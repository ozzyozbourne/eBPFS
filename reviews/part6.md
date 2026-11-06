# Review: chapters 25–28 (AgentCgroup, RewardGuard + safe change, Actime + Akeep, namei_ext)

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/25-agentcgroup.html`, `26-reward-guard-and-safe-change.html`, `27-actime-and-akeep.html`,
`28-namei-ext.html`, checked against `research/25–28`, `AUTHORING.md`, `SYLLABUS.md`. Only these four chapters and
this file were edited. Nothing was committed or pushed.

## How the chapters were checked

- **Sources at the cited commits.** agentcgroup `551ca168`; reward-guard `98d4f285`; agent-check-restore-safety
  `c3fbdae3`; actime `9c035981`; akeep `7d690362`; backup-client-sdk `2774aa0b`; namei_ext `3f67fcbd`; agentqos README
  (raw from GitHub, HEAD). Kernel fork: GitHub compare API `062871f1371b...b07117a3cb41` (12 commits, 20 files, patch
  text) plus raw `fs/namei.c`, `fs/namei_ext.c`, `fs/readdir.c`, `kernel/bpf/cgroup.c`, `include/linux/namei_ext.h`,
  `include/uapi/linux/bpf.h` at `b07117a3` (not cloned). Upstream torvalds/master raw files for
  `kernel/cgroup/cgroup.c`, `include/trace/events/memcg.h`, `mm/memcontrol.c`, `include/linux/memcontrol.h`,
  `tools/sched_ext/scx_flatcg.{bpf.c,c}` and the GitHub commits API for `scx_flatcg.bpf.c`.
  AgentCgroup paper: arXiv HTML v3 (every number in ch25's tables searched). namei_ext paper draft
  (`docs/paper/main.tex`, `sections/05-evaluation.tex`) for every number in ch28's evaluation table.
- **`data-file` blocks (61).** A script compared every non-elided line, whitespace-normalised and in order, with the
  cited file (for ch26/ch27 against each candidate repo; for ch28 `kernel/…` against the fork files). 51 match exactly.
  The other 10 were checked by hand: elision markers inside comments or strings (ch25 flatcg header, ch27
  `information-flow.dsl`, `source.rs`, ch28 `redirect_alias.bpf.c`), an added comment the chapter labels (ch27
  `manifest.rs`), joined lines with identical content (ch26 content-guard `cmd` list, `gateway.go`), the agentqos README
  block (matches the agentqos README; the checker tried the actime README), and two real issues (26.3, 26.4).
- **Quoted text.** Searched in the repos, papers and docs: all found (several span line breaks), except one quote
  attributed to the wrong file (26.5).
- **Citations.** arXiv API for 2602.09345, 2603.11337, 2511.21654, 2510.20270, 2603.20625, 2608.22928, 2209.13085,
  1908.04734, 2406.10162, 2606.25189, 2508.02736, 2505.20411, 2310.06770. Crossref for Skalse et al., TMO and Everitt
  et al. USENIX pages for ExtFUSE, To FUSE or Not to FUSE, Bento and FxMark. LWN title/author/date for all ten LWN links.
  docs.kernel.org `admin-guide/cgroup-v2` for every cgroup quote and default in ch25.
- **Mechanics.** HTML parser tag balance, duplicate ids, same-page and cross-chapter anchors, raw `<`/`&` in `<pre>`:
  clean before and after the edits. Each chapter has 6 quiz questions with exactly one `data-right`. All 24 answers
  re-derived. prev/next: 24→25→26→27→28→29 correct in both directions. Prose 6.6k–7.6k words, ≥2 SVGs, ≥4 code
  samples, stepper and tabs in all four.
- **Not run.** Nothing in these chapters can be run in this orb (no cgroup v2 write access, no memcg_bpf_ops kernel, no
  namei_ext kernel, no Docker/KVM). All runtime statements below are code-reading results unless marked otherwise.

Severity scale as in parts 3–5: **High** = wrong technical statement a reader would act on; **Medium** = wrong or
misleading, limited impact; **Low** = imprecise, pedagogy or consistency.

## Specific claims the task asked to re-check

| Claim | Verdict |
|---|---|
| ch25: memcg_bpf_ops struct_ops | **Confirmed.** `patches.mbox` is RFC v6 00/12 (7 patches Hui Zhu, 5 Roman Gushchin). `struct memcg_bpf_ops` has the five callbacks shown; `BPF_MEMCG_CALL` with SRCU; `below_low` short-circuit in `mem_cgroup_below_low`; `penalty_jiffies = max(penalty_jiffies, bpf_high_delay)`; `memcontrol_bpf_online` inherits the parent's ops. Not in mainline (paper also calls it under review). Two `SEC(".struct_ops.link")` maps, attach with `bpf_map__attach_struct_ops_opts` + `relative_fd`. |
| ch25: scx_flatcg | **Partly wrong, fixed (25.3).** Same algorithm, but the copy is an older upstream version, not upstream + compat shims. Master now uses the two-argument `scx_bpf_dsq_move_to_local()` and has 2026 fixes the copy lacks (`94c20e1fb334` "expire cached hweights on weight changes", `a5cc43414b38` cvtime_delta race, `b6ee92d7f7f0`, `9b4243d30469`, `bf2f23dc5a36`). Loader `-d` and online CPUs confirmed. No agent-specific logic: confirmed. |
| ch25: no-internal-process rule breaks clean-up | **Confirmed in kernel source (not run).** `cgroup_migrate_vet_dst()` returns `-EBUSY` when `dst->subtree_control` is set and `cgroup_can_be_thread_root()` is false, which it is whenever a domain controller (`memory`) is enabled. So `echo $$ > session_high/cgroup.procs` fails (stderr discarded), and `rmdir` of the still-populated `tool_*` cgroup fails with `EBUSY`. Extra consequence, now in the chapter: no process can ever live directly in `session_high`, so Figure 25.1's "agent framework (Node.js), ~185 MB baseline" inside `session_high` was impossible (25.1). |
| ch25: tracepoint filter misses `tool_*` children | **Confirmed in source, and stronger than stated (25.2).** Upstream `memcg_rstat_events` records `cgroup_id(memcg->css.cgroup)`; PGFAULT goes through `count_memcg_event_mm()` → `mem_cgroup_from_task()`, the faulting task's leaf memcg. Combined with the row above, in the daemon + wrapper configuration no event can carry `session_high`'s id, so `trigger_ts` is never set and neither `below_low` nor `get_high_delay_ms` ever acts. The paper's evaluation replays traces directly in HIGH/LOW cgroups without the wrapper, so it does not contradict this. Labelled as code reading. |
| ch25: cgroup v2 facts | **Confirmed** against docs.kernel.org: "No controller is enabled by default", weights [1, 10000] default 100, `cpu.max` "max 100000", the `cgroup_set_weight` sentence, all four memory boundary quotes, `io.weight` "default 100", `pids.peak`, `cgroup.kill`, the no-internal-process wording. `memory.peak` is also resettable by writing to it (25.4). |
| ch26: agent-check-restore-safety uses neither eBPF nor CRIU | **eBPF: confirmed; the search claim was wrong (26.1).** No eBPF anywhere. But `runtime/internal/agentguest/codex_child_linux.go` builds a classic-BPF seccomp filter (`SECCOMP_SET_MODE_FILTER`, `unix.SockFilter`): kill non-x86-64, `EPERM` for x32, `io_uring_*`, and `socket`/`socketpair(AF_VSOCK)` (decoded by hand and matched against `codex_child_linux_test.go`). **CRIU: confirmed not used**; mentioned in `docs/experiments.md`, the legacy ACRFence tex and also `poc/README.md` (a to-do), added (26.2). Real C/R backends are QEMU and Firecracker. |
| ch27: actime has no sandbox | **Confirmed.** `rg landlock|seccomp|bwrap|unshare` finds only container detection and comments. DESIGN.md "Exactly three planes … no isolation plane"; README "does not manage sandboxes". GitHub description still says "sandbox isolation" (checked 2026-11-06). Commit `3f29370` message as quoted. |
| ch27: akeep storage model | **Confirmed, one precision (27.1).** BLAKE3 of uncompressed chunk, zstd level 3 default, optional age per object, manifest published last, never overwrite (`put(…, false)`), lock sharded by first hash byte (`CHUNK_LOCK_SHARDS`), `S3_UPLOAD_BATCH_BYTES` = 512 MiB, layout as in `docs/archive-format.md`. Chunk size is 4 MiB *by default* (`archive.chunk_size`, max 64 MiB), not fixed at 4 MiB. src/ is 8,766 lines (chapter: about 8.8k). |
| ch28: BPF_PROG_TYPE_NAMEI_EXT and hook placement | **Confirmed against the compare API and raw files.** New prog type + `BPF_CGROUP_NAMEI_EXT`, no struct_ops, no kfuncs; return range `[PASS, SELECT_TARGET]` in `return_retval_range`; `is_net_admin_prog_type`; attach flags/relative_fd/expected_revision must be 0; `link_create` → `-EOPNOTSUPP`; helpers = `cgroup_common_func_proto` + perf_event_output + base; debugfs files mode 0200; 8 parents max; `huge_encode_dev`; name truncated to 64 with true `name_len`. Hooks: `walk_component()` (after `handle_dots`), `open_last_lookups()`, `iterate_dir()`, each behind `namei_ext_enabled() && namei_ext_parent_maybe_managed()`, slow path `noinline`. 20 files / 12 commits / per-file +/- counts match. Two gaps found (28.1, 28.2). |

## Issues found and changes made

### Chapter 25: AgentCgroup

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 25.1 | Medium | Figure 25.1 placed the agent framework (Node.js, ~185 MB) inside `session_high`, which has `+memory +cpu` in `subtree_control`. The no-internal-process rule forbids that. The callout on clean-up called the rule "unverified". | Figure text changed to "no processes of its own (no-internal-process rule)"; caption explains that processes can live only in `tool_*` leaves and the code does not say where the framework runs. Callout now cites `cgroup_migrate_vet_dst()` → `-EBUSY` and the populated-`rmdir` failure, labelled "confirmed in kernel source, not run". |
| 25.2 | **High** | The tracepoint-filter caveat said the effect "depends on how the tracepoint reports them". The tracepoint reports the leaf memcg id, and with 25.1 no event can carry `session_high`'s id, so in the daemon + wrapper setup the BPF memory protection never triggers. | Paragraph rewritten with the upstream evidence and the conclusion, labelled as code reading; stepper step 5 and the "Fragile details" limitation updated to match. |
| 25.3 | Low | scx_flatcg described as upstream plus compatibility changes; it is an older upstream version that lacks 2026 fixes, one of which concerns weight changes. | Paragraph corrected, with commit ids. |
| 25.4 | Low | `memory.peak` "since it was created": also resettable. | "(or since the last reset)". |

Verified and left alone: every paper number in the findings and evaluation tables (v3 HTML), including 55–60%,
13.2/7.6%, 32–64 instances, <36%, 185/183/188 MB, 13.7×, 518/234 MB, 98.5%/28.5%, 67.3%/35.8%, 4060/264 MB, 15.4×,
2.9 GB, 85%/97%, 56, 502 MB, 197 MB–4 GB, CV 147%, 402/222/259 s, −0.84..+0.50, 114 images, "over 90%", "tens of
milliseconds", 1100/1233 MB, 66%, 239, +2.8%, 70.97→50.14 ms, +0.3%/−1.1%, 2.000 ± 0.046 s, the testbeds; quotes
"primary bottleneck", "requiring no BPF code changes", "per-workload and per-tool-call metadata", "throttling via
memory.high delays, then freezing via cgroup.freeze"; no `freeze` in `agentcg/`; EXPERIMENT_REPORT (4.40/4.39 s,
2.12/2.17 s, 192→184, 268→210 ms), RESULTS_SUMMARY (150 MB, 2000 ms, 1.29×/1.01×, 272/1644), exp_log2 (1–4 ms, 5/5);
line counts 121/351/209/954; 43 Python and 14 wrapper tests; all code blocks; LWN 1055698 is the v3 posting the paper
cites. All quiz answers (Q3 describes the program logic, which is still right).

### Chapter 26: RewardGuard and safe change

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 26.1 | Medium | "Searching the code for `bpf` finds only the Go module path." False: the Firecracker Codex guest installs a classic-BPF seccomp filter. Directly relevant to a BPF curriculum. | Callout now describes the filter, calls it seccomp-BPF not eBPF, and links chapter 01. The "No eBPF" verdict stands. |
| 26.2 | Low | CRIU list missed `poc/README.md`. | Added. |
| 26.3 | Low | `examples/minimal-task/rewardguard.json` block is reformatted (two lines per entry) with entries elided; not said. | Sentence before the block says so. |
| 26.4 | Low | `README.md` build block mixed in `KEEP_STATE=1 …` from `runtime/README.md` and added `#` comments. | Lead-in sentence says where each part comes from. |
| 26.5 | Low | "restore-domain-external head anchor" given as a `runtime/README.md` term with "my reading". The phrase is in the top-level README; `runtime/README.md` L708 states the meaning outright. | Both quoted; "my reading" removed. |
| 26.6 | Low | Everitt et al. cited as arXiv only; it is *Synthese* 198 (2021). ACRFence's arXiv journal-ref is "CoDAIM workshop 2026". | Both added to the references. |

Verified and left alone: RHA numbers (240 cells, 45/45, 0/75, R102 0/20, R095/R098/R099/R105 true metrics 0.748452,
0.904817, 0.842720 and the CIFAR blocked value 0.844780, gap 0.251548, R105 `expected_runs`/`complete_data_runs`),
R093 151–158 chars and R094 45 chars, R080/R082/R083/R084, R041/R042 timing, R057–R061 EvilGenie, R017/R021/R022,
Q2's rows R020/R034/R045 (all `webfetch=deny` baselines), ring buffer 512 KB/2 MB → 256 KB/16 MB and v0.2.66;
safe-change demo flow and assertions in `run.sh`, Compose networks, Firecracker 1.16.1, Claude Code 2.1.233,
`MaxOpenOperations = 12`, `MaxSolverStates = 100_000`, "must never", ACRFence quotes ("identical requests on retry",
temperature 0, Action Replay / Authority Resurrection, "eBPF-based system-level monitors"). All quiz answers.

### Chapter 27: Actime and Akeep

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 27.1 | Low | "Fixed-size 4 MiB chunks" and Q4's explanation present 4 MiB as fixed; it is the default of a config key (max 64 MiB). | Both say "by default". |
| 27.2 | Low | The agentqos block uses `data-file="README.md"` in a chapter whose header lists three other repos, so the path is ambiguous. Prose says "Its README". Content matches agentqos's README. | Not changed (report only). |

Verified and left alone: feature bits and `ENGINE_SUPPORTED_0_1_8 = 0x3f0` (connect, recv, file flow, block
exec/file/connect; missing contains/suffix/open/write), Q3 (the pack header lists file-source label propagation among
the missing features, and its `**/.env`-style patterns need the suffix matcher), all quotes from README, CLAUDE.md,
DESIGN.md (§5, §7, §8, "may hang a run forever"), policies.md, deployment.md (B tamper story), the akeep quotes
(README, archive-format.md, providers.md, portable-history.md), 23.6 GiB → ~243 MiB as the project's claim, SDK
boundary statements, agentqos README text and command, commit history. All quiz answers.

### Chapter 28: namei_ext

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 28.1 | Medium | Background and Figure 28.2 said `walk_component()` handles only non-final components. In the fork (as upstream), `lookup_last()` sends the final component of `stat`/`access` through `walk_component(nd, WALK_TRAILING)`, which is why `hide_secret_stat` works. | Background sentence added; figure label "non-final; final one for stat etc.". |
| 28.2 | Medium (new finding) | Calls that create or remove a name (`unlink`, `rmdir`, `mkdir`, `rename`, …) resolve their last component through `filename_parentat()` + `start_dirop()`/`lookup_one_qstr_excl()` (`filename_unlinkat` L5753ff, `filename_rmdir` L5611ff), which the patch does not hook. By reading, a HIDE policy would not stop `unlink("secret")`. Neither the chapter nor the repo docs mention it. | Limitation bullet added, labelled as code reading, not tested. |
| 28.3 | Low | Context access said writes are allowed to "bytes of `redirect_name[]`"; `namei_ext_is_valid_access()` allows 1-, 2-, 4- or 8-byte stores there (reads of `name[]`/`redirect_name[]` are byte-only, as stated). | Fixed. |
| 28.4 | Low | Base helper protos listed as "(maps, atomics, …)"; atomics are instructions, not helpers. | "(map helpers, `bpf_ktime_get_ns` and so on)". |

Verified and left alone: hook code excerpts, `namei_ext_lookup` action handling, `namei_ext_apply_target` checks
(`LOOKUP_IS_SCOPED` → `EXDEV`, NO_XDEV only across mounts, dir/regular only, `ND_JUMPED`), registry RCU replacement,
readdir actions, owner/scope dispatch, commit list (incl. "bubui"), Kconfig dependencies; every number in the
evaluation table (5.51/62.64 µs, 11.32× [11.24, 11.64], 1.052–1.088, 0.895–0.931, 0.901–0.934, 0.981–0.999,
2.20–3.66, 1.018 [0.907, 1.135], 1.0009/1.0083/1.0007 with CIs, 37/37, 34 slots, 13 method classes, 21/21, 39/40 →
40/40, 12/12, 6/6, 960/450/300 observations, 2.18×/0.945×, "0--19" requests) and the quoted scope sentences; the
"Six of the seven" vs "complete seven-workload" discrepancy is real and correctly reported. All quiz answers.

## Citations checked for the task list

| Citation | Result |
|---|---|
| arXiv 2602.09345 | AgentCgroup, 6 authors as listed, cs.OS, v1 2026-02-10, v3 2026-07-22. Correct. |
| RewardHackingAgents 2603.11337 | Atinafu, Cohen; cs.AI; 2026-03-11. Correct. |
| EvilGenie 2511.21654 | Gabor, Lynch, Rosenfeld; cs.LG; v1 2025-11-26, v2 2026-05-17. Correct. |
| ImpossibleBench 2510.20270 | Zhong, Raghunathan, Carlini; cs.LG; 2025-10-23. Correct. |
| ACRFence 2603.20625 | Zheng, Yang, Zhang, Quinn; cs.CR; 2026-03-21; journal-ref "CoDAIM workshop 2026" (added). |
| 2608.22928 | "When Can Agents Safely Checkpoint, Fork, Restore, and Merge? …", 6 authors as listed, cs.PL, 2026-08-24. Correct. |
| Skalse et al. | Crossref: *Advances in Neural Information Processing Systems 35* (NeurIPS 2022), DOI 10.52202/068431-0687. Venue correct. |
| Everitt et al. | arXiv 1908.04734 v5; published *Synthese* 198 (2021), DOI 10.1007/s11229-021-03141-4 (added). |
| Denison et al. 2406.10162 | 14 authors as listed. Correct. |
| TMO, ASPLOS '22 | Crossref 10.1145/3503222.3507731: Proc. 27th ASPLOS, pp. 609–621, Weiner et al. (11 authors). Correct. |
| ExtFUSE | USENIX ATC '19, Bijlani and Ramachandran. Correct. |
| Bento | USENIX FAST '21, Miller et al. Correct. |
| FxMark | USENIX ATC '16, "Understanding Manycore Scalability of File Systems", Min et al. Correct. |
| To FUSE or Not to FUSE | USENIX FAST '17, Vangoor, Tarasov, Zadok. Correct. |
| LWN | 922405 Corbet 2023-02-10; 1055698 RFC v3 posting; 822362 Corbet 2020-06-08; 649115/649729/650786 Neil Brown 2015; 796868 Corbet 2019-08-22; 859908 Corbet 2021-06-17; 937433 Jake Edge 2023-07-11. All titles, authors and years as cited. |
| Also checked | ActPlane 2606.25189, AgentSight 2508.02736 (journal-ref PACMI'2025), SWE-rebench 2505.20411, SWE-bench 2310.06770 (ICLR 2024). Correct. |

## Pedagogy and consistency

- **ch25.** The cgroup v2 primer (tree, `subtree_control`, the four memory boundaries, PSI) is correct and enough for a
  newcomer. Purpose and maturity are clear: proof of concept, unmerged RFC kernel interface, "preliminary" evaluation.
  The no-internal-process rule was introduced but then contradicted by the figure; the fixes make the primer and the
  code reading agree. Gap, not fixed: the chapter does not say how the wrapper inside a container reaches
  `/sys/fs/cgroup/agentcg/…` (cgroup namespaces normally hide the host path); the repo does not say either.
- **ch26.** The reward-hacking background (Skalse definition, tampering vs gaming, the four benchmarks) is accurate and
  sufficient. Purpose and maturity are explicit for both repos (manifest compiler not built; "runnable research
  prototype"). The seccomp note now ties the safe-change runtime to chapter 01's classic BPF.
- **ch27.** States plainly which components use eBPF and which do not, and that Actime 0.1.0 / Akeep 0.2.0 are young.
  The argv-`kill` explanation matches chapter 24's LSM/tracepoint split.
- **ch28.** The VFS / path-walk primer (dentry, `struct path`, nameidata, RCU-walk vs ref-walk, `-ECHILD`, openat2
  flags) is correct and sufficient; 28.1 fixed the one inaccuracy that mattered for the hooks. Maturity (out-of-tree
  7.1-rc7 fork, debugfs control plane, unpublished draft) is clear.
- **Consistency with 05/23/24.** cgroup program types, struct_ops and sched_ext are covered in chapter 05 as ch25 and
  ch28 assume; ch28's "not struct_ops" contrast matches chapter 05/20. AgentSight's `sslsniff` and the 256 KB
  `MAX_BUF_SIZE` in chapter 23 agree with ch26's ring-buffer note. ActPlane's hook/effect split in chapter 24 agrees
  with ch26 and ch27.

## Not resolved / not verified

- 25.1/25.2 and 28.2 are code-reading results against kernel source; none was run (no writable cgroup v2, no patched
  kernels here). For 25.2 the patched 6.19-rc5 kernel's tracepoint was assumed to match upstream (the RFC series does
  not touch it).
- The `PGFAULT = 23` enum value was not checked against the patched kernel's `vm_event_item` layout.
- 27.2 (ambiguous `data-file` for agentqos) left as is.
- Demo outputs quoted in ch26/ch27 from the authoring runs (`python3 -m reward_guard`, `actime doctor`, akeep
  `demo.sh`) were not re-run.
- Repo-docs-only items in ch26 (TRACE, BenchJack, SpecBench IDs; RewardHackBench having no paper) stay labelled as
  unverified, as the chapter already says.
- `git status` also shows other files modified by other agents (README.md, SYLLABUS.md, chapters 29–31,
  `research/20-gpu-ext.md`, new 23 and 32). Only the edits listed above are mine.
