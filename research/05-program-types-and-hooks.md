# Research notes — 05 Program types and hooks

Survey date: 2026-11-05.

## Sources studied (commits)

| Source | Revision |
|---|---|
| https://github.com/libbpf/libbpf-bootstrap | `820a1bd8b4f4cb4b78b442ae4eb3994738651f12` (cloned to `/home/user/workspace/src/libbpf-bootstrap`) |
| https://github.com/eunomia-bpf/bpf-developer-tutorial | `110b91f87320a952c4c55dba1d6e8e3f814a789c` (cloned to `/home/user/workspace/src/bpf-developer-tutorial`) |
| Linux kernel (read on GitHub, not cloned) | master `d68ce4e71248e1ff5af9654b407541d9260b3ba5`; tags v4.2 … v7.0 for version checks |
| docs.kernel.org | rendered as "7.3.0" on the fetch date |

## Files quoted in the chapter

libbpf-bootstrap `examples/c/`: `minimal.bpf.c` (tp/syscalls/sys_enter_write), `kprobe.bpf.c`
(kprobe + kretprobe on do_unlinkat, BPF_CORE_READ), `fentry.bpf.c` (fentry/fexit on do_unlinkat,
direct deref `name->name`), `uprobe.bpf.c` (generic `SEC("uprobe")` plus auto-attach
`uprobe//proc/self/exe:uprobed_sub`), `uprobe.c` (`bpf_program__attach_uprobe_opts` with
`func_name`, pid 0 = self, -1 = all processes), `usdt.bpf.c` (`usdt/libc.so.6:libc:setjmp`),
`lsm.bpf.c` (`lsm/bpf` returning -EPERM), `profile.bpf.c` (`perf_event` + bpf_get_stack),
`task_iter.bpf.c` / `task_iter.c` (`iter/task`, `bpf_iter_create` + `read()`).

bpf-developer-tutorial `src/`: `5-uprobe-bashreadline/bashreadline.bpf.c`
(`uretprobe//bin/bash:readline`), `19-lsm-connect/lsm-connect.bpf.c` (`lsm/socket_connect`,
blocks 1.1.1.1), `cgroup/cgroup_guard.bpf.c` (cgroup/connect4, cgroup/dev, cgroup/sysctl —
return 1 allow / 0 deny), `44-scx-simple/scx_simple.bpf.c` (vtime/FIFO scheduler; uses the
older `scx_bpf_dispatch*`/`scx_bpf_consume` kfunc names), `49-hid/hid-input-modifier.bpf.c`
(`struct_ops/hid_device_event`, `SEC(".struct_ops.link") struct hid_bpf_ops`),
`9-runqlat/runqlat.bpf.c` (raw_tp/sched_*), `32-wallclock-profiler/offcputime.bpf.c`
(tp_btf/sched_switch with raw_tp fallback), `52-fsession-latency/fsession_latency.bpf.c`
(`fsession/vfs_read`, `bpf_session_cookie`, `bpf_session_is_return`).
Other tutorial dirs with hooks: 29-sockops (sockops), 51-tcp-quarantine (iter/tcp),
53-egress-pacer (struct_ops Qdisc), 54-exec-image-inspector (lsm/bprm_committed_creds),
features/struct_ops (custom struct_ops via test module), features/bpf_iters.

Linux selftests (at master d68ce4e7): `tools/testing/selftests/bpf/progs/bpf_dctcp.c`
(tcp_congestion_ops in BPF, `SEC("struct_ops")` + `SEC(".struct_ops")`),
`progs/modify_return.c` (fmod_ret on `bpf_modify_return_test`).

## Kernel versions verified

Method: bcc `docs/kernel-versions.md` plus grepping tagged `include/uapi/linux/bpf.h`,
syscall tables and source files on raw.githubusercontent.com.

| Feature | Version | How verified |
|---|---|---|
| BPF on kprobes (`BPF_PROG_TYPE_KPROBE`) | 4.1 | bcc table, commit 2541517c32be |
| BPF on uprobes | 4.3 | `trace_call_bpf` appears in `kernel/trace/trace_uprobe.c` at v4.3, absent at v4.2 |
| Tracepoint programs | 4.7 | bcc, 98b5c2c65c29 |
| perf_event programs | 4.9 | bcc, 0515e5999a46 |
| cgroup_skb, cgroup_sock | 4.10 | bcc |
| sock_ops | 4.13 | bcc |
| cgroup device | 4.15 | bcc |
| raw tracepoint; cgroup sock_addr (bind/connect) | 4.17 | bcc |
| cgroup sysctl; writable raw tp | 5.2 | bcc |
| cgroup sockopt | 5.3 | bcc |
| `BPF_PROG_TYPE_TRACING`, `BPF_TRACE_FENTRY`, `BPF_TRACE_RAW_TP` (tp_btf), BPF trampoline | 5.5 | bpf.h v5.4 lacks, v5.5 has; bcc f1b9509c2fb0 |
| struct_ops; freplace (EXT) | 5.6 | bpf.h v5.6; bcc |
| `BPF_MODIFY_RETURN` (fmod_ret), `BPF_PROG_TYPE_LSM` | 5.7 | bpf.h v5.7 |
| bpf_iter (`BPF_TRACE_ITER`) | 5.8 | bpf.h v5.8 |
| Sleepable programs | 5.10 | bcc |
| `BPF_PROG_TYPE_SYSCALL` | 5.15 | bcc |
| `BPF_TRACE_KPROBE_MULTI` (fprobe) | 5.18 | bpf.h v5.17 lacks, v5.18 has; kernelnewbies 5.18 |
| `BPF_LSM_CGROUP` | 6.0 | bpf.h v5.19 lacks, v6.0 has |
| HID-BPF first merged | 6.3 | kernelnewbies 6.3, Phoronix |
| `BPF_PROG_TYPE_NETFILTER` | 6.4 or earlier (present in v6.5) | only v6.5 checked — not used in chapter |
| `BPF_TRACE_UPROBE_MULTI` | 6.6 | bpf.h v6.5 lacks, v6.6 has |
| `BPF_TRACE_KPROBE_SESSION` | 6.10 | bpf.h v6.10; kernelnewbies 6.10 |
| HID-BPF converted to struct_ops (`struct_ops/hid_device_event`) | 6.11 | docs.kernel.org/6.10 shows `fmod_ret/hid_bpf_device_event`, /6.11 shows struct_ops |
| `uretprobe` syscall (x86-64) | 6.11 | syscall_64.tbl v6.11 entry 335; man uretprobe(2) "HISTORY Linux 6.11"; kernelnewbies says "10-30% faster" |
| sched_ext | 6.12 | `kernel/sched/ext.c` 404 at v6.11, 200 at v6.12; LWN 6.12-rc1 announcement |
| `scx_bpf_dsq_insert` (rename of `scx_bpf_dispatch`) | 6.13 | v6.12 ext.c has only scx_bpf_dispatch; v6.13 has both |
| `BPF_TRACE_UPROBE_SESSION` | 6.13 | bpf.h v6.13 |
| `uprobe` syscall + `[uprobes-trampoline]` (nop5 optimisation, x86-64) | 6.18 | syscall_64.tbl v6.18 entry 336, absent at v6.17; tip commit 56101b69c919 (Aug 2025) |
| `BPF_TRACE_FSESSION` (fsession) | 7.0 | bpf.h v6.19 lacks, v7.0 has; Leon Hwang blog; tutorial 52 README |

## Uprobe mechanics (from kernel/events/uprobes.c and arch/x86/kernel/uprobes.c at d68ce4e7)

- `UPROBE_SWBP_INSN` = `0xcc` (int3), size 1 (`arch/x86/include/asm/uprobes.h`).
- `uprobe_write_opcode()` writes the breakpoint into the probed page; `install_breakpoint()` is
  called for each mapping (also from mmap of new processes: `uprobe_mmap`). The write is
  copy-on-write into the page of that mapping — the file on disk is not modified.
- Hit path: int3 trap → notifier sets `TIF_UPROBE` → on return to user, `uprobe_notify_resume()`
  → `handle_swbp()` → `find_active_uprobe_rcu()` → `handler_chain()` (runs BPF consumers; for
  return probes `prepare_uretprobe()` hijacks the return address) → single-step the original
  instruction out-of-line in the `"[uprobes]"` XOL area (or emulate it) → second trap/notify →
  resume.
- uretprobe: return address replaced by the uretprobe trampoline; since 6.11 on x86-64 the
  trampoline issues the `uretprobe` syscall instead of trapping.
- 6.18: `SYSCALL_DEFINE0(uprobe)`, mapping name `"[uprobes-trampoline]"`; a probe on a 5-byte
  nop (USDT) is rewritten into a `call` to that trampoline after the first hit
  (`arch_uprobe_optimize`, "Try to optimize after first hit").
- Benchmark from Jiri Olsa's cover letter (LWN 1001746, Dec 2024, his machine): usermode-count
  233.8M/s, syscall-count 12.1M/s, uprobe-nop 3.25M/s, uprobe-nop5 (optimised) 6.75M/s,
  uretprobe-nop 1.74M/s. Quoted with attribution only.
- May 2026 LKML thread proposes moving optimisation from nop5 to nop10 — not merged as far as
  checked; not mentioned in chapter.

## Other facts

- libbpf section names: docs.kernel.org/bpf/libbpf/program_types.html (table copied for
  `kprobe+`, `uprobe.s+`, `usdt+`, `kprobe.multi+`, `kprobe.session+`, `uprobe.multi+`,
  `uprobe.session+`, `lsm+`, `lsm.s+`, `lsm_cgroup+`, `perf_event`, `raw_tp+`, `raw_tp.w+`,
  `tp+`/`tracepoint+`, `fentry+`, `fexit+`, `fmod_ret+`, `fsession+`, `iter+`, `tp_btf+`,
  `struct_ops+`, `cgroup/*`, `cgroup_skb/*`, `sockops`, `syscall`). `struct_ops/<name>` name is
  ignored; maps tagged `SEC(".struct_ops[.link]")`.
- BPF trampoline cover letter (LWN 803803 / 804937, Nov 2019): "Unlike k[ret]probe there is
  practically zero overhead to call a set of BPF programs before or after kernel function";
  depends on `register_ftrace_direct()`.
- struct_ops cover letter (LWN 807973, Dec 2019, Martin KaFai Lau): first user tcp_congestion_ops.
- LWN 974848 (2024): struct_ops slots filled with trampolines; earlier one-page trampoline limit
  (~20 entries on x86).
- sched_ext doc: `CONFIG_SCHED_CLASS_EXT`; SysRq-S restores fair class; watchdog for stalled
  runnable tasks; `/sys/kernel/sched_ext/state`, `/sys/kernel/sched_ext/root/ops`; DSQs:
  `SCX_DSQ_GLOBAL`, `SCX_DSQ_LOCAL`, custom via `scx_bpf_create_dsq`; `SCX_OPS_SWITCH_PARTIAL`;
  ABI explicitly unstable. LWN 1056014 (Jan 2026) on sub-schedulers (patch series).
- LSM BPF doc: `lsm/<hook>` with `ret` from previous program; needs `CONFIG_BPF_LSM` and `bpf`
  in the `lsm=` list (tutorial 19 README shows `/sys/kernel/security/lsm`).
- HID-BPF doc (6.11+): `struct_ops/hid_device_event` for event processing, `SEC("syscall")`
  for userspace-triggered actions; runs in IRQ context for events.
- seccomp: still classic BPF filters (seccomp(2)); no eBPF seccomp program type — chapter says so.
- bpftime: "Extending Applications Safely and Efficiently", OSDI '25, pp. 557–574,
  https://www.usenix.org/conference/osdi25/presentation/zheng-yusheng.

## Not verified / left out

- Exact per-hook nanosecond overheads: none quoted except the Olsa cover-letter numbers.
- The libbpf version that first supported USDT: not stated.
- (Verified) fmod_ret target rule: `check_attach_modify_return()` in `kernel/bpf/verifier.c`
  (line ~22324 at d68ce4e7) accepts functions on the error-injection list or with the
  `security_` prefix (a config-dependent variant also accepts arch syscall-prefixed names).
