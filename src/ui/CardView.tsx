import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { checkOptionsFor, type Exercise } from '../engine/exercise'
import type { Answer } from '../engine/reviewSession'
import { AnswerInput } from './AnswerInput'
import { DiacriticRow } from './DiacriticRow'
import { Feedback } from './Feedback'

const RESULT_COLOR = {
  correct: 'text-emerald-700 dark:text-emerald-400',
  nearMiss: 'text-amber-600 dark:text-amber-400',
  wrong: 'text-rose-700 dark:text-rose-400',
} as const

interface Props {
  exercise: Exercise
  /** Set once the card has been answered (feedback phase). */
  answer: Answer | null
  onSubmit: (given: string) => void
  onNext: () => void
}

/**
 * One card, any kind. Keyboard flow: type, Enter checks, Enter again moves
 * on; recognize cards also take 1–4. Renders only — checking and grading
 * happen in the engine reducer the parent dispatches to.
 */
export function CardView({ exercise, answer, onSubmit, onNext }: Props) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    if (answer) nextRef.current?.focus()
    else inputRef.current?.focus()
  }, [answer])

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  })

  // Number keys pick a recognize choice.
  useEffect(() => {
    if (exercise.kind !== 'recognize' || answer) return
    const choices = exercise.choices
    function onKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < choices.length) onSubmit(choices[index])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exercise, answer, onSubmit])

  const typed = exercise.kind !== 'recognize'
  const input = (variant: 'inline' | 'block', label: string) => (
    <AnswerInput
      inputRef={inputRef}
      label={label}
      value={draft}
      onChange={setDraft}
      variant={variant}
    />
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (answer) onNext()
        else if (typed) onSubmit(draft)
      }}
      className="space-y-5"
    >
      <Prompt exercise={exercise} answer={answer} input={input} onChoose={onSubmit} />

      {answer ? (
        <div className="space-y-4">
          {exercise.kind !== 'recognize' && (
            <Feedback answer={answer} options={checkOptionsFor(exercise)} />
          )}
          {exercise.kind === 'recognize' && (
            <p role="status" className={`font-medium ${RESULT_COLOR[answer.result]}`}>
              {answer.result === 'correct'
                ? 'Correct.'
                : 'Not quite — the right meaning is marked.'}
            </p>
          )}
          <button
            ref={nextRef}
            type="submit"
            className="rounded-md bg-slate-800 px-5 py-2.5 font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
          >
            Next <span className="text-slate-400">(Enter)</span>
          </button>
        </div>
      ) : (
        typed && (
          <div>
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800"
            >
              Check <span className="text-emerald-200">(Enter)</span>
            </button>
            <DiacriticRow
              inputRef={inputRef}
              value={draft}
              onChange={(value, caret) => {
                pendingCaret.current = caret
                setDraft(value)
              }}
            />
          </div>
        )
      )}
    </form>
  )
}

interface PromptProps {
  exercise: Exercise
  answer: Answer | null
  input: (variant: 'inline' | 'block', label: string) => React.ReactNode
  onChoose: (choice: string) => void
}

function Prompt({ exercise, answer, input, onChoose }: PromptProps) {
  switch (exercise.kind) {
    case 'cloze':
      return (
        <div>
          <Instruction>Fill in the right form</Instruction>
          <p className="text-2xl leading-relaxed sm:text-3xl" lang="lv">
            {exercise.before}
            {answer ? (
              <span className={`font-semibold ${RESULT_COLOR[answer.result]}`}>
                {exercise.expected}
              </span>
            ) : (
              input('inline', `Answer: ${exercise.lemma}`)
            )}
            {exercise.after}{' '}
            <span className="text-lg text-slate-500 dark:text-slate-400">({exercise.lemma})</span>
          </p>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{exercise.gloss}</p>
        </div>
      )

    case 'inflect':
      return (
        <div>
          <Instruction>Give the form</Instruction>
          <p className="text-3xl font-semibold" lang="lv">
            {exercise.lemma}{' '}
            <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
              ({exercise.lemmaGloss})
            </span>
          </p>
          <p className="mt-1 text-lg">→ {exercise.formLabel}</p>
          <div className="mt-4 max-w-sm">
            {answer ? (
              <p className={`text-2xl font-semibold ${RESULT_COLOR[answer.result]}`} lang="lv">
                {exercise.expected}
              </p>
            ) : (
              input('block', `Answer: ${exercise.lemma}, ${exercise.formLabel}`)
            )}
          </div>
        </div>
      )

    case 'produce':
      return (
        <div>
          <Instruction>Say it in Latvian</Instruction>
          <p className="text-2xl">{exercise.gloss}</p>
          <div className="mt-4">
            {answer ? (
              <p className={`text-2xl font-semibold ${RESULT_COLOR[answer.result]}`} lang="lv">
                {exercise.expected}
              </p>
            ) : (
              input('block', `Latvian for: ${exercise.gloss}`)
            )}
          </div>
          {!answer && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Word order is checked against the original sentence; punctuation is ignored.
            </p>
          )}
        </div>
      )

    case 'recognize':
      return (
        <div>
          <Instruction>What does it mean?</Instruction>
          <p className="text-2xl sm:text-3xl" lang="lv">
            {exercise.text}
          </p>
          <ol className="mt-4 space-y-2">
            {exercise.choices.map((choice, index) => {
              const isRight = choice === exercise.expected
              const isPicked = answer?.given === choice
              const tone = !answer
                ? 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'
                : isRight
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                  : isPicked
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950'
                    : 'border-slate-200 opacity-60 dark:border-slate-700'
              return (
                <li key={choice}>
                  <button
                    type="button"
                    disabled={answer !== null}
                    onClick={() => onChoose(choice)}
                    className={`flex w-full items-start gap-3 rounded-md border-2 px-3 py-2 text-left ${tone}`}
                  >
                    <kbd className="mt-0.5 text-sm text-slate-400">{index + 1}</kbd>
                    <span>{choice}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )
  }
}

function Instruction({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </p>
  )
}
