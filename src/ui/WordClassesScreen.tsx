import type { Lexeme } from '../content/schemas'
import { draftPronounCount, paradigmOf, pronounGroups } from '../engine/grammarReference'
import { featureLabel } from '../engine/labels'
import { examplesFor, segmentSentence, WORD_CLASSES } from '../engine/wordClasses'
import { AnnotatedSentence } from './AnnotatedSentence'
import { POS_STYLE } from './posStyle'
import { useApp } from './appContext'

/**
 * Grammar → Word classes: every Latvian part of speech (vārdšķira) with what
 * it is, what to watch for, and examples taken from the approved sentences —
 * the same words the cards' "Aa" legend marks. Under Pronoun, the full list
 * of pronouns by type.
 */
export function WordClassesScreen({ onShowPronounTables }: { onShowPronounTables: () => void }) {
  const { content } = useApp()
  const sentences = [...content.sentenceById.values()]

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Word classes</h2>
        <p className="text-slate-600 dark:text-slate-300">
          The ten parts of speech (<span lang="lv">vārdšķiras</span>) of Latvian. On any card, the{' '}
          <span className="rounded border border-slate-300 px-1 text-xs font-medium dark:border-slate-600">
            Aa
          </span>{' '}
          button marks each word of the sentence with its class in these colours.
        </p>
      </div>

      <ul className="space-y-6">
        {WORD_CLASSES.map((wordClass) => {
          const examples = examplesFor(wordClass.pos, sentences, content.lexemeById)
          const style = POS_STYLE[wordClass.pos]
          return (
            <li
              key={wordClass.pos}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <h3 className="flex items-baseline gap-2 text-lg font-semibold">
                <span
                  aria-hidden="true"
                  className={`inline-block h-3 w-3 rounded-sm ${style.chip}`}
                />
                <span className="capitalize">{wordClass.english}</span>{' '}
                <span
                  className="text-base font-normal text-slate-500 dark:text-slate-400"
                  lang="lv"
                >
                  {wordClass.latvian}
                </span>
              </h3>
              <p className="mt-2 text-slate-700 dark:text-slate-200">{wordClass.description}</p>
              {examples.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {examples.map(({ sentence, tokenIndex, lexeme }) => {
                    const token = sentence.tokens[tokenIndex]
                    const features = Object.entries(token.features)
                      .filter(([key]) => key !== 'number' || token.features.case)
                      .map(([key, value]) => featureLabel(`${key}:${value}`))
                    return (
                      <li key={sentence.id} className="text-sm">
                        <AnnotatedSentence
                          words={segmentSentence(sentence, content.lexemeById)}
                          showClasses={false}
                          renderToken={(index) =>
                            index === tokenIndex ? (
                              <strong className={`border-b-2 ${style.line}`}>
                                {token.surface}
                              </strong>
                            ) : undefined
                          }
                          className="text-base"
                        />
                        <span className="text-slate-500 dark:text-slate-400">
                          {' '}
                          — {sentence.gloss} · <span lang="lv">{lexeme.lemma}</span> “
                          {lexeme.gloss[0]}”{features.length > 0 && `, ${features.join(' ')}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  No example in the current material yet.
                </p>
              )}
              {wordClass.pos === 'pronoun' && <PronounList onShowTables={onShowPronounTables} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Every pronoun the content has, by type; drafts only in the preview build, marked. */
function PronounList({ onShowTables }: { onShowTables: () => void }) {
  const { content, preview } = useApp()
  const groups = pronounGroups(content.lexemeById, preview)
  const waiting = preview ? 0 : draftPronounCount(content.lexemeById)
  if (groups.length === 0) return null

  // his / her / our / your / their: the genitive of the personal pronoun, read from the paradigms.
  const genitive = (id: string, key: 'gen.sg' | 'gen.pl') => {
    const lexeme = content.lexemeById.get(id)
    if (!lexeme || (!preview && lexeme.review !== 'approved')) return null
    const cell = paradigmOf(lexeme, content.grammar)[key]
    return cell ? { form: cell.form, meaning: possessiveMeaning(lexeme, key) } : null
  }
  const genitives = [
    genitive('lex_vins', 'gen.sg'),
    genitive('lex_vina', 'gen.sg'),
    genitive('lex_mes', 'gen.pl'),
    genitive('lex_jus', 'gen.pl'),
    genitive('lex_vins', 'gen.pl'),
  ].filter((g) => g !== null)

  return (
    <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold">All pronouns</h4>
        <button
          type="button"
          onClick={onShowTables}
          className="text-sm text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          Case tables → Inflections
        </button>
      </div>
      {groups.map((group) => (
        <div key={group.id}>
          <h5 className="text-sm font-semibold">{group.label}</h5>
          <p className="text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {group.pronouns.map((lexeme) => (
              <li key={lexeme.id} className="text-sm">
                <PronounName lexeme={lexeme} />{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  — {lexeme.gloss.join('; ')}
                </span>
              </li>
            ))}
          </ul>
          {group.id === 'possessive' && genitives.length > 0 && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              His, her, our, your (plural) and their use the genitive of the personal pronoun, which
              never changes:{' '}
              {genitives.map((g, index) => (
                <span key={index}>
                  {index > 0 && ', '}
                  <strong lang="lv">{g.form}</strong> ({g.meaning})
                </span>
              ))}
              .
            </p>
          )}
        </div>
      ))}
      {waiting > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {waiting} more pronoun{waiting === 1 ? ' is' : 's are'} drafted and waiting for review.
        </p>
      )}
    </div>
  )
}

function PronounName({ lexeme }: { lexeme: Lexeme }) {
  const draft = lexeme.review !== 'approved'
  return (
    <span lang="lv" className="font-medium">
      {lexeme.lemma}
      {lexeme.feminine && <span className="font-normal"> / {lexeme.feminine}</span>}
      {draft && (
        <span
          lang="en"
          className="ml-1 rounded bg-amber-100 px-1 text-xs font-normal text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        >
          draft
        </span>
      )}
    </span>
  )
}

const POSSESSIVE_MEANING: Record<string, string> = {
  'lex_vins gen.sg': 'his',
  'lex_vina gen.sg': 'her',
  'lex_mes gen.pl': 'our',
  'lex_jus gen.pl': 'your, plural',
  'lex_vins gen.pl': 'their',
}

function possessiveMeaning(lexeme: Lexeme, key: string): string {
  return POSSESSIVE_MEANING[`${lexeme.id} ${key}`] ?? ''
}
