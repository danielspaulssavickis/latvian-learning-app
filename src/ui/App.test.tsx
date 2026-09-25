import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Dexie's liveQuery only observes a *global* IndexedDB, so UI tests install
// fake-indexeddb globally and isolate tests by database name instead.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDb, type TrainerDb } from '../db/db'
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

function renderApp(preview = false) {
  return render(<App content={fixtureContent()} db={db} clock={clock} preview={preview} />)
}

describe('App', () => {
  it('renders the heading and the number of new cards', async () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Latvian Trainer' })).toBeInTheDocument()
    expect(await screen.findByText(/new cards/)).toHaveTextContent('3 new cards')
  })

  it('shows the draft banner only in preview mode', async () => {
    renderApp(true)
    expect(screen.getByRole('note')).toHaveTextContent(/Draft preview/)
  })

  it('runs a keyboard-only cloze session and persists every answer', async () => {
    const user = userEvent.setup()
    renderApp()
    const start = await screen.findByRole('button', { name: 'Start session' })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)

    // Card 1: "Es dzīvoju ___. (Rīga)" — answer without macrons → near miss.
    const input = await screen.findByRole('textbox', { name: 'Answer: Rīga' })
    expect(input).toHaveFocus()
    await user.keyboard('Riga{Enter}')
    expect(await screen.findByText(/check the diacritics/)).toBeInTheDocument()
    expect(screen.getByLabelText('Correct spelling: Rīgā')).toBeInTheDocument()

    // Enter again advances. Card 2: "___ ir divi bērni. (es)" — wrong.
    await user.keyboard('{Enter}')
    await screen.findByRole('textbox', { name: 'Answer: es' })
    await user.keyboard('mani{Enter}')
    expect(await screen.findByText(/The answer is/)).toHaveTextContent('Man')

    // Card 3: "Man ir divi ___. (bērns)" — correct.
    await user.keyboard('{Enter}')
    await screen.findByRole('textbox', { name: 'Answer: bērns' })
    await user.keyboard('bērni{Enter}')
    expect(await screen.findByText('Correct.')).toBeInTheDocument()

    // The wrong card comes back; answer it right, then the summary.
    await user.keyboard('{Enter}')
    await screen.findByRole('textbox', { name: 'Answer: es' })
    await user.keyboard('man{Enter}')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Session done' })).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument() // 2 of 3 first attempts accepted

    await waitFor(async () => expect(await db.reviews.count()).toBe(4))
    const results = (await db.reviews.orderBy('id').toArray()).map((r) => r.result)
    expect(results).toEqual(['nearMiss', 'wrong', 'correct', 'correct'])
  })

  it('inserts a diacritic at the caret without losing focus', async () => {
    const user = userEvent.setup()
    renderApp()
    const start = await screen.findByRole('button', { name: 'Start session' })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)
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
})
