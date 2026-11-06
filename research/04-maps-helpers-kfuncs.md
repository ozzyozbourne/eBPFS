# Research notes — Chapter 04: Maps, helpers, kfuncs

Date: 2026-11-05. Author: chapter-04 subagent.

## Sources studied

- Linux kernel, `master` on GitHub, HEAD `d68ce4e71248e1ff5af9654b407541d9260b3ba5`
  (from `git ls-remote https://github.com/torvalds/linux HEAD`). Files fetched individually from
  `raw.githubusercontent.com/torvalds/linux/master/...` (no clone, per AUTHORING.md) into
  `/home/user/workspace/src/linux04/`:
  - `Documentation/bpf/{maps,map_hash,map_array,map_lpm_trie,map_of_maps,map_cgrp_storage,map_sk_storage,ringbuf,kfuncs,bpf_design_QA}.rst`
  - `include/uapi/linux/bpf.h` (enum bpf_map_type, helper docs), `include/linux/btf.h` (KF_* flags),
    `include/linux/bpf.h`, `include/linux/bpf_verifier.h`, `include/linux/filter.h`
  - `kernel/bpf/ringbuf.c`, `kernel/bpf/helpers.c`, `kernel/bpf/verifier.c`
  - `tools/lib/bpf/{bpf_helpers.h,libbpf.h,bpf.h}`
  - selftests: `progs/test_ringbuf.c`, `prog_tests/ringbuf.c`, `progs/test_spin_lock.c`,
    `prog_tests/spin_lock.c`, `progs/timer.c`, `progs/task_kfunc_common.h`,
    `progs/task_kfunc_success.c`, `progs/task_local_storage.c`, `progs/test_map_in_map.c`,
    `progs/test_pinning.c`, `progs/test_global_data.c`, `progs/tailcall1.c`, `progs/arena_list.c`
- bcc `docs/kernel-versions.md` (master) for feature→version→commit table.
- Andrii Nakryiko, "BPF ring buffer", 2020-10-26, https://nakryiko.com/posts/bpf-ringbuf/
- LWN: 856005 (kfuncs, 5.13), 849512 (kfunc patch set), 820559/821456 (ringbuf patch v1/v3),
  779120 (Concurrency management in BPF / spin locks), 777199 (bpf_spin_lock patch),
  961594 (BPF arena v2 patch), 1019885 (arenas in sched_ext, LSFMM+BPF 2025),
  977013 (Modernizing BPF for the next 10 years), 808503 (mmapable maps), 806328 (skeletons),
  914833 (allocated objects, global spin locks), 1076648 (BPF_MAP_TYPE_RHASH patch v7, Jun 2026).
- GitHub API commit lookups (dates) for: d8eca5bbb2be (global data, 2019-04-09 → 5.2),
  e6ac2450d6de (kfunc calls, 2021-03-25 → 5.13), 317460317a02 (bpf_arena, 2024-03-08 → 6.9),
  4cf1bc1f1045 (task storage, 2020-11 → 5.11), b00628b1c7d5 (bpf timers, 2021-07 → 5.15),
  d83525ca62cf (bpf_spin_lock, 2019-01 → 5.1).

## Verified facts (with source)

### Map types and versions (bcc kernel-versions.md + Documentation/bpf/map_*.rst)
| Map | Version |
|---|---|
| HASH, ARRAY | 3.19 |
| PROG_ARRAY | 4.2 (tail calls same commit 04fd61ab36ec) |
| PERF_EVENT_ARRAY | 4.3 |
| PERCPU_HASH, PERCPU_ARRAY, STACK_TRACE | 4.6 |
| CGROUP_ARRAY | 4.8 |
| LRU_HASH, LRU_PERCPU_HASH | 4.10 |
| LPM_TRIE | 4.11 (BPF_F_NO_PREALLOC mandatory; prefix len multiple of 8, 8..2048) |
| ARRAY_OF_MAPS, HASH_OF_MAPS | 4.12 (one nesting level; inner may not be PROG_ARRAY; prog can only lookup outer) |
| CGROUP_STORAGE | 4.19 (now `_DEPRECATED` alias in uapi, replaced by CGRP_STORAGE) |
| QUEUE, STACK | 4.20 |
| SK_STORAGE | 5.2 |
| STRUCT_OPS | 5.6 |
| RINGBUF | 5.8 (commit 457f44363a88) |
| INODE_STORAGE | 5.10 |
| TASK_STORAGE | 5.11 |
| BLOOM_FILTER | 5.16 |
| USER_RINGBUF | 6.1 |
| CGRP_STORAGE | 6.2 (bpf_cgrp_storage_get helper 6.2) |
| ARENA | 6.9 (LWN 1019885 states 6.9; commit date 2024-03-08) |
| INSN_ARRAY, RHASH | present in current uapi enum; exact release NOT verified |

- Current `enum bpf_map_type` ends `... BPF_MAP_TYPE_ARENA, BPF_MAP_TYPE_INSN_ARRAY, BPF_MAP_TYPE_RHASH`.
- Hash: preallocated by default; `BPF_F_NO_PREALLOC`. LRU: common LRU list by default,
  `BPF_F_NO_COMMON_LRU` for per-CPU LRU lists (map_hash.rst table).
- `bpf_map_lookup_percpu_elem()` helper: 5.19.
- mmap of array maps (`BPF_F_MMAPABLE`): 5.5. bpf FS pinning: 4.4 (b2197755b263).
- Userspace `bpf_map_get_next_key` returns first key if cur_key was deleted → use batch ops (map_hash.rst).
- `BPF_MAP_LOOKUP_ELEM` syscall does not copy bpf_spin_lock field (uapi doc).

### Ring buffer (Documentation/bpf/ringbuf.rst, kernel/bpf/ringbuf.c, Nakryiko blog)
- MPSC, shared across CPUs; motivations: memory efficiency and ordering across CPUs.
- key/value size zero; `max_entries` = byte size, power of 2 (and multiple of page size per blog).
- APIs: `bpf_ringbuf_output()` (copy), `bpf_ringbuf_reserve()/submit()/discard()`, `bpf_ringbuf_query()`
  (BPF_RB_AVAIL_DATA, RING_SIZE, CONS_POS, PROD_POS; current uapi also BPF_RB_OVERWRITE_POS).
- reserve size must be known constant to verifier; reserved records tracked by reference tracking —
  forgetting submit/discard fails verification.
- 8-byte record header: length + busy bit + discard bit + page offset to ring.
- Producer counter advanced under spinlock (now `rqspinlock_t`), commits lockless; records visible in
  reservation order once all earlier committed. NMI: reserve can fail if lock not acquired.
- Data pages mapped twice back-to-back (comment in `bpf_ringbuf_area_alloc()`).
- Adaptive wakeup; `BPF_RB_NO_WAKEUP` / `BPF_RB_FORCE_WAKEUP`.
- Consumer pos page is writable from user space; producer pos + data r/o (ringbuf.c comments, mmap code).
- New: `BPF_F_RB_OVERWRITE` (1U<<19) overwrite mode; patch posted 2025-08 by Xu Kuohai. Release version NOT verified.
- libbpf: `ring_buffer__new(fd, cb, ctx, opts)`, `ring_buffer__poll`, `__consume`, `__consume_n`,
  `ring_buffer__add`; callback `int (*)(void *ctx, void *data, size_t size)`.
- perf buffer: `perf_buffer__new(map_fd, page_cnt, sample_cb, lost_cb, ctx, opts)`; per-CPU, page_cnt per CPU.
- Perfbuf has lost-sample callback; ringbuf does not (blog).

### Helpers
- Stable ABI: bpf_design_QA.rst "Q: Does BPF have a stable ABI? A: YES ... set of helper functions and their
  arguments ... part of ABI"; "New BPF functionality is generally added through the use of kfuncs instead of new helpers."
- `bpf_get_current_pid_tgid` (4.2): returns `(u64) task->tgid << 32 | task->pid` (kernel/bpf/helpers.c, BPF_CALL_0).
- `bpf_probe_read_kernel` / `_str` (5.5, GPL).
- `bpf_get_current_task_btf` 5.11. `bpf_kptr_xchg` 5.19. `bpf_loop` 5.17. `bpf_for_each_map_elem` 5.13.
- LWN 977013: at the time of Starovoitov's talk (LSFMM+BPF 2024) 211 helpers and 164 kfuncs.

### kfuncs (Documentation/bpf/kfuncs.rst, include/linux/btf.h, kernel/bpf/helpers.c)
- Introduced 5.13 (LWN 856005; commit e6ac2450d6de), driven by BPF TCP congestion control.
- No stable interface; lifecycle "similar to EXPORT_SYMBOL_GPL"; KF_DEPRECATED flag.
- Declared in BPF C as `extern ... __ksym;` (`__ksym` = `section(".ksyms")`); `bpf_ksym_exists()` for weak ones.
- Kernel side: `__bpf_kfunc`, `__bpf_kfunc_start_defs()/end_defs()`, `BTF_KFUNCS_START/END`, `BTF_ID_FLAGS`,
  `register_btf_kfunc_id_set(prog_type, &set)`; resolve_btfids emits BTF decl tags at build time.
- Current doc: "All kfuncs now require trusted arguments by default" (KF_TRUSTED_ARGS no longer exists in btf.h;
  bits 3,4 unused). KF_RCU opts out to accept RCU pointers.
- Flags in btf.h now: KF_ACQUIRE, KF_RELEASE, KF_RET_NULL, KF_SLEEPABLE, KF_DESTRUCTIVE, KF_RCU, KF_ITER_NEW/NEXT/DESTROY,
  KF_RCU_PROTECTED, KF_FASTCALL, KF_ARENA_RET/ARG1/ARG2, KF_IMPLICIT_ARGS, KF_SPINLOCK_SAFE, KF_PERFMON, KF_ITER_RET_INDEPENDENT.
- `bpf_task_acquire`: `KF_ACQUIRE | KF_RCU | KF_RET_NULL`; `bpf_task_release`: `KF_RELEASE`; implementation uses
  `refcount_inc_not_zero(&p->rcu_users)` / `put_task_struct_rcu_user`.
- Arg annotations: `__sz`, `__k`, `__uninit`, `__nullable`, `__str`, `__map`, `__const_map`, `__arena`, ...

### BPF-to-BPF calls, tail calls
- bpf2bpf calls 4.16 (cc8b0b92a169). Mixing with tail calls: x86-64 5.10, arm64 6.0, s390 6.3, loongarch 6.4.
- `MAX_TAIL_CALL_CNT 33` (include/linux/bpf.h; uapi doc says "currently set to 33").
- `MAX_CALL_FRAMES 16` in current include/linux/bpf_verifier.h (was 8 historically — older docs say 8; not
  verified when it changed).
- Verifier: with tail calls in subprogs, "tail_calls are not allowed when call stack of previous frames is %d bytes.
  Too large" when depth >= 256 (verifier.c).
- Stack: `MAX_BPF_STACK 512`, `MAX_BPF_STACK_JIT 2048`; bpf_design_QA: up to 2 KiB combined when JIT supports
  large stacks (x86-64, arm64), else 512 bytes. (New; release not verified.)
- `bpf_tail_call_static()` in libbpf bpf_helpers.h; `tailcall1.c` uses it.

### Global variables
- 5.2 (d8eca5bbb2be "lookup-free direct value access for maps", April 2019).
- libbpf maps `.data`, `.bss`, `.rodata` to single-element ARRAY maps named `<obj>.data` etc.; `.rodata` frozen,
  BPF_F_RDONLY_PROG. Verified live on 6.1: `execsnoo.rodata flags 0x480 ... frozen`, `execsnoo.bss flags 0x400`.
- skeleton exposes `skel->rodata`, `skel->bss` (mmap'd). Skeleton patch LWN 806328 (Dec 2019).
- Custom sections `.data.A` etc. allowed (test_spin_lock.c `lockA __hidden SEC(".data.A")`).

### Spin locks and timers
- bpf_spin_lock 5.1; uapi doc restrictions (one lock at a time, one per element, must unlock on all paths,
  not in inner maps, BTF required, no LD_ABS). Global spin locks via allocated-objects series (LWN 914833, 6.2 era).
- Current selftests show static subprog calls allowed under lock (`lock_static_subprog_call`) and global calls
  rejected: "global function calls are not allowed while holding a lock" (prog_tests/spin_lock.c).
- BPF_F_LOCK (5.1) for syscall lookup/update under lock.
- bpf_timer 5.15: `bpf_timer_init(timer, map, flags)` (clockid in low 4 bits; MONOTONIC/REALTIME/BOOTTIME),
  `bpf_timer_set_callback`, `bpf_timer_start`, `bpf_timer_cancel`; -EPERM if map has no user refs (pin or hold fd).

### Arena
- 6.9; sparse shared memory region between BPF program and user space; up to 4 GB; pages allocated lazily or via
  `bpf_arena_alloc_pages` kfunc (sleepable). `map_extra` = mmap start address; `BPF_F_MMAPABLE`; max_entries = pages.
  `__arena` address-space tags.

## Experiments run in the orb (kernel 6.1.189, Debian 12, clang 14, libbpf 1.1.2, bpftool 7.1.0)
Scratch dir: `/home/user/workspace/src/ringbuf-demo/` (outside repo).
- Wrote `execsnoop.h`, `execsnoop.bpf.c`, `execsnoop.c` (ringbuf + .rodata + .bss + skeleton). Built with:
  `bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h`,
  `clang -g -O2 -target bpf -D__TARGET_ARCH_x86 -c execsnoop.bpf.c -o execsnoop.bpf.o`,
  `bpftool gen skeleton execsnoop.bpf.o > execsnoop.skel.h`,
  `cc -g -O2 -Wall execsnoop.c -lbpf -lelf -lz -o execsnoop`. Ran with sudo; printed exec events; `dropped: 0`.
- `bpftool map show` output captured (ringbuf `key 0B value 0B max_entries 262144`).
- `bpftool map pin id <id> /sys/fs/bpf/execsnoop_bss` + `bpftool map dump pinned` worked; removed pin afterwards.
- Variant that skips `bpf_ringbuf_submit` on one path: verifier rejects with `Unreleased reference id=3 alloc_insn=28`.

## Unverified / left out
- Exact release for BPF_MAP_TYPE_INSN_ARRAY, BPF_MAP_TYPE_RHASH, BPF_F_RB_OVERWRITE, the 16-frame limit and the 2 KiB
  JIT stack: marked "recent mainline" in the chapter, no version claimed.
- No benchmark numbers quoted.
