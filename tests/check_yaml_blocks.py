#!/usr/bin/env python3
"""Parse every ```yaml fenced block in the given markdown files; exit 1 on any YAML error.

Blocks that look like a config (a `publish:` map with an `adapter`) are also held to the
invariants an example must not break (config-schema.md §Fitting the site's frontmatter,
invariants 15 and 16): a `frontmatter_keys` list includes the required keys of its
template and the configured cover key; WordPress names exactly one password source.
"""
import re, sys

try:
    import yaml
except ImportError:
    print("FAIL: PyYAML not installed. Run: python3 -m pip install --user pyyaml", file=sys.stderr)
    sys.exit(1)

# Required keys per frontmatter template (title, description key, date key, cover key; layout for jekyll).
REQUIRED = {
    "astro-starlight": ["title", "excerpt", "date", "cover"],
    "astro-content": ["title", "description", "pubDate", "heroImage"],
    "wordpress": ["title", "excerpt", "date"],
    "markdown-astro": ["title", "description", "pubDate", "heroImage"],
    "markdown-hugo": ["title", "description", "date", "cover"],
    "markdown-jekyll": ["layout", "title", "description", "date", "image"],
    "markdown-ghost": ["title", "excerpt", "published_at", "feature_image"],
    "markdown-nextjs": ["title", "description", "date", "image"],
    "markdown-eleventy": ["title", "description", "date", "image"],
    "markdown-generic": ["title", "description", "date", "image"],
}
DRAFT_KEYS = {"draft", "published"}


def config_failures(doc):
    """Invariant breaches in an example config block; [] when it is not a config or is fine."""
    out = []
    if not isinstance(doc, dict):
        return out
    publish = doc.get("publish")
    if not isinstance(publish, dict) or "adapter" not in publish:
        return out
    for adapter, block in publish.items():
        if not isinstance(block, dict):
            continue
        template = block.get("frontmatter_template")
        keys = block.get("frontmatter_keys")
        if keys is not None:
            if not isinstance(keys, list) or not keys or not all(isinstance(k, str) and k for k in keys):
                out.append(f"publish.{adapter}.frontmatter_keys must be a non-empty list of strings (invariant 16)")
                continue
            if any(k in DRAFT_KEYS for k in keys):
                out.append(f"publish.{adapter}.frontmatter_keys lists a draft key; draft_mechanism/draft_key decide it (invariant 16)")
            name = re.sub(r"^.*/|\.md$", "", template or "")
            required = list(REQUIRED.get(name, []))
            cover_key = block.get("cover_key")
            if adapter == "markdown" and isinstance(cover_key, str) and required:
                required[-1] = cover_key
            missing = [k for k in required if k not in keys]
            if missing:
                out.append(f"publish.{adapter}.frontmatter_keys lacks required {missing} for {name} (invariant 16)")
        if adapter == "markdown" and isinstance(block.get("cover_key"), str) and "." in block["cover_key"]:
            out.append("publish.markdown.cover_key must be one top-level key, no dot (invariant 11)")
    wp = publish.get("wordpress")
    if publish.get("adapter") == "wordpress-rest" and isinstance(wp, dict):
        sources = [k for k in ("app_password_env", "app_password_keychain") if wp.get(k)]
        if len(sources) != 1:
            out.append(f"publish.wordpress names {len(sources)} password sources, needs exactly one (invariant 15)")
    return out


rc = 0
for path in sys.argv[1:]:
    text = open(path).read()
    for i, block in enumerate(re.findall(r"```yaml\n(.*?)```", text, re.S)):
        try:
            doc = yaml.safe_load(block)
        except yaml.YAMLError as e:
            print(f"YAML FAIL {path} block {i}: {e}", file=sys.stderr)
            rc = 1
            continue
        for msg in config_failures(doc):
            print(f"YAML FAIL {path} block {i}: {msg}", file=sys.stderr)
            rc = 1
print("YAML OK" if rc == 0 else "YAML FAILED")
sys.exit(rc)
