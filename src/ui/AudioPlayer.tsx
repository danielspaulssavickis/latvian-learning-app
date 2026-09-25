import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Path relative to the site root, e.g. "audio/snt_0001.mp3" (served from public/). */
  src: string
  /** Try to play as soon as it's ready (browsers may refuse without a user gesture). */
  autoPlay?: boolean
  /** Called once if the file can't be loaded or played. */
  onUnavailable?: () => void
  label?: string
}

/**
 * A single play button for a sentence recording. A missing or broken file
 * never throws: the button disappears (or the caller swaps in a text
 * fallback via onUnavailable) — M5's "degrade to text-only".
 */
export function AudioPlayer({ src, autoPlay = false, onUnavailable, label = 'Play audio' }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const reported = useRef(false)

  function fail() {
    setFailed(true)
    if (!reported.current) {
      reported.current = true
      onUnavailable?.()
    }
  }

  function play() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    // Autoplay may be blocked; that's not a failure — the button still works.
    audio.play()?.catch(() => {})
  }

  useEffect(() => {
    if (autoPlay) play()
  }, [autoPlay])

  if (failed) return null
  return (
    <>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}${src}`}
        preload="auto"
        onError={fail}
        onPlay={() => setPlaying(true)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={play}
        aria-label={label}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        <span aria-hidden="true">{playing ? '◼' : '▶'}</span>
        {label}
      </button>
    </>
  )
}
