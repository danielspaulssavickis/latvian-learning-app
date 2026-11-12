#!/usr/bin/env python3
"""
Generates a recording for every approved sentence with Piper TTS (ADR-019).

    pip install piper-tts          # once; needs Python 3.9+ and ffmpeg on PATH
    npm run audio:generate         # = python3 scripts/generate-audio.py

What it does, in order:

1. Downloads the voice (default lv_LV-aivars-medium) into .tts/ (git-ignored)
   and its model card into docs/tts-voice-licence.md, then checks the card
   states a licence that allows commercial redistribution (CC0 / CC-BY /
   MIT / Apache). It stops otherwise — ADR-005: no TTS ships unchecked.
2. For each content/sentences/*.json without an MP3 yet (or all, --force):
   synthesizes the sentence's `text` exactly, compresses it with the
   settings from docs/AUDIO.md (MP3 mono 48 kbps, -16 LUFS, trimmed) to
   public/audio/<id>.mp3, and points the sentence's `audio` field at it.

Needs network access to huggingface.co (voice + model card) the first time.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SENTENCES = ROOT / "content" / "sentences"
AUDIO_DIR = ROOT / "public" / "audio"
LICENCE_FILE = ROOT / "docs" / "tts-voice-licence.md"
DATA_DIR = ROOT / ".tts"

# The compression from docs/AUDIO.md — keep the two in sync.
FFMPEG_FILTER = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,"
    "areverse,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11"
)

# Licences that allow free commercial use and redistribution of the output.
ALLOWED_LICENCES = re.compile(
    r"\b(CC0|CC[- ]BY(?![- ]NC)(?:[- ]4\.0|[- ]3\.0)?|Creative Commons Zero|"
    r"public domain|MIT|Apache[- ]2\.0)\b",
    re.IGNORECASE,
)
NON_COMMERCIAL = re.compile(r"\b(NC|non[- ]commercial|noncommercial)\b", re.IGNORECASE)


def model_card_urls(voice: str) -> list[str]:
    language = voice.split("_", 1)[0]
    locale_name, quality = voice.rsplit("-", 1)
    locale, name = locale_name.split("-", 1)
    return [
        f"https://huggingface.co/rhasspy/piper-voices/raw/main/{language}/{locale}/{name}/{quality}/MODEL_CARD",
    ]


def fetch(url: str) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.read().decode("utf-8")
    except Exception as error:  # noqa: BLE001 — reported, and the caller decides
        print(f"  could not fetch {url}: {error}", file=sys.stderr)
        return None


def check_licence(voice: str, accept_unverified: bool) -> None:
    cards = [(url, fetch(url)) for url in model_card_urls(voice)]
    found = [(url, text) for url, text in cards if text]
    if found:
        body = "\n\n".join(f"Source: {url}\n\n```\n{text.strip()}\n```" for url, text in found)
        LICENCE_FILE.write_text(
            f"# TTS voice licence: {voice}\n\n"
            f"Fetched {date.today().isoformat()} by scripts/generate-audio.py "
            f"(ADR-019). The audio in public/audio/ is generated with this voice.\n\n{body}\n",
            encoding="utf-8",
        )
        print(f"Model card saved to {LICENCE_FILE.relative_to(ROOT)}")
    text = "\n".join(t for _, t in found)
    licence_lines = [line for line in text.splitlines() if re.search(r"licen[cs]e", line, re.I)]
    for line in licence_lines:
        print(f"  licence: {line.strip()}")
    ok = any(ALLOWED_LICENCES.search(line) for line in licence_lines) and not any(
        NON_COMMERCIAL.search(line) for line in licence_lines
    )
    if ok:
        return
    if accept_unverified:
        print("WARNING: licence not confirmed from the model card; continuing (--accept-unverified-licence).")
        return
    sys.exit(
        "Stopped: the voice's model card does not state a licence that allows commercial "
        "redistribution (or could not be read). Read it yourself; if it is fine, rerun with "
        "--accept-unverified-licence."
    )


def ensure_voice(voice: str) -> Path:
    model = DATA_DIR / f"{voice}.onnx"
    if model.exists() and Path(f"{model}.json").exists():
        return model
    DATA_DIR.mkdir(exist_ok=True)
    print(f"Downloading voice {voice} …")
    subprocess.run(
        [sys.executable, "-m", "piper.download_voices", "--download-dir", str(DATA_DIR), voice],
        check=True,
    )
    if not model.exists():
        sys.exit(f"Voice download did not produce {model}")
    return model


def synthesize(piper: list[str], model: Path, text: str, wav: Path, length_scale: float) -> None:
    subprocess.run(
        [*piper, "-m", str(model), "-f", str(wav), "--length-scale", str(length_scale)],
        input=text.encode("utf-8"),
        check=True,
        capture_output=True,
    )


def compress(wav: Path, mp3: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", FFMPEG_FILTER,
         "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "48k", str(mp3)],
        check=True,
    )


def duration(mp3: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def set_audio_field(path: Path, data: dict, audio: str) -> None:
    if data.get("audio") == audio:
        return
    ordered: dict = {}
    for key, value in data.items():
        if key == "audio":
            continue
        ordered[key] = value
        if key == ("glossAlternatives" if "glossAlternatives" in data else
                   "alternatives" if "alternatives" in data else "gloss"):
            ordered["audio"] = audio
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--voice", default="lv_LV-aivars-medium")
    parser.add_argument("--length-scale", type=float, default=1.1,
                        help="above 1 = slower; 1.1 is a clear learner pace (default)")
    parser.add_argument("--force", action="store_true", help="regenerate files that already exist")
    parser.add_argument("--ids", nargs="*", help="only these sentence ids, e.g. snt_0001")
    parser.add_argument("--accept-unverified-licence", action="store_true")
    parser.add_argument("--piper", default=f"{sys.executable} -m piper",
                        help="the Piper command (default: this Python's piper module)")
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        sys.exit("ffmpeg (with ffprobe) is not on PATH — see docs/AUDIO.md for how to install it.")
    piper = args.piper.split()
    if piper[-2:] == ["-m", "piper"]:
        try:
            import piper as _  # noqa: F401
        except ImportError:
            sys.exit("Piper is not installed: pip install piper-tts")

    check_licence(args.voice, args.accept_unverified_licence)
    model = ensure_voice(args.voice)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    made, skipped = [], 0
    for path in sorted(SENTENCES.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        sentence_id = data["id"]
        if args.ids and sentence_id not in args.ids:
            continue
        mp3 = AUDIO_DIR / f"{sentence_id}.mp3"
        audio = f"audio/{sentence_id}.mp3"
        if mp3.exists() and not args.force:
            set_audio_field(path, data, audio)
            skipped += 1
            continue
        text = unicodedata.normalize("NFC", data["text"])
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "out.wav"
            synthesize(piper, model, text, wav, args.length_scale)
            compress(wav, mp3)
        seconds = duration(mp3)
        if not 0.4 <= seconds <= 15:
            sys.exit(f"{mp3.name}: suspicious duration {seconds:.2f}s — check the voice and the text")
        set_audio_field(path, data, audio)
        made.append((sentence_id, seconds, mp3.stat().st_size))
        print(f"  {sentence_id}  {seconds:4.1f}s  {mp3.stat().st_size / 1024:5.1f} KB  {text}")

    total = sum(size for _, _, size in made)
    print(f"Done: {len(made)} generated, {skipped} already there"
          + (f", {total / 1024:.0f} KB new audio." if made else "."))
    print("Next: npm run content:check, then try it with npm run dev.")


if __name__ == "__main__":
    main()
