import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

/**
 * Turns content:approve's arguments into a list of JSON files, so the same
 * command works in every shell:
 *
 * - a folder (`content/lexemes`) → every `.json` file directly in it;
 * - a `*` pattern the shell left unexpanded — PowerShell and cmd don't
 *   expand globs — (`content/lexemes/*.json`) → the matching files;
 * - a file path, relative or absolute → itself.
 *
 * Results are relative to `cwd`, in a stable order, without duplicates.
 * A path that matches nothing is returned as-is so the caller can report it.
 */
export function expandPaths(args: readonly string[], cwd: string): string[] {
  const out: string[] = []
  const add = (absolute: string) => {
    const rel = relative(cwd, absolute)
    if (!out.includes(rel)) out.push(rel)
  }

  for (const arg of args) {
    const absolute = resolve(cwd, arg)
    if (arg.includes('*')) {
      const dir = dirname(absolute)
      const pattern = globToRegExp(basename(absolute))
      if (!existsSync(dir)) {
        add(absolute)
        continue
      }
      const matches = readdirSync(dir)
        .filter((name) => pattern.test(name))
        .sort()
      if (matches.length === 0) add(absolute)
      for (const name of matches) add(join(dir, name))
      continue
    }
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
      for (const name of readdirSync(absolute)
        .filter((n) => n.endsWith('.json'))
        .sort()) {
        add(join(absolute, name))
      }
      continue
    }
    add(absolute)
  }
  return out
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/\\\\]*')
  return new RegExp(`^${escaped}$`)
}
