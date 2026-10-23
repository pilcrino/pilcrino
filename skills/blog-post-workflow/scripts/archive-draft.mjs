#!/usr/bin/env node
// Moves a post's drafts folder into its archive, and pulls the base branch over
// a local archive, without nesting the folder or losing local-only files.
// A merged pull request already carries an early archive snapshot at the same
// path, so the archive may exist before finalize (retire) or arrive with the
// pull after it (pull).
// Plain Node, no dependencies: the plugin ships no node_modules, and the
// skill runs this script straight from the plugin directory.
// Spec: docs/superpowers/specs/2026-10-23-pr-monitor-opt-in-design.md
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export class ExitError extends Error {
  constructor(code, message, payload) {
    super(message)
    this.code = code
    this.payload = payload
  }
}
class UsageError extends Error {}

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { ok: r.status === 0, out: r.stdout ?? '', err: r.stderr ?? '' }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function files(dir, base = dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...files(p, base))
    else out.push(relative(base, p))
  }
  return out
}

// Every file under `from` exists under `to` with the same bytes.
function missingIn(from, to) {
  return files(from).filter((f) => {
    const t = join(to, f)
    return !existsSync(t) || !readFileSync(join(from, f)).equals(readFileSync(t))
  })
}

// Copies `from` over `to` (which exists), checks the copy, then removes `from`.
function mergeOver(from, to, what) {
  cpSync(from, to, { recursive: true, force: true })
  const bad = missingIn(from, to)
  if (bad.length) throw new ExitError(1, `${what}: ${bad.length} file(s) did not copy (${bad.slice(0, 5).join(', ')}); ${from} was kept`)
  rmSync(from, { recursive: true, force: true })
}

export function retire(src, dest) {
  const hasSrc = existsSync(src)
  const hasDest = existsSync(dest)
  if (!hasSrc && hasDest) return { action: 'already-retired' }
  if (!hasSrc) throw new ExitError(2, `neither ${src} nor ${dest} exists`)
  if (!hasDest) {
    mkdirSync(dirname(dest), { recursive: true })
    renameSync(src, dest)
    return { action: 'moved' }
  }
  const backup = `${dest}.backup-${stamp()}`
  cpSync(dest, backup, { recursive: true })
  mergeOver(src, dest, `copying ${src} into ${dest} (backup of the archive kept at ${backup})`)
  rmSync(backup, { recursive: true, force: true })
  return { action: 'merged' }
}

// Paths git lists, one per tab-indented line, when a pull would overwrite them.
function blockedPaths(text) {
  return text.split('\n').filter((l) => l.startsWith('\t')).map((l) => l.trim()).filter(Boolean)
}

function changedTracked(repo, archiveRel) {
  return git(['diff', '--name-only', '--', archiveRel], repo).out.split('\n').filter(Boolean)
}

export function pullWithArchive({ repo, archive, base }) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], repo).out.trim()
  if (branch !== base) throw new ExitError(3, `${repo} is on ${branch || 'no branch'}, not ${base}; switch to ${base} first`)
  const archiveAbs = resolve(repo, archive)
  const archiveRel = relative(resolve(repo), archiveAbs)
  // An earlier run stopped after setting the archive aside: that copy is the
  // final archive, so it is restored over whatever this run pulls.
  const prefix = `${basename(archiveAbs)}.aside-`
  const leftovers = existsSync(dirname(archiveAbs))
    ? readdirSync(dirname(archiveAbs)).filter((n) => n.startsWith(prefix)).sort().map((n) => join(dirname(archiveAbs), n))
    : []
  const restoreLeftovers = () => {
    for (const l of leftovers) {
      mkdirSync(archiveAbs, { recursive: true })
      mergeOver(l, archiveAbs, `restoring the local archive from ${l}`)
    }
    return leftovers.length > 0
  }
  const first = git(['pull', '--ff-only', 'origin', base], repo)
  if (first.ok) {
    const restored = restoreLeftovers()
    return { pulled: true, archiveRestored: restored, changed: changedTracked(repo, archiveRel) }
  }

  const blocked = blockedPaths(first.out + first.err)
  if (!blocked.length) throw new ExitError(1, first.err.trim() || first.out.trim())
  const outside = blocked.filter((p) => p !== archiveRel && !p.startsWith(`${archiveRel}/`))
  if (outside.length) throw new ExitError(4, `files outside the archive are in the way: ${outside.join(', ')}`, { blocked: outside })

  const aside = `${archiveAbs}.aside-${stamp()}`
  renameSync(archiveAbs, aside)
  const second = git(['pull', '--ff-only', 'origin', base], repo)
  if (!second.ok) {
    if (!existsSync(archiveAbs)) renameSync(aside, archiveAbs)
    throw new ExitError(1, `${second.err.trim() || second.out.trim()}${existsSync(aside) ? ` (local archive kept at ${aside})` : ''}`)
  }
  mkdirSync(archiveAbs, { recursive: true })
  mergeOver(aside, archiveAbs, `restoring the local archive from ${aside}`)
  restoreLeftovers()
  return { pulled: true, archiveRestored: true, changed: changedTracked(repo, archiveRel) }
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = {}
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || rest[i + 1] === undefined) throw new UsageError(`bad argument ${rest[i]}`)
    opts[rest[i].slice(2)] = rest[i + 1]
  }
  const need = { retire: ['src', 'dest'], pull: ['repo', 'archive', 'base'] }[cmd]
  if (!need) throw new UsageError('usage: archive-draft.mjs retire --src <dir> --dest <dir> | pull --repo <dir> --archive <path> --base <branch>')
  for (const k of need) if (!opts[k]) throw new UsageError(`${cmd} needs --${k}`)
  return { cmd, opts }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { cmd, opts } = parseArgs(process.argv.slice(2))
    const result = cmd === 'retire' ? retire(resolve(opts.src), resolve(opts.dest)) : pullWithArchive(opts)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (e) {
    if (e instanceof ExitError && e.payload) process.stdout.write(`${JSON.stringify(e.payload)}\n`)
    process.stderr.write(`${e.message}\n`)
    process.exit(e instanceof ExitError ? e.code : 64)
  }
}
