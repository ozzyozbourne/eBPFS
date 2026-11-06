# Research notes — Chapter 24: ActPlane

## Source studied

- Repo: https://github.com/eunomia-bpf/ActPlane (description: "eBPF Information Flow Enforcement for AI Agent safety, security and effectiveness"; 110 stars when checked 2026-11-06; default branch `master`).
- Clone: `git clone --depth 1 --single-branch --filter=blob:limit=2m` into `/home/user/workspace/src/ActPlane`.
- Commit studied: `bb89c77bcb29cfa81ba1fb212b5634c353c7352b` (2026-10-16, "Bump serde_json from 1.0.151 to 1.0.154 (#608)").
- Crate version in tree: `actplane v0.1.8` (crates/actplane-cli).
- Lineage: CLAUDE.md says the repo descends from AgentSight; SSL/HTTP analyzer chain, web server and frontend were removed.

## Paper (verified with arXiv API, export.arxiv.org/api/query?id_list=2606.25189)

- Title: "ActPlane: Programmable OS-Level Policy Enforcement for Agent Harnesses"
- arXiv 2606.25189, cs.OS, v1 2026-06-23, v2 2026-06-30.
- Authors (arXiv, 9): Yusheng Zheng, Tianyuan Wu, Quanzhi Fu, Tong Yu, Wenan Mao, Tao Ma, Dan Williams, Wei Wang, Andi Quinn. Affiliations (HTML v2): UC Santa Cruz, Virginia Tech, HKUST, eunomia-bpf, Alibaba Group.
- NOTE: the README BibTeX lists 8 authors (omits Tao Ma). arXiv metadata is authoritative.
- A commit message mentions "sync ATC 2026 rebuttal paper revision" (c1dd76f5) — venue status not verified; do not claim acceptance.

### Paper numbers (from arXiv HTML v2)

- Empirical study: 64 repos with CLAUDE.md/AGENTS.md, snapshot 2026-05-23, median 20K stars, 84 instruction files, 2,116 statements. 64% policies; of 1,361 policies 17% semantic-only, 83% system-observable (38% content, 29% per-event, 16% cross-event). 81% of repos contain ≥1 cross-event policy. Of 1,127 system-observable policies: 26.4% self-contained, 64.2% project context, 9.4% task context. 607 OS-enforceable policies.
- Implementation (paper): ~3.2K LoC Rust compiler/runner, ~1.8K LoC BPF C; up to 128 rules; 64-bit label bitmasks; BPF-LSM for block, tracepoints for observation/kill.
- Testbed: Intel Core Ultra 9 285K (24 cores), 125 GiB RAM, Linux 6.15.11.
- RQ1: 607 policies → 1,283 rule lines; $0.028 per policy; 1.7M input / 177k output tokens; 34 min with 7 subagents (4 parallel); 74% have ≤2 clauses; mean 71 tokens; effects 66% notify, 29% block, 5% kill; 60% exec, 37% write; 28% use after/since; 214 use unless; 95 define file sources; declassify/endorse unused.
- RQ2 (38 rules, 5 traces each, 190 judged): DCR Prompt-filter 48.4%, Tool-regex 45.3%, FIDES 48.9%, ActPlane-opaque 53.7%, ActPlane 75.8%. ActPlane TP 86 TN 58 FP 18 FN 28. Detects 77.2% of violations vs 34–40% baselines. 26/28 FN recovered after one rule revision. Opaque ablation: FN 87, FP 1.
- RQ3 overhead (no-hit policies): agent-trace replay 1.9% at AP-32; Linux build 6.5% at AP-32; <8.4% at AP-100. Per-syscall p50 (µs) Native/AP-1/AP-32/AP-100: fork 48.94/52.06/74.05/69.33; exec 248.30/263.95/314.86/317.03; open 0.58/1.24/6.92/13.40; write 0.27/0.78/0.79/0.84; connect 0.58/0.61/1.98/3.17. Hot reload 26.3 µs; exec violation observed p50 176.4 µs.
- RQ4 OctoBench (21 tasks in scope): user-query reward +9.9 pts, impl/test +9.7, compliance +2.8; 110 runtime deltas.
- RQ5 OpenAgentSafety 361 tasks: baseline unsafe 106; ActPlane prevented 78, missed 28 → 74%.
- Threat model: privileged loader + higher-authority policy loaded before agent; agent-authored rules only add; TCB = kernel engine + higher-authority policy. Out of scope: file contents, kernel compromise, CAP_BPF compromise, side channels; semantically equivalent ops (custom git client) evade command rules.

## Kernel engine facts (bpf/)

- `bpf/process.bpf.c` (3,953 lines at this commit): LSM hooks `bprm_check_security`, `file_open`, `file_permission`, `file_truncate`, `mmap_file`, `file_mprotect`, `path_truncate`, `path_unlink`, `path_rename`, `socket_connect`, `socket_recvmsg`, `task_kill`, `ptrace_access_check`, `bpf` (14). Tracepoints: `sched/sched_process_fork|exec|exit` and many `syscalls/sys_enter_*|sys_exit_*` (openat, open, openat2, creat, truncate, pipe, pipe2, socketpair, bind, accept, accept4, unlink, unlinkat, rename*, connect, read, write, mmap, mprotect, mremap, munmap, sendto, recvfrom, sendmsg, recvmsg, close, dup*, fcntl, sendfile64, copy_file_range, splice, getpid). No kprobes, no cgroup programs. `grep -i cgroup bpf/*.c bpf/*.h` → nothing.
- Exec path split across tail calls (`exec_tail` PROG_ARRAY).
- Effects: `block` → LSM hook returns `-EPERM`; `kill` → `bpf_send_signal(SIGKILL)`; `notify` → event only. `te_tracepoint_mode()` returns `TE_MODE_NOTIFY`; `te_supported_effects(TE_MODE_BLOCK)` = only BLOCK bit, otherwise NOTIFY|KILL. So LSM hooks evaluate block clauses; tracepoints evaluate notify/kill (my reading of the code).
- Only output: `emit_violation()` → ring buffer `rb`, event TAINT_VIOLATION.
- `enforce_mode` rodata set by loader from `bpf_lsm_active()` (reads `/sys/kernel/security/lsm`, env `ACTPLANE_FORCE_TRACEPOINT` forces off) in `bpf/src/lib.rs`.
- Scope: `te_pid_active(pid)` = `cap_task_bound(pid)`; pids in `cap_task`; fork copies via `te_fork`/`cap_fork`. Root per lineage in `ts_root`.
- Maps: `ts_proc` (pid→{labels, lin_gates}), `ts_proc_domains`, `ts_root`, `ts_sess` (gate epochs/inval epochs), `ts_file` (file_domain_id{dev,ino or fnv1a path}→{labels,last_write_epoch}), `ts_endp` (IPv4+domain→labels), `*_prov` maps for provenance, `ts_updates`/`ts_rules`/`ts_counts`, `cap_req` (USER_RINGBUF), `cap_state`, `cap_task`, `cap_policy`.
- Self-protection (LSM): task_kill/ptrace against protected control pid denied; `lsm/bpf` allows only lookup/get_next_key/obj_get/info for managed pids; update/delete only with authority.
- Limits (taint.h): TAINT_PAT_LEN 64, MAX_TAINT_UPDATES 320, MAX_TAINT_RULES 128, MAX_TAINT_GATES 64, MAX_TAINT_INVALS 64, labels u64, MAX_ARG_SLOTS 16, TAINT_ARG_LEN 24.
- Pin root `/sys/fs/bpf/actplane/v1` (env ACTPLANE_BPF_PIN_ROOT).
- Kernel requirement (README): 5.10+ BTF; 5.10–6.0 static exec/file/IPv4 policies (`process-legacy.bpf.o`); full runtime 6.1+. bpf/README says 5.8+; CLAUDE.md says developed on 6.15.

## Userspace

- `crates/actplane-ifc-compiler/src/dsl/{ast,parse,lower,mod}.rs`; lower.rs: label/gate bits, DNF → (req, forbid), globs → EXACT/PREFIX/SUFFIX/ANY/CONTAINS, IPv4 net/mask, repr(C) mirror of taint.h.
- `crates/actplane-runtime/src/runtime.rs`: `spawn_stopped_target` runs `/bin/sh -c 'kill -STOP $$; exec "$@"'`, drops to SUDO uid/gid, then engine seeds label (`seed_label_in_domain`), protects control pid, then SIGCONT.
- `run` requires the policy to declare label `COMMAND` or `AGENT` (error seen on orb).
- CLI commands: run, compile, init, doctor, watch, attach, feedback-hook, mcp, control. Templates: no-git-branch, no-git-push, no-secret-egress, test-before-commit, dependency-update-gate, protected-branch-push, workspace-confinement, readonly-review, no-network, prod-db-via-migrate.

## What I ran on the orb (kernel 6.1.189+, LSMs `capability,landlock`)

- `cargo build --release -p actplane` with CARGO_BUILD_JOBS=2: finished in 1m56s.
- `cc -I bpf bpf/test_taint.c`: 38 passed, 0 failed.
- `cargo test --release -p actplane-ifc-compiler`: 41 passed, 0 failed, 1 ignored.
- `actplane compile` / `compile --explain`: OK; reported "BPF-LSM pre-op block: unavailable", "kill connect -> connect tracepoint kill, IPv4 only".
- `actplane doctor`: "⚠ BPF-LSM: not active; `block` rules will not fire (capability,landlock)".
- `sudo -E actplane run -- bash -c ...`: FAILED to load. Verifier: "tail_calls are not allowed in non-JITed programs with bpf-to-bpf calls". The orb kernel has no BPF JIT (`/proc/sys/net/core/bpf_jit_enable` missing). So no enforcement was observed. Cleaned up empty `/sys/fs/bpf/actplane` dirs afterwards.

## Recent commits (master, from GitHub API)

- 2026-10: dependabot bumps (serde_json, tokio, libc, rmcp).
- 2026-09-10..12: "Audit OpenAgentSafety policy inventory compilation (#42)", "Audit RQ2 outcomes by execution path and FIDES (#40)", "Adopt PR-only workflow (#38)", fixes "preserve file-source provenance across rename", "select verifier-safe rename hooks", "reduce file-flow verifier stack depth".
- 2026-08-31: "sync ATC 2026 rebuttal paper revision"; rmcp 2.2 → 3.1.4.
- 2026-07-22: "fix: reduce rule evaluation stack depth (#27)", aya 0.13.1 → 0.14.0.
- 2026-07-18: legacy (5.10) runtime: fail closed, cleanup, "Extend Linux 5.10 static policy coverage".

## Background citations (verified)

- Denning, "A Lattice Model of Secure Information Flow", CACM 19(5), 1976, doi 10.1145/360051.360056 (Crossref).
- Efstathopoulos et al., "Labels and Event Processes in the Asbestos Operating System", SOSP 2005, doi 10.1145/1095810.1095813 (Crossref).
- Zeldovich et al., "Making Information Flow Explicit in HiStar", OSDI 2006, https://www.usenix.org/conference/osdi-06/making-information-flow-explicit-histar
- Krohn et al., "Information Flow Control for Standard OS Abstractions" (Flume), SOSP 2007, doi 10.1145/1294261.1294293 (Crossref).
- Myers, "JFlow", POPL 1999, doi 10.1145/292540.292561 (from paper bib).
- Enck et al., TaintDroid, OSDI 2010 (paper bib URL).
- Pasquier et al., CamFlow, IEEE TCC 2017, doi 10.1109/TCC.2015.2489211; CamQuery "Runtime Analysis of Whole-System Provenance", CCS 2018, doi 10.1145/3243734.3243776 (Crossref).
- Greshake et al., indirect prompt injection, AISec 2023, doi 10.1145/3605764.3623985 (Crossref).
- Costa et al., FIDES "Securing AI Agents with Information-Flow Control", arXiv 2505.23643; Debenedetti et al., CaMeL "Defeating Prompt Injections by Design", arXiv 2503.18813 (arXiv API).
- AgentSight, PACMI 2025, doi 10.1145/3766882.3767169 (Crossref).
- LWN "KRSI — the other BPF security module", https://lwn.net/Articles/808048/ (title fetched).
- Kernel docs: https://docs.kernel.org/bpf/prog_lsm.html
