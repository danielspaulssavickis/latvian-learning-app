import { useState } from 'react'
import type { FormKey, Lexeme, Sentence } from '../content/schemas'
import {
  alternatedForms,
  CASE_ORDER,
  declensionReference,
  hasNumber,
  paradigmOf,
  prepositionReference,
  pronounGroups,
  visibleParadigm,
  type FormCell,
  type GrammaticalNumber,
  type Paradigm,
} from '../engine/grammarReference'
import { featureLabel } from '../engine/labels'
import { segmentSentence } from '../engine/wordClasses'
import { AnnotatedSentence } from './AnnotatedSentence'
import { useApp } from './appContext'

/** What each case is for — English grammar prose; the Latvian examples come from approved sentences. */
const CASE_USES: Record<(typeof CASE_ORDER)[number], string> = {
  nom: 'The subject — who or what does something. The dictionary form.',
  gen: 'Of, belonging to; "none of"; after no, pie, bez, zem and other prepositions.',
  dat: 'To or for someone; the person who likes, has to, or feels (man patīk …).',
  acc: 'The direct object; after uz for direction ("to").',
  ins: 'With — in the singular only after ar.',
  loc: 'In, at, on — where something is, and when (ziemā).',
  voc: 'Calling someone by name. Mostly fixed forms; little used in the app.',
}

const NUMBERS: GrammaticalNumber[] = ['sg', 'pl']

/**
 * Grammar → Inflections: case uses, every noun declension with full tables,
 * consonant alternation, pronoun paradigms and preposition government — all
 * generated from content/grammar/ and the lexemes by `inflect()` — then a
 * box to look any word up on Tēzaurs.
 */
export function InflectionsScreen() {
  const { content, preview } = useApp()
  const sentences = [...content.sentenceById.values()]
  const declensions = declensionReference(sentences, content.lexemeById, content.grammar)
  const prepositions = prepositionReference(sentences, content.lexemeById)
  const alternations = content.grammar.alternations
  const showAlternations = alternations && (preview || alternations.review === 'approved')

  return (
    <section className="space-y-10">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Inflections</h2>
        <p className="text-slate-600 dark:text-slate-300">
          Latvian nouns and pronouns change their ending for <strong>case</strong> and{' '}
          <strong>number</strong>. Every form below is generated from the app&apos;s reviewed
          grammar tables — the same ones your cards are checked against.{' '}
          <a href="#tezaurs" className="text-emerald-700 underline dark:text-emerald-400">
            Look up any word on Tēzaurs ↓
          </a>
        </p>
        {preview && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Preview: unreviewed forms are shown in <em>italics</em>.
          </p>
        )}
      </div>

      <Section title="The seven cases">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1 pr-3 font-medium">Case</th>
                <th className="py-1 pr-3 font-medium">Used for</th>
                <th className="py-1 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {CASE_ORDER.map((grammaticalCase) => {
                const example = caseExample(sentences, grammaticalCase)
                return (
                  <tr
                    key={grammaticalCase}
                    className="border-t border-slate-200 align-top dark:border-slate-700"
                  >
                    <th scope="row" className="py-2 pr-3 font-medium capitalize">
                      {featureLabel(`case:${grammaticalCase}`)}
                    </th>
                    <td className="py-2 pr-3">{CASE_USES[grammaticalCase]}</td>
                    <td className="py-2">
                      {example ? (
                        <SentenceExample
                          sentence={example.sentence}
                          tokenIndex={example.tokenIndex}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Nouns: the six declensions">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A noun&apos;s declension decides its endings; you can usually tell it from the dictionary
          form&apos;s ending and gender. Highlighted forms change the last consonant of the stem
          (see{' '}
          <a href="#alternation" className="underline">
            consonant alternation
          </a>
          ). A dash means the app has no reviewed form for that slot.
        </p>
        {declensions.map(({ table, examples }) => (
          <div key={table.id} className="space-y-3">
            <h4 className="font-semibold">
              Declension {table.declension}
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {' '}
                ·{' '}
                {table.gender === 'f'
                  ? 'feminine'
                  : table.gender === 'm'
                    ? 'masculine'
                    : 'any gender'}{' '}
                · dictionary form ends in{' '}
                <span lang="lv">{table.lemmaEndings.map((e) => `-${e}`).join(', ')}</span>
              </span>
            </h4>
            {examples.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No example noun in the current material yet.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {examples.map(({ lexeme, paradigm }) => (
                  <ParadigmTable
                    key={lexeme.id}
                    caption={
                      <>
                        <span lang="lv">{lexeme.lemma}</span>{' '}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          “{lexeme.gloss[0]}”
                        </span>
                      </>
                    }
                    columns={NUMBERS.map((number) => ({
                      label: featureLabel(`number:${number}`),
                      number,
                    }))}
                    paradigm={visibleParadigm(paradigm, preview)}
                    highlighted={alternatedForms(lexeme, content.grammar)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </Section>

      {showAlternations && (
        <Section title="Consonant alternation" id="alternation">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            In some forms the last consonant of the stem softens before the ending (brālis → brāļa,
            egle → egļu). It only happens in these declensions and forms:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {alternations.appliesTo.map((entry) => (
              <li key={entry.declension}>
                <strong>Declension {entry.declension}:</strong>{' '}
                {entry.forms
                  .map((key) => {
                    const [grammaticalCase, number] = key.split('.')
                    return `${featureLabel(`case:${grammaticalCase}`)} ${featureLabel(`number:${number}`)}`
                  })
                  .join(', ')}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-300">The changes:</p>
          <ul className="flex flex-wrap gap-2 text-sm" lang="lv">
            {alternations.rules
              .filter((rule) => rule.from !== rule.to)
              .map((rule) => (
                <li
                  key={rule.from}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  {rule.from} → {rule.to}
                </li>
              ))}
          </ul>
          {alternations.rules.some((rule) => rule.from === rule.to) && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Never changes:{' '}
              <span lang="lv">
                {alternations.rules
                  .filter((rule) => rule.from === rule.to)
                  .map((rule) => rule.from)
                  .join(', ')}
              </span>
              .
            </p>
          )}
        </Section>
      )}

      <PronounTables preview={preview} />

      {prepositions.length > 0 && (
        <Section title="Which case after which preposition">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            A preposition decides the case of the word after it. From your sentences:
          </p>
          <ul className="space-y-3">
            {prepositions.map(({ preposition, uses }) => (
              <li key={preposition.id} className="text-sm">
                <strong lang="lv">{preposition.lemma}</strong>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  “{preposition.gloss.join(', ')}”
                </span>
                <ul className="mt-1 space-y-1 pl-4">
                  {uses.map((use) => (
                    <li key={`${use.case}.${use.number}`}>
                      + {featureLabel(`case:${use.case}`)}
                      {use.number === 'pl' ? ' (plural)' : ''}:{' '}
                      <SentenceExample sentence={use.sentence} tokenIndex={use.tokenIndex} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Verbs and adjectives">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Not in the app yet: it can&apos;t generate verb forms (three conjugations, tenses, the jā-
          debitive) or adjective forms (definite and indefinite) from reviewed tables, so it
          doesn&apos;t show them rather than show unchecked ones. Use Tēzaurs below for any verb or
          adjective.
        </p>
      </Section>

      <TezaursLookup />
    </section>
  )
}

function Section({
  title,
  id,
  children,
}: {
  title: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <div id={id} className="scroll-mt-4 space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  )
}

/** The first approved sentence (by id) with a drillable word in this case. */
function caseExample(sentences: readonly Sentence[], grammaticalCase: string) {
  for (const sentence of [...sentences].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const tokenIndex = sentence.tokens.findIndex(
      (token) => token.drillable && token.features.case === grammaticalCase,
    )
    if (tokenIndex >= 0) return { sentence, tokenIndex }
  }
  return null
}

function SentenceExample({ sentence, tokenIndex }: { sentence: Sentence; tokenIndex: number }) {
  const { content } = useApp()
  return (
    <span>
      <AnnotatedSentence
        words={segmentSentence(sentence, content.lexemeById)}
        showClasses={false}
        renderToken={(index) =>
          index === tokenIndex ? (
            <strong className="border-b-2 border-emerald-500">
              {sentence.tokens[index].surface}
            </strong>
          ) : undefined
        }
      />{' '}
      <span className="text-slate-500 dark:text-slate-400">— {sentence.gloss}</span>
    </span>
  )
}

interface Column {
  label: React.ReactNode
  number: GrammaticalNumber
  /** Which paradigm the column reads; defaults to the table's own. */
  paradigm?: Paradigm
}

function ParadigmTable({
  caption,
  columns,
  paradigm,
  highlighted = new Set<FormKey>(),
  cases = CASE_ORDER,
}: {
  caption?: React.ReactNode
  columns: Column[]
  paradigm?: Paradigm
  highlighted?: Set<FormKey>
  cases?: readonly (typeof CASE_ORDER)[number][]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full text-left text-sm">
        {caption && <caption className="px-3 pt-2 text-left font-semibold">{caption}</caption>}
        <thead className="text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-3 py-1.5 font-medium">Case</th>
            {columns.map((column, index) => (
              <th key={index} className="px-3 py-1.5 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((grammaticalCase) => (
            <tr key={grammaticalCase} className="border-t border-slate-100 dark:border-slate-700">
              <th scope="row" className="px-3 py-1 font-normal text-slate-500 dark:text-slate-400">
                {featureLabel(`case:${grammaticalCase}`)}
              </th>
              {columns.map((column, index) => {
                const key: FormKey = `${grammaticalCase}.${column.number}`
                const cell = (column.paradigm ?? paradigm)?.[key] ?? null
                return (
                  <td key={index} className="px-3 py-1">
                    <Form cell={cell} highlighted={highlighted.has(key)} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Form({ cell, highlighted }: { cell: FormCell | null; highlighted: boolean }) {
  if (!cell) return <span className="text-slate-400">—</span>
  const draft = cell.confidence !== 'verified'
  return (
    <span
      lang="lv"
      className={`${highlighted ? 'rounded bg-amber-100 px-1 dark:bg-amber-500/20' : ''} ${draft ? 'italic text-amber-700 dark:text-amber-400' : ''}`}
      title={draft ? 'Not reviewed yet' : undefined}
    >
      {cell.form}
    </span>
  )
}

/** Personal pronouns side by side (singular, then plural), then any other pronoun with a paradigm. */
function PronounTables({ preview }: { preview: boolean }) {
  const { content } = useApp()
  const groups = pronounGroups(content.lexemeById, preview)
  const withParadigm = (lexemes: Lexeme[]) =>
    lexemes
      .map((lexeme) => ({
        lexeme,
        paradigm: visibleParadigm(paradigmOf(lexeme, content.grammar), preview),
      }))
      .filter(({ paradigm }) => hasNumber(paradigm, 'sg') || hasNumber(paradigm, 'pl'))

  const personal = withParadigm(groups.find((g) => g.id === 'personal')?.pronouns ?? [])
  // One table per number, so each fits a phone screen (4 columns, not 8).
  const personalTables = NUMBERS.map((number) => ({
    number,
    columns: personal
      .filter(({ paradigm }) => hasNumber(paradigm, number))
      // Plural in person order: mēs, jūs (plural-only) before viņi, viņas.
      .sort((a, b) =>
        number === 'pl'
          ? Number(hasNumber(a.paradigm, 'sg')) - Number(hasNumber(b.paradigm, 'sg'))
          : 0,
      )
      .map(({ paradigm }): Column => ({
        number,
        paradigm,
        label: <span lang="lv">{paradigm[`nom.${number}`]?.form ?? '—'}</span>,
      })),
  })).filter((table) => table.columns.length > 0)
  const seen = new Set(personal.map(({ lexeme }) => lexeme.id))
  const others = withParadigm(
    groups
      .filter((g) => g.id !== 'personal')
      .flatMap((g) => g.pronouns)
      .filter((lexeme) => !seen.has(lexeme.id) && (seen.add(lexeme.id), true)),
  )
  if (personalTables.length === 0 && others.length === 0) return null

  const noVocative = CASE_ORDER.filter((c) => c !== 'voc')
  return (
    <Section title="Pronouns" id="pronouns">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Pronouns have their own forms that follow no table, so they are learned by heart. After{' '}
        <span lang="lv">ar</span> the instrumental looks like the accusative in the singular and the
        dative in the plural.
      </p>
      {personalTables.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {personalTables.map(({ number, columns }) => (
            <ParadigmTable
              key={number}
              caption={`Personal pronouns, ${featureLabel(`number:${number}`)}`}
              columns={columns}
              cases={noVocative}
            />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {others.map(({ lexeme, paradigm }) => (
            <ParadigmTable
              key={lexeme.id}
              caption={
                <>
                  <span lang="lv">{lexeme.lemma}</span>{' '}
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    “{lexeme.gloss[0]}”
                  </span>
                </>
              }
              columns={NUMBERS.filter((number) => hasNumber(paradigm, number)).map((number) => ({
                number,
                label: featureLabel(`number:${number}`),
              }))}
              paradigm={paradigm}
              cases={noVocative}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

/** Opens the word's Tēzaurs entry in a new tab; the app itself never reads Tēzaurs. */
function TezaursLookup() {
  const [word, setWord] = useState('')
  const [offline, setOffline] = useState(false)
  return (
    <form
      id="tezaurs"
      className="scroll-mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = word.trim().normalize('NFC')
        if (!trimmed) return
        if (!navigator.onLine) {
          setOffline(true)
          return
        }
        setOffline(false)
        window.open(`https://tezaurs.lv/${encodeURIComponent(trimmed)}`, '_blank', 'noopener')
      }}
    >
      <h3 className="text-lg font-semibold">Check a word on Tēzaurs</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Tēzaurs.lv is the largest Latvian dictionary; its entries show every form of a word, verbs
        and adjectives included. Opens in a new tab. Works best with the dictionary form (
        <span lang="lv">māja</span>, not <span lang="lv">mājā</span>).
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Word to check on Tēzaurs"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          lang="lv"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="e.g. strādāt"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={word.trim() === ''}
          className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          Check
        </button>
      </div>
      {offline && (
        <p role="status" className="text-sm text-rose-700 dark:text-rose-400">
          You&apos;re offline — Tēzaurs needs an internet connection.
        </p>
      )}
    </form>
  )
}
