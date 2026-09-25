import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Dexie's liveQuery only observes a *global* IndexedDB, so UI tests install
// fake-indexeddb globally and isolate tests by database name instead.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { recordReview, syncCards } from '../db/cards'
import { openDb, type TrainerDb } from '../db/db'
import { generateAllCards } from '../engine/cards'
import { createScheduler } from '../engine/schedule'
import { SNT_1, SNT_3 } from '../engine/__fixtures__/sentences'
import { fixtureContent } from './__fixtures__/content'
import { App } from './App'

let db: TrainerDb
let now: Date
let dbCount = 0
const clock = () => now

beforeEach(() => {
  dbCount += 1
  db = openDb(`app-test-${dbCount}`)
  now = new Date('2026-09-25T09:00:00.000Z')
})

/**
 * Answers `cardIds` correctly and fast (→ easy, due days later) on the day
 * before `now`, so today's session reaches the next sibling of each sentence
 * (new cards are one per sentence per day — sibling burying).
 */
async function studiedYesterday(cardIds: string[], content = fixtureContent()) {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const scheduler = createScheduler(() => yesterday)
  const specs = generateAllCards(
    [...content.sentenceById.values()],
    content.lexemeById,
    content.grammar,
  )
  await syncCards(db, specs, scheduler)
  for (const cardId of cardIds) {
    await recordReview(db, scheduler, { cardId, result: 'correct', given: 'x', responseMs: 1000 })
  }
}

async function startSession(user: ReturnType<typeof userEvent.setup>) {
  const start = await screen.findByRole('button', { name: 'Start session' })
  await waitFor(() => expect(start).toBeEnabled())
  await user.click(start)
}

function renderApp(preview = false) {
  return render(<App content={fixtureContent()} db={db} clock={clock} preview={preview} />)
}

describe('App', () => {
  it('renders the heading and the number of new cards', async () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Latvian Trainer' })).toBeInTheDocument()
    // Two sentences, one new card each per day (siblings buried): their recognize cards.
    expect(await screen.findByText(/new cards/)).toHaveTextContent('2 new cards')
  })

  it('says so when there is no approved content at all', async () => {
    render(<App content={fixtureContent([])} db={db} clock={clock} />)
    expect(await screen.findByText(/No study material yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
  })

  it('shows the draft banner only in preview mode', async () => {
    renderApp(true)
    expect(screen.getByRole('note')).toHaveTextContent(/Draft preview/)
  })

  it('answers a recognize card with a number key', async () => {
    const user = userEvent.setup()
    renderApp()
    await startSession(user)
    expect(await screen.findByText('What does it mean?')).toBeInTheDocument()
    const choices = screen.getAllByRole('button').filter((b) => /^\d/.test(b.textContent ?? ''))
    const right = choices.findIndex((b) => b.textContent?.includes('I live in Riga.'))
    await user.keyboard(String(right + 1))
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    await waitFor(async () => expect(await db.reviews.count()).toBe(1))
  })

  it('runs a keyboard-only cloze session, re-queues a miss, and persists every answer', async () => {
    await studiedYesterday(['recognize:snt_0001', 'recognize:snt_0003'])
    const user = userEvent.setup()
    renderApp()
    await startSession(user)

    // "Es dzīvoju ___. (Rīga)" — no macrons → near miss.
    const input = await screen.findByRole('textbox', { name: 'Answer: Rīga' })
    expect(input).toHaveFocus()
    await user.keyboard('Riga{Enter}')
    expect(await screen.findByText(/check the diacritics/)).toBeInTheDocument()
    expect(screen.getByLabelText('Correct spelling: Rīgā')).toBeInTheDocument()

    // Enter again advances. "___ ir divi bērni. (es)" — wrong.
    await user.keyboard('{Enter}')
    await screen.findByRole('textbox', { name: 'Answer: es' })
    await user.keyboard('mani{Enter}')
    expect(await screen.findByText(/The answer is/)).toHaveTextContent('Man')

    // The wrong card comes back at the end; answer it right, then the summary.
    await user.keyboard('{Enter}')
    await screen.findByRole('textbox', { name: 'Answer: es' })
    await user.keyboard('man{Enter}')
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Session done' })).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument() // 1 of 2 first attempts accepted

    await waitFor(async () => expect(await db.reviews.count()).toBe(5))
    const today = (await db.reviews.orderBy('id').toArray()).slice(2).map((r) => r.result)
    expect(today).toEqual(['nearMiss', 'wrong', 'correct'])
  })

  it('checks a produce card as a whole sentence and shows it on the dashboard', async () => {
    await studiedYesterday(['recognize:snt_0001', 'cloze:snt_0001#2', 'recognize:snt_0003'])
    const user = userEvent.setup()
    renderApp()
    await startSession(user)

    await screen.findByRole('textbox', { name: 'Latvian for: I live in Riga.' })
    await user.keyboard('es dzīvoju Rīgā{Enter}') // no full stop, lower case: still correct
    expect(await screen.findByText('Correct.')).toBeInTheDocument()

    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: 'End session' }))
    await user.click(screen.getByRole('button', { name: 'Progress' }))
    const skills = await screen.findByRole('table', { name: /Exercise types/ })
    expect(skills).toHaveTextContent('produce')
    const grammar = screen.getByRole('table', { name: /Grammar, weakest first/ })
    expect(grammar).toHaveTextContent('locative')
    expect(grammar).not.toHaveTextContent('singular')
  })

  it('degrades a listen card with a missing audio file to a text-only card (M5 done-when)', async () => {
    const content = fixtureContent([{ ...SNT_1, audio: 'audio/missing.mp3' }, SNT_3])
    await studiedYesterday(
      ['recognize:snt_0001', 'cloze:snt_0001#2', 'produce:snt_0001', 'recognize:snt_0003'],
      content,
    )
    const user = userEvent.setup()
    const { container } = render(<App content={content} db={db} clock={clock} />)
    await startSession(user)

    expect(await screen.findByText('Type what you hear')).toBeInTheDocument()
    const audio = container.querySelector('audio')!
    expect(audio.getAttribute('src')).toBe('/audio/missing.mp3')
    fireEvent.error(audio) // what the browser fires for a 404

    expect(await screen.findByText(/Audio unavailable/)).toBeInTheDocument()
    await screen.findByRole('textbox', { name: 'Latvian for: I live in Riga.' })
    await user.keyboard('Es dzīvoju Rīgā.{Enter}')
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Fill in the right form')).toBeInTheDocument() // session goes on
  })

  it('inserts a diacritic at the caret without losing focus', async () => {
    await studiedYesterday(['recognize:snt_0001', 'recognize:snt_0003'])
    const user = userEvent.setup()
    renderApp()
    await startSession(user)
    const input = await screen.findByRole('textbox', { name: 'Answer: Rīga' })
    await user.keyboard('Rg')
    await user.keyboard('{ArrowLeft}')
    await user.click(screen.getByRole('button', { name: 'ī' }))
    expect(input).toHaveValue('Rīg')
    expect(input).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'ā' }))
    expect(input).toHaveValue('Rīāg')
  })

  it('saves the daily limits', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const field = await screen.findByLabelText('New cards per day')
    await user.clear(field)
    await user.type(field, '1')
    await user.click(screen.getByRole('button', { name: 'Save limits' }))
    // Saving re-renders the form from the stored values; wait for the final DOM.
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(await screen.findByText(/new card/)).toHaveTextContent('1 new card')
  })

  it('exports and re-imports progress from Settings', async () => {
    const user = userEvent.setup()
    let exported = ''
    const createObjectURL = URL.createObjectURL
    URL.createObjectURL = (blob: Blob) => {
      void blob.text().then((text) => (exported = text))
      return 'blob:test'
    }
    URL.revokeObjectURL = () => {}
    try {
      renderApp()
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      await user.click(await screen.findByRole('button', { name: 'Export progress' }))
      expect(await screen.findByText('Backup downloaded.')).toBeInTheDocument()
      await waitFor(() => expect(exported).toContain('latvian-trainer-progress'))

      window.confirm = () => true
      const file = new File([exported], 'backup.json', { type: 'application/json' })
      await user.upload(screen.getByLabelText('Progress backup file'), file)
      expect(await screen.findByText(/Imported 7 cards and 0 reviews/)).toBeInTheDocument()
    } finally {
      URL.createObjectURL = createObjectURL
    }
  })
})
