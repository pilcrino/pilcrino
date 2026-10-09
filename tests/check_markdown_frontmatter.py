#!/usr/bin/env python3
"""Each adapters/publish/frontmatter/markdown-<platform>.md has a first ```yaml block
whose keys are exactly that platform's keys (markdown adapter spec, section 3.2).
The draft strip commands in adapters/publish/markdown.md remove the flag from the
frontmatter only and leave the body byte for byte (tests/fixtures/markdown-draft-strip.md)."""
import os, re, subprocess, sys, tempfile

try:
    import yaml
except ImportError:
    print("FAIL: PyYAML not installed. Run: python3 -m pip install --user pyyaml", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
COMMON = ["title", "description", "date", "tags", "author", "image"]
EXPECTED = {
    "astro": ["title", "description", "pubDate", "tags", "author", "heroImage", "draft"],
    "hugo": ["title", "description", "date", "tags", "author", "cover", "draft"],
    "jekyll": ["layout", "title", "description", "date", "tags", "author", "image", "published"],
    "ghost": ["title", "excerpt", "published_at", "tags", "authors", "feature_image"],
    "nextjs": COMMON,
    "eleventy": COMMON,
    "generic": COMMON,
}

rc = 0
def fail(msg):
    global rc
    print(f"FRONTMATTER FAIL: {msg}", file=sys.stderr)
    rc = 1

for platform, keys in EXPECTED.items():
    rel = f"adapters/publish/frontmatter/markdown-{platform}.md"
    path = os.path.join(ROOT, rel)
    if not os.path.isfile(path):
        fail(f"{rel}: missing")
        continue
    blocks = re.findall(r"```yaml\n(.*?)```", open(path).read(), re.S)
    if not blocks:
        fail(f"{rel}: no ```yaml block")
        continue
    body = "\n".join(l for l in blocks[0].splitlines() if l.strip() != "---")
    try:
        data = yaml.safe_load(body)
    except yaml.YAMLError as e:
        fail(f"{rel}: first yaml block does not parse: {e}")
        continue
    if not isinstance(data, dict):
        fail(f"{rel}: first yaml block is not a mapping")
        continue
    if sorted(data) != sorted(keys):
        fail(f"{rel}: keys {sorted(data)}, expected {sorted(keys)}")
    if platform == "jekyll" and data.get("layout") != "post":
        fail(f"{rel}: layout must be post")

# Draft strip (markdown.md §Staging step 2): the frontmatter flag goes, the body is unchanged
doc = open(os.path.join(ROOT, "adapters/publish/markdown.md")).read()
fixture = open(os.path.join(ROOT, "tests/fixtures/markdown-draft-strip.md")).read()
head, body = re.match(r"(---\n.*?\n---\n)(.*)", fixture, re.S).groups()
for flag in ("draft: true", "published: false"):
    cmds = [c for c in re.findall(r"^\s*(perl -i .*\"\$POST\")\s*$", doc, re.M) if flag.replace(": ", r":\s*") in c]
    if len(cmds) != 1:
        fail(f"adapters/publish/markdown.md: expected one strip command for `{flag}`, found {len(cmds)}")
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as t:
        t.write(fixture)
    subprocess.run(["bash", "-c", cmds[0]], env={**os.environ, "POST": t.name}, check=True)
    got = open(t.name).read()
    os.unlink(t.name)
    if got != head.replace(flag + "\n", "", 1) + body:
        fail(f"draft strip for `{flag}`: only the frontmatter line may go; the body must stay byte for byte")

print("MARKDOWN FRONTMATTER OK" if rc == 0 else "MARKDOWN FRONTMATTER FAILED")
sys.exit(rc)
