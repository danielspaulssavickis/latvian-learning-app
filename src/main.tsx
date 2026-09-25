import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { openDb, systemClock } from './db/db'
import { App } from './ui/App'

/**
 * Draft preview (ADR-011) is dev-only: in a production build
 * `import.meta.env.DEV` is the constant false, so the preview import is
 * dead code and never bundled (scripts/check-dist.ts verifies that).
 */
const PREVIEW = import.meta.env.DEV && import.meta.env.MODE === 'drafts'

async function main() {
  const root = createRoot(document.getElementById('root')!)
  try {
    const { content } = PREVIEW
      ? await import('./content/preview')
      : await import('./content/index')
    const db = openDb(PREVIEW ? 'latvian-trainer-preview' : 'latvian-trainer')
    root.render(
      <StrictMode>
        <App content={content} db={db} clock={systemClock} preview={PREVIEW} />
      </StrictMode>,
    )
  } catch (error) {
    // Invalid content throws at load (src/content/loader.ts): show why instead of a blank page.
    root.render(
      <pre style={{ padding: 16, whiteSpace: 'pre-wrap', color: '#9f1239' }}>
        {`Latvian Trainer could not start.\n\n${String(error)}`}
      </pre>,
    )
  }
}

/**
 * Production only (ADR-013): the service worker makes the installed app work
 * offline, and persistent storage asks the browser not to evict IndexedDB
 * (review history) under storage pressure. Neither is fatal if refused.
 */
function registerOfflineSupport() {
  if (!import.meta.env.PROD) return
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
        console.warn('Service worker registration failed:', error)
      })
    })
  }
  void navigator.storage?.persist?.().catch(() => false)
}

registerOfflineSupport()
void main()
