import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Last line of defence: a render error shows a way out instead of a blank
 * page. Progress is safe — it's in IndexedDB, which a render error can't
 * touch — so reloading is always an option.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Latvian Trainer crashed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 p-6">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p>Your progress is saved in this browser and is not affected.</p>
        <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-sm whitespace-pre-wrap dark:bg-slate-800">
          {this.state.error.message}
        </pre>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md bg-slate-800 px-4 py-2 font-medium text-white"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-slate-300 px-4 py-2 font-medium"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
