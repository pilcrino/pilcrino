#!/usr/bin/env bash
# wp-secret.sh: print the WordPress application password that blog-ops/config.yaml names.
#
# Usage: wp-secret.sh [path/to/config.yaml]
#   Default config: blog-ops/config.yaml under the current directory, else under the
#   repository root (git rev-parse --show-toplevel).
#
# Source, exactly one of (config-schema.md invariant 15):
#   publish.wordpress.app_password_env       the NAME of an environment variable
#   publish.wordpress.app_password_keychain  a macOS keychain service name; the account is
#                                            publish.wordpress.username, read with
#                                            security find-generic-password -s <service> -a <user> -w
#
# Output: the password on stdout, nothing else. On any problem: nothing on stdout, one
# line on stderr, exit 1. The value is never written anywhere but stdout, never echoed,
# never logged. Callers bind it per Bash call: WP_APP_PASSWORD="$(wp-secret.sh)" || exit 1
set -uo pipefail

die() { printf 'wp-secret.sh: %s\n' "$1" >&2; exit 1; }

if [ "${1:-}" != "" ]; then
  CONFIG="$1"
elif [ -f blog-ops/config.yaml ]; then
  CONFIG=blog-ops/config.yaml
else
  root=$(git rev-parse --show-toplevel 2>/dev/null) || die "blog-ops/config.yaml not found (not inside the blog's repository)"
  CONFIG="$root/blog-ops/config.yaml"
fi
[ -f "$CONFIG" ] || die "config not found: $CONFIG"

# Value of publish.wordpress.<key>, with quotes and a trailing comment removed; empty when absent.
# Indentation-relative: `publish:` at column 0, `wordpress:` as its child at any indent, the key
# as a child of that. Comments and blank lines are skipped. No YAML library is needed for these
# three scalar keys, and the script must work on a machine where nothing is installed yet.
wp_key() {
  awk -v want="$1" '
    function indent(s) { match(s, /^ */); return RLENGTH }
    function strip(v) {
      sub(/^[ \t]+/, "", v)
      if (v ~ /^"/)         { sub(/^"/, "", v); sub(/".*$/, "", v) }
      else if (v ~ /^\x27/) { sub(/^\x27/, "", v); sub(/\x27.*$/, "", v) }
      else                  { sub(/[ \t]+#.*$/, "", v); sub(/[ \t]+$/, "", v) }
      return v
    }
    /^[ \t]*(#|$)/ { next }
    {
      ind = indent($0)
      if (level == 0) {
        if ($0 ~ /^publish:[ \t]*(#.*)?$/) level = 1
        next
      }
      if (level == 1) {
        if (ind == 0) { level = 0; next }
        if ($0 ~ /^ *wordpress:[ \t]*(#.*)?$/) { level = 2; wind = ind }
        next
      }
      if (ind <= wind) { level = (ind == 0) ? 0 : 1; next }
      line = $0; sub(/^ */, "", line)
      if (index(line, want ":") == 1 && substr(line, length(want) + 2) ~ /^([ \t]|$)/) {
        print strip(substr(line, length(want) + 2)); exit
      }
    }' "$CONFIG"
}

env_name=$(wp_key app_password_env)
service=$(wp_key app_password_keychain)
user=$(wp_key username)
case "$env_name" in null|'~') env_name="" ;; esac
case "$service" in null|'~') service="" ;; esac

if [ -n "$env_name" ] && [ -n "$service" ]; then
  die "both publish.wordpress.app_password_env and app_password_keychain are set in $CONFIG; keep exactly one (config-schema.md invariant 15)"
fi
if [ -z "$env_name" ] && [ -z "$service" ]; then
  die "neither publish.wordpress.app_password_env nor app_password_keychain is set in $CONFIG (config-schema.md invariant 15)"
fi

if [ -n "$env_name" ]; then
  printf '%s' "$env_name" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || die "publish.wordpress.app_password_env is not a valid environment variable name: $env_name"
  value="${!env_name:-}"
  [ -n "$value" ] || die "\$$env_name is not set in this process (publish.wordpress.app_password_env)"
  printf '%s\n' "$value"
  exit 0
fi

[ -n "$user" ] || die "publish.wordpress.username is not set; the keychain item's account is the username"
command -v security >/dev/null 2>&1 || die "the security command is not available; publish.wordpress.app_password_keychain needs macOS"
if ! value=$(security find-generic-password -s "$service" -a "$user" -w 2>/dev/null); then
  die "no keychain item with service \"$service\" and account \"$user\" (security find-generic-password failed); store one with: security add-generic-password -U -s \"$service\" -a \"$user\" -w"
fi
[ -n "$value" ] || die "the keychain item \"$service\" for account \"$user\" holds an empty password"
printf '%s\n' "$value"
