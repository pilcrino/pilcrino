#!/usr/bin/env node
// Competitor profiles for a post run, read from one pinned commit of
// origin/<base>. Refreshes land on the base branch; a post branch can be months
// behind it, so a run never reads profiles from its own working tree.
// Plain Node, no dependencies: the plugin ships no node_modules, and the
// skill runs this script straight from the plugin directory.
// Spec: docs/superpowers/specs/2026-10-06-competitor-profiles-from-base-design.md
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FETCH_TIMEOUT_MS = 60_000
const SKIP = new Set(['_summary.md'])
const METHODOLOGY = 'methodology.md'

export class UsageError extends Error {}

// `quiet` ignores all stdio: a killed fetch can leave an ssh child holding
// inherited pipes, and spawnSync would wait for it.
function git(args, opts = {}) {
  const r = spawnSync('git', args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    timeout: opts.timeout,
    killSignal: 'SIGKILL',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: opts.quiet ? 'ignore' : ['ignore', 'pipe', 'pipe'],
  })
  const err = r.error ? `${r.error.message}\n` : ''
  return { ok: r.status === 0 && !r.error, stdout: r.stdout ?? '', stderr: err + (r.stderr ?? '') }
}

export function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? s : null
}

export function parseProfile(text, file) {
  const stem = basename(file, '.md')
  const h1 = /^#[ \t]+(.+?)[ \t]*$/m.exec(text)
  const slug = /^\*\*Slug:\*\*[ \t]*`?([^`\s]+)`?[ \t]*$/m.exec(text)
  const lv = /^\*\*Last verified:\*\*[ \t]*(.*?)[ \t]*$/m.exec(text)
  return { slug: slug ? slug[1] : stem, name: h1 ? h1[1] : stem, file, lastVerified: validDate(lv ? lv[1] : null) }
}

function within(a, b) {
  return a === b || a.startsWith(b + sep)
}

function pickSource(cwd, base, fetchTimeoutMs, g) {
  if (!g(['remote', 'get-url', 'origin'], { cwd }).ok) return { source: 'worktree', commit: null, fetched: false }
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  if (!env.GIT_SSH_COMMAND) env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes'
  const fetch = g(['fetch', '--quiet', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`], { cwd, env, timeout: fetchTimeoutMs, quiet: true })
  const rev = g(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${base}^{commit}`], { cwd })
  if (!rev.ok) return { source: 'worktree', commit: null, fetched: fetch.ok }
  return { source: `origin/${base}`, commit: rev.stdout.trim(), fetched: fetch.ok }
}

function readFromCommit(cwd, dir, commit, g) {
  // -z: NUL-delimited and unquoted, so non-ASCII paths survive intact.
  const ls = g(['ls-tree', '-z', commit, '--', `${dir}/`], { cwd })
  if (!ls.ok) throw new Error(`git ls-tree ${commit} -- ${dir}/ failed: ${ls.stderr.trim()}`)
  const paths = ls.stdout.split('\0').filter(Boolean)
    .map((rec) => {
      const tab = rec.indexOf('\t')
      return [rec.slice(0, tab), rec.slice(tab + 1)]
    })
    .filter(([meta, path]) => meta.split(' ')[1] === 'blob' && path.endsWith('.md') && !SKIP.has(basename(path)))
    .map(([, path]) => path)
  const files = paths.map((path) => {
    const show = g(['show', `${commit}:${path}`], { cwd })
    if (!show.ok) throw new Error(`git show ${commit}:${path} failed: ${show.stderr.trim()}`)
    return { file: path, text: show.stdout }
  })
  return { dirExists: ls.stdout.trim() !== '', files }
}

function readFromWorktree(cwd, dir) {
  const abs = resolve(cwd, dir)
  if (!existsSync(abs)) return { dirExists: false, files: [] }
  const files = readdirSync(abs)
    .filter((name) => name.endsWith('.md') && !SKIP.has(name) && statSync(join(abs, name)).isFile())
    .sort()
    .map((name) => ({ file: `${dir}/${name}`, text: readFileSync(join(abs, name), 'utf8') }))
  return { dirExists: true, files }
}

// Install `files` as the whole content of `out`. The previous snapshot is kept
// aside until the new one is in place and restored if installing fails.
/**
 * @param {string} out
 * @param {{ file: string, text: string }[]} files
 * @param {(oldPath: string, newPath: string) => void} [rename]
 */
export function installSnapshot(out, files, rename = renameSync) {
  const parent = dirname(out)
  mkdirSync(parent, { recursive: true })
  const tmp = mkdtempSync(join(parent, `.${basename(out)}.new-`))
  try {
    for (const f of files) writeFileSync(join(tmp, basename(f.file)), f.text)
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true })
    throw e
  }
  const backup = existsSync(out) ? `${join(parent, `.${basename(out)}.old-`)}${process.pid}-${Date.now()}` : null
  if (backup) {
    try {
      rename(out, backup)
    } catch (e) {
      rmSync(tmp, { recursive: true, force: true })
      throw e
    }
  }
  try {
    rename(tmp, out)
  } catch (e) {
    if (backup) rename(backup, out)
    rmSync(tmp, { recursive: true, force: true })
    throw e
  }
  if (backup) rmSync(backup, { recursive: true, force: true })
}

/**
 * @param {{ cwd?: string, dir?: string, base?: string, out?: string | null, fetchTimeoutMs?: number }} opts
 * @param {{ git?: Function, rename?: (oldPath: string, newPath: string) => void }} [deps]
 */
export function run({ cwd = process.cwd(), dir, base, out = null, fetchTimeoutMs = FETCH_TIMEOUT_MS }, deps = {}) {
  if (!dir || !base) throw new UsageError('usage: competitor-profiles.mjs --dir <competitors_dir> --base <branch> [--out <dir>]')
  const g = deps.git ?? git
  const cleanDir = dir.replace(/\/+$/, '')
  if (out) {
    const a = resolve(cwd, out)
    const b = resolve(cwd, cleanDir)
    if (within(a, b) || within(b, a)) throw new UsageError(`--out ${out} overlaps --dir ${dir}`)
  }
  const src = pickSource(cwd, base, fetchTimeoutMs, g)
  const { dirExists, files } = src.commit ? readFromCommit(cwd, cleanDir, src.commit, g) : readFromWorktree(cwd, cleanDir)
  const profiles = files
    .filter((f) => basename(f.file) !== METHODOLOGY)
    .map((f) => ({ ...parseProfile(f.text, f.file), path: out ? join(out, basename(f.file)) : null }))
  if (out) installSnapshot(resolve(cwd, out), files, deps.rename)
  return {
    source: src.source,
    commit: src.commit,
    fetched: src.fetched,
    dirExists,
    methodology: files.some((f) => basename(f.file) === METHODOLOGY),
    out,
    profiles,
  }
}

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = { '--dir': 'dir', '--base': 'base', '--out': 'out' }[argv[i]]
    if (!key || argv[i + 1] === undefined) throw new UsageError(`unknown or incomplete argument: ${argv[i]}`)
    opts[key] = argv[i + 1]
  }
  return opts
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2)}\n`)
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    process.exit(e instanceof UsageError ? 2 : 1)
  }
}
