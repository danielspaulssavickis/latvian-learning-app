import type { LoadedContent } from '../../content/loader'
import type { Sentence } from '../../content/schemas'
import { FIXTURE_LEXEMES, SNT_1, SNT_3 } from '../../engine/__fixtures__/sentences'
import { buildGrammar } from '../../engine/inflect'

/** A LoadedContent built from the engine's fixture sentences, for UI tests. */
export function fixtureContent(sentences: Sentence[] = [SNT_1, SNT_3]): LoadedContent {
  return {
    lexemeById: FIXTURE_LEXEMES,
    sentenceById: new Map(sentences.map((s) => [s.id, s])),
    sentencesByLevel: new Map([['a1', sentences]]),
    sentencesByFeature: new Map(),
    grammar: buildGrammar([]),
  }
}
