const CASES: Record<string, string> = {
  nom: 'nominative',
  gen: 'genitive',
  dat: 'dative',
  acc: 'accusative',
  ins: 'instrumental',
  loc: 'locative',
  voc: 'vocative',
}
const NUMBERS: Record<string, string> = { sg: 'singular', pl: 'plural' }
const TENSES: Record<string, string> = {
  pres: 'present tense',
  past: 'past tense',
  fut: 'future tense',
}
const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']
const SKILLS: Record<string, string> = {
  recognize: 'understanding (recognize)',
  hear: 'understanding by ear (hear)',
  translate: 'translating to English (translate)',
  produce: 'writing sentences (produce)',
  listen: 'listening',
}

/**
 * A feature key ("case:loc", "declension:4") as learner-facing English, using
 * the CEFR/linguistic names from CLAUDE.md rule 4. Unknown keys pass through.
 */
export function featureLabel(feature: string): string {
  const [key, value] = feature.split(':')
  switch (key) {
    case 'case':
      return CASES[value] ?? feature
    case 'number':
      return NUMBERS[value] ?? feature
    case 'tense':
      return TENSES[value] ?? feature
    case 'person':
      return `${ORDINALS[Number(value)] ?? value} person`
    case 'mood':
      return value === 'debitive' ? 'debitive (must / have to)' : `${value} mood`
    case 'declension':
      return `${ORDINALS[Number(value)] ?? value} declension`
    case 'conjugation':
      return `${ORDINALS[Number(value)] ?? value} conjugation`
    case 'gender':
      return value === 'm' ? 'masculine' : value === 'f' ? 'feminine' : feature
    case 'definiteness':
      return value === 'definite' || value === 'indefinite' ? value : feature
    case 'skill':
      return SKILLS[value] ?? value
    default:
      return feature
  }
}

/** "in 8 minutes", "at 14:05", "tomorrow at 09:30", "on 12 Nov" — when the next review is due. */
export function formatDueIn(due: Date, now: Date): string {
  const minutes = Math.ceil((due.getTime() - now.getTime()) / 60_000)
  if (minutes <= 1) return 'in a minute'
  if (minutes < 60) return `in ${minutes} minutes`
  const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
  const days = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  )
  if (days === 0) return `at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  const month = due.toLocaleString('en-GB', { month: 'short' })
  return `on ${due.getDate()} ${month}`
}
