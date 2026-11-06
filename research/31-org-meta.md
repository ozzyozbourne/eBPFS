# Research notes — 31 · org meta (eunomia.dev, agent-skills, research-skills, megakernel notes)

Survey date: 2026-11-06. Clones under /home/user/workspace/src/.

## Commits studied

| Repo | HEAD SHA | Date | How read |
|---|---|---|---|
| eunomia.dev | 47a61ac0f3f53f4fa7d292deb8a306d7614fc7f4 | 2026-11-05 | `--depth 1 --filter=blob:none --sparse`, sparse set: root *.md/*.yaml, Makefile, rename.sh, .github/workflows, hooks, scripts, docs/index*.md, app/*.md, app/package.json |
| agent-skills | 6f126390656c4308e1f2997bd4b134725c277652 | 2026-10-04 | full shallow clone |
| research-skills | bc0de6643266152bc201efade1a5dc1f36812384 | 2026-08-21 | full shallow clone |
| megakernel-profiling-feasibility | dfd0c18cddbfc2342f67a40fb1b95b157b13a8bb | 2026-08-06 | full shallow clone (Chinese) |
| .github | 66d7aea08b37ada8f4882387404819e02dd141e1 | 2026-10-04 | full clone |
| basic-cuda-tutorial / cupti-tutorial / nvbit-tutorial | (local shallow clones; latest commits 210f773 2026-07-19 / 676b2ac 2026-07-22 / 0845c6a 2026-03-02) | | README level |
| bpf-developer-tutorial | trigger-sync.yml read via `gh api` (main 110b91f) | | |

## eunomia.dev

- Repo description: "https://github.com/eunomia-bpf homepage, documents and blogs"; size ~2.9 GB (gh `size` 2936781 KB).
- README: site is now a custom **Next.js + React + Tailwind** frontend in `app/`, *static export* to plain HTML, deployed to GitHub Pages. Content = Markdown in `docs/**`; `mkdocs.yaml` kept as nav/IA config source. Node 22+. `cd app && npm ci && npm run dev`; prod: `NEXT_PUBLIC_SITE_URL=https://eunomia.dev npm run build` → `app/out`.
- app/README.md: "Configuration rule: mkdocs.yaml is the permanent single source of truth for site IA"; Next.js "used as a static site compiler, not as a server runtime"; no API routes. Generated artifacts: documents, content-model, manifest, site-sections, search. Raw HTML allowed (`allowDangerousHtml`, rehypeRaw) — called a trust boundary.
- app/package.json scripts: generate:site-config, generate:content-index, generate:search-index, generate:static-assets, generate:static-metadata; build = artifacts + `next build` + finalize-static-export + generate-legacy-redirects. Deps: next 16.2.6, react 19, unified/remark/rehype, shiki, mermaid, gray-matter.
- app/ARCHITECTURE.md: route identity locale-agnostic (`tutorials/38-btf-uprobe/test-verify`), English `/tutorials/...`, Chinese `/zh/tutorials/...`; preserve legacy `/blogs/*`, `/blog/YYYY/MM/DD/*`. Fixtures cover `.en.md`, `.zh.md`.
- Legacy MkDocs: requirements.txt pins mkdocs 1.6.1, mkdocs-material 9.7.4, mkdocs-static-i18n 1.3.1, git-revision-date, git-authors, awesome-pages, exclude. mkdocs.yaml plugin `i18n` with locales en (default) and zh (简体中文, nav_translations). hooks/blog_i18n_fix.py patches `mkdocs_static_i18n.suffix.create_i18n_file` for blog posts. `.github/workflows/mkdocs.yml` is now "Legacy MkDocs Build", workflow_dispatch only.
- i18n convention: suffix files `index.md` / `index.zh.md` (docs/index.zh.md exists; rename.sh copies SUMMARY.zh.md → docs/tutorials/index.zh.md).
- Makefile: targets clone bpf-developer-tutorial (as `tutorial`), bpftime, basic-cuda-tutorial (`cuda-exp`), cupti-tutorial (`cupti-exp`), nvbit-tutorial, agentsight, ActPlane; `docs/CNAME` target runs `./rename.sh`. rename.sh copies tutorial/src/* → docs/tutorials/, SUMMARY(.zh).md → index(.zh).md, imgs; CUDA/CUPTI/NVBit → docs/others/*; bpftime READMEs → docs/bpftime/documents/*.md; agentsight docs & README(.zh-CN) → docs/agentsight; ActPlane docs with perl link rewrites; writes `eunomia.dev` to docs/CNAME.
- Sync pipeline: bpf-developer-tutorial `.github/workflows/trigger-sync.yml` ("Test and trigger downstream tutorial sync") on push/PR: checks out tutorial + eunomia.dev, stages tutorial in website/docs/tutorials, runs `npm ci && npm run build` (test build); on push to main in the real repo, `peter-evans/repository-dispatch@v4` sends `trigger-tutorial-sync` with client-payload {source_repo, source_sha}. eunomia.dev `.github/workflows/app-static-pages.yml` ("Deploy Static App"): on repository_dispatch, job sync-external-docs validates source_repo == eunomia-bpf/bpf-developer-tutorial and 40-hex SHA, fetches main, skips stale SHA, `make clean`, `make docs/CNAME`, commits "sync external docs from <repo>@<sha>" and pushes main; deploy-static-app: checks deploy SHA == origin/main (skip stale), `npm run verify` (lint + verify.mjs) with Playwright chromium audit deps, `npm run build`, asserts no localhost in sitemap/robots/feed, publishes `app/out` to branch `new`, upload-pages-artifact + deploy-pages, Discord notification. `trigger-document-sync` → `make sync-external-docs`.
- Agent operations: AGENTS.md → CLAUDE.md symlink; "Work directly on main"; `.agents/skills/*` repo-specific skills (blog-writer, blog-writing-style, content-launch-planner, devto/hackernews/juejin/linkedin/lobsters/medium/reddit/x/xiaohongshu/zhihu publishers, eunomia-community-radar, eunomia-content-patrol, eunomia-research-report, eunomia-social-radar, seo-geo); `.agents/sources/agent-skills` submodule → eunomia-bpf/agent-skills; scripts/sync-agent-skills.sh runs submodule update then agent-skills/scripts/link-skills.sh into .agents/skills; `.claude/skills` → `../.agents/skills`.
- Recent commits (30 days, 2026-10-06..11-05): 168 commits; 45 `docs(ebpf-qa)`, 45 `docs(media)`, 31 "Update daily data brief [skip ci]", 7 `docs(skills)`; weekly/monthly org reports ("Add weekly org report 2026-10-26..2026-11-01", "Add monthly org report 2026-10-01..2026-10-31"); `test(content): require a Chinese twin for every Q&A answer` (8014315); `fix(publisher): support platform selection...` (7813b36).

## agent-skills

- README: "public, versioned source for reusable maintainer workflows and organization-level Eunomia community maintenance". Skills: agent-cli-tools, gh-workflow, oss-change-workflow, oss-issue-triage, oss-release-readiness, project-bootstrap-workflow; org-level eunomia-community-patrol. Repo-specific skills deliberately excluded.
- Install: `./scripts/link-skills.sh "$HOME/.codex/skills"` (relative symlinks; refuses to replace real path); PowerShell variant with junction fallback. Validate with skill-creator `quick_validate.py`.
- SKILL.md format: YAML frontmatter `name`, `description`, then Markdown body; optional `agents/openai.yaml` (interface display_name, short_description, default_prompt) and `references/`. Matches agentskills.io spec (name ≤64 chars lowercase/hyphen; description ≤1024 chars) and OpenAI Codex skills docs (agents/openai.yaml optional).
- Line counts: agent-cli-tools 122, eunomia-community-patrol 596, gh-workflow 123, oss-change-workflow 156, oss-issue-triage 93, oss-release-readiness 73, project-bootstrap-workflow 99.
- oss-change-workflow: mature repos = bpftime, eunomia-bpf, wasmbpf, agentsight, tutorial → PR + two independent reviews (subagent + cross-agent tool of another model family), Copilot comment gate, CI monitoring; immature → direct push to main. "Never put AI tool, model ... names in branch names"/commits. "Docs and examples must be real. Never fabricate example output". Completion = live acceptance ("CI is green" is not "done").
- eunomia-community-patrol: all public non-archived non-fork repos; every open issue/PR; daily 09:00 America/Vancouver; paginate fully; merge authority: <500 stars agent may merge after conditions, ≥500 left to user; `gh pr merge --match-head-commit`.
- Recent commits: 6f12639 2026-10-04 "Check default-branch CI by commit and workflow outcome"; 878d772 / cfccc53 2026-09-22; d9791c4 2026-09-19 "Require complete pagination of every inventory and sweep"; c2a48c2 2026-09-18 "Add verification steps for dependency bumps".

## research-skills

- README: loop Discover → Experiment → Write → Review, coordinated by `auto-research-orchestrator`. 14 skills (orchestrator; research-literature-novelty, iter-refine-ideas; research-experiment-design, paper-figures; iter-refine-writing, rewrite-abstract-intro, rewrite-paper-section, paper-writing-style, tighten-prose-systems-latex; check-paper-citations, check-paper-structure-flow, check-terminology-infoflow, iter-review-critique). Principles: paper-decision value, real evidence, one-way scientific authority, independent result review, persistent state. Install: `cp -R research-skills/skills/* ~/.codex/skills/`.
- orchestrator: step = `EXPERIMENT_GATE -> WRITE_GATE -> REVIEW_GATE`; phases `BOOTSTRAP -> BUILD_AND_EVALUATE -> WRITING`; `docs/user-instruction.md` verbatim user prompts only; current paper under docs/paper/. Contains a Chinese "Non-Negotiable Research Policy" quote — translation: "Negative results should not go into the paper at all. The paper only presents good results — remember that. They can stay in the repository for rebuttal but must never enter the paper. The paper must not contain any wording that weakens our contribution, self-attacking wording, or defensive wording. You may redesign the experiments, algorithms, or system implementation to turn the data into positive claims, or change the story when the user approves." Followed by "Keep negative ... results in docs/evaluation.md ... never in the reader-facing paper."
- research-experiment-design: `PAPER-VALUE ADMISSION -> PROPOSE -> PLAN REVIEW -> REAL PREFLIGHT -> FULL RUN -> RESULT REVIEW -> RETURN`.
- check-paper-citations: `scripts/verify_bib.py` checks arXiv, Crossref, DBLP, Semantic Scholar; URL fallback; ERROR vs WARN; three passes.
- Commits: e62ffd9 2026-08-21 "Add end-to-end research skills"; bc0de66 "Remove generated Python cache files". Only 2 commits.

## megakernel-profiling-feasibility (Chinese, translated)

- No code, no data. Feasibility review of "Coz-style causal profiler for GPU megakernels". Origin: a ChatGPT conversation from a collaborator, used only as outline; every citation re-verified against paper bodies, NVIDIA docs (CUDA C++ Programming Guide, PTX ISA, Nsight Compute), source code of plasma-umass/coz and mirage-project/mirage (mpk branch).
- Three evidence classes: verified facts (quoted verbatim), inference (labelled), hypothetical example numbers (labelled).
- Files: docs/01 conversation & terms (46 KB), 02 citation verification, 03 risks (90 KB), 04 five reviewer questions, 05 ChatGPT answer audit, 06 revision log (four claims overturned).
- 03 top three risks: (1) interventions would become directly tunable knobs → just tune and measure, no causal inference needed; of five interventions, 2 exist as MPK config (queue lengths `per_worker_queue_len`, `per_sched_queue_len`; worker/scheduler counts), 3 don't (per-stage warp quota, priority, admission rate); round-robin assignment comment `// assign event in a round-robin fashion`. (2) pausing a warp frees bandwidth/issue slots but not registers/shared memory → directional bias. (3) headroom: MPK paper Qwen3-8B on A100: 14.5 ms (vLLM/SGLang) → 12.5 ms vs ~10 ms bound → ~20% headroom; scheduler 0.28% of runtime.
- 06 revision log: claim "GPU sleep too imprecise" overturned by Coz source (`wait()` returns elapsed time; `add_delays()` records `waited` not `needed`; macOS ~1ms nanosleep comment) + MPK `sleep_cycles` spin on `%globaltimer_lo`. Lesson: all four overturned claims were made from abstracts/docs/second-hand; overturned by reading primary sources.
- 02: unverifiable 2022 Korean short paper "GPU Kernel Speedup Prediction using GPU Causal Profiling" (Kwon, Ahn, Jeong) — not found in dblp. Not covered: CNKI, internal tools, Korean domestic venues.
- Commits: efc481a and dfd0c18, both 2026-08-06.

## Verified citations

- Coz: Curtsinger & Berger, "Coz: Finding Code that Counts with Causal Profiling", SOSP '15, pp. 184–197, DOI 10.1145/2815400.2815409, Best Paper; arXiv 1608.03676; CACM 61(6) 2018 DOI 10.1145/3205911. Verified via ACM DL, arXiv, USENIX ATC16 page.
- MPK: arXiv 2512.22219 (v1 2025-12-22, v2 2026-06-10); USENIX OSDI '26 page https://www.usenix.org/conference/osdi26/presentation/cheng — verified via web search.
- Agent Skills spec: https://agentskills.io/specification ; OpenAI Codex skills: https://developers.openai.com/codex/skills.
- Other papers (KPerfIR, Neutrino, LEO, Event Tensor, Daydream, GPA, DrGPU) mentioned only as "cited by the repo"; not independently verified by me.

## .github

- profile/README.md: "Eunomia Labs is an open-source systems lab building practical systems software and exploring programmable runtimes, eBPF, AI agents, and GPU systems." Lists bpftime, llvmbpf, wasm-bpf, GPTtrace, eunomia-bpf; News list of papers/talks. Default community files: ISSUE_TEMPLATE (bug_report, feature_request, custom), pull_request_template.md ("Please try to use the copilot to summary your PR"), FUNDING.yml, workflows greetings.yml (actions/first-interaction@v1), codeql-analysis.yml, .editorconfig, .deepsource.toml.
- Commits: 66d7aea 2026-10-04 "chore: remove vestigial gh-pages workflow (#5)"; 2b321f7 2026-08-30 "docs: present Eunomia as a broader systems lab (#4)".

## GPU tutorials

- basic-cuda-tutorial: 13 numbered `.cu` + `.md` + `.zh.md` lessons (vector add … low-latency packet processing); "change the gpu architecture sm_61 ... in Makefile". Recent: July 2026 bug fixes (PTX load errors, cooperative launch, CNN batch grid).
- cupti-tutorial: NVIDIA CUPTI samples with tutorials; `./install.sh; source setup_env.sh`; dirs activity_trace, callback_*, pc_sampling*, pm_sampling, sass_metrics, nvlink_bandwidth, unified_memory ...; recent 676b2ac 2026-07-22 "fix: select the current CUPTI device record (#5)".
- nvbit-tutorial: unofficial blog-style NVBit tutorial (NVBit 1.7.5 per description); tools instr_count, instr_count_bb, instr_count_cuda_graph, mem_printf2, mem_trace, mov_replace, opcode_hist, ptx_instr_count, record_reg_vals; quick start `LD_PRELOAD=./tools/instr_count/instr_count.so ./test-apps/vectoradd/vectoradd`, also `CUDA_INJECTION64_PATH`. Last push 2026-03-02 (outside 6-month window → not "active" by syllabus definition, but still synced into eunomia.dev).
- All three are synced into eunomia.dev docs/others/* by rename.sh.

## Active repo inventory (pushed_at ≥ 2026-05-05, non-fork, non-archived; gh api orgs/eunomia-bpf/repos, 2026-11-06)

40 repos: bpf-benchmark, agentsight-website, eunomia.dev, bpf-developer-tutorial, bpftime, bpfix, agentsight, akeep, ActPlane, llvmbpf, agentcgroup, qwen3-ebpf, actime, agent-check-restore-safety, namei_ext, agent-skills, .github, nccl-eBPF, gpu_ext, xpu-perf, ebpf-correctness-verifier, libbpf-rs-starter-template, libbpf-starter-template, eunomia-template, homebrew-tap, reward-guard, wasm-bpf-guest-sdk-rust/-c/-go, ecli-webui, wasm-bpf, research-skills, eunomia-bpf, megakernel-profiling-feasibility, backup-client-sdk, cupti-tutorial, basic-cuda-tutorial, bpf-compatible, agentqos (not in syllabus), bpfperf. Note pushed_at is a proxy for "commits in last six months". Less active, still mapped: schedcp, MCPtrace, GPTtrace (ch 30), nvbit-tutorial (ch 31).

## Chapter-writing checks (2026-11-06)

- HTTP 200 checked: eunomia.dev/others/cuda-tutorial/, nextjs.org static-exports guide, ultrabug/mkdocs-static-i18n, agentskills.io/specification.
- Not run: full eunomia.dev build (needs the whole docs/ tree); no skills executed.
- Papers cited in the megakernel notes besides Coz and MPK (KPerfIR, GPA, DrGPU, LEO, Daydream, Event Tensor, SCOZ) are reported as the repo states them and were not independently verified.
