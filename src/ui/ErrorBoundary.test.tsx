import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = true
function Flaky() {
  const [n] = useState(0)
  if (shouldThrow) throw new Error('boom')
  return <p>fine {n}</p>
}

describe('ErrorBoundary', () => {
  it('shows the error and recovers on "Try again"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('alert')).toHaveTextContent('progress is saved')
    shouldThrow = false
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('fine 0')).toBeInTheDocument()
  })
})
