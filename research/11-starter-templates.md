# Research notes — 11 · Starter templates

Studied 2026-11-06 in the orb (kernel 6.1.189+, x86_64, Debian clang 14.0.6, libelf-dev 0.188, gh 2.99).

## Repos and commits

| Repo | Commit studied | Date | Notes |
|---|---|---|---|
| eunomia-bpf/libbpf-starter-template | `6e572b6d53cede2158dce357d1d5ebb1346640ce` | 2026-09-16 | "Pin the release action to a version that uploads before publishing" |
| eunomia-bpf/libbpf-rs-starter-template | `8927eea171db99ee8ada902380b0bc38f13aed53` | 2026-09-16 | same commit message |
| eunomia-bpf/cilium-ebpf-starter-template | `ec9a4303e13ea136d44f11f80dc4ac770bf0c148` | 2023-03-25 | "README: update"; no commits since |
| libbpf/libbpf-bootstrap (comparison) | `820a1bd8b4f4cb4b78b442ae4eb3994738651f12` | 2026-10-22 | same as ch. 06 |
| libbpf/libbpf-rs (comparison) | `9680ea7` | 2026-11-04 | workspace version 0.27.2 |

Cloned shallow under `/home/user/workspace/src/` with `--recurse-submodules --shallow-submodules`.

GitHub API (2026-11-06): all three have `is_template: true`, default branch `master`, not archived.
Stars/forks: C 78/26, Rust 30/1, Go 65/10. Created 2023-03-21..23.
Releases: C latest `v0.0.11` (2026-07-14); Rust latest `v0.0.20` (2026-02-11). (No release after the
2026-09-16 "pin release action" commits; reason not investigated.)

Commit history highlights (C): 2023-03 initial (README, LICENSE, docker, flake, devcontainer);
2024-08-19 `fd14bb1` "fix: docker name should be repo name" (docker.yml tag changed from
`ghcr.io/${{ github.repository_owner }}/libbpf-template:latest` to `ghcr.io/${{ github.repository }}`);
2025-08-23 `c38be18` / 2025-10-06 `5ba4410` add `-fno-stack-protector` to BPF compile (fix compile error);
2025-10-06 `a916454` nix flake fix (`hardeningDisable = [ "zerocallusedregs" ]`);
2026-07-14 `13a3549` "updated submodules and its dependencies (#11)" — added vmlinux/x86/vmlinux_68.h and _71.h,
bumped libbpf/bpftool.
Rust: 2024-08-19 `7553497` "fix compile and docker name"; 2026-02 dependabot bump of `time` 0.3.36→0.3.47.

## libbpf-starter-template (C)

Files: `.devcontainer/devcontainer.json`, `.envrc` (`use flake`), `.github/workflows/{docker,publish}.yml`,
`.gitignore` (`.direnv`, `/build`), `.gitmodules`, `LICENSE` (MIT), `Makefile`, `README.md`,
`dev.dockerfile`, `dockerfile`, `flake.{nix,lock}`, `src/{.gitignore,Makefile,bootstrap.bpf.c,bootstrap.c,bootstrap.h}`,
`vmlinux/` (vendored, NOT a submodule; tracked files), `libbpf/` and `bpftool/` submodules.

- Submodules: `libbpf` → libbpf/libbpf @ `dcaac95` (2026-05-28 "sync: latest libbpf changes from kernel",
  `LIBBPF_MAJOR/MINOR 1.8`); `bpftool` → libbpf/bpftool @ `48f7cc7` (2026-06-01), itself with a nested libbpf submodule.
  Built bpftool reports `bpftool v7.8.0 / using libbpf v1.8 / features: crypto, skeletons, bootstrap`.
- `vmlinux/`: `vmlinux.h -> x86/vmlinux.h`; `x86/vmlinux.h -> vmlinux_601.h` (also `vmlinux_68.h`, `vmlinux_71.h`);
  `arm64/` (516, 601), `arm/` (62), `riscv/` (602). 19 MB total. No powerpc/mips/loongarch dirs although
  ARCH sed maps ppc64le→powerpc, mips*→mips.
- Top `Makefile`: `build: make -C src`, `clean`, `install:` (sudo apt install libelf1 libelf-dev zlib1g-dev libssl-dev make clang llvm).
- `src/Makefile` = trimmed copy of libbpf-bootstrap `examples/c/Makefile`. Differences vs bootstrap @820a1bd:
  - paths `../libbpf`, `../bpftool`, `../vmlinux/$(ARCH)/vmlinux.h` (bootstrap: `../../libbpf`, `../../vmlinux.h/include/$(ARCH)`)
  - `APPS = bootstrap` only; no blazesym/cargo logic; no loongarch sed.
  - BPF rule: `clang -g -O2 -fno-stack-protector -target bpf ... -c X.bpf.c -o X.bpf.o` then `llvm-strip -g`.
    Bootstrap instead compiles to `X.tmp.bpf.o` with `-MMD` dep files and runs `bpftool gen object X.bpf.o X.tmp.bpf.o`.
  - No `-MMD -MP` dependency files anywhere; uses `$(wildcard %.h)` in prerequisite lists, which does not
    expand per-pattern (wildcard runs at parse time with a literal `%`). **Verified**: after a full build,
    `touch bootstrap.h; make -n` prints nothing → header edits do not trigger a rebuild. Touching
    `bootstrap.bpf.c` rebuilds BPF obj, skeleton, user obj, binary.
  - `CLANG_BPF_SYS_INCLUDES =` (not `?=`).
- `src/bootstrap.{bpf.c,c,h}` = libbpf-bootstrap's bootstrap example, whitespace/format differences only (diffed).
- `dockerfile`: ubuntu:22.04, `COPY . /root/`, install `libelf1`, `ENTRYPOINT ["/root/src/bootstrap"]` → needs
  prebuilt binary in the build context.
- `dev.dockerfile`: ubuntu:22.04, installs libelf1 libelf-dev zlib1g-dev libclang-13-dev libssl-dev make git clang llvm
  pkg-config build-essential ca-certificates; ENTRYPOINT bash. `.devcontainer/devcontainer.json` only sets build
  context `..` and dockerfile `../dev.dockerfile` (no runArgs / privileges).
- `flake.nix`: `packages.default = pkgs.mkShell {...}` with clang llvm pkg-config openssl; elfutils zlib.
- CI `publish.yml`: on push to master, ubuntu-latest, checkout with `submodules: 'recursive'`, github-script computes
  next version (v0.0.1 if no releases, else bump patch of latest release, or existing tag on this SHA),
  apt deps, `make build`, `softprops/action-gh-release@v3` uploads `src/bootstrap`. Skips if commit message
  contains `[skip ci]`/`[ci skip]`. Matrix target x86_64-unknown-linux-gnu (unused by steps).
- CI `docker.yml`: same trigger; build; buildx; login ghcr with GITHUB_TOKEN; build-push `dockerfile`,
  platforms linux/amd64, tag `ghcr.io/${{ github.repository }}`. Last step echoes `steps.docker_build.outputs.digest`
  but no step has id `docker_build` (prints empty).
- README still says `docker run --rm -it --privileged ghcr.io/eunomia-bpf/libbpf-template:latest`; since fd14bb1
  CI pushes to `ghcr.io/eunomia-bpf/libbpf-starter-template`. Whether the old image still exists: **unverified**
  (packages API needs read:packages scope).
- README "How to use": Use this template → `git clone ... --recursive` or `git submodule update --init --recursive`
  → `make install` → `make build` → `sudo src/bootstrap`.

### Build & run in the orb (verified)

- `make build -j4`: exit 0, `real 0m29.6s` (mostly building libbpf twice: once for the app, once inside bpftool bootstrap).
  Output lines: `LIB libbpf.a`, `BPF .output/bootstrap.bpf.o`, `BPFTOOL bpftool/bootstrap/bpftool` (feature
  detection: libbfd OFF, clang-bpf-co-re on, llvm on, libcap OFF), `GEN-SKEL .output/bootstrap.skel.h`, `BINARY bootstrap`.
  Warning: `make[1]: warning: jobserver unavailable: using -j1. Add '+' to parent make rule.` (top Makefile uses
  `make -C src` rather than `$(MAKE)`).
- Sizes: bootstrap.bpf.o 36,392 B; bootstrap.skel.h 120,346 B; src/bootstrap 1,614,688 B (with debug info).
  `ldd`: libelf.so.1, libz.so.1, libc.so.6 (libbpf static).
- bpf.o sections after llvm-strip -g: tp/sched/sched_process_exec (0x1f8), tp/sched/sched_process_exit (0x2a8),
  license, .rodata (8), .maps (0x30), .BTF (0x77aa), .BTF.ext (0x54c), rel sections, .symtab. No .debug_*.
- `sudo src/bootstrap`: both tracepoints attached; EXEC/EXIT lines printed (e.g. `EXEC id 30113 30112 /usr/bin/id`,
  `EXIT id ... [0] (1ms)`, `EXIT git ... [128] (1ms)`). `-d 200`: only EXIT lines with duration ≥200 ms
  (e.g. `EXIT sleep 31021 30838 [0] (501ms)`). `timeout` exit 124.
- `-v` CO-RE log (verbatim):
  `CO-RE relocating [34] struct task_struct: found target candidate [187] struct task_struct in [vmlinux]`
  `relo #0: <byte_off> [34] struct task_struct.real_parent (0:81 @ offset 1416)`
  `relo #0: matching candidate #0 <byte_off> [187] struct task_struct.real_parent (0:82 @ offset 1400)`
  `relo #0: patched insn #30 (ALU/ALU64) imm 1416 -> 1400`
  `relo #1: ... task_struct.tgid (0:79 @ offset 1404)` → `offset 1388`, `patched insn #37 imm 1404 -> 1388`.
  So even the vendored "6.1" header differs from the orb's 6.1.189 kernel (config differences); CO-RE fixes it.
- Rename experiment (scratch copy, deleted): renamed bootstrap.* → execsnoop.*, `APPS = execsnoop`, sed
  `bootstrap.h`→`execsnoop.h`, `bootstrap.skel.h`→`execsnoop.skel.h`, `bootstrap_bpf`→`execsnoop_bpf` in .c;
  built OK; skeleton defines `struct execsnoop_bpf`, `execsnoop_bpf__open`. Other places to update: `src/.gitignore`
  (`/bootstrap`), `dockerfile` ENTRYPOINT, `publish.yml` files: `src/bootstrap`.
- Multiple apps: `APPS = a b` works (tested `APPS = execsnoop runqslower`).

## libbpf-rs-starter-template (Rust)

Files: `.devcontainer/devcontainer.json` (dockerfile `../dockerfile-dev`), `.envrc` (nix-direnv 2.2.1 bootstrap, watches
devenv.nix/lock/yaml which do not exist, then `use flake . --impure`), `.github/workflows/{docker,publish}.yml`,
`.gitignore` (target, .devenv, .direnv), `Cargo.toml`, `Cargo.lock`, `LICENSE` (MIT), `Makefile` (`build: cargo build --release`,
`clean: rm -rf target`), `README.md`, `build.rs`, `dockerfile`, `dockerfile-dev`, `flake.{nix,lock}`,
`src/main.rs`, `src/bpf/{runqslower.bpf.c,runqslower.h,vmlinux.h}`. No submodules.

- Cargo.toml: package `runqslower` 0.1.0, author Daniel Xu, license "LGPL-2.1-only OR BSD-2-Clause", edition 2021.
  deps anyhow 1.0, libbpf-rs 0.20, libc 0.2, plain 0.2, time 0.3 (formatting, local-offset, macros), clap 3.1 (derive).
  build-deps libbpf-cargo 0.20. Lock: libbpf-rs 0.20.1, libbpf-cargo 0.20.1, libbpf-sys 1.4.3+v1.4.5.
- build.rs: `SkeletonBuilder::new().source(SRC).build_and_generate(&out)` into `$OUT_DIR/runqslower.skel.rs`;
  `cargo:rerun-if-changed=src/bpf/runqslower.bpf.c` (header not listed).
- main.rs: `include!(concat!(env!("OUT_DIR"), "/runqslower.skel.rs"))`; clap positional args latency (default 10000),
  pid, tid, `-v`; `bump_memlock_rlimit` 128 MiB; `RunqslowerSkelBuilder::default()`, `obj_builder.debug(true)`;
  `open_skel.rodata().min_us = ...`; `load()`, `attach()`; `PerfBufferBuilder::new(skel.maps_mut().events())`.
  Note bug-ish: `targ_tgid = opts.tid` and `targ_pid = opts.pid` naming crossed (as in old upstream example).
  `unsafe impl Plain for runqslower_bss_types::event {}` — event type lands in bss types because of dummy `struct event _event`.
- runqslower.bpf.c: three `tp_btf` programs (sched_wakeup, sched_wakeup_new, sched_switch), HASH `start`,
  PERF_EVENT_ARRAY `events`, `task_struct___pre_5_14` flavor + `bpf_core_field_exists(t->__state)`.
  Upstream libbpf-rs example now uses RINGBUF and `bpf_ringbuf_reserve/submit`; otherwise same.
- vmlinux.h: single x86 file, 2,583,960 bytes, contains `__state` (≥5.14). Exact kernel version unverified.
- Upstream libbpf-rs 0.24.0 changelog: "Adjusted `SkelBuilder::open` method to require mutable reference to storage
  space for BPF object" — current example: `let mut open_object = MaybeUninit::uninit(); skel_builder.open(&mut open_object)?`,
  `open_skel.maps.rodata_data`, `skel.maps.events`, vmlinux crate from libbpf/vmlinux.h. So template code will not compile
  unchanged against libbpf-rs ≥0.24 (inference from changelog; not compiled).
- dockerfile: copies `./target/release/runqslower`, libelf1, entrypoint. dockerfile-dev: ubuntu 22.04 + wget pkg-config
  build-essential zlib1g-dev clang llvm libelf1 libelf-dev, rustup, `make`.
- CI: same structure as C; uses `actions-rs/toolchain@v1` (archived action) stable, `Swatinem/rust-cache@v2`;
  publish uploads `target/release/runqslower`, guarded by `github.repository_owner == 'eunomia-bpf'`.
- README mentions `make install` but Makefile has no `install` target. README says "Go development" in Features (copy-paste).
  README docker image `ghcr.io/eunomia-bpf/libbpf-rs-template:latest`.
- Rust build: **not done** — no cargo/rustc in orb.
- Verified BPF side instead: compiled `runqslower.bpf.c` with the C template's Makefile and a throwaway C loader
  (open, set rodata min_us=1000, load, attach, perf_buffer poll 3 s): `attached OK, events with latency > 1000us in 3s: 46`.
  So tp_btf sched_* attach on orb 6.1. (libbpf-rs userspace not exercised.)

## cilium-ebpf-starter-template (Go)

Last commit 2023-03-25. go.mod: go 1.20, `github.com/cilium/ebpf v0.10.0` (cilium/ebpf latest release v0.22.0 per API).
`cmd/ringbuffer/{main.go,ringbuffer.c,common.h,bpf_helpers.h,bpf_helper_defs.h}`; `//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc $BPF_CLANG -cflags $BPF_CFLAGS -type event bpf ringbuffer.c -- -I../headers`;
Makefile: `generate` exports BPF_CLANG/BPF_CFLAGS, `go generate ./...`; `build` → `bin/ringbuffer`.
BPF: `SEC("kprobe/sys_execve")`, RINGBUF 1<<24; Go: `link.Kprobe("sys_execve", ...)`, `ringbuf.NewReader`.
Orb kallsyms has `__x64_sys_execve` only; current cilium/ebpf link/kprobe.go documents adding platform prefix for `sys_*`.
Not built.

## Other facts / URLs

- GitHub docs: template → new repo "starts with a single commit"; option "Include all branches";
  https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template
  Docs do not say whether submodule gitlinks are preserved → **unverified**; give `git submodule add` fallback.
- `gh repo create NAME --template OWNER/REPO --public --clone` (flags verified in gh 2.99 help).
- Dev containers spec: https://containers.dev/
- libbpf-bootstrap blog: https://nakryiko.com/posts/libbpf-bootstrap/
- libbpf-rs: https://github.com/libbpf/libbpf-rs ; CHANGELOG libbpf-rs/CHANGELOG.md
- bpf2go docs: https://pkg.go.dev/github.com/cilium/ebpf/cmd/bpf2go
- eunomia-template (chapter 10), bpf-developer-tutorial (chapter 09).
