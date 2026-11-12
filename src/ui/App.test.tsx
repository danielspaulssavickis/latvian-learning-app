import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Dexie's liveQuery only observes a *global* IndexedDB, so UI tests install
// fake-indexeddb globally and isolate tests by database name instead.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordReview, syncCards } from '../db/cards'
import { openDb, type TrainerDb } from '../db/db'
import { updateSettings } from '../db/settings'
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
  localStorage.clear() // the remembered Grammar subtab
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

/** Both sentences' recognize and translate cards: the next new card of each is its cloze. */
const TRANSLATED = [
  'recognize:snt_0001',
  'translate:snt_0001',
  'recognize:snt_0003',
  'translate:snt_0003',
]

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
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument()
  })

  it("after the day's new cards, says when the next review is and offers more new cards", async () => {
    const user = userEvent.setup()
    await updateSettings(db, { dailyLimits: { newPerDay: 1, reviewsPerDay: 100 } })
    renderApp()
    await startSession(user)
    await screen.findByText('What does it mean?')
    await user.keyboard('1')
    await user.click(await screen.findByRole('button', { name: 'End session' }))
    await user.click(await screen.findByRole('button', { name: 'Back to start' }))

    expect(await screen.findByText(/Done for now/)).toBeInTheDocument()
    expect(screen.getByText(/next review is due in/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument()

    // One other sentence still has a new card for today.
    await user.click(screen.getByRole('button', { name: 'Learn 1 more new card today' }))
    expect(await screen.findByText(/reviews? due/)).toHaveTextContent('1 new card')
    await startSession(user)
    expect(await screen.findByText('What does it mean?')).toBeInTheDocument()
  })

  it('marks each word with its class on request, and keeps the legend on across cards', async () => {
    const user = userEvent.setup()
    renderApp()
    await startSession(user)
    await screen.findByText('What does it mean?')
    expect(screen.queryByLabelText('Rīgā: noun')).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Word classes' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Es: pronoun')).toHaveTextContent('pron.')
    expect(screen.getByLabelText('dzīvoju: verb')).toHaveTextContent('verb')
    expect(screen.getByLabelText('Rīgā: noun')).toHaveTextContent('noun')

    // Next card: the legend stays on.
    await user.keyboard('1')
    await user.keyboard('{Enter}')
    await screen.findByText('What does it mean?')
    expect(screen.getByLabelText('divi: numeral')).toHaveTextContent('num.')
  })

  it('explains every word class on the Grammar tab, with examples from the content', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Grammar' }))
    expect(await screen.findByRole('heading', { name: 'Word classes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /noun lietvārds/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /adverb apstākļa vārds/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(10)
    expect(screen.getAllByText(/I have two children\./).length).toBeGreaterThan(0) // numeral example
    expect(screen.getAllByText('No example in the current material yet.').length).toBeGreaterThan(0)
  })

  it('has Word classes and Inflections subtabs, and remembers the last one', async () => {
    const user = userEvent.setup()
    const { unmount } = renderApp()
    await user.click(await screen.findByRole('button', { name: 'Grammar' }))
    expect(await screen.findByRole('heading', { name: 'Word classes' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Inflections' }))
    expect(await screen.findByRole('heading', { name: 'Inflections' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The seven cases' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /^locative/ })).toHaveTextContent('Rīgā')
    unmount()

    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Grammar' }))
    expect(await screen.findByRole('heading', { name: 'Inflections' })).toBeInTheDocument()
  })

  it('opens a word on Tēzaurs in a new tab, or says it needs a connection', async () => {
    const user = userEvent.setup()
    const opened: unknown[][] = []
    const open = window.open
    window.open = (...args: unknown[]) => (opened.push(args), null)
    try {
      renderApp()
      await user.click(await screen.findByRole('button', { name: 'Grammar' }))
      await user.click(await screen.findByRole('button', { name: 'Inflections' }))
      await user.type(await screen.findByLabelText('Word to check on Tēzaurs'), ' māja ')
      await user.click(screen.getByRole('button', { name: 'Check' }))
      expect(opened).toEqual([['https://tezaurs.lv/m%C4%81ja', '_blank', 'noopener']])

      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await user.click(screen.getByRole('button', { name: 'Check' }))
      expect(screen.getByRole('status')).toHaveTextContent(/offline/)
      expect(opened).toHaveLength(1)
      onLine.mockRestore()
    } finally {
      window.open = open
    }
  })

  it('lists approved pronouns by type, hides drafts outside preview, and links to their tables', async () => {
    const user = userEvent.setup()
    const content = fixtureContent()
    const lexemes = new Map(content.lexemeById)
    lexemes.set('lex_es', {
      ...lexemes.get('lex_es')!,
      gloss: ['I'],
      tags: ['pronoun:personal', 'order:1'],
      irregular: { 'nom.sg': 'es', 'gen.sg': 'manis' },
      review: 'approved',
    })
    lexemes.set('lex_sis', {
      id: 'lex_sis',
      lemma: 'šis',
      feminine: 'šī',
      pos: 'pronoun',
      gender: 'm',
      declension: null,
      conjugation: null,
      gloss: ['this'],
      tags: ['pronoun:demonstrative'],
      review: 'draft',
    })
    const withPronouns = { ...content, lexemeById: lexemes }

    const { unmount } = render(<App content={withPronouns} db={db} clock={clock} />)
    await user.click(await screen.findByRole('button', { name: 'Grammar' }))
    const all = await screen.findByRole('heading', { name: 'All pronouns' })
    expect(all).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument()
    expect(screen.queryByText('šis')).not.toBeInTheDocument()
    expect(screen.getByText(/1 more pronoun is drafted/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Case tables → Inflections' }))
    const table = await screen.findByRole('table', { name: 'Personal pronouns, singular' })
    expect(table).toHaveTextContent('manis')
    unmount()
    localStorage.clear()

    render(<App content={withPronouns} db={db} clock={clock} preview />)
    await user.click(await screen.findByRole('button', { name: 'Grammar' }))
    await screen.findByRole('heading', { name: 'All pronouns' })
    expect(screen.getByRole('heading', { name: 'Demonstrative' })).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()
    expect(screen.getByText(/\/ šī/)).toBeInTheDocument()
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
    await studiedYesterday(TRANSLATED)
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

    await waitFor(async () => expect(await db.reviews.count()).toBe(7))
    const today = (await db.reviews.orderBy('id').toArray()).slice(4).map((r) => r.result)
    expect(today).toEqual(['nearMiss', 'wrong', 'correct'])
  })

  it('checks a translate card as English, accepting a listed alternative', async () => {
    await studiedYesterday(['recognize:snt_0001', 'recognize:snt_0003'])
    const user = userEvent.setup()
    renderApp()
    await startSession(user)

    expect(await screen.findByText('Say it in English')).toBeInTheDocument()
    const input = await screen.findByRole('textbox', { name: 'English for: Es dzīvoju Rīgā.' })
    expect(input).toHaveAttribute('lang', 'en')
    expect(screen.queryByRole('group', { name: 'Latvian letters' })).not.toBeInTheDocument()
    await user.keyboard("i'm living in riga{Enter}") // a glossAlternative, contracted, no full stop
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    expect(screen.getByText(/Another way to say it/)).toHaveTextContent('I live in Riga.')

    await user.keyboard('{Enter}')
    await screen.findByRole('textbox', { name: 'English for: Man ir divi bērni.' })
    await user.keyboard('I have two cats{Enter}')
    expect(await screen.findByText(/The answer is/)).toHaveTextContent('I have two children.')
  })

  it('checks a produce card as a whole sentence and shows it on the dashboard', async () => {
    await studiedYesterday([...TRANSLATED, 'cloze:snt_0001#2'])
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

  it('plays a hear card: pick the meaning by ear, then the transcript appears (ADR-019)', async () => {
    const content = fixtureContent([{ ...SNT_1, audio: 'audio/snt_0001.mp3' }, SNT_3])
    await studiedYesterday(
      [...TRANSLATED, 'cloze:snt_0001#2', 'produce:snt_0001', 'cloze:snt_0003#0'],
      content,
    )
    const user = userEvent.setup()
    const { container } = render(<App content={content} db={db} clock={clock} />)
    await startSession(user)

    expect(await screen.findByText('Listen — what does it mean?')).toBeInTheDocument()
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('/audio/snt_0001.mp3')
    expect(screen.queryByText('Transcript')).not.toBeInTheDocument()
    expect(screen.queryByText('Rīgā')).not.toBeInTheDocument() // no text before answering

    const choices = screen.getAllByRole('button').filter((b) => /^\d/.test(b.textContent ?? ''))
    const right = choices.findIndex((b) => b.textContent?.includes('I live in Riga.'))
    await user.keyboard(String(right + 1))
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    expect(screen.getByText('Transcript')).toBeInTheDocument()
    expect(screen.getByText('Rīgā')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Word classes' }))
    expect(screen.getByLabelText('Rīgā: noun')).toBeInTheDocument()
    await waitFor(async () =>
      expect((await db.reviews.toArray()).at(-1)).toMatchObject({ cardId: 'hear:snt_0001' }),
    )
  })

  it('shows a hear card as text when its audio is missing', async () => {
    const content = fixtureContent([{ ...SNT_1, audio: 'audio/missing.mp3' }, SNT_3])
    await studiedYesterday(
      [...TRANSLATED, 'cloze:snt_0001#2', 'produce:snt_0001', 'cloze:snt_0003#0'],
      content,
    )
    const user = userEvent.setup()
    const { container } = render(<App content={content} db={db} clock={clock} />)
    await startSession(user)
    await screen.findByText('Listen — what does it mean?')
    fireEvent.error(container.querySelector('audio')!)
    expect(await screen.findByText(/Audio unavailable — read the sentence/)).toBeInTheDocument()
    expect(screen.getByText('Rīgā')).toBeInTheDocument()
    expect(screen.getByText('What does it mean?')).toBeInTheDocument()
  })

  it('degrades a listen card with a missing audio file to a text-only card (M5 done-when)', async () => {
    const content = fixtureContent([{ ...SNT_1, audio: 'audio/missing.mp3' }, SNT_3])
    await studiedYesterday(
      [...TRANSLATED, 'cloze:snt_0001#2', 'produce:snt_0001', 'hear:snt_0001'],
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
    await studiedYesterday(TRANSLATED)
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

  it('resets all progress and can switch sibling burying off from Settings', async () => {
    await studiedYesterday(TRANSLATED)
    const user = userEvent.setup()
    renderApp()
    // Two sentences, siblings buried: one new card each.
    expect(await screen.findByText(/new cards/)).toHaveTextContent('2 new cards')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByLabelText(/One new card per sentence per day/))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    // All unseen cards are offered (9 cards - 4 studied = 5, within the cap of 10).
    expect(await screen.findByText(/new cards/)).toHaveTextContent('5 new cards')

    window.confirm = () => true
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('button', { name: 'Reset all progress' }))
    expect(await screen.findByText('Progress reset.')).toBeInTheDocument()
    expect(await db.reviews.count()).toBe(0)
    expect(screen.getByLabelText(/One new card per sentence per day/)).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(await screen.findByText(/new cards/)).toHaveTextContent('2 new cards')
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
      expect(await screen.findByText(/Imported 9 cards and 0 reviews/)).toBeInTheDocument()
    } finally {
      URL.createObjectURL = createObjectURL
    }
  })
})
