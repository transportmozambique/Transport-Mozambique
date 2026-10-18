"""Checks every relative link and image in README.md and docs/*.md: the file must exist, and a
#anchor into a Markdown file must match one of its headings (GitHub's slugs). Exits 1 on a
broken link.

    python .github/scripts/check-doc-links.py .
"""
import glob
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
files = [os.path.join(root, "README.md")] + sorted(glob.glob(os.path.join(root, "docs", "*.md")))


def slugs(path):
    """The anchors GitHub gives the headings of a Markdown file"""
    out, seen, in_fence = set(), {}, False
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for line in text.splitlines():
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        m = None if in_fence else re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if not m:
            continue
        title = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", m.group(2))
        title = re.sub(r"<[^>]+>", "", title).lower()
        slug = re.sub(r"[^\w\- ]", "", title, flags=re.UNICODE).replace(" ", "-")
        n = seen.get(slug, 0)
        seen[slug] = n + 1
        out.add(slug if n == 0 else f"{slug}-{n}")
    out.update(re.findall(r'<a (?:name|id)="([^"]+)"', text))
    return out


cache, broken, count = {}, 0, 0
for f in files:
    with open(f, encoding="utf-8") as fh:
        text = re.sub(r"```.*?```", "", fh.read(), flags=re.S)
    targets = re.findall(r"\]\(([^)\s]+)\)", text) + re.findall(r'src="([^"]+)"', text) + re.findall(r'href="([^"]+)"', text)
    for t in targets:
        if re.match(r"^(https?:|mailto:)", t):
            continue
        count += 1
        path, _, anchor = t.partition("#")
        target = os.path.normpath(os.path.join(os.path.dirname(f), path)) if path else f
        if not os.path.exists(target):
            print(f"MISSING {os.path.relpath(f, root)} -> {t}")
            broken += 1
            continue
        if anchor and target.endswith(".md"):
            cache.setdefault(target, slugs(target))
            if anchor not in cache[target]:
                print(f"ANCHOR  {os.path.relpath(f, root)} -> {t}")
                broken += 1

print(f"{count} links checked, {broken} broken")
sys.exit(1 if broken else 0)
