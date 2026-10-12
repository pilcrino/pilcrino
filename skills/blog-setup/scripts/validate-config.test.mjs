import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasUnionMerge, parseArgs, PLUGIN_ROOT, runChecks, TEMPLATE_KEYS } from './validate-config.mjs'

const SCRIPT = fileURLToPath(new URL('./validate-config.mjs', import.meta.url))

// The yaml package comes from browser/node_modules. One real install here (a
// no-op once the stamp matches); every case below passes --no-install so no
// case runs npm.
before(() => {
  const r = spawnSync(process.execPath, [join(PLUGIN_ROOT, 'browser', 'bin.mjs'), 'install'], { stdio: ['ignore', 'ignore', 'inherit'] })
  assert.equal(r.status, 0, 'browser install')
})

const PROFILE = ['blog.md', 'voice.md', 'authors.md', 'audience.md', 'image-style.md']

const BLOG = `blog:
  name: "Trail Notes"
  url: https://trailnotes.example
  language: en
  route_prefix: /blog/
  trailing_slash: true

modules:
  reddit_research: false
  x_research: false
  product: false
  competitors: false
  repurpose: false
`

const ASTRO = `${BLOG}
images:
  enabled: [remotion, ai-prompt]
  featured_default: remotion
  remotion:
    project_dir: tools/remotion

publish:
  adapter: astro-git-pr
  site_live: true
  astro:
    content_dir: src/content/blog
    assets_dir: src/assets/blog
    frontmatter_template: adapters/publish/frontmatter/astro-content.md
    draft_mechanism: "draft: true"
    frontmatter_keys: [title, description, pubDate, heroImage]

git:
  branch_prefix: blog/
  base_branch: main
  push_without_asking: true

review:
  plan_approval: ask

research:
`

const HUGO = `${BLOG}
images:
  enabled: [ai-prompt]

publish:
  adapter: markdown
  markdown:
    content_dir: content/posts
    assets_dir: static/images
    image_url_prefix: /images
    platform: hugo
    frontmatter_template: adapters/publish/frontmatter/markdown-hugo.md
    frontmatter_keys: [title, description, date, featured_image, draft]
    cover_key: featured_image
    draft_key: draft

git:
  branch_prefix: blog/
  base_branch: main

console:
  publish_policy: gated

research:
`

const WORDPRESS = (passwordLines) => `${BLOG}
images:
  enabled: [ai-prompt]

publish:
  adapter: wordpress-rest
  wordpress:
    content_dir: content/blog
    assets_dir: blog-ops/assets
    frontmatter_template: adapters/publish/frontmatter/wordpress.md
    base_url: https://fieldstack.example
    username: blogbot
${passwordLines}
    default_status: draft

git:
  branch_prefix: blog/
  base_branch: main

research:
`

function repo(config, { profile = PROFILE, remotion = true, gitattributes = 'tools/remotion/src/Root.tsx merge=union\n' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-'))
  mkdirSync(join(dir, 'blog-ops', 'profile'), { recursive: true })
  writeFileSync(join(dir, 'blog-ops', 'config.yaml'), config)
  for (const d of profile) writeFileSync(join(dir, 'blog-ops', 'profile', d), `# ${d}\n`)
  if (remotion) mkdirSync(join(dir, 'tools', 'remotion', 'src'), { recursive: true })
  if (gitattributes !== null) writeFileSync(join(dir, '.gitattributes'), gitattributes)
  return dir
}

function run(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--repo', dir, '--no-install'], { encoding: 'utf8' })
  rmSync(dir, { recursive: true, force: true })
  return { status: r.status, out: r.stdout, err: r.stderr }
}

const failing = (out) => out.split('\n').filter((l) => l.startsWith('FAIL')).map((l) => Number(/\((\d+)\)/.exec(l)[1]))

test('a complete Astro config passes all 16 checks, exit 0', () => {
  const r = run(repo(ASTRO))
  assert.equal(r.status, 0, r.out + r.err)
  assert.equal(r.out.split('\n').filter((l) => l.startsWith('ok  ')).length, 16)
  assert.match(r.out, /\nAll 16 checks pass\n$/)
  assert.equal(r.err, '')
})

test('a Hugo markdown config with frontmatter_keys and cover_key passes', () => {
  const r = run(repo(HUGO, { remotion: false, gitattributes: null }))
  assert.equal(r.status, 0, r.out + r.err)
  assert.match(r.out, /All 16 checks pass/)
})

test('WordPress with both password sources fails only check 15 and names the fix', () => {
  const r = run(repo(WORDPRESS('    app_password_env: FIELDSTACK_WP_APP_PASSWORD\n    app_password_keychain: pilcrino-wp-fieldstack'), { remotion: false, gitattributes: null }))
  assert.equal(r.status, 1)
  assert.deepEqual(failing(r.out), [15])
  assert.match(r.out, /1 of 16 checks failed:\n- WordPress has exactly one place .*: both app_password_env and app_password_keychain are set; keep one\n$/)
})

test('WordPress with one password source passes 15', () => {
  const r = run(repo(WORDPRESS('    app_password_keychain: pilcrino-wp-fieldstack'), { remotion: false, gitattributes: null }))
  assert.equal(r.status, 0, r.out)
})

test('frontmatter_keys that drops a required key fails check 16 and names the key', () => {
  const r = run(repo(HUGO.replace('[title, description, date, featured_image, draft]', '[title, date, featured_image]'), { remotion: false, gitattributes: null }))
  assert.equal(r.status, 1)
  assert.deepEqual(failing(r.out), [16])
  assert.match(r.out, /frontmatter_keys is missing description, which the post template always writes/)
})

test('frontmatter_keys without the configured cover key fails check 16', () => {
  const r = run(repo(HUGO.replace('[title, description, date, featured_image, draft]', '[title, description, date, cover]'), { remotion: false, gitattributes: null }))
  assert.deepEqual(failing(r.out), [16])
  assert.match(r.out, /missing featured_image/)
})

test('a missing profile document fails check 6', () => {
  const r = run(repo(ASTRO, { profile: PROFILE.filter((d) => d !== 'voice.md') }))
  assert.equal(r.status, 1)
  assert.deepEqual(failing(r.out), [6])
  assert.match(r.out, /blog-ops\/profile\/voice\.md is missing/)
})

test('a review block with an unknown key fails check 11 in plain words', () => {
  const r = run(repo(ASTRO.replace('review:\n  plan_approval: ask', 'review:\n  plan_approval: ask\n  strictness: high')))
  assert.equal(r.status, 1)
  assert.deepEqual(failing(r.out), [11])
  assert.match(r.out, /review\.strictness is not a setting Pilcrino knows/)
})

test('Remotion on without the .gitattributes line fails check 14; a missing project folder fails 3', () => {
  const r = run(repo(ASTRO, { gitattributes: '# nothing here\n' }))
  assert.deepEqual(failing(r.out), [14])
  assert.match(r.out, /tools\/remotion\/src\/Root\.tsx merge=union/)
  const r2 = run(repo(ASTRO, { remotion: false }))
  assert.deepEqual(failing(r2.out), [3])
})

test('a file that is not YAML, or no config at all, reports one failure and exits 1', () => {
  const r = run(repo('blog: [unclosed'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^FAIL  The settings file reads as YAML \(1\)/)
  const dir = mkdtempSync(join(tmpdir(), 'vc-'))
  const r2 = run(dir)
  assert.equal(r2.status, 1)
  assert.match(r2.out, /blog-ops\/config\.yaml exists \(1\)/)
})

test('owner-facing lines carry no em dash and the check titles never lead with a number', () => {
  const r = run(repo(ASTRO))
  assert.ok(!r.out.includes('—'))
  for (const line of r.out.split('\n').filter((l) => /^(ok  |FAIL)/.test(l))) assert.match(line, /^(ok  |FAIL)  [A-Z]/)
})

test('runChecks: every template in the key table yields the schema table\'s required keys for check 16', () => {
  const required = (tpl, extra = {}) => {
    const cfg = { blog: { name: 'x', url: 'https://x', route_prefix: '/', trailing_slash: true }, modules: {}, images: { enabled: ['ai-prompt'] }, publish: { adapter: 'markdown', markdown: { content_dir: 'a', assets_dir: 'b', platform: tpl.replace(/^markdown-|\.md$/g, ''), frontmatter_template: `adapters/publish/frontmatter/${tpl}`, frontmatter_keys: ['nothing'], ...extra } } }
    const c = runChecks(cfg, { repo: '/nonexistent' }).find((r) => r.n === 16)
    return /missing (.*), which/.exec(c.detail)[1].split(', ')
  }
  assert.deepEqual(required('markdown-jekyll.md'), ['layout', 'title', 'description', 'date', 'image'])
  assert.deepEqual(required('markdown-ghost.md'), ['title', 'excerpt', 'published_at', 'feature_image'])
  assert.deepEqual(required('markdown-astro.md', { cover_key: 'hero' }), ['title', 'description', 'pubDate', 'hero'])
  assert.equal(Object.keys(TEMPLATE_KEYS).length, 10)
})

test('hasUnionMerge and parseArgs', () => {
  assert.equal(hasUnionMerge('# c\n/tools/remotion/src/Root.tsx   merge=union text\n', 'tools/remotion/src/Root.tsx'), true)
  assert.equal(hasUnionMerge('tools/remotion/src/Root.tsx merge=ours\n', 'tools/remotion/src/Root.tsx'), false)
  assert.equal(parseArgs(['--repo', '/r', '--no-install']).install, false)
  assert.equal(parseArgs(['--repo', '/r']).repo, '/r')
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/)
})
