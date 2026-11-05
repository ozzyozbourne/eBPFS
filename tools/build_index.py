#!/usr/bin/env python3
"""Regenerate index.html from the chapter-* meta tags of chapters/NN-*.html."""
import html, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
chapters = []
for f in sorted((ROOT / "chapters").glob("[0-9][0-9]-*.html")):
    src = f.read_text(encoding="utf-8")
    meta = dict(re.findall(r'<meta name="chapter-([a-z]+)" content="([^"]*)"', src))
    title = re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S)
    chapters.append({
        "file": f"chapters/{f.name}",
        "num": meta.get("number", f.name[:2]),
        "part": meta.get("part", "Other"),
        "summary": meta.get("summary", ""),
        "title": re.sub(r"<[^>]+>", "", title.group(1)).strip() if title else f.stem,
    })

parts = {}
for c in chapters:
    parts.setdefault(c["part"], []).append(c)

sections = []
for part, items in parts.items():
    cards = "\n".join(
        f'<a class="card" href="{c["file"]}"><h4>{html.escape(c["num"])} · {html.escape(c["title"])}</h4>'
        f'<p>{html.escape(c["summary"])}</p></a>' for c in items)
    sections.append(f'<h2>{html.escape(part)}</h2>\n<div class="grid">\n{cards}\n</div>')

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>eBPF Curriculum · BPF, eBPF and the eunomia-bpf projects</title>
<link rel="stylesheet" href="assets/style.css"><script src="assets/app.js" defer></script></head>
<body>
<header class="site"><a class="brand" href="index.html">eBPF Curriculum</a><span class="crumb">Home</span>
<button id="theme-toggle" type="button">theme</button></header>
<div class="layout"><nav class="toc"></nav><main>
<section class="chapter-hero"><div class="kicker">Curriculum</div>
<h1>BPF, eBPF and the eunomia-bpf projects</h1>
<p class="lede">A chapter-wise guide: what the Berkeley Packet Filter and its extended form are, how they work
inside the Linux kernel, and what every actively maintained <a href="https://github.com/eunomia-bpf">eunomia-bpf</a>
project does, with diagrams, real code, papers and quizzes.</p>
<div class="meta"><span>{len(chapters)} chapters</span><span>Start with Chapter 01 if eBPF is new to you</span></div></section>
{chr(10).join(sections)}
</main></div></body></html>
"""
(ROOT / "index.html").write_text(page, encoding="utf-8")
print(f"index.html: {len(chapters)} chapters")
