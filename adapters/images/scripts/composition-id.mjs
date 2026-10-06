#!/usr/bin/env node
// Remotion composition ids for one post: `<slug>--<stem>`. Slugs never contain
// `--` (console/src/queue.ts SLUG_RE), so the first `--` always ends the slug
// and two posts can never produce the same id, file or identifier.
// Plain Node, no dependencies: the image adapter runs it in sessions where the
// console's node_modules may not exist.
import { fileURLToPath } from 'node:url'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function stemOf(filename) {
  const base = filename.replace(/\.[^./]*$/, '')
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function idFor(slug, stem) {
  return `${slug}--${stem}`
}

export function identifierFor(id) {
  return `C_${id.replace(/-/g, '_')}`
}

export function allocateIds(slug, filenames) {
  const used = new Set()
  return filenames.map((filename) => {
    const stem = stemOf(filename)
    let id = idFor(slug, stem)
    for (let n = 2; used.has(id); n++) id = idFor(slug, `${stem}-${n}`)
    used.add(id)
    return { filename, id, file: `${id}.tsx`, identifier: identifierFor(id) }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [slug, ...filenames] = process.argv.slice(2)
  if (!slug || !SLUG_RE.test(slug) || filenames.length === 0) {
    process.stderr.write('usage: composition-id.mjs <slug> <filename> [<filename> ...]\n')
    process.exit(2)
  }
  const empty = filenames.find((f) => stemOf(f) === '')
  if (empty !== undefined) {
    process.stderr.write(`no usable name in filename "${empty}"\n`)
    process.exit(2)
  }
  process.stdout.write(`${JSON.stringify(allocateIds(slug, filenames), null, 2)}\n`)
}
