/** The Latvian letters that a standard US/UK keyboard can't type directly. */
export const LATVIAN_LETTERS = ['ā', 'ē', 'ī', 'ū', 'č', 'ģ', 'ķ', 'ļ', 'ņ', 'š', 'ž'] as const

/**
 * Inserts `text` over the selection [start, end) and returns the new value
 * and caret position — what the diacritic buttons do to the answer input.
 */
export function insertAt(
  value: string,
  start: number,
  end: number,
  text: string,
): { value: string; caret: number } {
  return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length }
}
