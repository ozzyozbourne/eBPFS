# Research notes — Chapter 19: bpf-benchmark and bpfperf

Survey date: 2026-11-06. Nothing was built or benchmarked; all numbers below are quoted
from files in the repositories, with paths.

## Sources studied

| Source | Revision | How |
|---|---|---|
| https://github.com/eunomia-bpf/bpf-benchmark | `193c2b9b584a8ec832f3cca98707688a4f3a2f8c` (2026-11-06 00:16 UTC, "Audit the numeral forms the checker reads") | `git clone --depth 1 --filter=blob:none --sparse`, sparse set to READMEs, docs/*.md, kinsn (no archive/data), bpfopt (no testbin/testobject), runner (no config except 4 pass dirs), rejit, kprog docs, analysis, llvm-backend, corpus/config, micro/programs + config, bpfperf, .agents |
| https://github.com/eunomia-bpf/bpfperf | `085bcbc3232264b90ad61cdbccd5179530cf2337` (2026-05-08, "Initial archive of bpfprof + kernel-sys from bpf-benchmark @ HEAD") | full shallow clone |
| https://github.com/yunwei37/ebpf27-bpfoptbench (bpf-bench paper draft, public submodule `docs/ebpf27-bpfoptbench`) | `17588bdd3dcad404541e9417934c0ee1eafbc6d1` (2026-10-06) | shallow clone |
| https://github.com/yunwei37/atc26-kinsn-camera-ready (BPF-Ext camera-ready source, public) | `2ff6d3f8f7a00fb80215422cc2db8a81a154e193` (2026-10-17) | shallow clone; read abstract and `helpers/commands.tex` |
| arXiv:2606.24213 | v1, 2026-06-23 | read abstract page |
| lore.kernel.org RFC thread | 2026-10-05 cover letter, 2026-10-17 Alexei reply | read |

Repo metadata (gh api, 2026-11-06): bpf-benchmark created 2023-08-18, size 859,843 KB, MIT,
26 stars, description "AI Agent eBPF optimization benchmark and framework", pushed
2026-11-06T00:16:56Z, ~4,913 commits (Link header `page=4913` with per_page=1).
bpfperf: description "Per-BPF-PC branch profile collector (LBR + fexit sidecar). Archived from
bpf-benchmark."; GitHub `archived` flag is **false** (README says "Source archived as-is. Not
actively maintained"). bpf-kinsn-llvm: fork of llvm/llvm-project, description "LLVM BPF backend
with KOperation selection support"; latest commits 7f56eafab (2026-10-06 "BPF: rename kernel
instruction selector and options to kinsn"), 01c8ff376 (2026-07-11 "BPF: adopt KOperation naming").
eunomia-bpf/linux is a fork (branch `kinsn-only` used by artifact). Not cloned: bpf-kinsn-llvm,
ebpfos-linux, deepflow-kop (per instructions).

## What the repo is

Three research lines sharing one harness (README "Research Projects" table;
`kinsn/docs/archive/paper-prototype-design.md` "三个姐妹 idea"):

1. **Speculative ReJIT / bpfopt** (`bpfopt/`, `runner/`, `rejit/docs/`): fully userspace,
   stock kernel. `LD_PRELOAD` shim `bpfopt/shim/libbpfrejit_shim.so` intercepts `syscall(SYS_bpf,...)`,
   `perf_event_open`, `ioctl`, `close`, netlink; runs a runner-supplied plan of shell commands
   (`bpfopt --pass X --input ... --output ...`), probes verifier acceptance with stock
   `BPF_PROG_LOAD`, and substitutes accepted bytecode. No daemon, no `BPF_PROG_REJIT` (removed;
   AGENTS.md "Shim & Bytecode Architecture").
2. **kinsn / BPF-Ext** (`kinsn/`): kernel-module-defined "kernel instructions" (formerly
   Kops/KOperation/kop — renames in `kinsn/README.md`). Each has a *proof sequence* of vanilla
   BPF (`instantiate_insn`) that the verifier checks, and a native emit (`emit_x86`/`emit_arm64`).
   Paper prototype uses `BPF_PSEUDO_KINSN_SIDECAR` + `BPF_PSEUDO_KINSN_CALL` (UAPI additions in
   `eunomia-bpf/linux` `kinsn-only`); 10 files +869/-101 LOC kernel diff
   (`paper-prototype-design.md` §4.1). Upstream RFC (different design, kfuncs with a BPF body,
   no new UAPI) posted 2026-10-05.
3. **kprog / NativeBPF** (`kprog/`): eBPF program that simulates a native x86/arm64 instruction
   stream so the stock verifier checks it; then run native. Lean 4 formal model in `kprog/formal/`.

Plus the **bpf-bench** framing: "Auto-research framework and benchmark for agentic OS kernel
extension optimization" (README); paper draft "BPFOptBench" in `docs/ebpf27-bpfoptbench/`.

## The agent loop — what is actually in the repo

- There is no in-repo LLM driver. The "agent" is an external coding agent (Claude Code, Codex)
  operating the repo under `AGENTS.md`/`CLAUDE.md`. `.agents/skills/` holds 21 skills
  (`auto-research-orchestrator`, `kvm-benchmark-workflow`, `research-experiment-design`, paper
  writing skills...).
- `runner/libs/agent.py` is **not** an LLM agent: "agent" means the eBPF application process
  (Tracee/Tetragon...). `start_agent()` launches the app with `LD_PRELOAD=/usr/local/lib/bpfrejit/libbpfrejit_shim.so`
  and `BPFREJIT_SHIM_SOCK_DIR=/var/run/bpfrejit`.
- Integrity model (README "Agent Integrity Model", AGENTS.md "Measurement Integrity"): agents act
  only via `make` targets; frozen workloads/launchers/`corpus/driver.py`; never filter programs;
  `result.json` raw counters only; aggregation only in analysis scripts (`analysis/corpus_analyze.py`).
  Pass YAML under `runner/config/passes/` is policy and may be changed freely — this is the
  agent's action surface.
- Draft paper (`ebpf27-bpfoptbench/main.tex`): agents "submit an optimization configuration, the
  framework executes it under budget constraints, and returns data including verifier logs, JIT
  output size, and per-program runtime counters"; integrity via OS-level policy citing ActPlane.
  Preliminary eval: Claude Code (Opus 4.5) and Codex (GPT-5.5), 2,640 sessions May 6–Jun 26 2026,
  445M + 531M tokens, avg 7 h/session (max 19 h), 2,487 improvements / 3,197 regressions,
  2,299 verifier rejections, ~30 kernel crashes isolated in KVM; K2 3 programs 2%, Merlin 4% on
  Katran, agent source opts 12%; abstract "up to 34% speedup". Table: bulk_memory 1.90× vs 0.86×
  (ARM64 micro), BCC 1.04× vs OTEL 0.93× (x86 all passes), Cilium bulk_memory x86 1.28× vs ARM64 0.93×.
  Draft URL `github.com/eunomia-bpf/bpf-bench` returns 404 (repo is `bpf-benchmark`).
  README of the draft: "Agent success claims require new controlled runs"; "the existing
  bpf-benchmark runner is an execution substrate; BPFOptBench must add task datasets and
  evaluator isolation". The draft's `evaluation-sessions.md` counts 2,874 sessions (differs from 2,640).
- README: "six production eBPF applications, 146 comparable BPF program measurements, and 42
  microbenchmark tasks".

## Corpus and micro

- `corpus/config/macro_apps.yaml`: bcc/set, otelcol-ebpf-profiler/profiling, cilium/agent,
  tetragon/observer, katran, tracee/monitor. Removed apps with reasons in AGENTS.md (scx,
  suricata, systemd, loxilb, calico).
- Workloads (draft §Benchmark Design): pktgen for Cilium/Katran, stress-ng for Tetragon/Tracee/BCC,
  interpreter hash loops for OTEL.
- Apps vendored as eunomia-bpf forks (`.gitmodules`), katran branch `bpf-benchmark`.
- `micro/programs/`: 29 `.bpf.c` sources; `micro/config/micro_pure_jit.yaml` has 35 `- name:` entries
  (benchmarks + runtimes: native, llvmbpf, kernel, kernel_rejit, native_kernel, native_proof).
  Artifact guide: 27 programs (12 production-derived, 15 synthetic) + simple, simple_packet.
- `micro/README.md` smoke result: kinsn-LLVM path; siphash_rotate64_mixer 78.7 → 55.3 ns,
  payload_prefix_memcmp_scan 116.3 → 108.0, bpftrace_string_search_prefix_scan 180.0 → 175.7;
  29/29 correct; selector doesn't select inside local `.text` subprograms (512-byte stack).

## Methodology (`rejit/docs/evaluation.md` §5)

ratio = (post run_time_ns_delta / run_cnt_delta) / (baseline ...); drop programs with
min(run_cnt) < 100 (CV 29.6% → 17.7%, 127 vs 90 programs at ≥10K); geomean of ratios;
wins/losses/ties; bootstrap CIs over per-program ratios; tail-call caveat (tail-called progs
report run_cnt 0, cost appears in caller). Throughput measured with BPF stats off; BPF cost with
`BPFREJIT_CORPUS_BPF_STATS=1` (artifact guide §6). Two-start load-time protocol.

## Results quoted (with paths)

`docs/atc26-artifact-evaluation.md` §6: RQ1 x86 1.242× (27 programs), size 0.772×
(`x86_kvm_micro_20260519_114214_364050` vs `..._20260526_210351_224315`); RQ1 ARM64 1.222×, 308
sites, size 0.879×; load time 0.99×; RQ2 Cilium x86 all ops 1.074× throughput, 4086 sites, BPF
cost 1.010×; RQ2 Katran ARM64 1.065×, 21 sites, BPF cost 0.941×; RQ3 Cilium no bulk 1.119×, 3512
sites, BPF cost 1.062×; RQ3 Katran all ARM64 ops 0.984×, 62 sites; RQ4 Cilium whole-program
native 1.194× (median of six guests), 659.2 → 463.9 ns/run. Environment: KVM 8 vCPU/64 GB on
Intel Core Ultra 9 285K, kernel 7.0.0-rc2+; ARM64 AWS t4g.small.

`corpus/results/cilium_x86_config_parity_counterbalanced_20261010/SUMMARY.md`: 1.1938×, IQR
1.1853–1.2056, range 1.0744–1.2077; old 2.357974× ratio superseded (JIT arm had POLICY_AUDIT_MODE;
native traffic dropped reason 133). arXiv abstract still says 2.358×; camera-ready says 19%.

`rejit/docs/evaluation.md` (2026-09-24): Cilium map_inline 1.0667 [1.0393,1.0992], Katran
map_inline 1.0912 [1.0836,1.0983], Cilium hot_region_version 1.0504, Cilium hot_region+map_inline
1.0517; Tracee/BCC context_specialize intervals cross 1. `rejit/docs/design.md`: branch_flip
2026-07-01 1.054× vs 2026-07-04 0.899× — "cannot claim stable speedup".

RFC cover letter: 27 benchmarks, BPF 1.71× (x86) and 2.05× (arm64) slower than native; LLVM
within 7%; "21 chosen call sites gave 7.3% more throughput, but all 62 gave 0.5% less".
Alexei (2026-10-17): Q1 replace-before-analysis "yes"; Q2 "Copy only"; suggests KF_FASTCALL +
copy compiled C kfunc, no bodies/emit callbacks.

## BPF-Ext paper status

- Public: arXiv:2606.24213 "Kops: Safely Extending the eBPF Compilation Pipeline with Native
  Operations" (v1 2026-06-23; same 7 authors). Camera-ready title is "BPF-Ext: ..." (`\tool` =
  BPF-Ext, `\lang` = kinsn; earlier name EInsn). Accepted ATC '26 (paper #1160, CITATION.cff),
  conference Nov 16–18 2026 Hong Kong — not yet held on survey date; no ACM DL/USENIX
  proceedings URL found. Camera-ready LaTeX public at yunwei37/atc26-kinsn-camera-ready.
  Also eunomia.dev hosts a PDF of the Kops version. Zenodo concept DOI 10.5281/zenodo.22907396.
- Venue naming: CITATION.cff says "2026 ACM SIGOPS Annual Technical Conference (ATC '26)".

## kinsn code facts

- `kinsn/module/x86/` 15 `.c`, `kinsn/module/arm64/` 11 `.c`; `kinsn/module/include/kinsn_common.h`
  `DEFINE_KINSN_V2_MODULE` registers `btf_kfunc_id_set` with `.kinsn_descs`.
- `bpf_x86_rotate.c`: empty `__bpf_kfunc` stubs `bpf_x86_roll/rolq/rorxl`; `instantiate_rotate_leaf`
  (L106) builds rotate as `shift` iterations of JSLT/LSH/OR (no scratch register); `emit_rol_imm`
  (L205) emits REX + C1 /0 ib; descriptors (L346) `max_insn_cnt` 10270/2574/156, `max_emit_bytes` 16.
- Lean: `kinsn/lean/README.md` Lean 4.28/Mathlib; proves BPF.exec, ARM64.exec, X86.exec equal
  `spec`; axiom audit only propext/Classical.choice/Quot.sound.
- Pass families (README): kinsn-backed (kinsn, rotate, cond_select, ccmp, extract, endian_fusion,
  bulk_memory, prefetch), bytecode (noop, wide_mem, map_inline, const_prop, dce,
  bounds_check_merge, skb_load_bytes_spec), profile-guided branch_flip. Default policy
  `corpus/config/benchmark_config.yaml`: x86_64 → full-x86, arm64 → full.

## bpfopt code facts

`bpfopt/llvm/src/llvm_mapinline.hpp`: `generate_llvm_module` (L182) uses
`bpftime::llvmbpf_vm`, `set_kernel_compatible_mode(true)`, `generateModule`; `emit_bpf_object`
(L130) triple `bpfel`, `buildPerModuleDefaultPipeline(O3)`; `run_llvm_roundtrip` (L200).
`noop` is an O3 round trip, not byte-preserving (bpfopt/llvm/README.md).
Shim: `libbpfrejit_shim.c` `long syscall(long number, ...)` L724; `shim_loadtime.h` L1539
probe rejection → "passing original BPF_PROG_LOAD through".

## bpfperf facts

Archived repo (085bcbc): `kernel-sys/src/lib.rs` `branch_snapshot_sidecar_insns` (L827) —
19 hand-assembled insns: ringbuf_reserve, store prog_id, `bpf_get_branch_snapshot`, store return,
ringbuf_submit; `attach_branch_snapshot_sidecar` (L1205) loads it as BPF_PROG_TYPE_TRACING,
`BPF_TRACE_FEXIT`, `attach_prog_fd` = target program, `attach_btf_id` = target func BTF id, then
`bpf_link_create`. `bpfprof/src/main.rs` opens per-CPU perf events with
PERF_SAMPLE_BRANCH_STACK (cycles, period 1) to arm LBR; maps native IPs to BPF PCs through
`prog_jited_line_info` + `prog_xlated_insns`. Output per site: branch_count, branch_misses,
miss_rate, taken, not_taken.

In-tree `bpf-benchmark/bpfperf/crates/bpfprof/src/main.rs` (4,564 lines) has evolved: **no
`branch_snapshot` references**; it samples `PERF_COUNT_HW_BRANCH_INSTRUCTIONS` with
`PERF_SAMPLE_BRANCH_STACK` (default period 200,000) and optional `--precise-branch-direction`
(precise retired-branch events, Arrow Lake core PMU check), decodes x86 conditional branches in
the JIT image, LCS-maps xlated PCs to shim-dumped source bytecode, handles tail calls.

## Last ~50 commits (gh api, 2026-11-05 17:42 → 2026-11-06 00:16)

All 50 touch `docs/shared/implementation.md` (+5 log entry) and `kprog/formal/README.md`, often
`kprog/formal/check_paper_counts.py` (5,062-line checker of the kprog paper's stated figures
against a `make check` log) and the `docs/kprog-simulator-in-ebpf` submodule pointer. Themes:
binding count sentences to sources ("Bind all thirteen count sentences"), auditing name
classes/harness names, checking percentages/partitions, section titles, "Pick up ..." paper
submodule bumps. Over the last 500 commits (all 2026-11-01..06: 65/35/107/134/157/2 per day):
"formal" 50, "Step 0" 56, submodule 25, harness 38, kinsn 0, corpus 0, shim/bpfopt 0.
`kprog/formal/README.md`: 248 cross-check banners, 124,531,802 modeled cases, 306 Lean modules,
2,065 theorems, 488 by native_decide.

## Unverified / caveats

- Did not build or run anything. Six-app coverage claims from repo docs only.
- The "146 programs / 42 micro" figures come from README/draft; micro config count differs.
- Private submodules (docs/paper, docs/kprog-simulator-in-ebpf, docs/speculative-optimization,
  vendor/academic-writing-skills) not read.
- Could not read eunomia-bpf/linux kinsn-only kernel diff (not cloned).
