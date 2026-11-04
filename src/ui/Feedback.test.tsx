import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Feedback } from './Feedback'

const base = {
  cardId: 'cloze:x#0',
  kind: 'cloze' as const,
  feature: 'case:loc',
  expected: 'galdā',
  responseMs: 1000,
  firstAttempt: true,
}

describe('Feedback', () => {
  it('names the real form the learner typed instead (ADR-014)', () => {
    render(
      <Feedback
        answer={{ ...base, given: 'galda', result: 'wrong', confusedWith: 'genitive singular' }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'galda is a real form of this word — the genitive singular',
    )
  })

  it('stays a plain "not quite" for other wrong answers', () => {
    render(<Feedback answer={{ ...base, given: 'galdu', result: 'wrong' }} />)
    expect(screen.getByRole('status')).not.toHaveTextContent('real form')
  })
})
