# Research notes — Chapter 13: bpf-compatible

Date of study: 2026-11-06. All clones under `/home/user/workspace/src/` (shallow, `--filter=blob:limit=2m`;
bpf-compatible was later unshallowed to read its full history).

## Repositories and revisions studied

| Repo | Commit | Date | Notes |
|---|---|---|---|
| eunomia-bpf/bpf-compatible | `4ed5e6510ff59cc901052bd65b0a77326c21107e` | 2026-07-14 | "fix: link C examples with zstd (#9)" |
| eunomia-bpf/eunomia-bpf | `a5408a8c3614bd4e008c1f999bb4ee9738e2fc41` | 2026-08-09 | ecc `--btfgen`, ecli tar loading, bpf-loader-rs |
| eunomia-bpf/btf-relocate-demo | `a26f157fa0a2c30ad9441351ad197eea3a0938e1` | 2024-01-26 | extracted bpftool btfgen code |
| eunomia-bpf/multiarch-relocate-example | `cbc7be4a498d1a903e97baa7ef0ef4b67a8c5288` | 2024-05-26 | x86 → aarch64 object patching |
| aquasecurity/btfhub | `6348f13e5605990fd9c21024bfdc2ca614b8ce5f` | 2026-11-03 | dependabot bump; tools/btfgen.sh |
| iovisor/bcc | `c398a9a7a41cba623b520cda27457b92d7fcad2b` | 2026-10-02 | libbpf-tools/btf_helpers.c, Makefile.btfgen |
| libbpf/libbpf | `872299d94e27d2fa9f119667c7e52268698dc760` | 2026-11-02 | btf_custom_path doc + obj_needs_vmlinux_btf |
| libbpf/bpftool | `1f6bbb790d755f78acd076f3d3462f63b988f75c` | — | src/gen.c min_core_btf |

## Activity of bpf-compatible

- 22 commits total. Initial commit 2023-05-20 (云微 = yunwei37). Bulk of work May–Oct 2023 by Officeyutong,
  ocfox (btfgen script, 2023-05-21), Yang Hanlin (#6 multiple btfhub repos 2023-07-05, #7 multiple BPF objects
  2023-08-30). 2023-10-11 "switch libbpf to v0.8.1" (submodule bump).
- Only 2026 commit: 2026-07-14 Herman Zhu, PR #9 (opened 2025-05-14) adds `-lzstd` to the example link line,
  fixing issue #8 (static libelf on Ubuntu 24.04 needs zstd). One-line Makefile change.
- GitHub: 14 stars, MIT, not archived, pushed 2026-07-14. Description: "compatible library for ebpf programs to
  improve BTF portability".
- crates.io `bpf-compatible-rs`: versions 0.1.0–0.1.3, last updated 2023-05-28.
- Conclusion: feature-complete/maintenance mode; the design doc's roadmap (compat API like bpf_buffer, OCI BTF
  store, binary releases) has not been implemented.

## Repo layout (44 files)

```
bpf-compatible/
├── README.md, README_zh.md (zh has the API design + roadmap), design.md (zh design doc), LICENSE (MIT)
├── Makefile                 (only `clean`)
├── doc/image/flow.png, flow-dev.png   (mermaid flowcharts, Chinese labels)
├── script/btfgen            (bash, ~110 lines: fetch | btfgen)
├── bpf-compatible-rs/       (Rust crate 0.1.3: uname-rs, os-release, tar, tempfile, thiserror)
│   └── src/lib.rs, error.rs
├── bpf-compatible-sys/      (Rust crate, crate-type cdylib+staticlib, lib name bpf_compatible → libbpf_compatible.a)
│   ├── src/lib.rs           (ensure_core_btf_with_tar_binary / _with_linked_tar / clean_core_btf_rs; flate2, mkstemp-rs)
│   ├── btf_helpers.h        (C wrapper: ensure_core_btf, ensure_core_btf_tar, cleanup_core_btf, weak symbols)
│   └── Makefile             (cargo build --release; cp libbpf_compatible.a)
└── example/                 (adapted libbpf-bootstrap)
    ├── libbpf, bpftool, blazesym   (submodules)
    ├── vmlinux/<arch>/vmlinux.h    (symlinks to vmlinux_601.h etc.)
    ├── tools/                      (gen_vmlinux_h.sh, cmake)
    └── c/  Makefile, bootstrap.{bpf.c,c,h}, execsnoop.{bpf.c,c,h}, btf_helpers.h (symlink → ../../bpf-compatible-sys/btf_helpers.h)
```

## Key facts from code

### script/btfgen
- Env vars actually read: `BTFHUB_CACHE` (default `$HOME/.cache/eunomia/btfhub`) and `BTFHUB_REPO` (default
  `https://github.com/aquasecurity/btfhub-archive`; comma-separated list allowed). README says
  `BTFHUB_REPO_URL`/`BTFHUB_CACHE_DIR` — those are the *internal* variable names; the usage text and the example
  Makefile use `BTFHUB_CACHE`/`BTFHUB_REPO`. (README discrepancy.)
- `fetch`: skips if cache dir exists; needs git + rsync; `git clone --depth 1` each repo into
  `$CACHE/btfhub-archive-repos/<sanitised-url>/`, then `rsync -av --ignore-existing` (excluding LICENSE, README.md,
  .gitignore, .git) into `$CACHE/btfhub-archive/`. First repo wins on conflicts.
- `btfgen`: calls fetch; needs bpftool; options `-j/--json` (package.json), `-o/--output` (default `output.tar`),
  `-f/--file`, rest = BPF objects. Then: `find *.tar.xz | xargs -P 8 tar xfJ` (in place), `find *.btf | xargs -P 8
  bpftool gen min_core_btf F F objs...` (overwrites in place), optional `cp $json $CACHE`, then
  `tar --exclude=./btfhub-archive-repos --exclude=*.xz -czf $dir/$output .` from the cache dir.
  So output is always gzip (even if named .tar). Tar entries look like `./btfhub-archive/ubuntu/20.04/x86_64/5.4.0-26-generic.btf`.
- Because every run re-extracts every .tar.xz first, the in-place overwrite does not poison later runs.
- `-j` copies package.json into the cache dir and it is never removed → would be included in later tars (code reading).
- xargs failures of individual min_core_btf are not checked (script continues).

### bpf-compatible-rs (src/lib.rs)
- `generate_current_system_btf_archive_path()` → `format!("{}/{}/{}/{}.btf", os_release.id, os_release.version_id, uname.machine, uname.release)`.
- `get_current_system_btf_file(archive)` joins that onto a path.
- `unpack_tar(&[u8])` → plain (uncompressed) tar into a `tempdir()`, reads `package.json` (required), returns
  `Some((tmp/btfhub-archive, TempDir))` if that directory exists. TempDir deletes on drop.
- os-release crate 0.1.0: `parse_line` strips surrounding `"` or `'` (checked crate source).

### bpf-compatible-sys (src/lib.rs + btf_helpers.h)
- `ensure_core_btf_with_tar_binary(path**, tar_bin, tar_len)`: returns 0 immediately if `/sys/kernel/btf/vmlinux`
  exists (no permission check); else gunzip whole blob (flate2) to memory; key = `./btfhub-archive/` + path above;
  iterate tar entries; on equal path, `mkstemp` `/tmp/eunomia.btf.XXXXXX`, write the bytes (via raw_file_position),
  malloc a C string, store in `*path`. Errors: -EINVAL (gzip/entries), -ENOENT (no os-release/uname or no match),
  -EIO, -EILSEQ, -ENOMEM; messages printed to stderr.
- `ensure_core_btf_with_linked_tar(path**)` uses `_binary_min_core_btfs_tar_gz_start/_end` (from `ld -r -b binary min_core_btfs.tar.gz`).
- `clean_core_btf_rs(path)`: remove file, free.
- btf_helpers.h: `static int ensure_core_btf(struct bpf_object_open_opts*)` → `ensure_core_btf_with_linked_tar(&opts->btf_custom_path)`;
  `ensure_core_btf_tar(opts, bin, len)`; `cleanup_core_btf(opts)`; weak *definitions*
  `char _binary_min_core_btfs_tar_gz_start __attribute__((weak));` (and _end) "Allow for not linking the tar binary".
- README says call `clean_core_btf`; header names it `cleanup_core_btf` (README discrepancy). Example uses `cleanup_core_btf`.
- Semantics modelled on bcc libbpf-tools `ensure_core_btf` (README_zh says so explicitly with link to
  bcc commit 046eea8 btf_helpers.c#L165).

### example/c/Makefile
- APPS = bootstrap execsnoop. Rules: `.output/%.bpf.o` (clang -g -O2 -target bpf + `bpftool gen object`),
  `.skel.h`, `.output/btfhub-cache` (fetch from `https://github.com/eunomia-bpf/btfhub-archive`),
  `.output/%-btf.tar.gz` (btfgen), app link: `cp %-btf.tar.gz min_core_btfs.tar.gz; ld -r -b binary ... -o min_core_btf_tar.o;
  $(CC) ... libbpf.a libbpf_compatible.a min_core_btf_tar.o -lelf -lz -lzstd -o $@ -static`.
- `$(OUTPUT)/libbpf_compatible.a: make -C ../../bpf-compatible-sys` (requires cargo).
- example README: binaries fail to start if target kernel not in eunomia-bpf/btfhub-archive.

### eunomia-bpf integration
- ecc flag: `-b, --btfgen` (help text "fetch custom btfhub archive file"), `--btfhub-archive <dir>` default
  `<eunomia data dir>/btfhub-archive` (README: `~/.eunomia/btfhub-archive`).
- `fetch_btfhub_repo`: `git clone --depth 1 https://github.com/aquasecurity/btfhub-archive DIR && rm -rf DIR/.git` (full archive!).
- `generate_tailored_btf`: copy archive to tmp, extract `.tar.xz` (and rm), `bpftool gen min_core_btf F F <obj>`, copy to `<out>/custom-archive/btfhub-archive`.
- `package_btfhub_tar`: `tar::Builder` (uncompressed) at `<out>/<name>.tar` with `.`=custom-archive, `package.json`, `<name>.bpf.o`.
  compiler/README says "→ btfgen.tar.gz" but code writes `<object_name>.tar` (object_name = source file name up to first dot).
- ecli: `.tar` suffix → `ProgramType::Tar`; `task_manager::start_task` calls `bpf_compatible_rs::unpack_tar`, keeps
  `TempDir` alive in the task (`BtfArchivePath::WithTempdir`). ecli-lib Cargo feature depends on `bpf-compatible-rs = 0.1.0` (optional).
- bpf-loader-rs `BpfSkeletonBuilder::build`: if archive path given → `get_current_system_btf_file`; **bails if the file
  does not exist, before checking vmlinux**; if vmlinux exists and readable (mode & 0400) → use kernel BTF; else if archive file → `btf_custom_path`;
  else env `BTF_FILE_PATH`; else error. Then `bpf_object__open_mem`.

### libbpf
- `btf_custom_path` doc (src/libbpf.h ~L163-170): "Path to the custom BTF to be used for BPF CO-RE relocations. This
  custom BTF completely replaces the use of vmlinux BTF for the purpose of CO-RE relocations. NOTE: any other BPF
  feature (e.g., fentry/fexit programs, struct_ops, etc) will need actual kernel BTF at /sys/kernel/btf/vmlinux."
- libbpf.c `obj_needs_vmlinux_btf`: CO-RE needs kernel BTF only when btf_custom_path not specified; typed ksyms etc. still need it.
- First added in libbpf commit 4920031c8809696debf43f7b0c8f95ea24b8f61c (per BTFHub README).

### bpftool gen min_core_btf (src/gen.c)
- `minimize_btf` comment: two phases — collect types involved in relocations via `bpf_core_calc_relo_insn` on
  each .BTF.ext CO-RE record (target spec = specs_scratch[2]); field relos keep only used members; type relos emit
  empty structs/unions; enum relos keep whole type. Then build new BTF with only marked types/members, fix IDs.
- Usage string: `bpftool gen min_core_btf INPUT OUTPUT OBJECT [OBJECT...]`.
- Upstreamed from Kinvolk's BTFGen (lore link 20220215225856.671072-1-mauricio@kinvolk.io).

### bcc libbpf-tools
- `make ENABLE_MIN_CORE_BTFS=1` → Makefile.btfgen: `bpftool gen min_core_btf $< $@ $(OUTPUT)/*.bpf.o` for every
  arch-matching btfhub file, `tar c --gz -f min_core_btfs.tar.gz -C min_core_btfs/ .`, `ld -r -b binary`.
- btf_helpers.c: `get_os_info` (uname + sscanf `ID=%64s`, `VERSION_ID="%64s`), key `./%s/%s/%s/%s.btf`, own gzip
  inflate + minimal tar walk, mkstemp `/tmp/bcc-libbpf-tools.btf.XXXXXX`, `opts->btf_custom_path = strdup()`;
  returns -EOPNOTSUPP if `!_binary_min_core_btfs_tar_gz_start` (weak extern declaration).

### BTFHub
- Archive is separate repo aquasecurity/btfhub-archive; layout `<ID>/<VERSION_ID>/<arch>/<release>.btf.tar.xz`.
  Top-level dirs: amzn, centos, debian, fedora, ol, rhel, sles, ubuntu. rhel: 7 8; ol: 7 8; centos 7 8; amzn 1 2 2018;
  sles 12.3 12.5 15.3; fedora 24–31; debian 9 10 + codename symlinks; ubuntu 16.04 18.04 20.04 + codename symlinks.
- GitHub tree API (2026-11-06): 4,461 `.btf.tar.xz` files (3,065 x86_64, 1,396 arm64), blob total 6,691,022,069 bytes.
- arch dir names are `x86_64` and `arm64`. `uname -m` on 64-bit ARM reports `aarch64` → neither bcc's nor
  bpf-compatible's path builder maps it (code reading; not tested on arm64).
- RHEL/OL os-release `VERSION_ID` usually includes minor version (e.g. "8.4") while archive uses "8" → potential
  mismatch (not verified on a real RHEL box; flagged as unverified in chapter).
- tools/btfgen.sh: `-a x86_64|arm64 -o obj [-o obj] [-j N]`, output `custom-archive/<distro>/<ver>/<arch>/<release>.btf`.
- docs/btfgen-internals.md: "a complex bpf object might support nearly 400 kernels by having BTF files summing only 1.5 MB."
- Tracee is the reference user.
- eunomia-bpf/btfhub-archive: fork with 85 files (centos/8, debian/10, ubuntu/20.04, all x86_64), 93.7 MB of .tar.xz; last push 2023-05-24.

### design.md (Chinese) key claims
- Tar with minimal BTF for hundreds of distros "约为 10MB 左右" (~10 MB) — an estimate, not measured.
- Mentions BCC runtime compile drawbacks (needs compiler + kernel headers on target, CPU cost), CO-RE needs kernel BTF.
- Alternatives considered: embed BTF in .bpf.o; eunomia-bpf integrated; remote/BCC compile.
- Roadmap: compat API (bpf_buffer from bcc libbpf-tools compat.h), online BTF store (git or OCI).

### Related eunomia repos
- btf-relocate-demo: `src/relo.c` = copy of bpftool's btfgen marking code with printf ("marking member %s of type %s"),
  `main(obj, btf)`; `src/relocation.c` references bpftime headers (bpftime_object.h), i.e. a prototype of
  userspace CO-RE relocation for bpftime; `examples/` builds two userspace programs with different `struct data`
  layouts, `pahole --btf_encode_detached` to make base.btf/base-new.btf. Links to tutorial 38 (eunomia.dev/tutorials/38-btf-uprobe/).
- multiarch-relocate-example: build uprobe.bpf.o with x86 vmlinux.h, Rust tool patches pt_regs accesses to aarch64
  offsets using .BTF.ext CO-RE records then removes .BTF.ext; tested on Debian 12 ARM64 (per README).

## Experiments in the orb (2026-11-06)

Environment: Debian 12, kernel 6.1.189+ x86_64, clang 14.0.6, bpftool v7.1.0 (libbpf v1.1, at /usr/sbin), libbpf 1.1.2.

1. Compiled `example/c/execsnoop.bpf.c` and `bootstrap.bpf.c` with
   `clang -g -O2 -target bpf -D__TARGET_ARCH_x86 -I example/vmlinux/x86 -I example/c` + `bpftool gen object`.
   Sizes: execsnoop.bpf.o 73,288 B; bootstrap.bpf.o 34,856 B.
2. Orb kernel BTF `/sys/kernel/btf/vmlinux`: 4,854,827 bytes, 113,213 types (`bpftool btf dump ... format raw | grep -c '^\['`).
3. `bpftool gen min_core_btf /sys/kernel/btf/vmlinux execsnoop.min.btf execsnoop.bpf.o` → 358 bytes, 10 types
   (INT×3, TYPEDEF __kernel_pid_t, pid_t, STRUCT task_struct size=7616 vlen=2 {tgid@11104 bits, real_parent@11200},
   PTR, ARRAY[6], STRUCT trace_event_raw_sys_enter {args@128}, STRUCT trace_event_raw_sys_exit {ret@128}).
   bootstrap: 331 bytes, 9 types (task_struct exit_code/tgid/real_parent, trace_event_raw_sched_process_exec.__data_loc_filename).
   Both objects together: 522 bytes, 14 types.
4. Ran the real script: `BTFHUB_REPO=https://github.com/eunomia-bpf/btfhub-archive BTFHUB_CACHE=/tmp/ch13/btfhub-cache script/btfgen fetch`
   then `BTFHUB_CACHE=... script/btfgen btfgen execsnoop.bpf.o -o execsnoop-btf.tar.gz`.
   - 85 kernels; compressed input 93,708,220 B (.tar.xz); uncompressed full BTF total 538,178,564 B (min 2,872,000
     debian 4.19.0-21-cloud; max 44,046,775 centos 4.18.0-147.8.1 — CentOS 8.1 BTF much larger, probably not deduplicated;
     reason not verified).
   - btfgen run: 2.5 s wall (8-way xargs), output `execsnoop-btf.tar.gz` = 2,012 bytes; 85 .btf entries each 358 B;
     12 distinct files by md5; uncompressed total 30,432 B.
   - bootstrap-btf.tar.gz 2,056 B; both objects 2,642 B (each entry 522 B).
   - `ld -r -b binary min_core_btfs.tar.gz -o min_core_btf_tar.o` → 2,656 B object; `nm` shows
     `_binary_min_core_btfs_tar_gz_start` (D, 0), `_end` (D, 0x7dc), `_size` (A, 0x7dc = 2012).
   - task_struct.tgid bit offsets in minimized files: centos 4.18.0-80.el8: 18464 (size 9344); debian 4.19.0-24: 9888 (size 7104);
     ubuntu 5.4.0-26-generic: 18144 (size 9280); debian 5.10.0-0.deb10.22-cloud: 17888 (size 9280); orb 6.1.189+: 11104 (size 7616).
5. Loader (scratch C, libbpf 1.1.2, `btf_custom_path` from argv, run with sudo):
   - with orb-minimized BTF: load 0; libbpf log "relo #1 ... real_parent ... patched insn #48 (ALU/ALU64) imm 1416 -> 1400",
     "relo #2 ... tgid ... imm 1404 -> 1388"; args[1] off 24 -> 24, args[0] 16 -> 16, sys_exit ret 16 -> 16.
   - with bootstrap's minimized BTF for execsnoop: fails: "1: <invalid CO-RE relocation>", "failed to resolve CO-RE
     relocation <byte_off> [32] struct trace_event_raw_sys_enter.args[1] (0:2:1 @ offset 24)", load -22.
   - with Ubuntu 5.4.0-26 minimized BTF on the 6.1 orb: load 0 (!), imm 1416 -> 2280, 1404 -> 2268 → silently wrong offsets.
   - no custom path: same as native (1400/1388).
6. A test program reading `task->__state` (renamed in 5.14): `min_core_btf` against Ubuntu 5.4.0-26 BTF exits 0 and
   writes a 25-byte BTF with no types; loading with it: "relo #0: no matching targets found", "substituting insn #1 w/
   invalid insn", verifier "<invalid CO-RE relocation>". So trimming doesn't detect incompatibilities; load does.
7. Debian libbcc 0.26 in the orb: libbcc.so.0 3,398,840 B, depends on libLLVM-14.so.1 (109,967,296 B) and libclang-cpp.so.14 (58,818,256 B).
   No `/lib/modules/$(uname -r)/build` in the orb (no kernel headers). Did not run BCC (python module not installed).

Not done: building `bpf-compatible-sys` (no cargo in orb) and running the example binaries; ensure_core_btf would
return early on this kernel anyway because /sys/kernel/btf/vmlinux exists. No test on a kernel without BTF, no arm64.

## URLs
- https://github.com/eunomia-bpf/bpf-compatible
- https://github.com/eunomia-bpf/btfhub-archive
- https://github.com/eunomia-bpf/btf-relocate-demo
- https://github.com/eunomia-bpf/multiarch-relocate-example
- https://github.com/eunomia-bpf/eunomia-bpf (compiler/cmd/src/config/mod.rs, ecli/ecli-lib/src/runner/task_manager/mod.rs, bpf-loader-rs/bpf-loader-lib/src/skeleton/builder.rs)
- https://github.com/aquasecurity/btfhub , https://github.com/aquasecurity/btfhub-archive
- https://github.com/aquasecurity/btfhub/blob/main/docs/generating-tailored-btfs.md
- https://github.com/aquasecurity/btfhub/blob/main/docs/btfgen-internals.md
- https://lore.kernel.org/bpf/20220215225856.671072-1-mauricio@kinvolk.io/ (bpftool: Implement btfgen)
- https://github.com/libbpf/bpftool/blob/main/docs/bpftool-gen.rst
- https://github.com/iovisor/bcc/blob/master/libbpf-tools/btf_helpers.c , Makefile.btfgen, README.md
- https://nakryiko.com/posts/bpf-portability-and-co-re/
- https://www.youtube.com/watch?v=igJLKyP1lFk (LPC 2021 "Towards truly portable eBPF", linked from BTFHub docs)
- https://eunomia.dev/tutorials/38-btf-uprobe/
- https://crates.io/crates/bpf-compatible-rs
