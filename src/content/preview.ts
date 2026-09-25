import { loadContent, type LoadedContent } from './loader.js'

/**
 * DEV-ONLY draft preview (ADR-011). Loads everything src/content/index.ts
 * loads *plus* content/drafts/, so unreviewed sentences can be tried in the
 * real app before `content:approve`. src/main.tsx imports this module only
 * when `import.meta.env.DEV` and the Vite mode is "drafts"; a production
 * build never contains it (scripts/check-dist.ts enforces that), and preview
 * progress goes to a separate IndexedDB so draft cards never mix with real
 * review history.
 */
const lexemeModules = import.meta.glob('../../content/lexemes/*.json', { eager: true })
const sentenceModules = import.meta.glob('../../content/sentences/*.json', { eager: true })
const draftModules = import.meta.glob('../../content/drafts/*.json', { eager: true })
const grammarModules = import.meta.glob('../../content/grammar/*.json', { eager: true })

function unwrapDefaults(modules: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, module] of Object.entries(modules)) {
    result[path] = (module as { default: unknown }).default
  }
  return result
}

/** Draft files hold one sentence or an array; split arrays so each gets its own key. */
function flattenDrafts(records: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, data] of Object.entries(records)) {
    if (!Array.isArray(data)) {
      result[path] = data
      continue
    }
    data.forEach((sentence, index) => {
      result[`${path}[${index}]`] = sentence
    })
  }
  return result
}

export const content: LoadedContent = loadContent({
  lexemes: unwrapDefaults(lexemeModules),
  sentences: {
    ...unwrapDefaults(sentenceModules),
    ...flattenDrafts(unwrapDefaults(draftModules)),
  },
  grammar: unwrapDefaults(grammarModules),
})
