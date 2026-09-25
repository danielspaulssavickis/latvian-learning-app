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
    case 'skill':
      return SKILLS[value] ?? value
    default:
      return feature
  }
}
