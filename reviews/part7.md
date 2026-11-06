# Review: chapters 29–31 (qwen3-ebpf, LLM kernel tooling, org meta)

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/29-qwen3-ebpf.html`, `30-llm-kernel-tooling.html`, `31-org-meta.html`, checked against
`research/29,30,31`, `AUTHORING.md`, `SYLLABUS.md`. I edited only those three chapters, plus one line in
`research/20-gpu-ext.md` as the task asked. Nothing was committed. Chapters 23, 25–28 and 32 were not
edited. `README.md`, `SYLLABUS.md` and `reviews/syllabus-audit.md` show changes in `git status`, but other
agents made them.

## How the chapters were checked

- **Sources at the cited commits.** qwen3-ebpf `3999b887`; schedcp `730e2589`; MCPtrace `1bd88555`;
  GPTtrace `a1f83c7b`; agent-skills `6f126390`; research-skills `bc0de664`;
  megakernel-profiling-feasibility `dfd0c18c`; eunomia.dev `47a61ac0` (sparse checkout); .github
  `66d7aea0`; bpf-developer-tutorial `trigger-sync.yml`. Also read: the schedcp paper v2 text in
  `document/2509.01245v2.txt`, `paper/bpfllm.tex` in qwen3-ebpf, Linux v6.1 `kernel/bpf/verifier.c`
  (raw from GitHub), the Qwen3-0.6B `config.json` on Hugging Face, and MCP spec 2025-06-18 `tools.mdx`,
  `index.mdx` and `transports.mdx` (raw from GitHub).
- **`data-file` blocks.** A script compared every non-elided line of each block, in order and after
  whitespace normalisation, with the cited file: 17 blocks in ch29, 20 in ch30 and 17 in ch31. All
  match. Every remaining report was an inline `/* ... */` or `# ...` elision, except for blocks whose
  comments the chapter had added or whose lines it had regrouped (29.4, 30.3, 31.1).
- **Quoted text.** Each quotation was searched in the repository docs, papers or code. Missing hits
  were fixed (30.2, 31.2) or checked by hand.
- **Experiments in this orb.** Linux 6.1.189, no JIT. I re-ran the repo's existing smoke binaries
  (`batch`, `int4`, `int8`, `silu`, `vector`, `rope` and `attention-smoke`). Every one printed
  "callbacks are not allowed in non-JITed programs". The processed-instruction and peak-state counts
  were identical to the chapter's table: 52,325/447, 115,291/1,033, 79,983/776, 22,562/97, 1,478/21,
  2,114/22 and 5,480/70.
- **Activity.** I re-queried `gh api` for the last commit and `pushed_at` of all ten repos and for the
  org repo list (`orgs/eunomia-bpf/repos`, non-fork, non-archived).
- **Citations.** arXiv API, Crossref, LWN pages, the USENIX OSDI '26 page and the agentskills.io
  specification (see the citation table).
- **Mechanics.** An HTML parser checked tag balance (clean in all three chapters). It also checked for
  duplicate ids, unescaped `<` and `&` in `<pre>`, and local links. Each chapter has a 6-question quiz
  with exactly one `data-right` per question; I re-derived all 18 answers and every one is correct.
  prev/next links run 28→29→30→31→32. Prose plus code comes to roughly 8.4k, 7.6k and 8.8k words.
  All three chapters meet the structural minimums (at least 2 SVGs, 4 code samples, a stepper or tabs,
  a quiz and references).

Severity: **High** = a wrong technical statement a reader would act on. **Medium** = wrong or
misleading, with limited impact. **Low** = imprecise, or a pedagogy or consistency issue.

## Specific claims the task asked me to re-check

| Claim | Verdict |
|---|---|
| ch29 fixed-point formats (Q16 activations, Q24 weights, Q20 norm scales, s64 accumulators, `>>24`) | **Confirmed.** Verbatim in `bpfllm.tex` and in the code. eps = 4295 in Q32, 24 Newton iterations, `root \|= 1`, SiLU via (1−x/1024)^1024 using 10 squarings, saturation at \|x\|≥16, 5793/65536 ≈ 1/√128, the 6-term Taylor series in Q30: all match the source. |
| ch29 verifier-limit handling | **Confirmed.** The monolithic RMSNorm over the 1M limit and the "8193 jumps" message are both in the docs and paper. Masks are `&127`, `&31`, `&2047` and `&4095`. The `asm volatile` barrier is real. No `bpf_tail_call` is used. Power-of-two vector capacity is in `include/qwen3_vector.h`. |
| ch29 program types | **Confirmed.** Operator programs are `SEC("socket")`, run through `bpf_prog_test_run_opts` with a zeroed 64-byte packet and `repeat=1`. The arena allocator is a `SEC("syscall")` program. `SEC("xdp")` programs CAS the job status and call `bpf_wq_start`. `bpf_wq_init`/`bpf_wq_set_callback_impl` are called in `qwen3_event_init`. The callback requeues itself. |
| ch29 kernel versions | **Confirmed.** Arena 6.9 (LWN 961941 is indexed under Releases/6.9; ch04 agrees). `bpf_wq` 6.10 (docs.ebpf.io). `bpf_loop` 5.17 (ch03 agrees). |
| ch29 "callbacks are not allowed in non-JITed programs" in v6.1 `fixup_call_args` | **Confirmed.** It is under `#ifndef CONFIG_BPF_JIT_ALWAYS_ON`, at `bpf_pseudo_func`. The same function says "calling kernel functions are not allowed in non-JITed programs". I also reproduced the message (see above). |
| ch29 transformer facts vs arXiv 2505.09388 | **Mostly confirmed.** The report has GQA, SwiGLU, RoPE, RMSNorm with pre-norm, QKV bias removed, QK-Norm, 28 layers, 16/8 heads, tied embeddings, and an RoPE base raised to 1,000,000. **Two numbers differ from the report** (29.1): it gives a 32K context and a 151,669-token vocabulary, while the repo and `config.json` use 40,960 and 151,936. |
| ch29 performance numbers | All checked against `experiments.md` and `bpfllm.tex`, except one table cell (29.2). The 1.8–4.8× figure, 1.0 vs 2.9–4.1 G MAC/s, 29% and 34%, and 93.170→87.149 s are correct. |
| ch30 MCP facts vs spec | **Confirmed.** Revisions 2024-11-05, 2025-03-26, 2025-06-18, 2025-11-25 and 2026-07-28 match the GitHub releases (latest 2026-07-28). The weather example is verbatim from `tools.mdx` (ids 1, 2 and 4, `nextCursor`, the rate-limit error). Also verbatim: "Functions for the AI model to execute", "arbitrary code execution", "explicit user consent before invoking any tool", newline-delimited stdio messages and the stdout rule. The Anthropic description and the 25 Nov 2024 date are correct. |
| ch30 schedcp tool list | **Confirmed.** Seven `#[tool(`s, matching the table. `schedulers.json` has 20 entries, 10 of them `production_ready`. clang flags, the 10-second default, the stderr grep, the 500 ms sleep and `McpError::invalid_params` on compile or verify failure are all as stated. One JSON value in the excerpt was wrong (30.1). |
| ch30 paper-vs-code gaps | **Confirmed.** The paper promises static analysis, a micro-VM, deployment tokens, a canary/circuit breaker and a vector DB; none is in `mcp/` or `autotune/`. "zero LLM overhead in the critical path" and "doesn't need root access" are in the v2 text. `AI_AGENTS.md` quote, two password variables and the 30 ms vs "3ms" comment in `example.bpf.c` are confirmed. |
| ch30 last-commit dates | **Confirmed by re-query.** schedcp 2026-02-12 `730e2589`; MCPtrace 2026-02-12 `1bd88555`; GPTtrace 2026-03-07 `a1f83c7b`; KEN 2024-08-07 `7575d9ba`; GPTtrace-web 2024-08-07 `02bc89f7`. Stars 122/76/275, none archived. |
| ch31 eunomia.dev build (Next.js vs MkDocs) | **Confirmed.** README: Next.js + React + Tailwind static export, with `mkdocs.yaml` kept as the IA source. `requirements.txt` pins match. `mkdocs.yml` is "Legacy MkDocs Build" and runs on `workflow_dispatch` only. `app/package.json` has next 16.2.6, React 19, shiki, mermaid and rehype-raw/slug/pretty-code. The `app/README.md` and `app/ARCHITECTURE.md` quotes are verbatim, apart from line breaks. `hooks/blog_i18n_fix.py` patches `create_i18n_file`. The `AGENTS.md`→`CLAUDE.md` symlink and the 18 repository-specific skills are confirmed. My re-query of the 30-day commit counts gives 168/45/45/31/7, the same as the chapter. |
| ch31 skill list | **Confirmed.** Seven skills in agent-skills with line counts 122/596/123/156/93/73/99. Fourteen in research-skills. All orchestrator, experiment and citation-skill quotes are verbatim. The agent-skills commit list and dates are correct. |
| ch31 translation of the Chinese README | **Faithful.** Compared paragraph by paragraph: the Coz and megakernel definitions, the sources, the three evidence classes, the file guide (marked as shortened) and the "how to read" limits. One elision, the linear-scaling assumption behind the hypothetical numbers, is marked `[...]`. The translation of the research-skills Chinese policy quote is also faithful. |
| ch31 org repo→chapter map | **Count confirmed: 40 active repos, the same set as the API.** Every chapter file referenced exists in `chapters/` except `32-glossary-and-reading-list.html`. That file is listed in `SYLLABUS.md` and is being written by another agent. The agentqos row was wrong and GPTtrace-web was missing (31.3). |

## Issues found and changes made

### Chapter 29: qwen3-ebpf

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 29.1 | Medium | "They match the model's published configuration" hid that the Qwen3 technical report lists a **32K** context and a **151,669**-token tokenizer vocabulary. The repo's 40,960 and 151,936 come from `config.json` (`max_position_embeddings`, padded `vocab_size`). | Intro sentence now names `config.json` and states both differences; the two table rows carry the report values. |
| 29.2 | Low | Kernel-crossings table: "One call per RMSNorm … within noise". The paper's Table 1 gives 1.20 → 1.28 s, and `experiments.md` says the timings "do not establish a latency improvement". | Now "1.20 → 1.28 s (no gain)". |
| 29.3 | Low | Related work names KML and Bachl et al. with no reference. The second LWN arena article was attributed to Starovoitov; its author is Daroc Alden, 2024-02-21. | Added KML (arXiv 2111.11554) and Bachl, Fabini, Zseby (arXiv 2102.09980) to the references. Fixed the LWN attribution. |
| 29.4 | Low | The `data-file="docs/usage.md"` command block merges several `usage.md` sections and adds a comment that is not in the file. | The lead-in sentence now says so. |

Verified and left unchanged: the struct `qwen3_batch_work` layout (1.51 MiB), the call-count derivation
(about 4,128 vs 4,169 measured), the about-596M-MAC count, arena `max_entries`/`map_extra`, the eleven
tensor offsets per layer (`qwen3_arena_layer_weights`), event KV of 28×256×8 slots, the Q3BP/Q3BF/Q3BR
protocol and 20-byte poll (`usage.md`), the ICMP-unreachable reason for dropping early polls, the
operator test error figures, the layer-four reference bug, the README quotes, and the SiLU widget
(a BigInt port that matches `silu_q16`).

### Chapter 30: LLM kernel tooling

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 30.1 | Medium | `schedulers.json` excerpt: `slice_us_overutil` `"range": [100, 100000]`. The file says `[100, 10000]`. This was a code block that did not match its file. | Fixed. |
| 30.2 | Low | The `prompt.md` quote spliced two different prompts in the file ("processes name" is from line 7, "For python program…" from line 27). | Quote now taken from line 27 only ("processes in the scheduler"). |
| 30.3 | Low | Three `data-file` README blocks (schedcp, MCPtrace, GPTtrace) contain comments or lines that are not in the READMEs (for example `export OPENAI_API_KEY=...`, `# or: cargo build --release from a clone`) or are regrouped. | Added one sentence before each block saying the commands are regrouped and the comments added. |

Verified and left unchanged: rmcp 0.2.0 / `V_2024_11_05`; the `ListSchedulersRequest`/`RunSchedulerRequest`
schemas; tool descriptions (verbatim); `.mcp.json`; mcp/ at about 4,070 lines (4,815 with tests,
4,071 without); MCPtrace's 552-line `main.rs`, four tools, `clamp(1, 60)`, the 10,000-line buffer, the
500 ms wait, the 1-hour cleanup checked every 5 minutes, and `BPFTRACE_PASSWD` with a silent exit;
crate 0.1.1 created 2025-08-01; 39 `.bt` tools; the README quotes ("minimal MCP…", "No script
validation…", "AI never gets root access", "curated collection…"); GPTtrace's `gpt-3.5-turbo-0613`,
300 s default timeout, retry=5, top-2 FAISS results, PyPI 0.1.2 and the `memleak-bpfcc` example; every
paper number (13.57/8.31/7.60 s, 16%, 40.3/46.1/19.1 ms, 910/741/1452 req/s, 13% / 19%, 20%, $0.15,
$6→$0.5, 33 min / 221 calls, 2.5 min / 13×, the machines, Linux 6.14/6.13, 3 runs averaged); KEN's
abstract (comprehension plus symbolic execution plus feedback loops); the KEN README's "only for
evaluation scripts"; the GPTtrace README's "teach ChatGPT"; and tutorial lesson 44 = `44-scx-simple`.
The KEN component details, the 145/40-case dataset and the 30/60/77.5/80% ablation come from the
research notes (arXiv HTML) and were not re-fetched.

### Chapter 31: org meta

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 31.1 | Low | "The tutorial side, in full except for comments": the YAML block elides the checkout and Node steps (the file has 64 lines). | Now says the block is trimmed. |
| 31.2 | Low | Patrol pagination: "the other 126 items" was an invented paraphrase. The skill and commit `d9791c4` say "only the first 100 of, for example, 226". The agentskills.io spec says `name` **must** match the directory name, not "should". | Both reworded to match the sources. |
| 31.3 | Medium | Org map: agentqos was marked "Not covered by a chapter", but ch27 has the section "agentqos, briefly" (also flagged in `reviews/syllabus-audit.md` item 4). GPTtrace-web, which SYLLABUS.md and ch30 give a home, was missing. | agentqos now maps to `27-actime-and-akeep.html`. GPTtrace-web (2024-08-07) added to the ch30 row. "four less active ones" changed to "five". |

Verified and left unchanged: the Makefile and `rename.sh` excerpts (including the commented `_en` lines
and the `perl` rewrites); the `app-static-pages.yml` guard logic; the trigger-sync dispatch condition;
the SKILL.md frontmatter excerpts and `openai.yaml`; the `oss-change-workflow` rules (mature list,
reviewer families, no fabrication, no AI names, live acceptance); patrol 09:00 America/Vancouver, the
500-star limit and `--match-head-commit`; the research-skills README stages and pipelines;
`verify_bib.py` exits non-zero; megakernel `docs/03` (round-robin comment, `per_worker_queue_len`,
zero `priority` hits, 14.5/12.5/10 ms, 0.28%) and `docs/02` (KPerfIR, GPA, DrGPU, LEO limitation,
Event Tensor, `rocprof-sys-causal`, the unverified Kwon et al. paper); `docs/06` Coz/MPK code quotes;
the `.github` profile text, PR template, greeting and issue templates; and the activity table dates.

Not bugs: my checker flagged `08-ecosystem.html#where-eunomia-bpf-fits` and `#map-of-the-whole-org` as
missing anchors. Both are ids that `assets/app.js` generates from the `h2` text, so they resolve at run
time.

### research/20-gpu-ext.md

Line 49 had the false claim that the paper names `BPF_PROG_TYPE_GPU_MEM/GPU_SCHED/GPU_DEV`. It now
says that no version of the paper (arXiv v1, v2, camera-ready) contains those names. The real gap is
the interface names in the paper's listings (`gpu_activate`, `gdrv_mem_*_ctx_t`,
`bpf_gpu_move_head/tail`, `bpf_gpu_set_attr`, `gdrv_sched_preempt`, `bpf_gpu_prefetch_async`); none of
these exist in the fork (reviews/part5.md, 20.3/20.4). The rest of the line, about the code's use of
struct_ops, is unchanged.

## Citations checked

| Citation | Result |
|---|---|
| arXiv 2509.01245 | "Towards Agentic OS: An LLM Agent Framework for Linux Schedulers", Zheng, Hu, Zhang, Quinn; v1 2025-09-01, v4 current; journal-ref "MLforSystem 2025". Correct. |
| arXiv 2312.05531 | "KEN: Kernel Extensions using Natural Language", 4 authors, 2023-12-09. Correct. |
| Kgent 10.1145/3672197.3673434 | Crossref: Proc. SIGCOMM Workshop on eBPF and Kernel Extensions, pp. 30–36, 2024-08-04, Zheng/Yang/Chen/Quinn. Correct. |
| Decima 10.1145/3341302.3342080 | "Learning scheduling algorithms for data processing clusters", SIGCOMM 2019, Mao et al. (5 authors as listed). Correct. |
| Coz 10.1145/2815400.2815409 | SOSP '15, pp. 184–197, Curtsinger & Berger. The abstract quote is verbatim (arXiv 1608.03676). The CACM version is 61(6):91–99, 2018 (10.1145/3205911). Correct. |
| MPK arXiv 2512.22219 | Title and Cheng et al. correct. The USENIX page confirms OSDI '26 (pp. 1909–1926). The 1.7× figure is in the abstract. Correct. |
| GQA 2305.13245 | Ainslie et al., EMNLP 2023. Correct. |
| RoFormer 2104.09864 | Su et al., 2021. Correct. |
| Online softmax 1805.02867 | Milakov & Gimelshein, 2018. Correct. |
| I-BERT 2101.01321 | Kim et al., ICML 2021. Correct. |
| LiteFlow 10.1145/3544216.3544229 | SIGCOMM 2022, pp. 414–427, Zhang et al. Correct. |
| LAKE 10.1145/3575693.3575697 | ASPLOS '23, pp. 846–861, Fingler et al. Correct. |
| Qwen3 2505.09388 | "Qwen3 Technical Report", A. Yang et al., 2025-05-14. Correct (see 29.1 for content). |
| LWN 877062 | "A different approach to BPF loops", Corbet, 2021-11-29. Correct. |
| LWN 961128 | "bpf: Introduce BPF arena." (patch, Starovoitov). Correct. |
| LWN 961941 | "A proposal for shared memory in BPF programs", **Daroc Alden**, 2024-02-21. Attribution fixed (29.3). |
| LWN 1027096 | "Improved load balancing with machine learning", Corbet, 2025-07-01. Correct. |
| KML 2111.11554, Bachl 2102.09980 | Added in 29.3. Both verified on arXiv. |

## Pedagogy and consistency

- ch29 explains transformers well for a C programmer: the shape table, ten steps, KV cache, the
  quantization paragraph and the MAC count. Its descriptions of `bpf_loop` (callback verified once,
  index unknown), arena (6.9) and `bpf_wq` agree with ch03 and ch04. The "Lesson" callout about
  JIT-less kernels adds something that ch02 and ch04 do not cover.
- ch30 matches ch05 on sched_ext (6.12, fallback to the fair class, `/sys/kernel/sched_ext/state`) and
  ch17 on Kgent (same DOI). Its MCP section stands on its own.
- ch31's map agrees with SYLLABUS.md after 31.3.
- Small gap, not fixed: ch30 uses "DSQ" in the generated-scheduler walkthrough without a one-line
  definition and relies on ch05 for it.

## Not resolved / not verified

- `32-glossary-and-reading-list.html` does not exist yet, so ch31's "Next" link and one in-text link are
  dead until the other agent finishes. Not an error in ch31.
- No inference was run, no model was downloaded and no repo number was reproduced. None of schedcp,
  MCPtrace or GPTtrace was built or run (they need a sched_ext kernel, root and API keys).
- I did not re-fetch the details from the KEN arXiv HTML, the MCP 2024-11-05 lifecycle page, the OpenAI
  Codex skills page or the Vercel demo liveness.
- The megakernel notes cite KPerfIR, GPA, DrGPU, LEO, Daydream, Event Tensor and SCOZ. The chapter
  reports them as the repo states them; I did not verify them independently, and the chapter says so.
