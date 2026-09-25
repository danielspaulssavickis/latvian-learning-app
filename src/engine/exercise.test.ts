import { describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_3 } from './__fixtures__/sentences'
import { generateCards } from './cards'
import { buildExercise, splitAroundToken } from './exercise'

const sentenceById = new Map([SNT_1, SNT_3].map((s) => [s.id, s]))
const content = { sentenceById, lexemeById: FIXTURE_LEXEMES }

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
      cardId: 'cloze:snt_0001#2',
      feature: 'case:loc',
      before: 'Es dzīvoju ',
      after: '.',
      lemma: 'Rīga',
      gloss: 'I live in Riga.',
      expected: 'Rīgā',
    })
  })

  it('returns null for a card whose sentence is gone', () => {
    const [card] = generateCards([SNT_1], FIXTURE_LEXEMES)
    expect(buildExercise(card, { sentenceById: new Map(), lexemeById: FIXTURE_LEXEMES })).toBeNull()
  })
})
