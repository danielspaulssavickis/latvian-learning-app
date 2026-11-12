# Adding voice recordings

How to get your recordings into the app. Today a sentence with a recording
gets a **listen** card (hear it, type the Latvian), and a play button
appears after you answer that sentence's other cards (all but *give the
form*, which has no sentence). The planned
voice-note exercises in [`PLAN.md`](PLAN.md) §3–4 will use the same files,
so nothing here has to be redone later.

## In short

1. Record one sentence per file, saying **exactly** the sentence's `text`.
2. Convert it to a small MP3 (below).
3. Put it in `public/audio/` and name it after the sentence: `snt_0001.mp3`.
4. Add `"audio": "audio/snt_0001.mp3"` to `content/sentences/snt_0001.json`.
5. `npm run content:check`, try it with `npm run dev`, commit, deploy.

## 1. Record

- **One sentence per file.** The file *is* the sentence: the transcript the
  app shows is the sentence's `text`, so say exactly that — same words, same
  order, no extra "um", no alternative word order. If you'd naturally say it
  differently, change the sentence text first, or record the version that
  matches it.
- **Natural speed.** Clear, but the way you'd actually say it to someone.
  Learners need to hear real Latvian, not dictation.
- **Quiet room, soft furnishings.** A wardrobe or a room with curtains beats a
  bare kitchen. Turn off fans and the fridge if you can hear it.
- **Phone is fine.** Hold it 15–20 cm from your mouth, slightly to the side
  so "p" and "b" don't pop. Use a voice-memo app that records in the best
  quality it offers (WAV or high-bitrate M4A). Don't record over a call app.
- **Leave half a second of silence** before and after; it gets trimmed
  automatically below.
- **Whose voice:** yours, or a native speaker who has said yes to their
  recordings being published on a public website. No generated (TTS) voices
  until their licence has been checked (ADR-005).

Recording all 50 current sentences in one sitting keeps the sound
consistent; read them off the list in `docs/ROADMAP.md` or
`content/sentences/`.

## 2. Compress

Speech needs far less than music. The target:

| Setting | Value | Why |
|---|---|---|
| Format | **MP3** | Plays everywhere: iPhone, Android, every browser. (Opus is smaller, but older iPhones can't play it.) |
| Channels | **mono** | A voice has nothing in stereo; halves the size. |
| Bitrate | **48 kbps** (constant) | Clear speech, no audible artefacts. 64 kbps if a voice sounds harsh; never above. |
| Sample rate | **44.1 kHz** | MP3 encoders are tuned for it. Lowering it saves almost nothing at 48 kbps. |
| Loudness | **−16 LUFS**, peaks ≤ −1.5 dB | Every clip equally loud, so the learner never touches the volume. |
| Silence | trimmed to ~0.1 s each end | Plays the moment you press Play. |

That's **6 KB per second of audio**: a 3-second sentence ≈ 18 KB, all 50
sentences ≈ 1 MB. A raw phone recording of the same sentence is 300–500 KB.

### With ffmpeg (recommended, one command does everything)

Install ffmpeg once: Windows `winget install Gyan.FFmpeg`, macOS
`brew install ffmpeg`.

One file:

```bash
ffmpeg -i snt_0001.m4a -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11" -ac 1 -ar 44100 -c:a libmp3lame -b:a 48k public/audio/snt_0001.mp3
```

What the filter does, left to right: trim silence at the start, flip the
clip and trim the end, flip back, cut rumble below 80 Hz (traffic, handling
noise), even out the loudness.

A whole folder of recordings at once, if each recording is already named
after its sentence (`snt_0001.m4a`, `snt_0002.m4a`, …) in a folder called
`recordings`:

PowerShell (Windows):

```powershell
$af = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11"
Get-ChildItem recordings -File | ForEach-Object {
  ffmpeg -y -i $_.FullName -af $af -ac 1 -ar 44100 -c:a libmp3lame -b:a 48k "public/audio/$($_.BaseName).mp3"
}
```

bash (macOS / Linux / Git Bash):

```bash
af="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11"
for f in recordings/*; do
  ffmpeg -y -i "$f" -af "$af" -ac 1 -ar 44100 -c:a libmp3lame -b:a 48k "public/audio/$(basename "${f%.*}").mp3"
done
```

If a word at the very start or end gets clipped (a soft "h" or "s"), change
`-45dB` to `-55dB` in both places and run it again for that file.

### With Audacity (no command line)

1. Open the recording. **Tracks → Mix → Mix Stereo Down to Mono** (if it's stereo).
2. Select the silence at the start, Delete; same at the end (leave a sliver).
3. **Effect → Volume and Compression → Loudness Normalization** → perceived
   loudness, −16 LUFS.
4. **File → Export Audio** → MP3, Channels: Mono, Bit Rate Mode: Constant,
   Quality: 48 kbps. Save as `public/audio/snt_0001.mp3`.

## 3. Put it in the app

- Files go in **`public/audio/`** (create the folder the first time). Name
  each one after its sentence id, lower case: `snt_0001.mp3`.
- Point the sentence at it. In `content/sentences/snt_0001.json` add one line
  (anywhere at the top level; next to `text` is tidy):

  ```json
  "text": "Es dzīvoju Rīgā.",
  "audio": "audio/snt_0001.mp3",
  ```

  The path is relative to `public/`, with no leading slash.
- Editing an approved sentence like this is fine; nothing about the Latvian
  changes, so it doesn't need re-approving.

## 4. Check it

```bash
npm run content:check   # warns "audio file public/audio/… does not exist" on a typo
npm run dev             # open the app, Settings → untick "One new card per sentence per day"
                        # to reach the listen card quickly
```

On the next start the app adds a **listen** card for every sentence with a
recording. Your existing progress is kept.

A missing or broken file never breaks a session: the card says
"Audio unavailable" and falls back to the English prompt.

## 5. Publish

Commit the MP3s and the sentence files, merge to `main`, run the deploy
workflow as usual. On phones, reopen the installed app once to get the new
files.

**Size note:** the installed app currently downloads every file, recordings
included, on install and after each update (see PLAN.md, "Before
recordings go in at scale"). Fine for the first 50 sentences (~1 MB);
that needs changing before there are hundreds.
