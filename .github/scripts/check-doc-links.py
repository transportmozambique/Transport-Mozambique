"""Verifica cada ligação relativa e imagem em README.md e docs/*.md: o ficheiro tem de existir, e
uma #âncora para um ficheiro Markdown tem de corresponder a um dos seus títulos (as âncoras que o
GitHub gera) ou a um <a id="…">. Sai com 1 quando há uma ligação partida.

Porquê: as páginas ligam-se muito umas às outras e ao código; uma página ou um título com outro
nome partiria as ligações sem ninguém dar por isso.

    python .github/scripts/check-doc-links.py .
"""
import glob
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
files = [os.path.join(root, "README.md")] + sorted(glob.glob(os.path.join(root, "docs", "*.md")))


def slugs(path):
    """As âncoras que o GitHub dá aos títulos de um ficheiro Markdown, e os <a id> explícitos"""
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
        text = re.sub(r"`[^`\n]*`", "", text)  # o código entre crases não é uma ligação
    targets = re.findall(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", text) + re.findall(r'src="([^"]+)"', text) + re.findall(r'href="([^"]+)"', text)
    for t in targets:
        if re.match(r"^(https?:|mailto:)", t):
            continue
        count += 1
        path, _, anchor = t.partition("#")
        target = os.path.normpath(os.path.join(os.path.dirname(f), path)) if path else f
        if not os.path.exists(target):
            print(f"FALTA   {os.path.relpath(f, root)} -> {t}")
            broken += 1
            continue
        if anchor and target.endswith(".md"):
            cache.setdefault(target, slugs(target))
            if anchor not in cache[target]:
                print(f"ÂNCORA  {os.path.relpath(f, root)} -> {t}")
                broken += 1

print(f"{count} ligações verificadas, {broken} partidas")
sys.exit(1 if broken else 0)
