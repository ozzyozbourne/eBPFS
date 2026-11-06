# Research notes — Chapter 17: bpfix

Date of study: 2026-11-06 (orb, Linux 6.1.189+, Debian clang 14.0.6, bpftool v7.1.0 / libbpf v1.1).

## Sources studied

- Repo: https://github.com/eunomia-bpf/bpfix, default branch `master`, commit
  `4b9decaaaa2108b6ddb85c351473983b0d1501aa` ("chore: release bpfix 0.1.10", 2026-08-05).
  Cloned to `/home/user/workspace/src/bpfix` with `--depth 1 --filter=blob:limit=2m`.
- Paper submodule: `paper` -> https://github.com/yunwei37/ebpf27-bpfix (public), commit
  `f98e7e2c7a0f987fb2d16b709230c41f375ba00e` (2026-07-02). Cloned to
  `/home/user/workspace/src/bpfix-paper`.
- GitHub API: repo metadata, full commit list (475 commits on master), branches, PRs.
- crates.io API: `bpfix` crate, max_version 0.1.10, created 2026-06-17.

## Repository facts

- GitHub description: "Making eBPF verifier errors as friendly as Rust compiler errors, and let LLM fix it."
- Created 2026-03-12 (first commit authored 2026-03-11), 23 stars at time of study, MIT license.
- Commits per month on master: 2026-03: 62, 04: 21, 05: 16, 06: 352, 07: 15, 08: 9 (475 total).
- Open PRs #8, #9, #10 (2026-10-31): whole-word null-check identifier matching, ignore empty
  `@ prog.c:0` source comment, `as_chunks` for 8-byte instruction split. PR #2 (merged
  2026-08-01): "Measure token and timing cost in BPFix-Bench".
- History milestones (from commit messages):
  - 2026-03-11 "Add OBLIGE project scaffold" — project originally named OBLIGE; renamed
    "OBLIGE → BPFix" on 2026-03-19 (commit `adcdd757`). Early Python implementation,
    "Collect 302 verifier failure cases from 3 sources" (`cfa48350`).
  - 2026-04-29/30: corpus layout, raw backlog triage, Cilium reconstruction batches,
    "Make benchmark taxonomy mutually exclusive".
  - 2026-05-22: "Add Rust BPFix workspace", "Render diagnostics in rust style",
    "Instantiate required proofs in bpfix diagnostics", "Make bpfix a standalone log analyzer".
    2026-05-23: terminology "proof obligation" → "required proof".
  - 2026-06-17..22: bpfix-test (later bpfix-bench) built to 75 cases, hardened oracles,
    Qwen and GLM 5.2 results; 2026-06-19 "Remove bpfix JSON output mode".
  - 2026-06-27 "Rename empirical corpus and repair benchmark" (bpfix-empirical / bpfix-bench).
  - 2026-06-30..07-03: crates.io release automation, 0.1.1–0.1.8, `--doctor`, CLI contract frozen.
  - 2026-07-03/11: skills benchmark mode; `ebpf-verifier-repair` agent skill published.
  - 2026-08-01/05: token/timing cost accounting, prompt ablations, full cost artifacts, 0.1.10.

## Code layout (Rust workspace, ~23k lines in crates/)

- `crates/bpfix/` — CLI (`main.rs` 621 lines; `classifier.rs` 623; `input.rs` 455;
  `proof.rs` 412; `family.rs` 160; `output.rs` 219; `source.rs` 129; `diagnostic/` ~25 signal modules).
- `crates/bpfanalysis/` — verifier-log parser (`verifier_log.rs` 2213 lines,
  `verifier_log/terminal_error.rs`, `instruction_text.rs`) and bytecode/CFG analysis
  (`analysis/bbprogram*.rs`, `object_file.rs`) behind the `analysis`/`object-analysis`
  features (libbpf-sys). `lib.rs` says core analysis modules "are imported from the `bpfopt` project".
- `bpfix` depends on `bpfanalysis` with `default-features = false`, so the default CLI build
  does not need libbpf-sys. Built here in 18 s (`cargo build --release -p bpfix`, 2 jobs).
- `bpfix-empirical/` — 235-case replay corpus (manifest.yaml, taxonomy.yaml, environment.yaml,
  cases/, raw/, tools/, empirical-fixtures.tar.gz with prog.o + replay-verifier.log).
- `bpfix-bench/` — 77 case dirs, 75 runnable in frozen `splits/main.txt`; tools/run_suite.py etc;
  `published-results/main75/{qwen36-27b,glm52,qwen25-3b}`; `results/` (August cost + ablation artifacts).
- `skills/ebpf-verifier-repair/` — agent skill (SKILL.md, references/, scripts/).
- `examples/` — bpftool, libbpf-c, libbpf-rs, aya, bcc, make, ci, editor.
- `docs/` — user-guide, open-source-tool-design, project-status, error-catalog.yaml,
  evaluation/ (bpfix-bench-llm-repair-eval.md, metrics.md, baselines.md, ...), ARTIFACT.md.
- `vendor/libbpf` submodule; `paper` submodule.

## Pipeline (from code)

1. `input.rs::load_input` — read file/stdin; strip ANSI, CI timestamps; extract the last
   `-- BEGIN PROG LOAD LOG --` … `-- END PROG LOAD LOG --` region.
2. `input.rs::find_terminal_error` — scan lines backwards for `is_verifier_error_line`
   (marker list `TERMINAL_ERROR_MARKERS` in verifier_log.rs), join continuation lines,
   find nearest instruction PC, call target, source comment.
3. `classifier.rs::classify_with_context` — substring patterns (`REJECTION_PATTERNS`) →
   `VerifierRejectionKind` → `Classification` (error id BPFIX-E001..E018, obligation,
   failure_class, help). Unknown → BPFIX-E099; no rejection → BPFIX-E000.
4. `diagnostic/analyzer.rs::analyze_verifier_log_with_context` — parse all state lines
   (`verifier_states_with_branch_deltas_from_log`: forms `from X to Y: R…`, `pc: R…`,
   `pc: (insn) ... ; R…`) into `VerifierInsn {pc, regs: RegState{reg_type, range, tnum,
   packet_range, offset, id, ref_id…}, stack…}`; collect source events
   (`source.rs::collect_source_events` parses `; <text> @ file:line` and binds next PC within 4 lines);
   `proof.rs::instantiate_required_proof` (e.g., packet: off+size vs r=);
   obligation-specific proof events (`proof_events.rs`: ProofEstablished / ProofLost / Rejected,
   evidence VerifierState / SourceComment / TerminalVerifier); then `signal_pipeline::proof_signals`
   runs ~60 named predicates (lowering, dynptr, irq, nullable, …) that can override id/class/help.
5. `main.rs::build_diagnostic` + `output.rs::render_text` — Rust-style text: `error[ID]`,
   class, confidence, `diagnostic/help/span` qualities, next action, `-->` path:line,
   source spans with `^^^` primary / `---` secondary labels, `= verifier[...]`, notes,
   required proof, `help:` lines. span confidence: exact_pc / nearest_source_comment /
   terminal_line_only / none.
- Optional `--object prog.o` (feature `object-analysis`) builds ProgramCFG summaries and attaches
  verifier states to CFG sites. Not built/tested here.
- README "Non-Goals": not a kernel patch, not a verifier replacement, "not an automatic
  source-code repair tool", not a semantic checker for accepted programs.

## Source mapping: depends on kernel log format

- bpfix gets source locations ONLY from the verifier's BTF line-info comments of the form
  `; <source text> @ <file>:<line>` (source.rs::parse_source_comment uses `rsplit_once(" @ ")`).
- Kernel: `verbose_linfo()` prints `" @ %s:%u\n"` in v6.9 `kernel/bpf/log.c` line 425;
  absent in v6.8 log.c; in v6.1 (verifier.c) it prints only `"%s\n"` (source text, no file/line).
  Verified by fetching raw files from GitHub torvalds/linux tags v6.1, v6.4–v6.10.
- Consequence verified in this orb (6.1): output shows `--> <verifier-log>:N` with no source
  block; classification, required proof, help still produced.

## Experiments run in this orb

1. `examples/bpftool/quick-start.bpf.o` (= stackoverflow-53136145 prog.o) loaded with
   `sudo bpftool -d prog load ... ` on 6.1: rejected `R5 invalid mem access 'scalar'` at pc 37,
   60 state snapshots. bpfix: `error[BPFIX-E006]: verifier-visible compiler lowering hides the
   required proof`, class lowering_artifact, `--> <verifier-log>:180`, note[lowering] "one verifier
   path reaches this shared instruction with a valid pointer proof, but another path reaches it
   after the proof is clobbered" (signal SharedInstructionPathProofLoss) — differs from README's
   note (PacketPointerProofLostAfterBoundsCheck) that needs source comments.
2. Bundled 6.15 replay log (extracted from empirical-fixtures.tar.gz into /tmp): output identical
   to README (prog.c:263/267/270 spans). Log contains `;  @ prog.c:0` (subject of PR #9).
3. bpfix-bench `packet_eth_off_by_one_001`: running bpfix on checked-in verifier.log is
   byte-identical to diagnostic.txt. Rebuilt buggy/fixed with clang 14 + vmlinux.h on 6.1:
   buggy rejected (`invalid access to packet, off=12 size=2, R1(id=0,off=12,r=13)`), fixed loads.
   bpfix on 6.1 log: BPFIX-E001 "packet bounds proof is missing", required proof "prove R1 has
   packet range at least 14 bytes before this access; verifier currently has range 13", no spans.
   On 6.15 log: title "packet bounds check is narrower than the later packet access" with spans
   33/36. Secondary label on line 33 says "verifier only proves packet range 0 bytes on this path"
   while primary says 13 — a label inconsistency observed.
4. Oracle: `run_suite.py --case packet_eth_off_by_one_001 --candidate .../fixed.bpf.c` passed on
   6.1 (compile, load, 7 functional bpftool prog run tests; `thirteen_byte_packet_passes` had
   bpftool error "Invalid argument" and `run_error_treated_as_pass: true`). `--prompt-only` works
   without API key.
5. Own program `nullmap.bpf.c` (tracepoint, map lookup without NULL check): 6.1 rejects
   `R0 invalid mem access 'map_value_or_null'`; bpfix: BPFIX-E002 class source_bug, next action
   null, required proof "prove the nullable helper result is non-null in the same verifier-visible
   branch as this use". Also log contained an earlier line "reg type unsupported for arg#0
   function count_openat#17"; bpfix correctly picked the last error.
6. `--doctor` works; reports bpftool "not found" because it lives in /usr/sbin (only on root PATH).
   `--fail-on-unsupported` returns exit 2 on non-log input. Runtime ~3 ms on qs.log.

## Empirical corpus (bpfix-empirical/README.md, manifest.yaml, environment.yaml)

- 235 replayable cases, environment `kernel-6.15.11-clang-18-log2` (kernel 6.15.11, clang 18.1.3,
  bpftool v7.7.0, libbpf 1.3.0 per environment.yaml, log level 2).
- source_kind: github_issue 18, github_commit 46, kernel_selftest 85, stackoverflow 86.
- taxonomy_class: source_bug 191, lowering_artifact 18, environment_or_configuration 14,
  verifier_false_positive 7, verifier_limit 5.
- raw audit records: github_commit 591, github_issue 31, stackoverflow 114 = 736; plus 201
  kernel-selftest raw log fixtures.
- Taxonomy (taxonomy.yaml): 5 classes, decision order verifier_false_positive →
  environment_or_configuration → verifier_limit → lowering_artifact → source_bug; "ask which layer
  must change to make the failure disappear".
- Case schema example `cases/stackoverflow-53136145/case.yaml`: label taxonomy_class
  lowering_artifact, error_id BPFIX-E006, label_source adjudicated, root_cause_insn_idx null.
- No published diagnostic-accuracy numbers on the empirical corpus found in docs (metrics.md
  defines metrics only).
- Doc drift: README says the eval driver invokes `bpfix --format json`, but JSON output was
  removed (2026-06-19) and evaluate_diagnostics.py has `parse_bpfix_text`.

## Paper (paper/main.tex, sections/*.tex)

- Title: "Characterizing and Bridging the Diagnostic Gap in eBPF Verifier Rejections".
- Authors: Yusheng Zheng, Zhengjie Ji, Weichen Tao, Xiangyu Gao, Jianchang Su, Wei Zhang,
  Andi Quinn, Dan Williams (UC Santa Cruz, eunomia-bpf, Virginia Tech, Telecom Paris, UW, UConn).
- acmart sigplan; a commented-out line `\acmConference[eBPF '27]{ACM SIGCOMM Workshop on eBPF and
  Kernel Extensions}{2027}`; repo named `ebpf27-bpfix`. No acceptance stated. Evaluation doc
  also lists OSDI '26 and NeurIPS 2026 E&D calls as external references. Venue: unverified/not stated.
- Study: 936 candidate reports → 235 reproduced (table sec-2-corpus-outcomes: not a verifier error
  262, needs specific env 197, selftest candidate not admitted 115, not reconstructable 45,
  reproduced but accepted 32, missing source 31, missing verifier log 15, rejected without a
  reported instruction 4).
- 191 program bugs in 12 root causes (Unclamped scalar 24, Corrupted/stale dynptr 23, Packet access
  w/o bound on every path 22, Missing null check 19, Pointer type/provenance mismatch 16, Unverified
  address dereferenced 16, Index exceeds capacity 15, Context/contract misuse 15, Unpaired resource
  reference 15, IRQ flag not restored in order 11, Probe signature mismatched with ABI 9,
  Oversized/uninitialized stack buffer 6). 44 others: compiler 18, environment 14, verifier 12.
- 47% of rejections return EINVAL; 167 distinct strings → 82 templates; 15 templates map to >1
  root cause; `R# invalid mem access 'scalar'` 28 cases / 9 categories; `invalid access to packet`
  26/5; `invalid access to map value` 18/4; `R# !read_ok` 13/4.
- Table sec-2-error-space: 454 rejection points in 6.15.11 verifier.c grouped in 16 classes.
- Table sec-5-lowering: 4 lowering artifacts printing `invalid mem access 'scalar'` (bcc 42c00adb,
  cilium 4d36cac2, cilium 50c319d0, SO 53136145).
- Design §3: ~23k lines Rust; three stages Log Analysis → Proof Reconstruction → Diagnostic
  Generation; establishment / loss / rejection; loss point.
- Abstract: raw-log one-shot 0–37%; BPFix improves by 11–21pp.
- Related work cited: Deokar et al. eBPF '24; PREVAIL PLDI'19; Agni CAV'23; Sun & Su OSDI'24;
  Rex ATC'25; Kgent eBPF '24; Pretty Verifier IEEE CSR 2025; bpfvv.

## Benchmark results (docs/evaluation/bpfix-bench-llm-repair-eval.md; summaries verified)

Verified by reading `passed`/`total` from each `bpfix-bench/published-results/main75/*/*/summary.json`:
- Qwen3.6 27B: raw 1-shot 22/75, BPFix 1-shot 38/75; raw retry2 30/75, BPFix retry2 44/75.
- GLM 5.2: 28/75, 38/75; 47/75, 52/75.
- Qwen2.5 3B: 0/75, 8/75; 0/75, 10/75 (3 raw one-shot HTTP 400 on long prompts; 4 in retry).
- Failure-stage table (1-shot, Qwen3.6 27B): raw compile 3 / load 19 / functional 9 / aux 22;
  BPFix 1 / 10 / 10 / 16.
- Diagnostic class distribution in main75 diagnostic.txt: source_bug 63, lowering_artifact 8,
  environment_or_configuration 4. Program types: XDP 62, tracepoint 6, TC 5, LSM 1, kprobe 1.
- Source families: mechanism-designed 40, Cilium 7, ActPlane 5, xdp-tools 5, AgentSight 4,
  bpf-developer-tutorial 4, bpftime 3, eunomia.dev 3, DatRail 2, NCCL-eBPF 1, Tetragon 1.
- Mechanism buckets: proof lifecycle 26, modern BPF protocol 23, source/object correlation 13,
  helper memory contract 9, environment/config 4.
- Run config: temp 0, max_tokens 8192, timeout 900, OpenAI-compatible endpoint; Qwen via
  llama.cpp on RTX 5090; GLM via Z.ai with thinking disabled. Host kernel 6.15.11, clang 18.1.3,
  bpftool 7.7.0 / libbpf 1.7.
- Cost rerun (`bpfix-bench/results/cost-main75-current-server/result-report.md`, Qwen3.6 27B,
  commit f5293abc): 1 attempt raw 21/75 with ≥399,578 total tokens vs BPFix 38/75 with 117,159;
  2 attempts raw 32/75 ≥777,756 vs BPFix 44/75 251,316. Raw totals are lower bounds (HTTP 400
  without usage on 32K context).
- Ablation (`bpfix-bench/results/ablation-main75-current-server/result-report.md`, commit 89f54847):
  source-only 24/75; matched-raw-tail 26/75; bpfix-no-help 29/75; bpfix-neutral (full) 38/75.
  McNemar: tail vs no-help p=0.5078; no-help vs full p=0.0117.
- Prompt: system "You repair eBPF C verifier failures by returning a full corrected source file.";
  user prompt asks for one complete C file in a ```c block, preserve semantics, plus one evidence
  block. Retry appends previous candidate + compile stderr / verifier output / failed oracle checks
  (truncated) — never fixed.bpf.c or hidden predicates.

## Citations verified

- Deokar et al., "An Empirical Study on the Challenges of eBPF Application Development",
  eBPF '24, DOI 10.1145/3672197.3673429 (Crossref confirmed).
- Zheng et al., "Kgent: Kernel Extensions Large Language Model Agent", eBPF '24,
  DOI 10.1145/3672197.3673434 (Crossref). Earlier arXiv 2312.05531 "KEN: Kernel Extensions using
  Natural Language" (arXiv page). Repo https://github.com/eunomia-bpf/KEN.
- Rizza, Sisto, Valenza, "Design and implementation of a tool to improve error reporting for eBPF
  code", IEEE CSR 2025, pp. 214–219, DOI 10.1109/CSR64739.2025.11130075 (Crossref; PoliTo IRIS
  postprint). Later SSRN preprint "Improving Error Messages for eBPF Programs" (2026-05).
- libbpf/bpfvv — "A tool to help programmers debug and analyze Linux Kernel BPF verification
  failures." (GitHub API).
- Gershuni et al., PREVAIL, PLDI 2019, DOI 10.1145/3314221.3314590 (Crossref).
- Vishwanathan et al., "Verifying the Verifier: eBPF Range Analysis Verification", CAV 2023,
  DOI 10.1007/978-3-031-37709-9_12 (resolves).
- Sun & Su, "Validating the eBPF Verifier via State Embedding", OSDI '24,
  https://www.usenix.org/conference/osdi24/presentation/sun-hao.
- Jia et al., "Rex: Closing the language-verifier gap with safe and usable kernel extensions",
  USENIX ATC '25, https://www.usenix.org/conference/atc25/presentation/jia (200).
- Kernel docs https://docs.kernel.org/bpf/verifier.html ; rustc JSON diagnostics
  https://doc.rust-lang.org/rustc/json.html ; rustc dev guide diagnostics
  https://rustc-dev-guide.rust-lang.org/diagnostics.html.

## Not verified

- `--object` / `object-analysis` feature (needs libbpf-sys build) — not built.
- Full empirical replay (needs 6.15.11) and model-backed benchmark runs (need an LLM endpoint).
- Paper venue/acceptance.
