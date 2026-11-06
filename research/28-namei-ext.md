# Research notes — Chapter 28: namei_ext

Studied 2026-11-06.

## Sources

- Repo: https://github.com/eunomia-bpf/namei_ext — clone at
  `/home/user/workspace/src/namei_ext`, HEAD `3f67fcbd663a9180e2b4ccc00304fd36a1401ed8`
  (2026-10-11, "docs: archive and summarize untracked raw results before deletion").
  Created 2026-06-13; GitHub size ~120 MB (119957 KB); ~219 commits (pagination count);
  no license field on GitHub; 0 stars. Description: "BPF-extensible VFS namespace policy
  research prototype".
- Kernel fork (NOT cloned): https://github.com/eunomia-bpf/kernel_nameiext, fork of
  torvalds/linux. Submodule pinned at `b07117a3cb41826a34af5ca61e3e2c81dade793f`
  ("namei_ext: expose stat-compatible parent device", 2026-08-01).
  Base (last upstream merge) `062871f1371b` "Merge tag 'pinctrl-v7.1-3'" (2026-06-13), i.e.
  Linux 7.1-rc7 era. Implementation doc mentions kernel `7.1.0-rc7-g621aff8d1bb5`.
  Compare used: https://github.com/eunomia-bpf/kernel_nameiext/compare/062871f1371b...b07117a3cb41
  (12 commits, 20 files).

## Kernel diff (from compare API)

Files: fs/Kconfig (+10, CONFIG_NAMEI_EXT depends on BPF_SYSCALL && CGROUP_BPF, default n),
fs/Makefile, fs/namei.c (+230 −13), fs/namei_ext.c (new, +909), fs/readdir.c (+7 −1),
include/linux/bpf-cgroup{,-defs}.h, include/linux/bpf_types.h, include/linux/namei_ext.h (new, 117),
include/uapi/linux/bpf.h (+32), kernel/bpf/btf.c, kernel/bpf/cgroup.c (+196),
kernel/bpf/syscall.c (+20 −1), kernel/bpf/verifier.c (+4), bpftool cgroup.c/common.c,
tools/include uapi, libbpf bpf.c/libbpf.c/libbpf_probes.c.

- NOT struct_ops, NOT kfuncs. New program type `BPF_PROG_TYPE_NAMEI_EXT`, new attach type
  `BPF_CGROUP_NAMEI_EXT`, libbpf section `SEC("cgroup/namei_ext")` (SEC_ATTACHABLE).
  Attached with `bpf_prog_attach(prog_fd, cgroup_fd, BPF_CGROUP_NAMEI_EXT, 0)`.
  attach_flags / relative_fd / expected_revision must be 0. `link_create` returns -EOPNOTSUPP
  (no bpf_link). Listed in `is_net_admin_prog_type` (load needs CAP_NET_ADMIN-class privilege).
- Verifier: return range [PASS=0, SELECT_TARGET=3]. Context access: read all fields; `name[]`
  and `redirect_name[]` byte reads only; writes only to `redirect_name_len`, `target_id`,
  `redirect_name[]`. Helpers: cgroup_common_func_proto + perf_event_output + base protos.
- UAPI ctx: `struct bpf_namei_ext_ctx {event, flags, name_len, name_hash, cgroup_id, name[64],
  redirect_name_len, target_id, redirect_name[64], parent_dev, parent_ino, parent_generation,
  parent_flags}`. Events LOOKUP=0, READDIR=1. Actions PASS=0, REDIRECT=1, HIDE=2, SELECT_TARGET=3.
- Hook points in fs/namei.c: `walk_component()` split into `walk_component_common()` +
  noinline `walk_component_namei_ext()`; gate `namei_ext_enabled() &&
  namei_ext_parent_maybe_managed(&nd->path)` (after `.`/`..` handling). Same for
  `open_last_lookups()` → `open_last_lookups_namei_ext()` (final component of open).
  fs/readdir.c `iterate_dir()` wraps `iterate_shared` with `namei_ext_iterate_dir()` that
  interposes a `dir_context` actor (`namei_ext_filldir`) calling the BPF prog per entry.
- `namei_ext_enabled()` = `cgroup_bpf_enabled(CGROUP_NAMEI_EXT)` (static key).
  `namei_ext_parent_maybe_managed()` = seqcount + RCU hash of exact managed parents
  (`path_equal`), or global scope users.
- Dispatch: `__cgroup_bpf_run_namei_ext()` uses `task_dfl_cgroup(current)`, checks
  `cgrp->bpf.namei_ext_owner` (nearest ancestor with progs, set in activate_effective_progs)
  and `namei_ext_policy_parent_matches(owner, parent)`; runs effective prog array; first
  non-PASS wins; value > 3 → -EINVAL.
- `namei_ext_lookup()` action handling: PASS→0; REDIRECT → reject LOOKUP_CREATE
  (-EOPNOTSUPP), validate name (non-empty, ≤64, not "."/"..", no '/' or NUL) else -EINVAL,
  then rehash and continue normal lookup with substituted `nd->last` in the SAME parent;
  HIDE → -ENOENT; SELECT_TARGET → reject LOOKUP_CREATE, mark target pending.
- `namei_ext_apply_target()`: -EXDEV if LOOKUP_IS_SCOPED (RESOLVE_BENEATH/IN_ROOT) or
  LOOKUP_NO_XDEV and mount differs; -EOPNOTSUPP if not dir/regular; -ENOTDIR for a regular file
  used as intermediate or with LOOKUP_DIRECTORY; sets nd->path = target, ND_JUMPED. In RCU walk
  borrows target (seq from d_seq), else takes ref.
- Target registry: debugfs `/sys/kernel/debug/namei_ext/register_target` (mode 0200):
  write "<target_id> <fd>\n" (fd usually O_PATH) or "clear". Keyed by (writer's cgroup id,
  target id). Rejects symlinks (-ELOOP), non-dir/non-reg (-EOPNOTSUPP). Replacement via
  `hlist_replace_rcu` then `synchronize_rcu()` then `path_put`.
  `/sys/kernel/debug/namei_ext/policy_parent`: "exact <fd>", "add <fd>", "clear", "global"
  (max 8 parents, NAMEI_EXT_MAX_POLICY_PARENTS).
- readdir: PASS → forward entry; REDIRECT → forward entry under redirect name; HIDE → skip;
  SELECT_TARGET → -EOPNOTSUPP.
- Design doc: RCU-to-ref conversion keeps saved action; full -ECHILD restart re-runs policy →
  at-least-once; side effects must be idempotent.

## Repo layout (top level)

kernel/ (submodule), bpf/{include,policies,tracing}, runner/ (libnamei_ext_harness.a, 700-line C),
experiments/ (14 case dirs), tests/{abi,functional,infrastructure,policy_load,policy_semantic},
bench/{fxmark,mdtest,workloads}, mk/ (kvm.mk, kernel.mk, results.mk, experiments/, benchmarks/),
analysis/, configs/, results/, docs/{design,idea-story,implementation,evaluation,
background-related-work}.md, docs/paper (main.tex, sections, namei_ext.pdf), thirdparty/ (wrapfs).
AGENTS.md: Make-only control plane, fail-fast, Phase 1 must run in KVM.

## Policies (bpf/policies, 24 files, 2044 lines total)

pass_only (11 lines), hide_secret (16), redirect_alias (69), select_portal (32),
agent_workspace_source_task (94), application_file_sharing (97), build_action_sandboxing,
spindle_staging, kubernetes_configmap_publication, checkpoint_restore_migration,
toolchain_environment, service_config_rotation, rq3_* fault policies, fxmark_*.
Helper header `namei_ext_policy.h` defines `namei_ext_component_key` (event, name_len,
cgroup_id, parent_dev, parent_ino, name[64]) and `namei_ext_is()` macro.
I compiled all 25 objects locally (`make -C bpf OUTPUT=/tmp/...`, clang) — succeeded;
`llvm-objdump -d hide_secret.bpf.o` shows 20 insns in section `cgroup/namei_ext`.

## Userspace (runner/src/namei_ext_harness.c)

libbpf `bpf_object__open_file` / `__load` / `bpf_prog_attach(..., BPF_CGROUP_NAMEI_EXT, 0)`;
detach via `bpf_prog_detach2`. Registration forks a child, moves it into the cgroup, writes to
debugfs. Map key built from `stat(parent)` st_dev/st_ino.

## Make entrypoints (README)

make phase1, make experiments, make formal-case-studies, make formal-performance,
make experiment-agent-workspace-rq2, make experiment-fxmark-rq2, make kvm-functional, etc.
Kernel: make kernel / kernel-config checks CONFIG_NAMEI_EXT=y etc.

## Evaluation numbers (quoted from docs/paper/sections/05-evaluation.tex and docs/idea-story.md)

- Agent workspace lifecycle RQ2: 20 KVM boots, 10,000 samples per mechanism, 960/960 oracles;
  p50 5.51 µs vs 62.64 µs (FUSE); paired FUSE/namei_ext 11.32x [11.24, 11.64].
- FxMark cache-hot path walk: 50 boots, 450/450; SELECT/FUSE 1.052–1.088x; attached PASS
  retains 0.901–0.934 of unattached; SELECT retains 0.895–0.931; SELECT/PASS 0.981–0.999.
- FxMark readdir: 50 boots, 300/300; SELECT/FUSE 2.20–3.66x in 5 of 6 cells; MRDM/4 1.018
  [0.907, 1.135] → verdict "mixed".
- Unused fast path: 60 boots, 180 observations; unattached/stock 1.0009 [0.9921, 1.0036],
  1.0083 [0.9950, 1.0179], 1.0007 [0.9918, 1.0139] at 1/2/4 workers.
- RQ3 Wrapfs-derived: 37/37 oracles both; Wrapfs port registers 34 unique VFS slots; 13 Wrapfs
  method classes executed; 21/21 fault cells (2 verifier + 19 runtime) per boot, 3 boots.
- Source task: Click pallets__click-2622 39/40 (base) vs 40/40 (completed).
- ccache historical: FUSE/namei_ext 2.18x (paper) / "about 2.1x" (idea-story); native/namei_ext 0.945x.
- Discrepancy: abstract says "Six of the seven ... pass", eval section says all seven formal RQ1
  workflows complete; research/STATE.md (2026-08-02) says W6 incomplete; commit 945b68c9f8
  (2026-08-02) "complete seven-workload rq1 evaluation".

## Recent commits (gh api, main)

2026-10-11 archive raw results; 2026-09-06 RQ2 official-portal latency re-entry plan;
2026-08-08 burst: ConfigMap quantitative comparison, batched target registration, Spindle
RQ2 FUSE comparison with many recorded preflight failures; 2026-08-02 seven-workload RQ1,
checkpoint result. Kernel fork commits 2026-06-13 → 2026-08-01 (12 commits, listed in chapter).

## Background references verified (HTTP 200 + title)

- https://docs.kernel.org/filesystems/path-lookup.html
- https://docs.kernel.org/filesystems/vfs.html
- https://man7.org/linux/man-pages/man2/openat2.2.html
- https://man7.org/linux/man-pages/man7/mount_namespaces.7.html
- https://docs.kernel.org/userspace-api/landlock.html
- https://docs.kernel.org/bpf/prog_lsm.html
- https://docs.kernel.org/scheduler/sched-ext.html
- https://docs.kernel.org/filesystems/overlayfs.html
- https://docs.kernel.org/filesystems/fuse/index.html
- LWN 649115 Pathname lookup in Linux; 649729 RCU-walk: faster pathname lookup in Linux;
  650786 A walk among the symlinks; 796868 Restricting path name lookup with openat2();
  859908 Landlock (finally) sets sail; 937433 The FUSE BPF filesystem (2023).
- USENIX: ExtFUSE ATC'19 (bijlani); To FUSE or Not to FUSE FAST'17 (vangoor);
  Bento FAST'21 (miller); FxMark ATC'16 (min).

## Cannot run here

Needs the modified kernel booted in KVM (CONFIG_NAMEI_EXT). The orb runs a gVisor-ish/stock
kernel; no BPF_PROG_TYPE_NAMEI_EXT. Only BPF object compile was verified.

## Chapter written

- `chapters/28-namei-ext.html`: 3 SVG figures, 16 data-file code blocks (all lines checked
  against repo files / compare-API patch text by script), stepper (9 steps), tabs, 6-question
  quiz, 21 references, plus a small illustrative JS simulator (labelled as not repo code;
  tested with node and a DOM stub).
- rq3_invalid_action.bpf.c returns SELECT_TARGET+1; rq3_invalid_ctx_write.bpf.c writes ctx->event
  (both verifier-rejection cases).
- Upstream submission of namei_ext: not searched/none linked in repo — chapter says "repository
  links no upstream submission".
