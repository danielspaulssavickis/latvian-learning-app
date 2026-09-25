import { featureLabel } from '../engine/labels'
import type { SessionSummary as Summary } from '../engine/summary'

interface Props {
  summary: Summary
  onDone: () => void
}

export function SessionSummary({ summary, onDone }: Props) {
  const weak = summary.byFeature.filter((f) => f.wrong > 0 || f.nearMiss > 0).slice(0, 3)
  return (
    <section aria-labelledby="summary-heading" className="space-y-6">
      <h2 id="summary-heading" className="text-2xl font-semibold">
        Session done
      </h2>
      {summary.count === 0 ? (
        <p className="text-slate-600 dark:text-slate-300">Nothing was answered this time.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Cards" value={String(summary.count)} />
            <Stat label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} />
            <Stat label="Near misses" value={String(summary.nearMiss)} />
            <Stat label="Wrong" value={String(summary.wrong)} />
          </dl>
          <div>
            <h3 className="mb-2 font-medium">Weakest this session</h3>
            {weak.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-300">
                Nothing — every card right first time.
              </p>
            ) : (
              <ul className="space-y-1">
                {weak.map((f) => (
                  <li
                    key={f.feature}
                    className="flex justify-between rounded-md bg-white px-3 py-2 shadow-sm dark:bg-slate-800"
                  >
                    <span>{featureLabel(f.feature)}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {f.wrong} wrong, {f.nearMiss} near of {f.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <button
        type="button"
        autoFocus
        onClick={onDone}
        className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
      >
        Back to start
      </button>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-3 shadow-sm dark:bg-slate-800">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
