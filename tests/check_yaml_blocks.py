#!/usr/bin/env python3
"""Parse every ```yaml fenced block in the given markdown files; exit 1 on any YAML error."""
import re, sys

try:
    import yaml
except ImportError:
    print("FAIL: PyYAML not installed. Run: python3 -m pip install --user pyyaml", file=sys.stderr)
    sys.exit(1)

rc = 0
for path in sys.argv[1:]:
    text = open(path).read()
    for i, block in enumerate(re.findall(r"```yaml\n(.*?)```", text, re.S)):
        try:
            yaml.safe_load(block)
        except yaml.YAMLError as e:
            print(f"YAML FAIL {path} block {i}: {e}", file=sys.stderr)
            rc = 1
print("YAML OK" if rc == 0 else "YAML FAILED")
sys.exit(rc)
