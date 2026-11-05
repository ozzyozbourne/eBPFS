# Authoring guide

Every chapter is one self-contained HTML page in `chapters/`, built from
`chapters/_template.html`. Read the template before writing.

## Page rules

- Link `../assets/style.css` and `../assets/app.js`, plus highlight.js from the CDN as in
  the template. Do not add other external scripts or stylesheets.
- Fill all four `<meta name="chapter-*">` tags; `tools/build_index.py` reads them.
- File name: `NN-slug.html`, with `NN` the two-digit chapter number from `SYLLABUS.md`.
- Use `h2` for sections and `h3` for subsections. The table of contents is generated.
- Use the shared widgets instead of inline JS: `.callout` (`key`, `tip`, `warn`, `danger`),
  `figure` + inline `<svg>`, `.tabs` > `.tab-panel[data-label]`, `.stepper` > `.step`,
  `.quiz` > `.q` with `button.opt[data-right]` and `.why`, `.grid` > `.card`, `details`.
- Small chapter-specific interactive widgets are welcome (a `<script>` at the end of the page
  is allowed for them), but keep them dependency-free.
- Diagrams are inline SVG. Use the CSS variables for colors (`var(--accent)`, `var(--accent2)`,
  `var(--fg)`, `var(--muted)`, `var(--border)`, `var(--bg3)`) so both themes work.
- Escape `<`, `>` and `&` inside `<pre><code>`.
- Code blocks that come from a repository carry `data-file="repo/path/to/file.c"` and are
  copied from the real source (trimmed with `/* ... */` where needed), not invented.
  Clearly label any illustrative code that is not from the repo.

## Content rules

- Audience: a working programmer who knows C and Linux basics but not eBPF.
- Each chapter must cover: what it is, why it exists (the problem), how it works internally,
  how the code is organized (for repo chapters: a directory map), how to build and use it
  with real commands, code walkthroughs, benefits and limitations, and related work.
- At least 2 SVG diagrams, at least 4 real code samples, one stepper or tabs widget,
  a quiz with 4–6 questions, and a references list.
- References: link primary sources — kernel docs, the repo, papers (arXiv / USENIX / ACM),
  LWN articles. Every paper cited must be real; give title, venue, year and a working URL.
  Never invent a citation, a flag, a command, or a benchmark number. When a fact is
  unverified, leave it out or mark it as unverified.
- Cross-link other chapters by file name (see `SYLLABUS.md`) instead of re-explaining them.
- Length target: 4,000–9,000 words of prose plus code.

## Research workflow (subagents)

- Clone sources into `/home/user/workspace/src/` (outside this repo) with
  `git clone --depth 1 --single-branch`. Add `--filter=blob:limit=2m` for big repos.
  Do not clone the Linux kernel; read it on GitHub or elixir.bootlin.com instead.
- The orb has 15 GB RAM shared by many agents: do not build large projects (LLVM, kernel,
  CUDA). Small builds (`make` of a libbpf example) are fine when they help.
- Write research notes to `research/NN-slug.md` (facts, file paths, commit SHA studied,
  URLs). Then write the chapter.
- Do not run git commit or push; the orchestrator does that.
