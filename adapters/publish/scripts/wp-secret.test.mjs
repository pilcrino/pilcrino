import { test } from 'node:test'

// The script runs under Git Bash on Windows; this suite spawns bash with a Unix PATH and stubs, so it runs on macOS and Linux only.
const unixOnly = process.platform === 'win32' ? 'runs the bash script with Unix stubs; skipped on Windows' : false
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'wp-secret.sh')

// A stubbed `security` on PATH: answers `find-generic-password -s <svc> -a <acct> -w` for one
// known item and fails (exit 44, as the real tool does for a missing item) for anything else.
function makeBin (dir) {
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  const stub = `#!/usr/bin/env bash
[ "$1" = find-generic-password ] || { echo "stub: unexpected subcommand $1" >&2; exit 2; }
shift
svc=""; acct=""; w=0
while [ $# -gt 0 ]; do
  case "$1" in
    -s) svc="$2"; shift 2 ;;
    -a) acct="$2"; shift 2 ;;
    -w) w=1; shift ;;
    *) echo "stub: unexpected flag $1" >&2; exit 2 ;;
  esac
done
[ "$w" = 1 ] || { echo "stub: -w missing" >&2; exit 2; }
if [ "$svc" = pilcrino-wp-fieldstack ] && [ "$acct" = blogbot ]; then printf 'kc-secret xxxx yyyy\\n'; exit 0; fi
echo "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain." >&2
exit 44
`
  writeFileSync(join(bin, 'security'), stub)
  chmodSync(join(bin, 'security'), 0o755)
  return bin
}

function run (configText, { env = {}, args = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wp-secret-'))
  try {
    const cfg = join(dir, 'config.yaml')
    writeFileSync(cfg, configText)
    const bin = makeBin(dir)
    const r = spawnSync('bash', [script, cfg, ...args], {
      encoding: 'utf8',
      // A minimal environment: the stub first on PATH, HOME for bash, nothing else leaks in.
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, ...env },
    })
    return { status: r.status, stdout: r.stdout, stderr: r.stderr }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const base = `blog:
  name: "Fieldstack"
  url: https://fieldstack.example

publish:
  adapter: wordpress-rest
  wordpress:
    content_dir: content/blog
    base_url: https://fieldstack.example   # the site
    username: blogbot
`

test('env var set: prints its value, nothing on stderr', { skip: unixOnly }, () => {
  const r = run(base + '    app_password_env: FIELDSTACK_WP_APP_PASSWORD\n', {
    env: { FIELDSTACK_WP_APP_PASSWORD: 'env-secret aaaa bbbb' },
  })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'env-secret aaaa bbbb\n')
  assert.equal(r.stderr, '')
})

test('env var unset: nothing on stdout, one line naming the variable, exit 1', { skip: unixOnly }, () => {
  const r = run(base + '    app_password_env: FIELDSTACK_WP_APP_PASSWORD\n')
  assert.equal(r.status, 1)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /^wp-secret\.sh: \$FIELDSTACK_WP_APP_PASSWORD is not set in this process/)
  assert.equal(r.stderr.trim().split('\n').length, 1)
})

test('keychain key present: reads the item for the configured username via security', { skip: unixOnly }, () => {
  const r = run(base + '    app_password_keychain: pilcrino-wp-fieldstack\n')
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'kc-secret xxxx yyyy\n')
  assert.equal(r.stderr, '')
})

test('keychain key quoted and commented: still resolves', { skip: unixOnly }, () => {
  const r = run(base + '    app_password_keychain: "pilcrino-wp-fieldstack"  # where setup stored it\n')
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'kc-secret xxxx yyyy\n')
})

test('keychain item missing: nothing on stdout, the reason names service and account, exit 1', { skip: unixOnly }, () => {
  const r = run(base + '    app_password_keychain: pilcrino-wp-other\n')
  assert.equal(r.status, 1)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /no keychain item with service "pilcrino-wp-other" and account "blogbot"/)
  assert.doesNotMatch(r.stderr, /kc-secret/)
})

test('neither key set: exit 1 with the invariant named', { skip: unixOnly }, () => {
  const r = run(base, { env: { FIELDSTACK_WP_APP_PASSWORD: 'should-not-leak' } })
  assert.equal(r.status, 1)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /neither publish\.wordpress\.app_password_env nor app_password_keychain is set .*invariant 15/)
})

test('CRLF line endings: the env var is still found', { skip: unixOnly }, () => {
  const crlf = (base + '    app_password_env: FIELDSTACK_WP_APP_PASSWORD\n').replace(/\n/g, '\r\n')
  const r = run(crlf, { env: { FIELDSTACK_WP_APP_PASSWORD: 'crlf-secret' } })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'crlf-secret\n')
  assert.equal(r.stderr, '')
})

test('both keys set: exit 1, nothing printed even though both would resolve', { skip: unixOnly }, () => {
  const r = run(base + '    app_password_env: FIELDSTACK_WP_APP_PASSWORD\n    app_password_keychain: pilcrino-wp-fieldstack\n', {
    env: { FIELDSTACK_WP_APP_PASSWORD: 'env-secret' },
  })
  assert.equal(r.status, 1)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /both .* are set/)
})

test('keys outside publish.wordpress are ignored, before and after the block', { skip: unixOnly }, () => {
  const cfg = `publish:
  adapter: wordpress-rest
  astro:
    app_password_env: WRONG_BLOCK
  wordpress:
    username: blogbot
    app_password_env: RIGHT_ONE
git:
  app_password_env: ALSO_WRONG
`
  const r = run(cfg, { env: { RIGHT_ONE: 'right', WRONG_BLOCK: 'wrong', ALSO_WRONG: 'wrong' } })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'right\n')
})

test('missing config path: exit 1', { skip: unixOnly }, () => {
  const r = spawnSync('bash', [script, '/nonexistent/config.yaml'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } })
  assert.equal(r.status, 1)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /config not found/)
})
