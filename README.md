# eBPFS — a curriculum on BPF, eBPF and the eunomia-bpf projects

Open `index.html` in a browser (or enable GitHub Pages on this repo) to read the guide.

- `SYLLABUS.md` — the chapter list, which eunomia-bpf repositories each chapter covers, and each chapter's status.
- `chapters/` — one interactive HTML page per chapter (diagrams, code, quizzes, references).
- `research/` — the research notes each chapter was written from, with sources and commit SHAs.
- `reviews/` — validation reports: technical accuracy, citation checks, and the whole-curriculum audit.
- `AUTHORING.md` — conventions every chapter follows.
- `tools/build_index.py` — regenerates `index.html` from chapter metadata.

## How to read it

The chapters are static pages, so no build step is needed. Open `index.html`, or serve the directory
with any static server (`python3 -m http.server`). The pages load highlight.js from a CDN; offline,
code still shows, just without colouring. Each page has a generated table of contents, a theme
toggle, copy buttons on code, and Previous/Next links that run 01 → 32.

- **New to eBPF:** read Part I (01–08) in order. 01 gives the history and a first program. 02–04
  cover the machine: ISA, verifier, and maps/helpers/kfuncs. 05–07 cover where programs attach and
  how they are built and loaded. 08 maps the wider ecosystem and the eunomia-bpf org.
- **Want to write tools:** after Part I, go to Part II (09–13): the tutorial, ecc/ecli, starter
  templates, wasm-bpf and bpf-compatible.
- **Interested in a project:** every later chapter (14–31) stands on its own. Each says which Part I
  chapters it assumes, and links back to them instead of re-explaining. Part III covers userspace
  runtimes (bpftime, llvmbpf), IV verification and performance, V GPUs, VI AI agents, and VII kernel
  extension research.
- **Looking something up:** 31 maps every active eunomia-bpf repository to its chapter, and 32 is the
  glossary and reading list.

Each chapter ends with a quiz and a references list. Code blocks marked with a file path
(`data-file`) are copied from the named repository at the commit given in the chapter. Anything
illustrative is labelled as such.

## How it was validated

- **Per-chapter reviews.** These are in `reviews/part1-a.md` (01–04), `part1-b.md` (05–08), `part2.md`
  (09–12), `part3.md` (13–16), `part4.md` (17–19) and `part5.md` (20–22, 24). For each chapter:
  - every `data-file` block was compared line by line with the source at the cited commit;
  - kernel facts were checked against kernel source at tagged versions;
  - every paper was resolved through arXiv, Crossref or the publisher;
  - every external URL was fetched;
  - tag balance, duplicate ids and `<pre>` escaping were checked;
  - where the orb allowed, the examples were built and run (Linux 6.1, clang 14).

  Each report lists what could not be reproduced. Chapters 23 and 25–32 were still being written or
  validated when this README was updated; their status is in `SYLLABUS.md`.
- **Whole-curriculum audit.** `reviews/syllabus-audit.md` checks:
  - that every active eunomia-bpf repository (GitHub API survey) has a home chapter;
  - which core eBPF concepts are covered and where;
  - that facts repeated across chapters agree;
  - that every inter-chapter link and `#anchor` resolves (anchors are rebuilt the way
    `assets/app.js` generates heading ids);
  - that the Previous/Next chain is continuous.

  It ends with a list of fixes per file.
