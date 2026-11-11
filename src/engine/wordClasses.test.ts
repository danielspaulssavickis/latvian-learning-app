import { describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_3, SNT_5 } from './__fixtures__/sentences'
import { examplesFor, segmentSentence, WORD_CLASSES, wordClassOf } from './wordClasses'

describe('segmentSentence', () => {
  it('splits text into words with their class and the punctuation between', () => {
    expect(segmentSentence(SNT_1, FIXTURE_LEXEMES)).toEqual([
      { text: 'Es', tokenIndex: 0, pos: 'pronoun' },
      { text: ' ', tokenIndex: null },
      { text: 'dzīvoju', tokenIndex: 1, pos: 'verb' },
      { text: ' ', tokenIndex: null },
      { text: 'Rīgā', tokenIndex: 2, pos: 'noun' },
      { text: '.', tokenIndex: null },
    ])
  })

  it('leaves the class off a word whose lexeme is unknown and reassembles the text', () => {
    const words = segmentSentence(SNT_3, new Map())
    expect(words.every((w) => w.pos === undefined)).toBe(true)
    expect(words.map((w) => w.text).join('')).toBe(SNT_3.text)
  })

  it('throws when the tokens do not match the text', () => {
    expect(() => segmentSentence({ ...SNT_1, text: 'Other.' }, FIXTURE_LEXEMES)).toThrow(/snt_0001/)
  })
})

describe('word classes', () => {
  it('covers every part of speech once, with English and Latvian names', () => {
    expect(new Set(WORD_CLASSES.map((c) => c.pos)).size).toBe(10)
    expect(wordClassOf('adverb')).toMatchObject({ english: 'adverb', latvian: 'apstākļa vārds' })
  })

  it('picks examples from approved sentences, one per sentence and no word twice', () => {
    const examples = examplesFor('verb', [SNT_5, SNT_3, SNT_1], FIXTURE_LEXEMES)
    expect(examples.map((e) => [e.sentence.id, e.lexeme.id])).toEqual([
      ['snt_0001', 'lex_dzivot'],
      ['snt_0003', 'lex_but'],
      ['snt_0005', 'lex_stradat'],
    ])
    expect(examplesFor('interjection', [SNT_1], FIXTURE_LEXEMES)).toEqual([])
    expect(examplesFor('noun', [SNT_1, SNT_3], FIXTURE_LEXEMES, 1)).toHaveLength(1)
  })
})
