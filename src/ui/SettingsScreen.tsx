import { useState } from 'react'
import { resetProgress } from '../db/backup'
import { getSettings, updateSettings } from '../db/settings'
import { useApp } from './appContext'
import { BackupSection } from './BackupSection'
import { useLiveQuery } from './useLiveQuery'

export function SettingsScreen() {
  const { db, resync } = useApp()
  const settings = useLiveQuery(() => getSettings(db), [db])
  const [resetDone, setResetDone] = useState(false)
  // Lives here, not in the form: saving changes the settings, which remounts the form.
  const [saved, setSaved] = useState(false)
  if (!settings) return <p className="text-slate-500">Loading…</p>
  return (
    <section className="space-y-8">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <DailyLimitsForm
        key={`${settings.dailyLimits.newPerDay}/${settings.dailyLimits.reviewsPerDay}`}
        newPerDay={settings.dailyLimits.newPerDay}
        reviewsPerDay={settings.dailyLimits.reviewsPerDay}
        saved={saved}
        onEdit={() => setSaved(false)}
        onSave={async (dailyLimits) => {
          await updateSettings(db, { dailyLimits })
          setSaved(true)
        }}
      />
      <div className="space-y-3">
        <h3 className="font-medium">Pace</h3>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.burySiblings}
            onChange={(event) => void updateSettings(db, { burySiblings: event.target.checked })}
            className="mt-1 h-4 w-4 accent-emerald-700"
          />
          <span>
            <span className="font-medium">One new card per sentence per day</span>
            <span className="block text-slate-600 dark:text-slate-300">
              Recommended: a sentence's cards would otherwise give away each other's answers minutes
              apart. Turn off to see every exercise type right away.
            </span>
          </span>
        </label>
      </div>
      <BackupSection />
      <div className="space-y-3">
        <h3 className="font-medium">Start over</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Deletes all progress and settings in this browser — every card goes back to new. Export a
          backup first if you might want it back.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm('Delete ALL progress in this browser? This cannot be undone.'))
                return
              await resetProgress(db)
              await resync()
              setResetDone(true)
            }}
            className="rounded-md border border-rose-700 px-4 py-2 font-medium text-rose-800 hover:bg-rose-50 dark:border-rose-400 dark:text-rose-300 dark:hover:bg-rose-950"
          >
            Reset all progress
          </button>
          {resetDone && (
            <span role="status" className="text-sm text-emerald-700">
              Progress reset.
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

interface FormProps {
  newPerDay: number
  reviewsPerDay: number
  saved: boolean
  onEdit: () => void
  onSave: (limits: { newPerDay: number; reviewsPerDay: number }) => Promise<unknown>
}

function DailyLimitsForm(props: FormProps) {
  const [newPerDay, setNewPerDay] = useState(String(props.newPerDay))
  const [reviewsPerDay, setReviewsPerDay] = useState(String(props.reviewsPerDay))
  const { saved } = props
  const parsedNew = Number.parseInt(newPerDay, 10)
  const parsedReviews = Number.parseInt(reviewsPerDay, 10)
  const valid =
    Number.isInteger(parsedNew) &&
    parsedNew >= 0 &&
    Number.isInteger(parsedReviews) &&
    parsedReviews >= 0

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!valid) return
        await props.onSave({ newPerDay: parsedNew, reviewsPerDay: parsedReviews })
      }}
    >
      <h3 className="font-medium">Daily limits</h3>
      <div className="flex flex-wrap gap-4">
        <NumberField
          label="New cards per day"
          value={newPerDay}
          onChange={(v) => (props.onEdit(), setNewPerDay(v))}
        />
        <NumberField
          label="Reviews per day"
          value={reviewsPerDay}
          onChange={(v) => (props.onEdit(), setReviewsPerDay(v))}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid}
          className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300"
        >
          Save limits
        </button>
        {saved && (
          <span role="status" className="text-sm text-emerald-700">
            Saved.
          </span>
        )}
        {!valid && <span className="text-sm text-rose-700">Whole numbers, 0 or more.</span>}
      </div>
    </form>
  )
}

function NumberField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col text-sm">
      {props.label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-base dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
  )
}
