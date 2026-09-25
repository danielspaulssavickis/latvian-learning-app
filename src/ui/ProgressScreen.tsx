import { featureLabel } from '../engine/labels'
import { cardStats, isSkill } from '../engine/progress'
import { featureRetention, RETENTION_WINDOW, type FeatureRetention } from '../engine/retention'
import { startOfLocalDay } from '../engine/session'
import { useApp } from './appContext'
import { useLiveQuery } from './useLiveQuery'

const HIDDEN_FEATURES = new Set(['number:sg'])

/**
 * The dashboard (M4): headline counts, then per-feature retention over the
 * trailing 30 reviews, worst first. Each list is a real <table> — it is its
 * own accessible table view — with a single-hue bar per row.
 */
export function ProgressScreen() {
  const { db, clock } = useApp()
  const data = useLiveQuery(async () => {
    const now = clock()
    const [cards, reviews] = await Promise.all([db.cards.toArray(), db.reviews.toArray()])
    const today = startOfLocalDay(now).getTime()
    return {
      stats: cardStats(cards, now),
      reviewsToday: reviews.filter((r) => r.reviewedAt.getTime() >= today).length,
      retention: featureRetention(reviews),
    }
  }, [db, clock])

  if (!data) return <p className="text-slate-500">Loading…</p>

  // Singular is the unmarked default on nearly every card — tracking it is noise.
  const grammar = data.retention.filter(
    (row) => !isSkill(row.feature) && !HIDDEN_FEATURES.has(row.feature),
  )
  const skills = data.retention.filter((row) => isSkill(row.feature))

  return (
    <section className="space-y-8">
      <h2 className="text-2xl font-semibold">Progress</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Cards seen" value={`${data.stats.seen}`} detail={`of ${data.stats.total}`} />
        <Tile label="Due now" value={`${data.stats.dueNow}`} />
        <Tile label="Reviews today" value={`${data.reviewsToday}`} />
        <Tile label="Features tracked" value={`${grammar.length}`} />
      </dl>

      {data.retention.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-300">
          No reviews yet. Weak spots show up here after your first session.
        </p>
      ) : (
        <>
          <RetentionTable
            caption="Grammar, weakest first"
            rows={grammar}
            note={`Share of the last ${RETENTION_WINDOW} answers per feature that were right or a near miss.`}
          />
          {skills.length > 0 && <RetentionTable caption="Exercise types" rows={skills} />}
        </>
      )}
    </section>
  )
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md bg-white p-3 shadow-sm dark:bg-slate-800">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">
        {value}
        {detail && (
          <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">
            {detail}
          </span>
        )}
      </dd>
    </div>
  )
}

function RetentionTable({
  caption,
  rows,
  note,
}: {
  caption: string
  rows: FeatureRetention[]
  note?: string
}) {
  return (
    <div>
      <table className="w-full border-separate border-spacing-y-1 text-sm">
        <caption className="mb-1 text-left">
          <span className="font-medium">{caption}</span>
          {note && <span className="block text-xs text-slate-500 dark:text-slate-400">{note}</span>}
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Retention</th>
            <th scope="col">Answers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const percent = Math.round(row.retention * 100)
            const detail = `${row.retained} of ${row.count} retained${
              row.wrongStreak > 1 ? `, ${row.wrongStreak} wrong in a row` : ''
            }${row.lowData ? ' — too few answers to judge yet' : ''}`
            return (
              <tr key={row.feature} title={detail} className="group">
                <th
                  scope="row"
                  className="w-2/5 rounded-l-md bg-white py-2 pl-3 text-left font-normal group-hover:bg-slate-100 dark:bg-slate-800 dark:group-hover:bg-slate-700"
                >
                  {featureLabel(row.feature)}
                  {row.wrongStreak >= 3 && (
                    <span className="block text-xs font-medium text-rose-700 dark:text-rose-400">
                      ▲ {row.wrongStreak} wrong in a row
                    </span>
                  )}
                </th>
                <td className="bg-white px-3 group-hover:bg-slate-100 dark:bg-slate-800 dark:group-hover:bg-slate-700">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                      role="presentation"
                    >
                      <div
                        className="h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                        style={{ width: `${Math.max(percent, 1)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums">{percent}%</span>
                  </div>
                </td>
                <td
                  className={`rounded-r-md bg-white pr-3 text-right tabular-nums group-hover:bg-slate-100 dark:bg-slate-800 dark:group-hover:bg-slate-700 ${
                    row.lowData ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  n={row.count}
                  {row.lowData && <span className="sr-only"> (too few to judge)</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
