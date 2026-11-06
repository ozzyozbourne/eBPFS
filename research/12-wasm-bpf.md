# Research notes — Chapter 12: wasm-bpf

Survey date: 2026-11-06. Orb kernel: Linux 6.1.189 x86_64.

## Sources studied (shallow clones under /home/user/workspace/src/)

| Repo | Commit | Date |
|---|---|---|
| eunomia-bpf/wasm-bpf | `01f14194ca6966201ff34d72290be118ed2253a9` | 2026-09-04 |
| eunomia-bpf/wasm-bpf-guest-sdk-c | `c8b1d8a0cc1362179710ece92c94888e0843f6f4` | 2026-09-09 |
| eunomia-bpf/wasm-bpf-guest-sdk-rust | `7d0b615afefda5f7dd82b38f5be014c9b2d0bda6` | 2026-09-09 |
| eunomia-bpf/wasm-bpf-guest-sdk-go | `27b5c515dfd82701f60c83ae5e241bcf569f4246` | 2026-09-09 |
| eunomia-bpf/bpftool (submodule pinned by wasm-bpf) | `a3bb93eed3a264ab6ce73cae7c32febc7eb59db4` "Restore wasm skeleton generation flag" | 2026-03-05 |
| eunomia-bpf/bpftool branch `wasm-bpftool` (older) | `252f0675c1c66daca7c6623bae112c2ea2f8d61e` | 2023-03-11 |
| bytecodealliance/wasm-micro-runtime (submodule) | `e516de8ec75293069075241bbf83cd3db1cc8aa2` | — |
| eunomia-bpf/eunomia-bpf (for ecli OCI) | `a5408a8c3614bd4e008c1f999bb4ee9738e2fc41` | 2026-08-09 |
| crate bpf-oci 0.1.0 (static.crates.io), oci-distribution 0.9.4 | — | — |

Repo metadata (gh api 2026-11-06): created 2022-11-04, MIT, 450 stars, 35 forks, last push 2026-09-04.

## Recent activity (gh api commits)

wasm-bpf: #166/#165/#164 CI fixes (2026-09-04); #163 fd-based attach in C++ runtime (2026-09-02); #160 fd-based
attach in Rust runtime (2026-08-29) — both close issue #48 "[BUG] Pass file descriptor instead of file path at
`wasm_attach_bpf_program`" (opened 2023-03-01, still listed open); #162 nix crates; dependabot rand bumps (2026-07);
2026-03-06 batch of CI/lint fixes (#145–#154), #142 const-to-mut pointer casts fix (2026-02-10). Before that, quiet
from 2023-11 (KubeCon doc link #137, podman doc #136) to 2024-09.
Guest SDKs: each got one commit on 2026-09-09 adding the fd-attach binding; previous commits 2023-05/06.
Open issue #157 "Release surface: refresh official package channels" (2026-06-15).
crates.io: wasm-bpf-rs max 0.3.2 (2023-05-12) while Cargo.toml says 0.3.3; wasm-bpf (CLI) 0.2.0 (2023-04-27);
wasm-bpf-binding 0.1.0; btf2wit 0.1.2. So `cargo install wasm-bpf` (README) installs a 2023 CLI without fd attach.

## Directory map (wasm-bpf)

- `runtime/wasm-bpf-rs/` — library crate `wasm-bpf-rs` (wasmtime 5.0.1, wasmtime-wasi, libbpf-rs 0.20.1, ouroboros).
  `src/lib.rs` (Config, run_wasm_bpf_module, run_wasm_bpf_module_async), `src/runner.rs` (Linker, host fn
  registration, epoch interruption, preopens), `src/state.rs` (AppState, object_map, poll containers),
  `src/bpf/{load,attach,fd,fd_by_name,map_operate,poll,wrapper_poll,close}.rs`, `src/utils.rs` (memory access,
  `__indirect_function_table` calls, `add_bind_function!` macros → module `wasm_bpf`), `src/handle.rs`
  (pause/resume/terminate), `src/pipe.rs`. `tests/*.wasm` prebuilt guests + test sources.
- `runtime/cli/` — `wasm-bpf` binary (clap): `--verbose`, `-m/--wrapper-module-name` (default `callback-wrapper`),
  `-c/--callback-export-name` (default `go-callback`), `--dir HOST:GUEST` (repeatable).
- `runtime/c-wrapper/` — C ABI over the Rust lib (`wasm_bpf_module_run`).
- `runtime/cpp/` — minimal C++ runtime on WAMR + vendored libbpf (from bpftool submodule): `src/wasm-bpf.cpp` (797
  lines), `src/main.cpp`, `include/bpf-api.h`, CMake, tests (attach_dispatch, attach_fd_e2e, hostile_init_e2e,
  memory tests). `third_party/vmlinux/<arch>/vmlinux.h`, `third_party/bpf/*.h`, submodules bpftool + WAMR.
- `wasm-sdk/` — submodules c, go_sdk, rust/wasm-bpf-binding (the separate guest SDK repos).
- `examples/` — bootstrap, rust-bootstrap, bootstrap-libbpf-rs, execve, go-execve, go-lsm, lsm, opensnoop, runqlat,
  sockfilter, sockops, tcpconnlat-libbpf-rs, uprobe, xdp. Top-level `examples/Makefile` needs `IMPL=cpp|rust`.
- `docs/build.md`, `docs/build-image.md`, `docs/podman.md`; `Dockerfile` (ubuntu:22.04 + libelf1 + rust binary,
  ENTRYPOINT ./wasm-bpf); workflows incl. `publish-example-images.yml` (ecli-rs push to ghcr).

## Host ABI (module `wasm_bpf`)

Registered in Rust runner.rs via `add_bind_function!` (module "wasm_bpf"): wasm_load_bpf_object,
wasm_close_bpf_object, wasm_attach_bpf_program, wasm_attach_bpf_program_fd, wasm_bpf_buffer_poll,
wasm_bpf_map_fd_by_name, wasm_bpf_map_operate; plus `bpf_buffer_poll_wrapper` registered as
`<wrapper_module_name>.wasm_bpf_buffer_poll` for TinyGo.

WAMR signatures (wasm-bpf.cpp `native_symbols`):
```
wasm_load_bpf_object       "(*~)I"
wasm_attach_bpf_program    "(I$$)i"
wasm_attach_bpf_program_fd "(I$i)i"
wasm_bpf_buffer_poll       "(Iiii*~i)i"
wasm_bpf_map_fd_by_name    "(I$)i"
wasm_bpf_map_operate       "(ii***I)i"
wasm_close_bpf_object      "(I)i"
```
(WAMR: `*` pointer i32 with bounds check, `~` length of previous buffer, `$` string, `I` i64, `i` i32.)

Real import sections parsed with a small Python script (my own scratch tool) from the repo's prebuilt test wasm files:
- bootstrap.wasm (73,446 B): load (i32,i32)->i64; attach (i64,i32,i32)->i32; map_fd_by_name (i64,i32)->i32;
  buffer_poll (i64,i32,i32,i32,i32,i32,i32)->i32; close (i64)->i32; 8 WASI imports; exports memory, _start,
  __indirect_function_table.
- runqlat.wasm (110,081 B): also map_operate (i32,i32,i32,i32,i32,i64)->i32.
- rust-bootstrap.wasm (2,119,496 B): exports `__main_argc_argv`, `cabi_realloc`.
- go-execve.wasm (494,453 B): imports `callback-wrapper.wasm_bpf_buffer_poll` (i64,i32,i32,i32,i32,i32)->i32;
  exports `go-callback` and asyncify_* functions.
- A bootstrap.wasm I built from current sources (72,984 B) additionally imports `wasm_attach_bpf_program_fd`
  (as the C SDK README warns: skeleton attach helper references both host calls).

Doc/ABI inconsistencies observed (reading only, not run):
- README/WasmEdge plugin README document `i32 wasm_bpf_map_operate(u64 fd, ...)`; implementations take i32 fd.
- Rust binding (`wasm-bpf-binding/src/binding.rs`) and Go SDK declare map_operate key/value/next_key as **i64**;
  host functions take 32-bit pointers (Rust runtime `WasmPointer = u32`; WAMR `*`). A guest that actually calls
  map_operate through these bindings would likely fail import type-checking at instantiation (wasmtime) —
  NOT verified (no Rust/TinyGo toolchain on the orb). The C SDK uses i32 pointers and matches.
- Rust lib `Config::default()` sets `callback_export_name="callback-wrapper"`, `wrapper_module_name="go-callback"`,
  the reverse of the CLI defaults (`-m callback-wrapper`, `-c go-callback`) and of what go-execve.wasm imports/exports.
  ecli uses `..Default::default()`. Not verified at runtime.

## Implementation facts

- Load (Rust load.rs): checks last byte of buffer is readable, `ObjectBuilder::default().open_memory("", slice)`
  directly on the guest memory slice, `.load()`, stores `WrapperObject` in `object_map` under counter starting at 1
  (`FIRST_OBJECT_ID`). Returns 0 on failure. C++: handle = `(uint64_t)program.get()` (host pointer value, used only
  as a key in an unordered_map).
- Attach: by name; null/empty target → `bpf_program__attach()` (libbpf auto-attach by SEC name). With target:
  section "sockops" → open path as cgroup, `attach_cgroup`; "xdp" → `if_nametoindex`, `attach_xdp`; else auto.
  Links kept in `opened_links`/`links` set, destroyed with the object/state.
- fd attach (#160/#163): runtime preopens host directories (`--dir`), with **empty rights** (Rust: DirCaps/FileCaps
  empty; C++: injects after instantiation and drops rights to 0, verifies prestat). Guest discovers preopen via
  fd_prestat_get/dir_name and passes the fd; runtime maps guest fd → host fd only through its own preopen registry.
  xdp rejected on fd path. Motivation: old path API let the guest name any host path for the privileged runtime to open.
- Map ops: `MapInfo`/`bpf_map_get_info_by_fd` to get key/value size; bounds-check guest pointers for those sizes;
  pass raw pointers into linear memory directly to `bpf_map_*_elem` → kernel copies to/from guest memory directly.
  Only LOOKUP(1)/UPDATE(2)/DELETE(3)/GET_NEXT_KEY(4); other cmds -EINVAL. Note the fd is a raw host fd number; the
  runtime does not check it belongs to the caller's object (it only calls get_info on it).
- Poll: first call creates PerfBuffer or RingBuffer depending on map type (C++: perf buffer 64 pages via
  `perf_buffer__new`; ring buffer `ring_buffer__new`). C++: per record, memcpy up to max_size into guest `data`,
  `wasm_runtime_call_indirect(exec_env, sample_func, 3, argv)` — callback per record, size passed is the full record
  size even if truncated. Rust: libbpf-rs callback stores `data.to_vec()` into an `Rc<RefCell<Option<Vec<u8>>>>`
  (replace), after poll copies the stored record and calls the guest once (via `__indirect_function_table` or Go
  export). Reading suggests that when several records arrive in one poll, only the last reaches the guest — NOT
  verified at runtime.
- C SDK `bpf_buffer__poll`: 4096-byte stack buffer, timeout<=0 → 100 ms.
- Guest needs `--export-table` (wasm-ld) so the host can call through `__indirect_function_table`; Rust build.rs
  passes `cargo:rustc-link-arg=--export-table`.
- Lifecycle (Rust): wasmtime `epoch_interruption(true)`, deadline 1; pause = `engine.increment_epoch()`, the
  deadline callback blocks on an mpsc channel until Resume/Terminate.
- C++ runtime: WAMR stack 1 MiB, heap 1 MiB; `wasm_runtime_set_wasi_args` with no preopens; `libbpf_set_strict_mode`.

## Toolchain / struct layout

- Wasm skeleton: `bpftool -w gen skeleton x.bpf.o` (flag `-w`/`--wasm` in eunomia-bpf/bpftool) emits a skeleton
  that includes `libbpf-wasm.h`, embeds the ELF bytes, sets `s->rodata_offset`. Verified on the orb: for my build
  of bootstrap.bpf.o, `s->rodata_offset = 1264` and `readelf -S` shows `.rodata` at file offset 0x4f0 = 1264.
  `bpf_object__open_skeleton` in libbpf-wasm.h points `*mmaped` at `s->data + s->rodata_offset`, so writing
  `skel->rodata->min_duration_ns` patches the ELF image before `wasm_load_bpf_object`. bss not supported
  (commented out). Verified: `bootstrap.wasm -d 50` printed only EXIT events with durations ≥ ~206 ms.
- Pointer variables in datasec → `uint64_t /* pointer */` (codegen_datasec_def_wasm).
- Wasm-friendly struct header: old wasm-bpftool branch `btf dump file x.bpf.o format c -j` → `dump_btf_wasm`
  emits packed structs with explicit `__padN` and `static_assert(sizeof...)`; skips bitfields and nested
  composites, prints pointers as integers. The committed `examples/bootstrap/bootstrap.wasm.h` is such output
  (`struct event` 168 bytes, `char __pad0[4]`). In the **pinned** bpftool (a3bb93e), `format c -j` prints a JSON
  description of struct layouts instead (verified on the orb). The Makefile's `bootstrap.wasm.h` rule (needs `ecc
  bootstrap.h --header-only` first so the event type is in BTF) is not a dependency of `bootstrap.wasm`, so plain
  `make` uses the committed header.
- Measured layout (clang 14, -target bpf vs wasm32) for `struct { int pid; long start_ns; const char *name; char
  comm[16]; }`: bpf offsets 8/16/24 size 40; wasm32 offsets 4/8/12 size 28. For bootstrap's `struct event`:
  identical (duration_ns 16, comm 24, exit_event 167, size 168).
- btf2wit (crate 0.1.2, github eunomia-bpf/btf2wit, last push 2023-03-11): BTF → WIT; rust-bootstrap/btf/Makefile:
  `clang -target bpf -g event-def.c -c -o event.def.o; btf2wit event.def.o -o event-def.wit --world-name event-def`;
  import.wit generated from `gcc -g` + `pahole -J` on import.c, then `sed 's/--/s-/g'`. WIT syntax is the old
  pre-1.0 `default world` form; wit-bindgen pinned rev 0fb4018. The `wasmtime` cargo feature switches to the
  wit-bindgen bindings.
- c-struct-bindgen (eunomia-bpf, last push 2023-02-03): POC "serialization-free bindings and marshal/unmarshal for JSON".

## Build/run on the orb (all real)

- `git submodule update --init --depth 1 runtime/cpp/third_party/{wasm-micro-runtime,bpftool}` + bpftool's libbpf.
- `cd runtime/cpp && make build` → 28.7 s wall (single job), `build/bin/Release/wasm-bpf` 1,774,520 bytes
  unstripped, 639,512 stripped; dynamic deps libelf, libz, libstdc++. (README claims "1.5 MB" minimal runtime.)
- `make -C runtime/cpp/third_party/bpftool/src` → bpftool v7.5.0 using libbpf v1.5 (`bpftool prog show`
  segfaulted on this kernel — not investigated).
- BPF: `clang -g -O2 -target bpf -D__TARGET_ARCH_x86 -I$T/vmlinux/x86 -I$T -I$E -c bootstrap.bpf.c` → 30,376 B.
- `bpftool -w gen skeleton bootstrap.bpf.o > bootstrap.skel.h` (100,241 B).
- wasi-sdk 20 (`/tmp`, scratch): `clang -O2 --sysroot=.../wasi-sysroot -Wl,--allow-undefined,--export-table -o
  bootstrap.wasm bootstrap.c` → 72,984 B in 0.14 s; one warning (const void* → void* for s->data).
- `sudo wasm-bpf bootstrap.wasm` → prints EXEC/EXIT table (real output captured). `runqlat.wasm 1 2` → two
  histograms, exit 0.
- Rust runtime NOT built (no Rust toolchain; wasmtime 5 build would be long). Go/TinyGo and Rust guests not built.

## Packaging / deployment

- Docker: `docker run --rm -it --privileged -v $(pwd):/examples ghcr.io/eunomia-bpf/wasm-bpf:latest /examples/runqlat.wasm`
  (README); docs/build-image.md adds mounts of /sys/kernel/debug and /sys/fs/cgroup read-only.
- OCI: workflow runs `ecli-rs push -m $(ls *.wasm) ghcr.io/$REPO_OWNER/<example>:latest -a org.opencontainers.image.title=<example>`.
  ecli client `Push {module (-m, default app.wasm), image, annotations (-a)}` / `Pull {output (-o)}`; uses crate
  bpf-oci 0.1.0 `push_wasm_image`: one layer with media type `application/vnd.wasm.content.layer.v1+wasm`, config
  `application/vnd.wasm.config.v1+json` with data `{}` (constants from oci-distribution 0.9.4 manifest.rs).
  ecli run can pull an OCI ref and run it with `wasm_bpf_rs::run_wasm_bpf_module_async`.
- WasmEdge plugin `plugins/wasm_bpf` (WasmEdge repo; build with `-DWASMEDGE_PLUGIN_WASM_BPF:BOOL=TRUE`, needs libbpf
  >= 1.2), env `WASMEDGE_PLUGIN_PATH`. podman + crun fork (eunomia-bpf/crun branch enable_plugin,
  `./configure --with-wasmedge`) with `--platform=wasi/wasm`; prebuilt `ghcr.io/eunomia-bpf/wasm-podman:latest`.

## Paper / talk / standards

- Yusheng Zheng, Tong Yu, Yiwei Yang, Andrew Quinn. "Wasm-bpf: Streamlining eBPF Deployment in Cloud Environments
  with WebAssembly". arXiv:2408.04856 [cs.OS], 9 Aug 2024. https://arxiv.org/abs/2408.04856 (preprint; ACM template
  placeholder "Conference'17"). Claims: ~1386 lines Rust + 510 lines C++; micro-bench (Xeon E5-2697v2, kernel 6.6):
  map access 1885.26 ns Wasm vs 1117.43 native; ring buffer polling 3186.83 vs 1509.18 ns per event; start-up of
  bootstrap 0.176 (Wasm lightweight container) vs 0.656 (Docker) — units not stated in the table (presumably s);
  sizes e.g. bootstrap 72K wasm vs 1.3M docker, rust-bootstrap 1.7M, runqlat 92K. Also claims arch-aware pt_regs
  CO-RE relocation, automatic BTF download, automatic choice of bpftime for uprobes, ORAS — none of these found in
  the wasm-bpf repo code at the studied commit (`rg -il "bpftime|pt_regs|btfhub" runtime` → nothing outside
  third_party). Treat as paper-level claims.
- KubeCon + CloudNativeCon NA 2023, "eBPF + Wasm: Lightweight Observability on Steroids", Michael Yuan (WasmEdge)
  & Yusheng Zheng (eunomia-bpf), Thu Nov 9 2023 2:00–2:35pm CST, https://kccncna2023.sched.com/event/1R2uf ; slides
  PDF on hosted-files.sched.co. eunomia.dev write-up: https://eunomia.dev/others/miscellaneous/wasm-bpf-kubecon
- WASI issue #513 "WASI proposal for eBPF related API" by yunwei37, opened 2023-02-02, open.
  https://github.com/WebAssembly/WASI/issues/513
- WASI: https://github.com/WebAssembly/WASI, https://wasi.dev/ ; Component Model:
  https://github.com/WebAssembly/component-model, https://component-model.bytecodealliance.org/, WIT.md.
- Haas et al., "Bringing the Web up to Speed with WebAssembly", PLDI 2017, doi 10.1145/3062341.3062363.
- WALI: arXiv:2312.03858, current arXiv title "Empowering WebAssembly with Thin Kernel Interfaces" (cited in the
  wasm-bpf paper under its earlier title "Stop hiding the sharp knives: The WebAssembly Linux Interface").
- bpftime: arXiv:2311.07923.
