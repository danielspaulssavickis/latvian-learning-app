import { describe, expect, it } from 'vitest'
import { renderServiceWorker } from './serviceWorker.js'

describe('renderServiceWorker', () => {
  const sw = renderServiceWorker(['index.html', 'assets/index-abc.js'], 'v123')

  it('precaches the app root and every built file, relative to its scope', () => {
    expect(sw).toContain('"./"')
    expect(sw).toContain('"./index.html"')
    expect(sw).toContain('"./assets/index-abc.js"')
  })

  it('names the cache after the build, so an update replaces the old cache', () => {
    expect(sw).toContain("const CACHE = 'latvian-trainer-v123'")
    expect(sw).toContain('caches.delete(key)')
  })

  it('only refreshes the cached shell from an OK response for the app root', () => {
    expect(sw).toContain('response.ok && (path === root')
  })

  it('is valid JavaScript', () => {
    expect(() => new Function(sw)).not.toThrow()
  })
})
