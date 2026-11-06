# Research notes — Chapter 06: BTF, CO-RE and libbpf

Date: 2026-11-05. All experiments ran inside the orb (kernel `6.1.189+`, x86_64,
`/sys/kernel/btf/vmlinux` present, 4,854,827 bytes, magic bytes `9f eb` = 0xeB9F LE).

## Sources studied (local clones under /home/user/workspace/src/)

| Repo | Commit | Notes |
|------|--------|-------|
| https://github.com/libbpf/libbpf-bootstrap | `820a1bd8b4f4cb4b78b442ae4eb3994738651f12` (2026-10-22) | submodules not checked out; `vmlinux.h` submodule pinned at libbpf/vmlinux.h `991dd4b8dfd8c9d62ce8999521b24f61d9b7fc52` |
| https://github.com/libbpf/libbpf | `872299d94e27d2fa9f119667c7e52268698dc760` (2026-11-02) | `LIBBPF_MAJOR_VERSION 1`, `LIBBPF_MINOR_VERSION 9` |
| https://github.com/libbpf/bpftool | `1f6bbb790d755f78acd076f3d3462f63b988f75c` | built `make -C src bootstrap` → `bpftool v7.9.0, using libbpf v1.9, features: crypto, skeletons, bootstrap` (bootstrap build: only btf/gen subcommands useful) |

Toolchain in orb: Debian clang 14.0.6; installed `libelf-dev` and `strace` via apt to build/run.
Built artefacts in /tmp/bt06 (scratch, outside repo).

## libbpf-bootstrap facts (examples/c)

- `Makefile`: `VMLINUX := ../../vmlinux.h/include/$(ARCH)/vmlinux.h`;
  BPF rule: `$(CLANG) -g -O2 -target bpf -D__TARGET_ARCH_$(ARCH) $(INCLUDES) $(CLANG_BPF_SYS_INCLUDES) -c ... -o %.tmp.bpf.o`
  then `$(BPFTOOL) gen object $@ %.tmp.bpf.o`; skeleton rule `$(BPFTOOL) gen skeleton $< > $@`;
  binary link `$(CC) $(CFLAGS) $^ $(ALL_LDFLAGS) -lelf -lz -o $@`; libbpf built static
  (`BUILD_STATIC_ONLY=1`); bpftool built with `bootstrap` target.
  `CLANG_BPF_SYS_INCLUDES` adds clang's default include dirs with `-idirafter` (needed: building
  minimal.bpf.c without it failed with `'asm/types.h' file not found` — reproduced).
- APPS list: minimal minimal_legacy minimal_ns bootstrap bootstrap_legacy uprobe kprobe fentry usdt
  sockfilter tc ksyscall task_iter lsm (+ profile if cargo found).
- `minimal.bpf.c`: `int my_pid = 0;`, `SEC("tp/syscalls/sys_enter_write")`, includes `<linux/bpf.h>`
  (not vmlinux.h). `minimal.c`: `minimal_bpf__open()`, `skel->bss->my_pid = getpid();`, `__load`, `__attach`, `__destroy`.
- `minimal_legacy.bpf.c`: `#define BPF_NO_GLOBAL_DATA`, uses 1-entry ARRAY map "instead of a global variable which does not work with older kernels".
- `bootstrap.bpf.c`: `#include "vmlinux.h"`, HASH map `exec_start`, RINGBUF `rb` 256 KiB,
  `const volatile unsigned long long min_duration_ns = 0;`, `BPF_CORE_READ(task, real_parent, tgid)`,
  `BPF_CORE_READ(task, exit_code)`. `bootstrap.c` sets `skel->rodata->min_duration_ns` before load, uses `ring_buffer__new(bpf_map__fd(skel->maps.rb), ...)`.
- README: deps `apt install clang libelf1 libelf-dev zlib1g-dev`; clang ≥ v11; `git clone --recurse-submodules`;
  `git submodule update --init --recursive; cd examples/c; make; sudo ./bootstrap`.
- `tools/gen_vmlinux_h.sh`: `$(dirname "$0")/bpftool btf dump file ${1:-/sys/kernel/btf/vmlinux} format c`.
- libbpf/vmlinux.h at pinned commit: `include/x86/vmlinux.h` → symlink to `vmlinux_6.18.h` (54,980 lines).

## libbpf source facts

- `src/btf.c` `btf__load_vmlinux_btf()` (line ~6170): tries `/sys/kernel/btf/vmlinux` (raw mmap, then parse),
  warns `kernel BTF is missing at '%s', was CONFIG_DEBUG_INFO_BTF enabled?`, then fallbacks
  `/boot/vmlinux-%1$s`, `/lib/modules/%1$s/vmlinux-%1$s`, `/lib/modules/%1$s/build/vmlinux`,
  `/usr/lib/modules/%1$s/kernel/vmlinux`, `/usr/lib/debug/boot/vmlinux-%1$s`, `...-%1$s.debug`,
  `/usr/lib/debug/lib/modules/%1$s/vmlinux` (`%1$s` = uname release).
- `src/libbpf.c` `bpf_object_prepare()` order: check_gen_loader → prepare_token → probe_loading →
  load_vmlinux_btf → resolve_externs → sanitize_maps → init_kern_struct_ops_maps →
  adjust_struct_ops_autoload → relocate(obj, btf_custom_path ?: target_btf_path) →
  sanitize_and_load_btf → create_maps → prepare_progs.
- `bpf_object__relocate_core()` (line ~6249): iterates `.BTF.ext` core_relo_info per section,
  skips progs with load_strategy DISABLED, `bpf_core_resolve_relo()` then `bpf_core_patch_insn()`.
  If `targ_btf_path` set: `obj->btf_vmlinux_override = btf__parse(targ_btf_path, NULL)`.
- `bpf_object_open_opts.btf_custom_path` comment: "This custom BTF completely replaces the use of vmlinux
  BTF for the purpose of CO-RE relocations. NOTE: any other BPF feature (e.g., fentry/fexit programs,
  struct_ops, etc) will need actual kernel BTF at /sys/kernel/btf/vmlinux."
- `src/relo_core.c`: candidate = same "essential" name ignoring everything after last `___`
  (flavors); bpftool's BTF-to-C emits `___2`, `___3` for duplicate names. Poisoning:
  `insn.code = BPF_JMP|BPF_CALL; imm = 195896080 /* => 0xbad2310 => "bad relo" */`, verifier says
  `invalid func unknown#195896080` if reachable.
- `include/uapi/linux/bpf.h` `enum bpf_core_relo_kind`: 0 FIELD_BYTE_OFFSET, 1 FIELD_BYTE_SIZE,
  2 FIELD_EXISTS, 3 FIELD_SIGNED, 4 FIELD_LSHIFT_U64, 5 FIELD_RSHIFT_U64, 6 TYPE_ID_LOCAL,
  7 TYPE_ID_TARGET, 8 TYPE_EXISTS, 9 TYPE_SIZE, 10 ENUMVAL_EXISTS, 11 ENUMVAL_VALUE, 12 TYPE_MATCHES.
  `struct bpf_core_relo` comment: insn_off, type_id, access_str_off ("0:1:0:5" style), kind.
- `src/bpf_core_read.h`: `bpf_core_read()` = `bpf_probe_read_kernel(dst, sz, __builtin_preserve_access_index(src))`;
  `bpf_core_field_exists` → `__builtin_preserve_field_info(..., BPF_FIELD_EXISTS)`;
  `bpf_core_type_exists` → `__builtin_preserve_type_info(..., BPF_TYPE_EXISTS)`;
  `bpf_core_enum_value[_exists]` → `__builtin_preserve_enum_value`; `BPF_CORE_READ` up to 9 accessors.
- `src/bpf_helpers.h`: `enum libbpf_pin_type { LIBBPF_PIN_NONE, LIBBPF_PIN_BY_NAME }` ("in /sys/fs/bpf by default"),
  `#define __kconfig __attribute__((section(".kconfig")))`.
- `src/libbpf.h`: `bpf_object__open_file`, `bpf_object__prepare` (new: prepares without loading progs),
  `bpf_object__load`, `bpf_object__close`, `bpf_object__pin_maps`, `bpf_link__pin`, `bpf_link__unpin`,
  `bpf_link__destroy`, `bpf_program__attach`, `bpf_map__set_pin_path`.
- `include/uapi/linux/btf.h` (libbpf copy): `BTF_MAGIC 0xeB9F`; kinds 0..19 as in docs, plus
  20 LOC_PARAM, 21 LOC_PROTO, 22 LOCSEC present in this libbpf header (very new; not in docs.kernel.org page; chapter does not discuss them).
- docs/libbpf_overview.rst: lifecycle phases Open / Load / Attachment / Tear down; skeleton functions
  `__open`, `__load`, `__attach`, `__destroy`; skeleton memory-maps global vars.
- bpftool docs/bpftool-gen.rst: `gen object`, `gen skeleton`, `gen subskeleton`, `gen min_core_btf INPUT OUTPUT OBJECT...`;
  `-L/--use-loader` light skeleton ("does not need libelf"); `-S/--sign` (implies -L, with -k, -i).

## Experiments (real output)

1. `bpftool btf dump file /sys/kernel/btf/vmlinux format raw`: 113,213 type lines; prints
   `skipping /sys/kernel/btf/vmlinux (will be loaded as base)` to stderr.
   `[187] STRUCT 'task_struct' size=7616 vlen=231`, members `'exit_code' type_id=21 bits_offset=10240`,
   `'pid' type_id=66 bits_offset=11072`, `'tgid' type_id=66 bits_offset=11104`,
   `'real_parent' type_id=188 bits_offset=11200`, `'comm' type_id=228 bits_offset=15104`;
   `[1] INT 'long unsigned int' size=8 bits_offset=0 nr_bits=64 encoding=(none)`; `[66] TYPEDEF 'pid_t' type_id=45`.
   `format c` → vmlinux.h with 117,822 lines, begins with
   `#pragma clang attribute push (__attribute__((preserve_access_index)), apply_to = record)` guarded by `BPF_NO_PRESERVE_ACCESS_INDEX`.
2. Built bootstrap.bpf.o against local vmlinux.h: sections `.BTF` (0x6f80), `.BTF.ext` (0x54c), `.rodata`, `.maps`,
   `.reltp/...`. DATASECs: `license`, `.rodata` (min_duration_ns), `.maps` (exec_start, rb).
   Disasm: insn 30 `r1 = 1400`, insn 37 `r1 = 1388` (real_parent, tgid offsets).
3. `sudo ./bootstrap -v` loaded on 6.1: `found 3 CO-RE relocations`, `relo #0: <byte_off> [34] struct task_struct.real_parent (0:82 @ offset 1400)` ... `patched insn #30 (ALU/ALU64) imm 1400 -> 1400`.
4. Rebuilt bootstrap.bpf.o against libbpf-bootstrap's pinned vmlinux_6.18.h, ran on 6.1:
   `relo #0: <byte_off> [34] struct task_struct.real_parent (0:66 @ offset 1032)` →
   `matching candidate #0 <byte_off> [187] struct task_struct.real_parent (0:82 @ offset 1400)` →
   `patched insn #30 (ALU/ALU64) imm 1032 -> 1400`; tgid `1028 -> 1388`; exit_code `924 -> 1280`.
   Program ran and printed correct EXEC/EXIT lines with PPIDs. (Offsets differ due to version AND config; not attributed to a specific change.)
5. Illustrative program (own code, /tmp/bt06/ex/state.bpf.c) with `task_struct___old { long state; }` and
   `bpf_core_field_exists(t->__state)`: log shows `<field_exists> ... __state ... patched insn #1 imm 1 -> 1`,
   `relo #2: <byte_off> [321] struct task_struct___old.state ... no matching targets found`,
   `substituting insn #12 w/ invalid insn`; load succeeded (exit 0) — dead branch removed by verifier.
6. `minimal` failed to attach on this orb: `failed to open '/sys/kernel/debug/tracing/events/syscalls/sys_enter_write/id': -ENOENT`
   (orb kernel lacks syscall tracepoints). Load succeeded.
7. strace of minimal/bootstrap: `bpf(0x24 /* BPF_??? */ ...) = -1 EINVAL` (BPF_TOKEN_CREATE probe, strace 6.1 too old to name it;
   libbpf log: `failed (-22) to create BPF token from '/sys/fs/bpf', skipping optional step`),
   several feature-probe `BPF_PROG_LOAD`/`BPF_BTF_LOAD`, `BPF_BTF_LOAD` of the object BTF (magic `\237\353`),
   `BPF_MAP_CREATE` exec_start HASH (btf_fd, key/value type ids 8/11), RINGBUF rb 262144, `bootstra.rodata`
   ARRAY `BPF_F_RDONLY_PROG|BPF_F_MMAPABLE`, `BPF_MAP_UPDATE_ELEM` + `BPF_MAP_FREEZE` for .rodata (minimal trace),
   `BPF_PROG_LOAD` TRACEPOINT `handle_exec` insn_cnt=63 kern_version=6.1.189,
   `perf_event_open(PERF_TYPE_TRACEPOINT, config=97)`, probe `BPF_LINK_CREATE ... = -1 EBADF`,
   `BPF_LINK_CREATE {prog_fd=7, target_fd=9, attach_type=BPF_PERF_EVENT}` = 10, `ioctl(9, PERF_EVENT_IOC_ENABLE)`.
8. Generated `minimal.skel.h` (bpftool v7.9.0, 286 lines): `struct minimal_bpf { skeleton; obj; maps{bss,rodata}; progs{handle_tp}; links{handle_tp}; struct minimal_bpf__bss { int my_pid; } *bss; }`;
   functions `__destroy`, `__open_opts` (calloc + `__create_skeleton` + `bpf_object__open_skeleton`), `__open`,
   `__load` (`bpf_object__load_skeleton`), `__open_and_load`, `__attach` (`bpf_object__attach_skeleton`), `__detach`,
   `__elf_bytes` (embedded ELF), `_Static_assert(sizeof(s->bss->my_pid) == 4, ...)`; `#define BPF_SKEL_SUPPORTS_MAP_AUTO_ATTACH 1`.

## Web sources

- Andrii Nakryiko, "BPF CO-RE (Compile Once – Run Everywhere)", 2020-02-19, https://nakryiko.com/posts/bpf-portability-and-co-re/
  — BCC drawbacks (Clang/LLVM big, resource-heavy at startup, kernel headers needed, errors only at runtime);
  four pieces (BTF, Clang, libbpf, kernel); BTF "up to 100x" smaller than DWARF (with dedup);
  Kconfig externs (`LINUX_KERNEL_VERSION`, `CONFIG_HZ`), struct flavors `thread_struct___v46`; ">25 BCC tools converted" (2021 update).
- Andrii Nakryiko, "BPF CO-RE reference guide", https://nakryiko.com/posts/bpf-core-reference-guide/ (2021)
  — bpf_core_read, BPF_CORE_READ(t, mm, exe_file, path.dentry, d_name.name), size not relocated automatically,
  BPF_CORE_READ_BITFIELD[_PROBED], bpf_core_type_exists(struct bpf_ringbuf), bpf_core_enum_value(enum cgroup_subsys_id, cpu_cgrp_id),
  task_struct `__state` vs `___old` `state` example, guarding relocations, preserve_access_index for direct reads (tp_btf, fentry).
- Andrii Nakryiko, "Building BPF applications with libbpf-bootstrap", https://nakryiko.com/posts/libbpf-bootstrap/ —
  global variables readable/writable from user space "starting from Linux 5.5"; rodata via `skel->rodata`.
- Andrii Nakryiko, "BTF deduplication and Linux kernel BTF", https://nakryiko.com/posts/btf-dedup/
- docs.kernel.org/bpf/btf.html — btf_header (magic 0xeB9F, version, flags, hdr_len, type_off/len, str_off/len),
  btf_type (name_off, info: vlen bits 0-23, kind 24-30, kind_flag 31; size/type union), kinds 1..19,
  .BTF / .BTF.ext (func_info, line_info, core_relo), .BTF.base split BTF for modules (pahole ≥ 1.28 distilled_base),
  BTF kernel API (BPF_BTF_LOAD, BPF_MAP_CREATE, BPF_PROG_LOAD, BPF_BTF_GET_FD_BY_ID, BPF_OBJ_GET_INFO_BY_FD).
- docs.kernel.org/bpf/libbpf/libbpf_overview.html; docs.kernel.org/bpf/llvm_reloc.html.
- docs.ebpf.io BPF_LINK_CREATE page: command since v5.7 (commit af6eea57437a); perf_event link field v5.15.
- aquasecurity/btfhub: "supplies BTF files for all published kernels that lack native support for embedded BTF";
  archive at aquasecurity/btfhub-archive; BTFgen made with Kinvolk and Elastic, later "incorporated in the bpftool as the min_core_btf sub-function".
- eunomia-bpf/bpf-compatible README: `script/btfgen` (fetch btfhub-archive to `~/.cache/eunomia/btfhub`, `btfgen xxx.o -o min_core_btfs.tar.gz`),
  `ld -r -b binary min_core_btfs.tar.gz -o min_core_btfs_tar.o`, crates bpf-compatible-rs / bpf-compatible-sys + `btf_helpers.h`
  that set the custom BTF path in `bpf_object_open_opts`; adapted libbpf-bootstrap under `example/c`.
- LWN "Possible paths for signing BPF programs", https://lwn.net/Articles/1031854/ — CO-RE relocations obstruct signing;
  light skeleton loader; 2021 patch set by Alexei Starovoitov added kernel-side CO-RE relocation.
- Brendan Gregg, "BPF binaries: BTF, CO-RE, and the future of BPF perf tools", 2020-11-04,
  http://www.brendangregg.com/blog/2020-11-04/bpf-co-re-btf-libbpf.html

## Unverified / left out

- `/sys/kernel/btf/vmlinux` in Linux 5.4: verified via https://kernelnewbies.org/Linux_5.4 ("Expose BTF info
  through /sys/kernel/btf ... /sys/kernel/btf/vmlinux"; same release lists "central part of CO-RE"), and
  Toke Høiland-Jørgensen on iovisor-dev ("appeared in 5.4 kernel (upstream version)").
- Kernel version of in-kernel CO-RE relocation (believed 5.17) — chapter says "2021 patch set" per LWN, no version.
- No benchmark numbers used besides those printed by tools above.
