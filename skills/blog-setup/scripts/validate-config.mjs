#!/usr/bin/env node
// Checks blog-ops/config.yaml against the 16 validation invariants of
// skills/blog-post-workflow/references/config-schema.md and prints one plain
// line per check for the blog owner. Run by blog-setup's final checks, from
// the blog repository root:
//
//   node "${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/scripts/validate-config.mjs" [--repo <path>] [--no-install]
//
// The YAML parser is the `yaml` package the browser MCP server already ships
// with (browser/package.json): a fresh Mac has no PyYAML and no js-yaml, so the
// script first runs `node browser/bin.mjs install`, which is a no-op once the
// stamp matches, then imports `yaml` from browser/node_modules by path. Nothing
// else is installed. Exit 0 when every check passes, 1 otherwise, 2 for a usage
// error. Diagnostics of the install step go to stderr.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const ADAPTERS = ['astro-git-pr', 'wordpress-rest', 'markdown']
const PLATFORMS = ['astro', 'hugo', 'jekyll', 'ghost', 'nextjs', 'eleventy', 'generic']
const PROFILE_DOCS = ['blog.md', 'voice.md', 'authors.md', 'audience.md', 'image-style.md']
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

// Required frontmatter keys per template, from config-schema.md §Fitting the
// site's frontmatter. `cover` names the default cover key, which
// publish.markdown.cover_key replaces for the markdown adapter; null means the
// template has no cover key (wordpress).
export const TEMPLATE_KEYS = {
  'astro-starlight.md': { required: ['title', 'excerpt', 'date'], cover: 'cover', draft: 'draft' },
  'astro-content.md': { required: ['title', 'description', 'pubDate'], cover: 'heroImage', draft: 'draft' },
  'wordpress.md': { required: ['title', 'excerpt', 'date'], cover: null, draft: 'draft' },
  'markdown-astro.md': { required: ['title', 'description', 'pubDate'], cover: 'heroImage', draft: 'draft' },
  'markdown-hugo.md': { required: ['title', 'description', 'date'], cover: 'cover', draft: 'draft' },
  'markdown-jekyll.md': { required: ['layout', 'title', 'description', 'date'], cover: 'image', draft: 'published' },
  'markdown-ghost.md': { required: ['title', 'excerpt', 'published_at'], cover: 'feature_image', draft: null },
  'markdown-nextjs.md': { required: ['title', 'description', 'date'], cover: 'image', draft: null },
  'markdown-eleventy.md': { required: ['title', 'description', 'date'], cover: 'image', draft: null },
  'markdown-generic.md': { required: ['title', 'description', 'date'], cover: 'image', draft: null },
}

const CONSOLE_KEYS = {
  port: 'integer',
  max_concurrent_writes: 'integer',
  scheduler_interval_ms: 'integer',
  publish_policy: ['gated', 'auto'],
  verification: { build_check: 'boolean', vision: ['on', 'off', 'auto'], vision_timeout_secs: 'integer' },
  max_limit_resumes: 'integer',
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== ''
const get = (obj, path) => path.split('.').reduce((o, k) => (isObj(o) ? o[k] : undefined), obj)

/** Runs `node browser/bin.mjs install` so browser/node_modules exists. Returns null on success, else a one-line reason. */
export function installBrowserPackages(pluginRoot = PLUGIN_ROOT, { spawn = spawnSync } = {}) {
  const bin = join(pluginRoot, 'browser', 'bin.mjs')
  if (!existsSync(bin)) return `the plugin's browser folder is missing (${bin})`
  // stdout of the install is sent to stderr too: this script's stdout is the report.
  const r = spawn(process.execPath, [bin, 'install'], { stdio: ['ignore', 2, 2] })
  if (r.error) return `could not run ${bin}: ${r.error.message}`
  if (r.status !== 0) return `node ${bin} install exited with ${r.status}`
  return null
}

/** The `yaml` package from browser/node_modules, resolved by path (no NODE_PATH). */
export async function loadYaml(pluginRoot = PLUGIN_ROOT) {
  const entry = join(pluginRoot, 'browser', 'node_modules', 'yaml', 'dist', 'index.js')
  if (!existsSync(entry)) throw new Error(`the yaml package is not at ${entry}; run: node ${join(pluginRoot, 'browser', 'bin.mjs')} install`)
  return import(pathToFileURL(entry).href)
}

function typeErrors(block, spec, prefix) {
  const errs = []
  for (const key of Object.keys(block)) {
    if (!(key in spec)) { errs.push(`${prefix}${key} is not a setting Pilcrino knows`); continue }
    const want = spec[key]
    const v = block[key]
    if (Array.isArray(want)) { if (!want.includes(v)) errs.push(`${prefix}${key} must be one of ${want.join(', ')}`) }
    else if (want === 'integer') { if (!Number.isInteger(v)) errs.push(`${prefix}${key} must be a whole number`) }
    else if (want === 'boolean') { if (typeof v !== 'boolean') errs.push(`${prefix}${key} must be true or false`) }
    else if (isObj(want)) { if (!isObj(v)) errs.push(`${prefix}${key} must be a group of settings`); else errs.push(...typeErrors(v, want, `${prefix}${key}.`)) }
  }
  return errs
}

/** True when `.gitattributes` text marks `path` with merge=union. */
export function hasUnionMerge(text, path) {
  return text.split('\n').some((raw) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return false
    const [pattern, ...attrs] = line.split(/\s+/)
    return (pattern === path || pattern === `/${path}`) && attrs.includes('merge=union')
  })
}

/**
 * Runs the 16 checks on a parsed config. `repo` is the blog repository root;
 * `fs` is a seam. Returns [{ n, title, ok, detail }], one per invariant, in order.
 */
export function runChecks(cfg, { repo, fs = { existsSync, readFileSync, statSync } } = {}) {
  const out = []
  const check = (n, title, problems) => {
    const list = Array.isArray(problems) ? problems.filter(Boolean) : problems ? [problems] : []
    out.push({ n, title, ok: list.length === 0, detail: list.join('; ') })
  }
  const inRepo = (p) => join(repo, p)
  const dirExists = (p) => { try { return fs.statSync(inRepo(p)).isDirectory() } catch { return false } }
  const fileExists = (p) => fs.existsSync(inRepo(p))

  const ok1 = isObj(cfg)
  const enabled = get(cfg, 'images.enabled')
  const adapter = get(cfg, 'publish.adapter')
  check(1, 'Blog name, address, modules, image types and publishing method are set', !ok1 ? 'the file is not a settings document' : [
    !nonEmpty(get(cfg, 'blog.name')) && 'blog.name is missing',
    !nonEmpty(get(cfg, 'blog.url')) && 'blog.url is missing',
    !isObj(cfg.modules) && 'the modules section is missing',
    !(Array.isArray(enabled) && enabled.length > 0) && 'images.enabled must list at least one image type',
    !nonEmpty(adapter) && 'publish.adapter is missing',
  ])
  if (!ok1) {
    for (let n = 2; n <= 16; n++) check(n, 'Skipped: the file could not be read as settings', 'not checked')
    return out
  }
  const list = Array.isArray(enabled) ? enabled : []
  const fd = get(cfg, 'images.featured_default')
  check(2, 'The default featured-image type is one of the enabled types', fd !== undefined && !list.includes(fd) && `images.featured_default is ${fd}, which is not in images.enabled`)

  const remotion = list.includes('remotion')
  const projectDir = get(cfg, 'images.remotion.project_dir')
  check(3, 'The Remotion image project folder exists when Remotion images are on', remotion && [
    !nonEmpty(projectDir) && 'images.remotion.project_dir is missing',
    nonEmpty(projectDir) && !dirExists(projectDir) && `the folder ${projectDir} does not exist`,
  ])

  const block = isObj(cfg.publish) ? cfg.publish[{ 'astro-git-pr': 'astro', 'wordpress-rest': 'wordpress', markdown: 'markdown' }[adapter]] : undefined
  const platform = get(cfg, 'publish.markdown.platform')
  const need = (keys) => keys.filter((k) => !nonEmpty(block?.[k])).map((k) => `publish.${adapter === 'astro-git-pr' ? 'astro' : adapter === 'wordpress-rest' ? 'wordpress' : 'markdown'}.${k} is missing`)
  check(4, 'The publishing method is known and its settings are complete', !ADAPTERS.includes(adapter) ? `publish.adapter is ${adapter ?? 'missing'}; it must be one of ${ADAPTERS.join(', ')}` : !isObj(block) ? `the publish settings for ${adapter} are missing` : [
    ...(adapter === 'astro-git-pr' ? need(['content_dir', 'assets_dir', 'frontmatter_template', 'draft_mechanism']) : []),
    ...(adapter === 'wordpress-rest' ? need(['content_dir', 'assets_dir', 'frontmatter_template', 'base_url', 'username']) : []),
    ...(adapter === 'markdown' ? [
      ...need(['content_dir', 'assets_dir', 'platform', 'frontmatter_template']),
      nonEmpty(platform) && !PLATFORMS.includes(platform) && `publish.markdown.platform is ${platform}; it must be one of ${PLATFORMS.join(', ')}`,
      PLATFORMS.includes(platform) && nonEmpty(block.frontmatter_template) && block.frontmatter_template !== `adapters/publish/frontmatter/markdown-${platform}.md` && `publish.markdown.frontmatter_template must be adapters/publish/frontmatter/markdown-${platform}.md`,
      'site_dir' in block && 'publish.markdown.site_dir is not allowed (only Astro sites have one)',
    ] : []),
  ])

  const profileDir = 'blog-ops/profile'
  const competitorsDir = nonEmpty(get(cfg, 'competitors.profile_dir')) ? get(cfg, 'competitors.profile_dir').trim() : 'blog-ops/profile/competitors'
  const modules = isObj(cfg.modules) ? cfg.modules : {}
  check(5, 'The product and competitor documents exist when those modules are on (the base-branch copy is checked at intake)', [
    modules.product === true && !fileExists(`${profileDir}/product.md`) && `${profileDir}/product.md is missing`,
    modules.competitors === true && !fileExists(`${competitorsDir}/methodology.md`) && `${competitorsDir}/methodology.md is missing`,
  ])
  check(6, 'The five profile documents exist (blog, voice, authors, audience, image style)', PROFILE_DOCS.filter((d) => !fileExists(`${profileDir}/${d}`)).map((d) => `${profileDir}/${d} is missing`))

  const rp = get(cfg, 'blog.route_prefix')
  check(7, 'The blog address prefix starts and ends with a slash', !nonEmpty(rp) ? 'blog.route_prefix is missing' : !(rp.startsWith('/') && rp.endsWith('/')) && `blog.route_prefix is ${rp}; it must start and end with /`)
  const exe = get(cfg, 'browser.executable')
  check(8, 'The Chrome path, when given, is a full path', exe !== undefined && !(nonEmpty(exe) && isAbsolute(exe)) && `browser.executable must be a full path starting with /`)
  check(9, 'Whether post addresses end with a slash is recorded', typeof get(cfg, 'blog.trailing_slash') !== 'boolean' && 'blog.trailing_slash must be true or false')
  check(10, 'Automatic publishing is only on for an Astro blog', get(cfg, 'console.publish_policy') === 'auto' && adapter !== 'astro-git-pr' && `console.publish_policy is auto but the publishing method is ${adapter}; only astro-git-pr may publish automatically`)

  const tpl = nonEmpty(block?.frontmatter_template) ? TEMPLATE_KEYS[block.frontmatter_template.split('/').pop()] : undefined
  const review = cfg.review
  const coverKey = get(cfg, 'publish.markdown.cover_key')
  const draftKey = get(cfg, 'publish.markdown.draft_key')
  const siteLive = get(cfg, 'publish.site_live')
  const pwa = get(cfg, 'git.push_without_asking')
  const draftMech = get(cfg, 'publish.astro.draft_mechanism')
  check(11, 'Optional settings have the expected values', [
    ...(cfg.console !== undefined ? (isObj(cfg.console) ? typeErrors(cfg.console, CONSOLE_KEYS, 'console.') : ['console must be a group of settings']) : []),
    ...(review !== undefined ? (isObj(review) ? typeErrors(review, { plan_approval: ['ask', 'auto'], pr_monitor: 'boolean' }, 'review.') : ['review must be a group of settings']) : []),
    siteLive !== undefined && typeof siteLive !== 'boolean' && 'publish.site_live must be true or false',
    pwa !== undefined && typeof pwa !== 'boolean' && 'git.push_without_asking must be true or false',
    adapter === 'astro-git-pr' && draftMech !== undefined && !nonEmpty(draftMech) && 'publish.astro.draft_mechanism must be a non-empty line (or none)',
    draftKey !== undefined && adapter === 'markdown' && tpl && !(draftKey === 'none' || (tpl.draft && draftKey === tpl.draft)) && `publish.markdown.draft_key must be ${tpl.draft ? `${tpl.draft} or ` : ''}none for this platform`,
    coverKey !== undefined && !(nonEmpty(coverKey) && !coverKey.includes('.')) && 'publish.markdown.cover_key must be one top-level key without a dot',
    get(cfg, 'publish.wordpress.permalink_structure') !== undefined && !nonEmpty(get(cfg, 'publish.wordpress.permalink_structure')) && 'publish.wordpress.permalink_structure must be a non-empty text',
    get(cfg, 'publish.wordpress.app_password_keychain') !== undefined && !nonEmpty(get(cfg, 'publish.wordpress.app_password_keychain')) && 'publish.wordpress.app_password_keychain must be a non-empty name',
  ])

  const pd = get(cfg, 'competitors.profile_dir')
  check(12, 'The competitor folder is inside the repository (its base-branch copy is checked at intake)', pd !== undefined && [
    !(nonEmpty(pd) && !isAbsolute(pd) && !pd.split(/[\\/]/).includes('..')) && 'competitors.profile_dir must be a folder path inside the repository',
    modules.competitors === true && nonEmpty(pd) && !isAbsolute(pd) && !dirExists(pd) && `the folder ${pd} does not exist`,
  ])
  const li = get(cfg, 'social.linkedin')
  check(13, 'The LinkedIn page id, when given, is set', li !== undefined && !nonEmpty(li?.company_id) && 'social.linkedin.company_id must be a non-empty text')

  check(14, 'Git merges Remotion image registrations from several posts (.gitattributes) when Remotion images are on', remotion && nonEmpty(projectDir) && (() => {
    const p = inRepo('.gitattributes')
    const target = `${projectDir.replace(/\/+$/, '')}/src/Root.tsx`
    if (!fs.existsSync(p)) return `.gitattributes is missing at the repository root; it must contain the line "${target} merge=union"`
    return !hasUnionMerge(fs.readFileSync(p, 'utf8'), target) && `.gitattributes must contain the line "${target} merge=union"`
  })())

  const envName = get(cfg, 'publish.wordpress.app_password_env')
  const keychain = get(cfg, 'publish.wordpress.app_password_keychain')
  check(15, 'WordPress has exactly one place to read its application password from', adapter === 'wordpress-rest' && (() => {
    const hasEnv = envName !== undefined
    const hasKc = keychain !== undefined
    if (hasEnv && hasKc) return 'both app_password_env and app_password_keychain are set; keep one'
    if (!hasEnv && !hasKc) return 'set publish.wordpress.app_password_env (an environment variable name) or app_password_keychain (a keychain item name)'
    if (hasEnv && !(nonEmpty(envName) && ENV_NAME.test(envName))) return `app_password_env must be an environment variable name like MYBLOG_WP_APP_PASSWORD, not ${JSON.stringify(envName)}`
    if (hasKc && !nonEmpty(keychain)) return 'app_password_keychain must be a non-empty name'
    return false
  })())

  const fk = block?.frontmatter_keys
  check(16, 'The list of front matter keys, when given, includes every key the post template needs', fk !== undefined && (() => {
    if (!(Array.isArray(fk) && fk.length > 0 && fk.every(nonEmpty))) return 'frontmatter_keys must be a list of key names with at least one entry'
    // The draft switch never belongs in this list: draft_mechanism / draft_key
    // alone decide whether the draft line is written.
    const draftNames = new Set(['draft', 'published', tpl?.draft, nonEmpty(draftKey) && draftKey !== 'none' ? draftKey : undefined].filter(Boolean))
    const listedDraft = fk.filter((k) => draftNames.has(k))
    if (listedDraft.length > 0) return `frontmatter_keys lists ${listedDraft.join(', ')}: the draft switch is set by draft_key, not listed here`
    if (!tpl) return `the template ${block?.frontmatter_template ?? '(missing)'} is not one Pilcrino knows, so its required keys cannot be checked`
    const cover = adapter === 'markdown' && nonEmpty(coverKey) ? coverKey : tpl.cover
    const required = cover ? [...tpl.required, cover] : tpl.required
    const missing = required.filter((k) => !fk.includes(k))
    return missing.length > 0 && `frontmatter_keys is missing ${missing.join(', ')}, which the post template always writes`
  })())

  return out
}

export function formatReport(results) {
  const lines = results.map((r) => `${r.ok ? 'ok  ' : 'FAIL'}  ${r.title} (${r.n})${r.ok ? '' : `: ${r.detail}`}`)
  const failed = results.filter((r) => !r.ok)
  lines.push('')
  if (failed.length === 0) lines.push(`All ${results.length} checks pass`)
  else {
    lines.push(`${failed.length} of ${results.length} checks failed:`)
    for (const r of failed) lines.push(`- ${r.title}: ${r.detail}`)
  }
  return lines.join('\n') + '\n'
}

export function parseArgs(argv) {
  const opts = { repo: process.cwd(), install: process.env.PILCRINO_VALIDATE_NO_INSTALL !== '1' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--repo') { if (!argv[i + 1]) throw new Error('--repo needs a path'); opts.repo = resolve(argv[++i]) }
    else if (a === '--no-install') opts.install = false
    else throw new Error(`unknown argument ${a}; usage: validate-config.mjs [--repo <path>] [--no-install]`)
  }
  return opts
}

export async function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, pluginRoot = PLUGIN_ROOT } = {}) {
  let opts
  try { opts = parseArgs(argv) } catch (err) { stderr.write(`${err.message}\n`); return 2 }
  if (opts.install) {
    const problem = installBrowserPackages(pluginRoot)
    if (problem) { stderr.write(`Could not prepare the YAML reader: ${problem}\n`); return 1 }
  }
  let yaml
  try { yaml = await loadYaml(pluginRoot) } catch (err) { stderr.write(`Could not load the YAML reader: ${err.message}\n`); return 1 }
  const file = join(opts.repo, 'blog-ops', 'config.yaml')
  if (!existsSync(file)) { stdout.write(`FAIL  The settings file blog-ops/config.yaml exists (1): not found at ${file}\n\n1 of 16 checks failed:\n- The settings file blog-ops/config.yaml exists: not found at ${file}\n`); return 1 }
  let cfg
  try { cfg = yaml.parse(readFileSync(file, 'utf8')) } catch (err) {
    stdout.write(`FAIL  The settings file reads as YAML (1): ${String(err.message).split('\n')[0]}\n\n1 of 16 checks failed:\n- The settings file reads as YAML: ${String(err.message).split('\n')[0]}\n`)
    return 1
  }
  const results = runChecks(cfg, { repo: opts.repo })
  stdout.write(formatReport(results))
  return results.every((r) => r.ok) ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main())
}
