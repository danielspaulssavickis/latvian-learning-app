import type { Lexeme, Sentence } from '../../content/schemas'

/**
 * Test-only sentences for card generation, shaped like content/drafts/
 * batch_001.json (which you reviewed). The lexemes are placeholders — only
 * `id`, `pos` and the declension/conjugation matter to these tests — and none
 * of this is content: it lives under __fixtures__/ (CLAUDE.md rule 1).
 */

function lexeme(
  id: string,
  lemma: string,
  pos: Lexeme['pos'],
  declension: Lexeme['declension'] = null,
  conjugation: Lexeme['conjugation'] = null,
): Lexeme {
  return { id, lemma, pos, gender: null, declension, conjugation, gloss: ['(fixture)'], tags: [] }
}

export const FIXTURE_LEXEMES = new Map(
  [
    lexeme('lex_es', 'es', 'pronoun'),
    lexeme('lex_dzivot', 'dzīvot', 'verb', null, 2),
    lexeme('lex_riga', 'Rīga', 'noun', 4),
    lexeme('lex_but', 'būt', 'verb'),
    lexeme('lex_divi', 'divi', 'numeral'),
    lexeme('lex_berns', 'bērns', 'noun', 1),
    lexeme('lex_sodien', 'šodien', 'adverb'),
    lexeme('lex_stradat', 'strādāt', 'verb', null, 2),
    lexeme('lex_darzs', 'dārzs', 'noun', 1),
    lexeme('lex_spelet', 'spēlēties', 'verb'),
  ].map((l) => [l.id, l]),
)

export const SNT_1: Sentence = {
  id: 'snt_0001',
  text: 'Es dzīvoju Rīgā.',
  gloss: 'I live in Riga.',
  level: 'a1',
  tokens: [
    { surface: 'Es', lexeme: 'lex_es', features: { case: 'nom', number: 'sg' } },
    {
      surface: 'dzīvoju',
      lexeme: 'lex_dzivot',
      features: { tense: 'pres', person: 1, number: 'sg' },
    },
    {
      surface: 'Rīgā',
      lexeme: 'lex_riga',
      features: { case: 'loc', number: 'sg' },
      drillable: true,
    },
  ],
}

/** Two drillable tokens → two cards from one sentence. */
export const SNT_3: Sentence = {
  id: 'snt_0003',
  text: 'Man ir divi bērni.',
  gloss: 'I have two children.',
  level: 'a1',
  tokens: [
    { surface: 'Man', lexeme: 'lex_es', features: { case: 'dat', number: 'sg' }, drillable: true },
    { surface: 'ir', lexeme: 'lex_but', features: { tense: 'pres', person: 3, number: 'sg' } },
    { surface: 'divi', lexeme: 'lex_divi', features: {} },
    {
      surface: 'bērni',
      lexeme: 'lex_berns',
      features: { case: 'nom', number: 'pl' },
      drillable: true,
    },
  ],
}

/** Debitive: mood outranks tense as the drilled feature. */
export const SNT_5: Sentence = {
  id: 'snt_0005',
  text: 'Man šodien jāstrādā.',
  gloss: 'I have to work today.',
  level: 'a1',
  tokens: [
    { surface: 'Man', lexeme: 'lex_es', features: { case: 'dat', number: 'sg' } },
    { surface: 'šodien', lexeme: 'lex_sodien', features: {} },
    {
      surface: 'jāstrādā',
      lexeme: 'lex_stradat',
      features: { mood: 'debitive', tense: 'pres' },
      drillable: true,
    },
  ],
}

export const SNT_10: Sentence = {
  id: 'snt_0010',
  text: 'Bērni spēlējas dārzā.',
  gloss: 'The children are playing in the garden.',
  level: 'a1',
  tokens: [
    { surface: 'Bērni', lexeme: 'lex_berns', features: { case: 'nom', number: 'pl' } },
    {
      surface: 'spēlējas',
      lexeme: 'lex_spelet',
      features: { tense: 'pres', person: 3, number: 'pl' },
    },
    {
      surface: 'dārzā',
      lexeme: 'lex_darzs',
      features: { case: 'loc', number: 'sg' },
      drillable: true,
    },
  ],
}
