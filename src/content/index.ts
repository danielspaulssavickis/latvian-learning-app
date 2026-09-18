import { loadContent, type LoadedContent } from './loader.js'

/**
 * The only place the app touches `content/` directly. `content/drafts/` is
 * intentionally not globbed here — per ADR-006, drafts must never reach the
 * loader, so they can never generate a review card.
 */
const lexemeModules = import.meta.glob('../../content/lexemes/*.json', { eager: true })
const sentenceModules = import.meta.glob('../../content/sentences/*.json', { eager: true })
const grammarModules = import.meta.glob('../../content/grammar/*.json', { eager: true })

function unwrapDefaults(modules: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, module] of Object.entries(modules)) {
    result[path] = (module as { default: unknown }).default
  }
  return result
}

export const content: LoadedContent = loadContent({
  lexemes: unwrapDefaults(lexemeModules),
  sentences: unwrapDefaults(sentenceModules),
  grammar: unwrapDefaults(grammarModules),
})
