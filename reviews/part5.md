# Review: chapters 20–22 and 24 (gpu_ext, NCCLbpf, xpu-perf, ActPlane)

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/20-gpu-ext.html`, `21-nccl-ebpf.html`, `22-xpu-perf.html`, `24-actplane.html`, checked against
`research/20,21,22,24`, `AUTHORING.md`, `SYLLABUS.md`. Chapter 23 was not reviewed or edited. Only these four chapters
were edited. Nothing was committed.

## How the chapters were checked

- **Sources at the cited commits.** gpu_ext `50a51ad4`; gpu_ext-kernel-modules `c4fd5655` (pinned 610 port) and
  `test-sched` (raw files fetched from GitHub); NVIDIA open-gpu-kernel-modules `575.57.08` (`uvm_perf_prefetch.c`);
  gbpf-paper `8cf95bd8` (camera-ready tex); arXiv 2512.12615 v1 and v2 LaTeX source (`arxiv.org/e-print`);
  nccl-eBPF `9a6006e2`; NCCL `36191590` (2.29.7: `enqueue.cc`, `tuner_v5.h`, `nccl_tuner.h`, `device.h`,
  `tuner_v5.cc`, `net_v11.cc`, `init.cc`); xpu-perf `b4fcc885`; OTel profiler fork `e19d3e8`; ActPlane `bb89c77b`;
  ActPlane arXiv 2606.25189 v2 LaTeX source.
- **`data-file` blocks (76).** A script compared every non-elided line, after whitespace normalisation and in order, with
  the cited file. All match. The remaining reports were checker artefacts (inline `/* ... */` elisions; ch24's
  `te_handle_event` excerpt shown after the LSM hook, which the chapter labels; ch22's `gpu_trace.folded` with the prefix
  the chapter says it removed) and one real issue (20.5).
- **Quoted text.** Every quoted string was searched in the repos, papers and docs. Missing hits were checked by hand:
  all were found except the ones fixed below (21.3) and commit messages, which were checked with the GitHub API.
- **Experiments in this orb.** Compiled all 30 NCCLbpf policies with clang 14 and ran them through
  `rank_agreement::check` with my own relocation harness (deleted afterwards). Built and ran the repo's
  `test_rank_agreement_verifier` and `test_rank_merge_verifier` (both pass). Wrote two scratch policies that found 21.1.
- **Citations.** arXiv API for 2512.12615, 2603.11438, 2606.25189, 2507.04786, 2505.23643, 2503.18813, 2109.06931,
  2007.09822. Crossref for 17 DOIs (all papers in the task list that have DOIs, plus cache_ext, NVBit, PREVAIL).
  USENIX pages for AutoCCL, TACCL, HiStar, TaintDroid, GPREEMPT, XSched, bpftime OSDI '25. IEEE CSDL for HOTI.
  NVIDIA env-var docs and the NCCL 2.4 blog for quoted text. eBPF '26 site for venue and date.
- **Mechanics.** HTML parser tag balance, duplicate ids, unescaped `<`/`&` in `<pre>`, same-page anchors, cross-chapter
  links: all clean after the edits. Every quiz has 6 questions with exactly one `data-right`; all 24 answers re-derived.
  prev/next: 19→20→21→22→23 and 23→24→25 are correct. Prose word counts 6.4k–7.5k; all four meet the structural
  minimums (≥2 SVGs, ≥4 code samples, stepper/tabs, quiz, references).

Severity scale as in part 3: **High** = wrong technical statement a reader would act on; **Medium** = wrong or
misleading, limited impact; **Low** = imprecise, pedagogy or consistency.

## Specific claims the task asked to re-check

| Claim | Verdict |
|---|---|
| ch20: seven kfuncs (vs nine) | **Confirmed: seven at the pinned commit.** `uvm_bpf_struct_ops.c` registers `bpf_gpu_strstr`, `bpf_gpu_set_prefetch_region`, `bpf_gpu_request_reorder`; `nv-gpu-sched-hooks.c` registers `bpf_nv_gpu_set_timeslice`, `_set_interleave`, `_reject_bind`, `_preempt_tsg` (the last one in two sets). `test-sched` adds `bpf_nv_gpu_override_timeslice` = eight. No source gives nine. The custom `get_current_comm` helper proto in the sched struct_ops is a helper, not a kfunc. Chapter text ("seven … one more on the 575 branch") is right. |
| ch20: paper vs code program types | **The research note is wrong; the chapter never used it.** `research/20-gpu-ext.md` says the paper names `BPF_PROG_TYPE_GPU_MEM/GPU_SCHED/GPU_DEV`. No such string exists in arXiv v1, v2 or the camera-ready tex. The real paper-vs-code difference is the interface names (`gpu_activate`, `gdrv_mem_*_ctx_t`, `bpf_gpu_move_head/tail`, `bpf_gpu_set_attr`, `gdrv_sched_preempt`, `bpf_gpu_prefetch_async`), none of which exist in the fork. Added a callout (20.3). The research file was not edited (out of scope). |
| ch21: rank-agreement checker results | **Reproduced exactly.** ACCEPT noop, size_aware_v5, nvlink_ring_mid_v2, nvl72_size_aware, spark_tp4_*, distributed_max_latency; REJECT adaptive_channels (insn 103) and _v2 (115) "rank-local control flow", slo_enforcer (162) "rank-local action", cpu_aware (23) control flow. Same instruction numbers as the research notes. New: the checker has a soundness gap (21.1). |
| ch21: paper/code differences | **Confirmed, two added.** Listing 1 ctx writes / `SEC("tuner")` (paper.tex L427–452) is right. Also: paper says the others are set to sentinel `1e9` and the native layer clamps channels (L509–513); the code only zeroes the chosen cell and never clamps. Hot-reload "CAS on a function pointer" vs `shared_ptr` atomic exchange: chapter already says so. |
| ch22: possible double counting of GPU time | **Confirmed by code reading, still not run.** `XpuPerfCallbackHandler` calls `XpuPerfGetCorrelationId` before any `callbackSite` test (cupti_trace.cpp L213–215), and the handler itself tests for `CUPTI_API_ENTER`, so both sites arrive. `ReportTraceEvent` and `AddCPUTraceWithCorrelation` do no dedup; `correlateByCorrelationID` adds the duration per trace. The README's `matched=7728` example predates correlation-ID mode (commit 506973e, "Correlation complete" is the timestamp path), so it is no counter-evidence. Wording strengthened (22.1). |
| ch24: LSM hooks evaluate only block, tracepoints only notify/kill | **Confirmed by code reading.** `te_supported_effects(TE_MODE_BLOCK)` = BLOCK bit only, otherwise NOTIFY\|KILL; that mask filters the rule scan (`taint_engine.bpf.h` L2123–2297). All 14 `lsm/*` sections pass `TE_MODE_BLOCK`; all tracepoints pass `te_tracepoint_mode()` = NOTIFY. LSM handlers return 0 at once when `enforce_mode` is 0. Extra nuance (not in chapter, not needed): with LSM active, the tracepoint exit handlers skip label propagation and the LSM path does it. Already labelled "As I read this code". |
| ch24: hook list | **Confirmed.** 14 LSM sections; tracepoints exactly as listed; no kprobe/fentry/cgroup sections. |

## Issues found and changes made

### Chapter 20: gpu_ext

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 20.1 | Medium | PMM validation said the allowed moves are `USED/HEAD` or `USED/TAIL`. `nv_gpu_transition_validate_pmm` and `pmm_bpf_validate_reorder_locked` accept destination USED **or UNUSED**, HEAD or TAIL (matches `revision-safety-design.md`: "permits only the used/unused allocation lists"). Same error in the eviction-hook paragraph and the kfunc table. | Fixed all three places. |
| 20.2 | Low | `bpf_nv_gpu_preempt_tsg` "registered for `BPF_PROG_TYPE_UNSPEC` so that sleepable uprobes can call it". UNSPEC is the kernel's all-types hook; the source comment gives kprobe/tracepoint `bpf_wq` callbacks as the reason. | Reworded. |
| 20.3 | Medium | No mention that the paper's interface listings (both versions) do not match the code. | Added a "Paper vs. code" callout. Also noted the paper's "standalone file (~1 KLOC) extending the kernel" lives in the module fork and uses upstream `register_bpf_struct_ops()`. |
| 20.4 | Low | Research note error on program types (see table). | Report only. |
| 20.5 | Low | Four `data-file="gpu_ext/README.md"`/`extension/README.md` blocks contain `#` comments that are not in the files (e.g. "builds libbpf and bpftool from submodules first", "foreground, Ctrl-C detaches"). | Added a sentence saying some comments were added or shortened for the chapter. |

Verified and left alone: struct `gpu_mem_ops` (6 members), cmpxchg singleton, `btf_struct_access` → `-EACCES`,
`bpf_base_func_proto`, KPROBE kfunc registration "non-fatal", wrappers with RCU; prefetch hook code and 575.57.08
`compute_prefetch_region` (threshold 51); activate/access/evict_prepare call sites; `gpu_block_access` only from
`uvm_pmm_gpu_mark_root_chunk_used`; `b63e7fde` bare `list_move` kfuncs (2025-11-24); the three "feat: validate …"
commits (2026-09-01); `920d44e6` date and title; task-init ctx layout and ABI static asserts; three vs four
`nv_gpu_sched_ops` members (610 vs test-sched); DEFERRED_VA_SPACE_APPS = 14; extension README quotes (rule 5, Xid 31,
6.15.11 segfault, "从未被调用"); SAFE_POLICY_ROUTES quotes; revision-safety-design quotes; 90 cell summaries
(ARTIFACT.md L98); LMCache 323.707/123.141/118.097; all arXiv and camera-ready numbers spot-checked (1.76×, 4.8×,
96% 1188→53 µs, 20 days/974/244/59/5.5M/$388, MoE-Infinity 22.1/22.5, FineMoE 24.6/0.21, POD −0.44/+1.18,
"zero OS kernel panics", <0.2%); eGPU pushed 2025-11-24, not archived; all quiz answers.

### Chapter 21: NCCLbpf

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 21.1 | **High (new finding)** | The rank-agreement checker is unsound for `agreed_map` lookups. `load_memory` returns `shared` for any load through an `agreed_value`, the key's label is never checked, and a `JEQ/JNE 0` on an `agreed_value` is exempt from local control flow. A policy with `key = ctx->last_latency_ns & 1` (no branch), lookup in the one-entry `agreed_map`, `if (!v) return 0; return <4 channels>` is **ACCEPTED** (tested with clang 14 + the repo header; a `call_count`-keyed variant too). Ranks then diverge. The chapter presented the checker as closing this class. Limits: CPU-only test of the header, not run in NCCL; the plugin only loads such an object under the experimental distributed opt-in with all three maps and `dist_merge`. Not reported upstream. | Added a "Gap found in review" callout with the method and limits. |
| 21.2 | Medium | Paper-vs-repo callout missed the `1e9` sentinel and the claimed channel clamp, neither of which the code does. | Added both. |
| 21.3 | Low | `"a leader decides"` shown as a quote; the notes say "They agree by a leader or manager deciding". | Replaced with the real quote. |
| 21.4 | Low | "every 8-byte store carries 4 bytes of data and a 4-byte flag": LL writes 16-byte `ncclLLFifoLine`s, two data/flag pairs. | "every 8 bytes written carry …". |

Verified and left alone: tuner v5 struct and comments (verbatim), `NCCL_TUNER_PLUGIN_SYMBOL`, the seven algorithms and
three protocols and their numbers, `NCCL_ALGO_PROTO_IGNORE -1.0`, `ncclGetAlgoInfo` and `topoGetAlgoInfo` excerpts,
`nRanks==1` Ring/Simple 0, the line `info->nMaxChannels = nMaxChannels == 0 ? …` (L2085), init.cc "align all ranks"
comment (L1259), `ncclLLFifoLine`, LL128 line constants, `dlsym` symbols `ncclTunerPlugin_v5` / `ncclNetPlugin_v11`;
NVIDIA docs (LL128 data-corruption sentence verbatim; NVLS/NVLSTree = NVLink SHARP; NCCL_MAX_NCHANNELS → fewer CUDA
blocks); Jeaugey blog quote; busbw factors; ctx offsets vs shared ranges; packed-action layout; `apply_policy_action`;
plugin exports `eBPFPolicy`/`eBPFPolicyProfiler`, net `.name = "Socket"`; plugin.cpp 2,755 lines, checker 260 lines;
verify mode and the "uprobe" fallback (`verifier_section_name`). Note for consistency with ch14/15: NCCLbpf calls
`bpftime::verifier::verify_ebpf_program` directly with a "uprobe" section, so ch14's caveat that bpftime's own call site
skips uprobe programs does not apply here. All paper numbers (Table 1, 33 ns, 1.3 µs/4%, 1.07 µs/9.4 ms/400,000,
Table 2 sweep, 5.5–26.5%, 194.9→246.5, 87–95%, 565.6±0.9/565.5±0.6, 14 programs 7/7), net-plugin numbers
(2.134/2.094, 1.87%, medians), "10 and 9 channels", README Spark quotes, all quiz answers.

### Chapter 22: xpu-perf

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 22.1 | Medium | Double counting was labelled "possible, unverified"; the code reading is stronger than that (see table). The worked example (318 samples ≈ 6.4 s GPU) did not mention it. | Bullet rewritten with the evidence, still labelled as not run. The example now says "or 3.2 s if the double counting applies". |

Verified and left alone: every data-file block, including the README blocks and `gpu_trace.folded` (5 lines, 419
total, prefix removal as stated); usage text; `SamplesPerSecond: 50`, `OffCPUThreshold: 0`, `LoadProbe`; 200/500 ms
waits; env vars; `custom_trace.ebpf.c` (43-line addition), `correlation_uprobe.ebpf.c` (61 lines), `cupti_trace.cpp`
(385 lines); `MapReplacements`/`prog_array` tail call; reporter PID filter; `cudaLaunchKernel` collapse; ns·50/1e9;
36.2 ms → 1.81 (profiler README); OTel upstream default 20 samples/s (`cli_flags.go`); `/usr/local/cuda-*` fallback
list; linear `VisitSymbols` scan vs README "binary search"; README prerequisites (5.10+, Go 1.19+) vs `go 1.24.0`;
commit hashes and dates in the history section. CUPTI correlation mechanism description is correct at the level stated.
Citations: Flame Graph CACM 59(6):48–57 2016; GWP IEEE Micro 30(4):65–79 2010, six authors; HPCToolkit Parallel
Computing 108:102837 (2021), arXiv 2109.06931; NVBit MICRO-52 pp. 372–383, four authors. All quiz answers.

### Chapter 24: ActPlane

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 24.1 | Low | Directory map says `test/policies/` has "24 valid" fixtures; there are 25 `.yaml` files (two `15_*`) plus 7 in `invalid/`. | Changed to 25. |

Verified and left alone: hook table; `te_tracepoint_mode`/`te_effect_mode`/`te_supported_effects`; `te_handle_event`
ordering (deny before flow); `emit_violation`; `lsm/bpf` command filter; `te_fork`, `te_write_flow_domain`,
`te_after_satisfied`; `taint.h` limits; `dnf()`; `spawn_stopped_target`; policy YAML fixtures; grammar and propagation
table from `rule-language.md`; line counts 3,953 / 2,581; "roughly 3.2 K / 1.8 K LoC" (paper L589); all paper numbers
(study 64/2,116/1,361/83%/16%/81%; RQ1 607/1,283/$0.028/34 min/74%/66-29-5%/28%; RQ2 table, 20+18 rules, 77.2%,
17 of 18 FP, 26/28; opaque 86→27 TP and 28→87 FN; RQ3 table and 1.9/6.5/8.4%; RQ4 +9.9/+2.8; RQ5 361/106/78/28,
"hook-coverage gaps"); testbed; quotes from README, CLAUDE.md, support-matrix, related_work.md, bpf/README.md,
doctor.rs; commit messages via GitHub API; ARTIFACT.md dirty-tree note; bpf-developer-tutorial lesson 19 is
`19-lsm-connect`. Citations: ActPlane arXiv (9 authors; README BibTeX omits Tao Ma, as the chapter says), Denning
CACM 19(5):236–243, Asbestos SOSP '05 (9 authors), HiStar OSDI '06, Flume SOSP '07 (7 authors), JFlow POPL '99,
TaintDroid OSDI '10, CamFlow IEEE TCC 5(3) 2017, CamQuery CCS '18 (8 authors), Greshake AISec '23 (6 authors),
FIDES arXiv 2505.23643 (Costa first author), CaMeL arXiv 2503.18813 (Debenedetti first), AgentSight (Crossref title
and venue). All quiz answers.

## Citations checked for the task list

| Citation | Result |
|---|---|
| arXiv 2512.12615 | Title, 11 authors, v1 2025-12-14, v2 2025-12-20, cs.OS: correct. |
| ASPLOS '27, 10.1145/3845814.3850045 | Crossref: title, Proc. 32nd ASPLOS, pp. 804–820, 10 authors (no Yanpeng Hu), 2027-04-10. Chapter says "Y. Zheng et al.": fine. |
| eGPU, 10.1145/3723851.3726984 | HCDS '25, pp. 73–79, Yang/Yu/Zheng/Quinn: correct. |
| NCCLbpf, 10.1145/3837779.3838156 / arXiv 2603.11438 | Crossref: Proc. 4th Workshop on eBPF and Kernel Extensions, pp. 90–96, sole author Yusheng Zheng. arXiv v1 2026-03-12, v2 2026-05-04, cs.DC. Workshop: Prague, 2026-09-29, with SOSP '26. Correct. |
| Demystifying NCCL | HOTI 2025, pp. 48–59, DOI 10.1109/HOTI66940.2025.00024, 9 authors as listed; arXiv 2507.04786 (v3). Correct. |
| AutoCCL | NSDI '25 pp. 667–683, authors as listed: correct. |
| TACCL | NSDI '23, Shah et al.: correct. |
| NVBit, Flame Graph, GWP, HPCToolkit | Correct (see ch22). |
| ActPlane 2606.25189 and Denning … CaMeL | Correct (see ch24). |

## Pedagogy and consistency

- GPU background (ch20): warps/SIMT/divergence, channels/TSG/runlists, UVM units, replayable faults and the
  prefetch threshold are accurate and enough for the chapter. Small gap, not fixed: "GSP" appears in Figure 20.2 and the
  history list without a one-line definition (GPU System Processor firmware).
- NCCL background (ch21): ranks, collectives, busbw, ring vs double binary tree, LL/LL128/Simple, channels and the cost
  table are correct and well ordered for a newcomer.
- Profiling background (ch22): sampling, frame pointers vs `.eh_frame`, symbolization, folded stacks and CUPTI are
  correct and sufficient.
- IFC background (ch24): Denning's lattice, sources/sinks/declassification and the OS IFC lineage are correct.
- Consistency with ch05/14/15/16: struct_ops, LSM verdict convention, uprobe.s and sleepable kfuncs, the ch15
  anchor `#gpu-and-cuda-probes` (exists) and the bpftime/llvmbpf roles agree. See the ch21 note on PREVAIL.

## Not resolved / not verified

- Nothing GPU-side was run: gpu_ext policies, the NVIDIA module fork, NCCL, the NCCLbpf plugins and xpu-perf gpu/merge
  mode need hardware. The ch22 double counting and the ch24 effect split are code-reading results.
- 21.1 was shown only against the header-only checker with my relocation harness (equivalent to
  `relocate_program_maps` in that it sets `src_reg = BPF_PSEUDO_MAP_FD` and the map fd). It was not loaded through the
  plugin. Not reported upstream.
- `research/20-gpu-ext.md` still contains the false `BPF_PROG_TYPE_GPU_*` statement (outside my edit scope).
- Kernel-fork files were fetched raw from GitHub (`c4fd5655`, `test-sched`), not from a full clone; the 30-files
  compare count was taken from the research notes.
- Parca, Pyroscope and iaprof facts in ch22's related work were taken from the research notes, not re-fetched.
- Chapters 20–24 also show as modified in `git status` from the authoring agents. Only the edits listed above are mine.
