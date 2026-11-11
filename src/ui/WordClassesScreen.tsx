import { featureLabel } from '../engine/labels'
import { examplesFor, segmentSentence, WORD_CLASSES } from '../engine/wordClasses'
import { AnnotatedSentence } from './AnnotatedSentence'
import { POS_STYLE } from './posStyle'
import { useApp } from './appContext'

/**
 * The Grammar tab: every Latvian part of speech (vārdšķira) with what it is,
 * what to watch for, and examples taken from the approved sentences — the
 * same words the cards' "Aa" legend marks.
 */
export function WordClassesScreen() {
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
            </li>
          )
        })}
      </ul>
    </section>
  )
}
