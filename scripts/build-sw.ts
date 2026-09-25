#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { renderServiceWorker } from './serviceWorker.js'

/** Runs after `vite build`: writes dist/sw.js precaching everything in dist/. */
const dist = join(process.cwd(), 'dist')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const built = files(dist)
  .map((path) => relative(dist, path).split(sep).join('/'))
  .filter((path) => path !== 'sw.js')
  .sort()

const hash = createHash('sha256')
for (const file of built) hash.update(file).update(readFileSync(join(dist, file)))
const version = hash.digest('hex').slice(0, 12)

writeFileSync(join(dist, 'sw.js'), renderServiceWorker(built, version))
console.log(`build-sw: dist/sw.js precaches ${built.length} files (version ${version}).`)
