import { describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_10, SNT_3, SNT_5 } from './__fixtures__/sentences'
import { generateAllCards, generateCards } from './cards'
import { buildGrammar } from './inflect'
import { grammarFileSchema } from '../content/schemas'
import { buildExercise, confusablesFor, splitAroundToken } from './exercise'

const sentenceById = new Map([SNT_1, SNT_3].map((s) => [s.id, s]))
const content = { sentenceById, lexemeById: FIXTURE_LEXEMES }
const SNT_1_WORDS = [
  { text: 'Es', tokenIndex: 0, pos: 'pronoun' },
  { text: ' ', tokenIndex: null },
  { text: 'dzīvoju', tokenIndex: 1, pos: 'verb' },
  { text: ' ', tokenIndex: null },
  { text: 'Rīgā', tokenIndex: 2, pos: 'noun' },
  { text: '.', tokenIndex: null },
]

describe('splitAroundToken', () => {
  it('splits the sentence text around the token, keeping punctuation', () => {
    expect(splitAroundToken(SNT_1, 2)).toEqual({ before: 'Es dzīvoju ', after: '.' })
    expect(splitAroundToken(SNT_3, 0)).toEqual({ before: '', after: ' ir divi bērni.' })
  })

  it('finds the right occurrence when a surface form repeats', () => {
    const sentence = {
      ...SNT_1,
      text: 'Es un es.',
      tokens: [
        { surface: 'Es', lexeme: 'lex_es', features: {} },
        { surface: 'un', lexeme: 'lex_es', features: {} },
        { surface: 'es', lexeme: 'lex_es', features: {}, drillable: true },
      ],
    }
    expect(splitAroundToken(sentence, 2)).toEqual({ before: 'Es un ', after: '.' })
  })

  it('throws when the tokens do not match the text', () => {
    const sentence = { ...SNT_1, text: 'Something else.' }
    expect(() => splitAroundToken(sentence, 2)).toThrow(/snt_0001/)
  })
})

describe('buildExercise — cloze', () => {
  it('blanks the target token and shows its lemma', () => {
    const [card] = generateCards([SNT_1], FIXTURE_LEXEMES)
    expect(buildExercise(card, content)).toEqual({
      kind: 'cloze',
      check: 'word',
      cardId: 'cloze:snt_0001#2',
      feature: 'case:loc',
      before: 'Es dzīvoju ',
      after: '.',
      lemma: 'Rīga',
      gloss: 'I live in Riga.',
      expected: 'Rīgā',
      words: SNT_1_WORDS,
    })
  })

  it('returns null for a card whose sentence is gone', () => {
    const [card] = generateCards([SNT_1], FIXTURE_LEXEMES)
    expect(buildExercise(card, { sentenceById: new Map(), lexemeById: FIXTURE_LEXEMES })).toBeNull()
  })
})

describe('buildExercise — other kinds', () => {
  const lexemes = new Map(FIXTURE_LEXEMES)
  lexemes.set('lex_es', { ...FIXTURE_LEXEMES.get('lex_es')!, irregular: { 'dat.sg': 'man' } })
  const grammar = buildGrammar([])
  const extra = [SNT_5, SNT_10].map((s) => [s.id, s] as const)
  const all = { sentenceById: new Map([...sentenceById, ...extra]), lexemeById: lexemes, grammar }
  const cards = generateAllCards([...all.sentenceById.values()], lexemes, grammar)
  const card = (id: string) => cards.find((c) => c.id === id)!

  it('recognize: the sentence, its gloss among up to three others, in a stable order', () => {
    const exercise = buildExercise(card('recognize:snt_0001'), all)
    expect(exercise).toMatchObject({
      kind: 'recognize',
      check: 'choice',
      text: 'Es dzīvoju Rīgā.',
      expected: 'I live in Riga.',
    })
    if (exercise?.kind !== 'recognize') throw new Error('not recognize')
    expect(exercise.choices).toHaveLength(4)
    expect(exercise.choices).toContain('I live in Riga.')
    expect(new Set(exercise.choices).size).toBe(4)
    expect(buildExercise(card('recognize:snt_0001'), all)).toEqual(exercise)
  })

  it('translate: the sentence in, its gloss out, checked as English with the listed alternatives', () => {
    expect(buildExercise(card('translate:snt_0001'), all)).toEqual({
      kind: 'translate',
      check: 'english',
      cardId: 'translate:snt_0001',
      feature: 'skill:translate',
      text: 'Es dzīvoju Rīgā.',
      expected: 'I live in Riga.',
      alternatives: ['I am living in Riga.'],
      words: SNT_1_WORDS,
    })
    expect(buildExercise(card('translate:snt_0003'), all)).not.toHaveProperty('alternatives')
  })

  it("produce: carries the sentence's accepted Latvian alternatives", () => {
    const withAlternatives = {
      ...all,
      sentenceById: new Map([
        ...all.sentenceById,
        ['snt_0003', { ...SNT_3, alternatives: ['Divi bērni man ir.'] }],
      ]),
    }
    expect(buildExercise(card('produce:snt_0003'), withAlternatives)).toMatchObject({
      kind: 'produce',
      alternatives: ['Divi bērni man ir.'],
    })
  })

  it('produce: gloss in, whole sentence out', () => {
    expect(buildExercise(card('produce:snt_0003'), all)).toEqual({
      kind: 'produce',
      check: 'sentence',
      cardId: 'produce:snt_0003',
      feature: 'skill:produce',
      gloss: 'I have two children.',
      expected: 'Man ir divi bērni.',
      words: expect.arrayContaining([{ text: 'divi', tokenIndex: 2, pos: 'numeral' }]),
    })
  })

  it('listen: the audio file and the sentence as the answer; null once the audio is gone', () => {
    const withAudio = { ...SNT_1, audio: 'audio/snt_0001.mp3' }
    const content = { ...all, sentenceById: new Map([[withAudio.id, withAudio]]) }
    const [listen] = generateAllCards([withAudio], lexemes, grammar).filter(
      (c) => c.kind === 'listen',
    )
    expect(buildExercise(listen, content)).toEqual({
      kind: 'listen',
      check: 'sentence',
      cardId: 'listen:snt_0001',
      feature: 'skill:listen',
      audio: 'audio/snt_0001.mp3',
      gloss: 'I live in Riga.',
      expected: 'Es dzīvoju Rīgā.',
      words: SNT_1_WORDS,
    })
    expect(buildExercise(listen, all)).toBeNull()
  })

  it('hear: the audio file, four English choices, the transcript; null once the audio is gone', () => {
    const withAudio = { ...SNT_1, audio: 'audio/snt_0001.mp3' }
    const sentences = new Map([...all.sentenceById, [withAudio.id, withAudio]])
    const content = { ...all, sentenceById: sentences }
    const [hear] = generateAllCards([withAudio], lexemes, grammar).filter((c) => c.kind === 'hear')
    const exercise = buildExercise(hear, content)
    expect(exercise).toMatchObject({
      kind: 'hear',
      check: 'choice',
      cardId: 'hear:snt_0001',
      feature: 'skill:hear',
      audio: 'audio/snt_0001.mp3',
      text: 'Es dzīvoju Rīgā.',
      expected: 'I live in Riga.',
      words: SNT_1_WORDS,
    })
    if (exercise?.kind !== 'hear') throw new Error('not hear')
    expect(exercise.choices).toHaveLength(4)
    expect(exercise.choices).toContain('I live in Riga.')
    expect(buildExercise(hear, content)).toEqual(exercise) // stable order
    expect(buildExercise(hear, all)).toBeNull()
  })

  it('inflect: lemma and target form in, the generated form out', () => {
    expect(buildExercise(card('inflect:lex_es@dat.sg'), all)).toEqual({
      kind: 'inflect',
      check: 'word',
      cardId: 'inflect:lex_es@dat.sg',
      feature: 'case:dat',
      lemma: 'es',
      lemmaGloss: '(fixture)',
      formLabel: 'dative singular',
      expected: 'man',
    })
  })
})

describe('confusablesFor (ADR-014)', () => {
  const modules = import.meta.glob('../../content/grammar/*.json', { eager: true })
  const files = Object.values(modules).map((m) =>
    grammarFileSchema.parse((m as { default: unknown }).default),
  )
  const approved = buildGrammar(files.map((f) => ({ ...f, review: 'approved' as const })))
  const galds = {
    id: 'lex_galds',
    lemma: 'galds',
    pos: 'noun' as const,
    gender: 'm' as const,
    declension: 1 as const,
    conjugation: null,
    gloss: ['table'],
    tags: [],
    review: 'approved' as const,
  }

  it('finds the forms spelled like the answer apart from diacritics', () => {
    // galdā (loc.sg) vs galda (gen.sg); galdu (acc/ins sg, gen pl) has other letters.
    expect(confusablesFor(galds, 'galdā', approved)).toEqual([
      { form: 'galda', label: 'genitive singular' },
    ])
    expect(confusablesFor(galds, 'galda', approved)).toEqual([
      { form: 'galdā', label: 'locative singular' },
    ])
  })

  it('names every form a shared spelling stands for', () => {
    const maja = {
      ...galds,
      id: 'lex_maja',
      lemma: 'māja',
      gender: 'f' as const,
      declension: 4 as const,
    }
    expect(confusablesFor(maja, 'mājās', approved)).toEqual([
      {
        form: 'mājas',
        label: 'genitive singular / nominative plural / accusative plural / vocative plural',
      },
    ])
  })

  it('uses only verified forms — none while the tables or the lexeme are drafts', () => {
    const drafts = buildGrammar(files.map((f) => ({ ...f, review: 'draft' as const })))
    expect(confusablesFor(galds, 'galdā', drafts)).toEqual([])
    expect(confusablesFor({ ...galds, review: 'draft' }, 'galdā', approved)).toEqual([])
  })
})
