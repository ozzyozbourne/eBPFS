# Research notes — Chapter 10: eunomia-bpf, ecc and ecli

Survey date: 2026-11-06. All clones in `/home/user/workspace/src/` (`--depth 1 --filter=blob:limit=2m`).

## Commits studied

| Repo | Default branch | HEAD studied | HEAD date |
|---|---|---|---|
| eunomia-bpf/eunomia-bpf | master | a5408a8c3614bd4e008c1f999bb4ee9738e2fc41 | 2026-08-09 |
| eunomia-bpf/eunomia-template | main | 739efb3d0ca3dfc1a4e9bbb8a9429147c91a1fb9 | 2026-09-16 |
| eunomia-bpf/ecli-webui | main | 6816d61b0319590d44d684828e8b5e6b644da5db | 2026-09-07 |
| eunomia-bpf/homebrew-tap | main | aefe55a345b0f806512a10d9adc62cdef1bb622e | 2026-09-16/17 |

Comparison: libbpf/libbpf-bootstrap @ 820a1bd (already cloned for ch06).

## Activity (gh api repos/eunomia-bpf/<repo>/commits)

- eunomia-bpf: last commits 2026-08-09 are dependabot bumps (tar, openssl, rpassword, rand). Last
  substantive work 2026-03-06..08: "ecli: remove legacy remote HTTP mode (#377)", "compiler: share
  clang args with document parser (#378)", "Consolidate ecli/ecc release version coordination (#390)",
  "ci: test on aarch64 (#174)". 908 stars, not archived. Dependabot wasmtime update runs failing
  Oct–Nov 2026; CodeQL weekly passing.
- Releases: v1.0.34 … v1.0.38 all published 2026-03-07/08. v1.0.38 assets: ecc 8,053,152 B,
  ecc-aarch64, ecli 11,895,200 B, ecli-aarch64, ecli tarball. v1.0.37 ecc was 65,692,064 B
  (bundles libclang).
- eunomia-template: 2023 history, then 2026-07-19 "fix: allow release workflow to publish (#5)" and
  2026-09-16 "Pin the release action to a version that uploads before publishing". Release v0.0.5
  (2026-07-19) has **no assets**; v0.0.4 / v0.0.3 (2023) have `package.json` (16,898 B). Last two
  Actions runs (2026-07-19) both failed; no run listed for the Sept commit.
- ecli-webui: burst 2026-09-06/07: "refactor: remove remote http api logic and dependencies",
  "fix: resolve target arch macro, filename struct member, and async loading race condition",
  "fix(build): pin pnpm 10.34.5 and vendor custom BPF llvm-box pack", docs online-compile.md.
  Homepage https://ecli-webui.vercel.app (HTTP 200).
- homebrew-tap: only `Formula/agentsight.rb` (v1.0.31). README "Planned formulae": bpftime,
  actplane, wasm-bpf. **No ecc or ecli formula.**

## Architecture facts (from code)

### Top level (eunomia-bpf)
- `bpf-loader-rs/` workspace: `bpf-loader-lib` (v0.2.1; libbpf-rs 0.20.1, btfdump, bpf-compatible-rs,
  blazesym), `bpf-loader-cli`, `bpf-loader-c-wrapper` (C ABI; `eunomia-bpf.h`; builds libeunomia.a).
- `compiler/cmd/` → binary `ecc-rs` (crate version 0.3.4). Modules: main.rs, config/{mod,options}.rs,
  bpf_compiler/{mod,standalone}.rs + standalone_bpf_loader.template.c, document_parser.rs (libclang via
  `clang` crate), export_types.rs, wasm.rs, helper.rs. build.rs clones eunomia-bpf/bpftool @ 8ae6b98 and
  eunomia-bpf/vmlinux @ 933f83b, builds bpftool, embeds a "workspace" (bin/bpftool, include/bpf,
  include/vmlinux/<arch>) via rust-embed; unpacked into a TempDir at each run.
- `ecli/` workspace: `ecli-lib` (0.2.9; features native-client → bpf-loader-lib, wasm-bpf-rs 0.3.2,
  bpf-compatible-rs; uses bpf-oci 0.1.0, reqwest) and `client` (binary `ecli-rs`, 0.2.9).
- `eunomia-sdks/` eunomia-rs, eunomia-otel (Prometheus/OTel exporter).
- `examples/bpftools/` bashreadline bootstrap fentry-link kprobe-link lsm-connect mdflush minimal
  opensnoop profile runqlat sigsnoop tc tcpstates xdp; `examples/tests`, `examples/simple-runner-rs`.
- `internal-docs/` POSITIONING.md (Oct 2025 marketing/competitor analysis — BumbleBee, bpfman),
  `spec/` with an older package.json/client.skel.json whose `export_types` is `{export_btf, structs}`
  — **does not match** the current loader's `Vec<ExportedTypesStructMeta>`; treat as historical.
- `third_party/` submodules bpftool (eunomia fork), vmlinux.

### ecc pipeline (compiler/cmd/src/bpf_compiler/mod.rs `compile_bpf`, `do_compile`)
1. If an export header is given: copy source to `temp.c`, append for each `struct X {` found by regex
   `struct\s+(\w+)\s*\{` in the header: `const volatile struct X * __eunomia_dummy_X_ptr __attribute__((unused));`
   (export_types.rs) — forces BTF emission of the struct.
2. clang `-g -O2 -target bpf -Wno-unknown-attributes -D__TARGET_ARCH_<arch>` + `-idirafter` sys includes
   + workspace includes + `-a` flags + source dir; then `llvm-strip -g`.
3. `bpftool gen skeleton <obj> -j` (eunomia fork's JSON mode) → `bpf_skel` (data_sections, maps, progs, obj_name).
4. document_parser: libclang parses the source; doc comments on .rodata/.bss vars, maps, progs and on
   `LICENSE` are merged into JSON. `@cmd text` → key cmd; text that parses as JSON is stored as JSON.
   e.g. `/// @sample {"interval": 1000}` on a map; `/// @cmdarg {...}` on a variable; `/// @ifindex 1`
   on XDP prog; LICENSE comment → `doc` (brief/details/version/description).
5. `bpftool btf dump file <obj> format c -j` → structs filtered to names in header → `export_types`.
6. `eunomia_version` = CARGO_PKG_VERSION. Write `<name>.skel.json` (or .skel.yaml).
7. `pack_object_in_config`: zlib(ELF) → base64 → package.json `{bpf_object, bpf_object_size, meta}`.
8. optional: `--standalone` (needs `$XDG_DATA_HOME/eunomia/libeunomia.a`; embeds package.json bytes
   into C template, `clang -static`); `--wasm-header` → `ewasm-skel.h` with `char* program_data = "..."`;
   `-b/--btfgen` → git clone btfhub-archive, `bpftool gen min_core_btf` per BTF, tar with package.json.
- Note: the compiler README says `/// @export` annotation; code does **not** look for `@export` — it uses
  the header file's struct names. README also shows `ecli push package.json ...` (not valid; push takes
  `--module app.wasm`). Top-level examples/README mentions `xdp_drop.bpf.c`, `--interface eth0`,
  `--duration 30` that do not exist in the code. Used per-example READMEs and code instead.

### Package format (bpf-loader-lib/src/meta/mod.rs)
- `ComposedObject` JSON: `bpf_object` (base64 of zlib), `bpf_object_size` (checked after inflate:
  "Unmatched size"), `meta: EunomiaObjectMeta`.
- EunomiaObjectMeta: export_types (Vec of {name, members[{name,type}], size, type_id}), bpf_skel,
  perf_buffer_pages=64, perf_buffer_time_ms=10, poll_timeout_ms=100, debug_verbose, print_header,
  enable_multiple_export_types=false.
- MapMeta: name, ident, mmaped, sample {interval ms, type log2_hist|linear_hist|default_kv, unit "(unit)",
  clear_map}, export_config (no_export | btf_type_id | custom_members | default), intepreter
  (default_struct | stack_trace{field_map, with_symbols}).
- ProgMeta: name, attach, link, flattened others (XDP: ifindex default 1, flags, xdpopts; TC: tchook
  {ifindex 1, attach_point BPF_TC_INGRESS}, tcopts {handle 1, priority 1}).

### Loader (skeleton/builder.rs, preload/mod.rs, mod.rs)
- build(): BTF source priority: btf_archive_path (if /sys/kernel/btf/vmlinux missing/unreadable) →
  env `BTF_FILE_PATH` → /sys/kernel/btf/vmlinux; else error. `bpf_object__open_mem`. Extracts program's
  own BTF into BtfContainer; records map value sizes.
- load_and_attach(): fill .rodata/.bss initial values from metadata+CLI (section_loader), `load()`,
  `attach()` for each prog; EOPNOTSUPP (95) → manual attach for `tc`, `xdp`, `perf_event`.
- wait_and_poll (single export mode): iterate maps; `sample` → SampleMap poller; RingBuf → ringbuf poller;
  PerfEventArray → perf poller; if export map found but `export_types` empty → error "Export map named
  ... found, but no export type is provided". No export map → just wait.
- checker.rs: export struct verified against program BTF by type_id/name/member count; bitfields rejected.
- arg_builder.rs: clap Command from data_section vars (skips `__eunomia_dummy*`); bool → `--x`,
  `--enable-x`, `--disable-x`; `--verbose` added; doc → version/before_help/after_help.

### ecli (client/src/main.rs, ecli-lib/src/runner/helper.rs, task_manager)
- Subcommands run / push / pull; legacy positional command line still accepted.
- `run [-j] [-p json|tar|wasm] <prog> [args...]`.
- try_load_program_buf_and_guess_type: local file (type by suffix .json/.wasm/.tar) → else URL
  (reqwest GET) → else OCI ref via `bpf_oci::pull_wasm_image` anonymous → **always WasmModule**.
- push: `--module app.wasm` (default) + image ref; auth: `-i` prompt, `-u/-p`, else ~/.docker/config.json,
  else anonymous; `-a key=value` annotations. pull: `-o app.wasm` default.
- task manager: Tar → unpack (bpf-compatible-rs) → JSON + BTF archive dir; JSON → build arg parser,
  fill vars, BpfSkeletonBuilder in a thread; Wasm → wasm_bpf_rs::run_wasm_bpf_module_async.
- Legacy HTTP server/client mode removed (#377, March 2026); preserved on `archive/ecli-remote-http`.

### OCI
- ghcr.io/eunomia-bpf/execve:latest manifest (fetched with anonymous token): config mediaType
  `application/vnd.wasm.config.v1+json` (size 2), single layer `application/vnd.wasm.content.layer.v1+wasm`
  size 37,392, annotation `org.opencontainers.image.title: execve`.

### GitHub Pages / examples publishing
- `.github/workflows/example-publlish.yml` builds assets with `.github/scripts/build-gh-pages-assets.sh`
  (ecc every example; sigsnoop Wasm via build.sh; opensnoop passthrough Wasm with `--wasm-header` +
  wasi-sdk clang `--target=wasm32-wasi ... -Wl,--export=bpf_main -Wl,--export=process_event`), deploys
  examples/bpftools to gh-pages.
- Checked 2026-11-06: https://eunomia-bpf.github.io/eunomia-bpf/bootstrap/package.json,
  .../sigsnoop/package.json, .../opensnoop/app.wasm all **HTTP 404**; gh-pages `bootstrap/` contains only
  .gitignore README.md bootstrap.bpf.c bootstrap.h. A branch `copilot/fix-ecli-404-issue` exists. Docs
  call the URL "historical GitHub Pages workflow, kept for compatibility".
- `https://aka.pw/bpf-ecli` → 302 to releases/latest/download/ecli.

### eunomia-template
- Files: src/template.bpf.c + template.h (bootstrap clone), Makefile (`cd src && ecc template.bpf.c template.h`),
  dockerfile (FROM ghcr.io/eunomia-bpf/ecc-x86_64:latest, downloads ecli, `make build`, ENTRYPOINT ecli,
  CMD run src/package.json), flake.nix/.envrc, devcontainer.
- publish.yml: on push; compute next version tag via github-script (increment patch of latest release);
  apt deps; wget latest ecc; `cd src && ../ecc template.bpf.c template.h`; softprops/action-gh-release@v3
  uploads src/package.json on main. docker.yml builds/pushes ghcr.io/<owner>/eunomia-template:latest.

### ecli-webui
- Vue 3 + Vite + Tailwind + Monaco; Emception (`emception` ^1.0.15, patched) running clang as Wasm in browser;
  also lists @yowasp/clang dependency. Headers in public/bpf_headers (vmlinux.h, bpf/*.h) written to MEMFS.
- Compile (src/views/MainView.vue ~L412): `/usr/bin/clang -g -O2 -target bpf -D__TARGET_ARCH_x86 -I/ -c /<main> -o /main.bpf.o`.
- Package built in JS: `bpf_object = btoa(raw ELF)` (no zlib), `bpf_object_size`, meta.bpf_skel
  {data_sections:[], maps:[], progs:[]} (no obj_name), eunomia_version "0.1.0"; then base64-encoded again
  for the download button.
- Experiment (Python replica of that JSON with the orb-built bootstrap.bpf.o, run with ecli v1.0.38):
  `Malformed json provided: missing field obj_name`; with obj_name added:
  `Malformed compressed data: unknown ZLIB method CM=0xf`. So the downloaded package would not load in
  current ecli as written. Web app itself not run in a browser.

## Hands-on in the orb (kernel 6.1.189+, x86-64, Debian clang 14.0.6, sudo available)
- Downloaded v1.0.38 ecc + ecli (static AppImage-style ELFs). `ecc --version` → `ecc-rs 0.3.4`.
- v1.0.38 ecc compile of bootstrap fails in doc-parsing: `Failed to load libclang dynamically at runtime:
  ... /tmp/.mount_eccXXXX/lib/x86_64-linux-gnu/libc.so.6: version GLIBC_2.36 not found (required by
  /lib/x86_64-linux-gnu/libLLVM-14.so.1)`. (bundled glibc older than host libLLVM's need.)
- v1.0.37 ecc (65 MB, bundles libclang) works: output
  `Compiling bpf object... / Generating export types... / Generating package json.. / Packing ebpf object and config into package.json...`
  Files: bootstrap.bpf.o (30,744 B), bootstrap.skel.json (951 B), package.json (16,928 B;
  base64 field 15,928 chars). Export struct event size 168, type_id 314, exit_event type `unsigned char`.
  rodata map name truncated: `bootstra.rodata`, obj_name `bootstrap_bpf`.
- `sudo ecli run /abs/path/package.json` works: header `TIME PID PPID EXIT_CODE DURATION_NS COMM FILENAME EXIT_EVENT`,
  rows of exec/exit events; `-j` gives JSON lines e.g.
  `{"comm":"curl","duration_ns":280495571,"exit_code":0,"exit_event":1,"filename":"","pid":36093,"ppid":36092}`;
  `--min_duration_ns 200000000` accepted (log shows bytes `[0, 194, 235, 11, 0, 0, 0, 0]`).
- `ecli run package.json -h` output: "A simple eBPF program / Usage: prog [OPTIONS] / --verbose /
  --min_duration_ns <min_duration_ns> Set value of `unsigned long long` variable min_duration_ns / -h / -V".
  (Note: wrapped in an error "Failed to parse argument:" because clap's help is returned as an error.)
- Relative paths under `sudo` were unreliable in this orb (sometimes fell through to OCI:
  `Not authorized: url https://registry-1.docker.io/v2/library/package.json/manifests/latest` or
  `invalid reference format`); absolute paths always worked. Cause not investigated (gVisor + AppImage FUSE?).
- runqlat compiled and ran; log2 histograms printed every second with `key = 4294967295`, `comm = ...`, `(unit)`.
- xdp: progs metadata got `"ifindex": 1, "flags": 0, "xdpopts": {"old_prog_fd": 0}` from doc comments;
  `--wasm-header` produced ewasm-skel.h (1,630 B) beginning `char* program_data = "{\"bpf_object\":\"eJyt...`.
- `ecli pull -o execve.wasm ghcr.io/eunomia-bpf/execve:latest` (no root) → 37,392-byte "WebAssembly (wasm)
  binary module version 0x1 (MVP)". Did not run the Wasm module.
- Did not test: push (no registry creds), --standalone (no libeunomia.a), -b btfgen (large btfhub clone),
  aarch64, Docker images.
- Temporary files in /tmp/ecl-bin, /tmp/ecl-work, /tmp/ecl-oci, /tmp/ecl-web deleted after the run.

## libbpf-bootstrap comparison
- libbpf-bootstrap @ 820a1bd: examples/c/bootstrap.c 172 lines (argp_parse, signal handlers,
  ring_buffer__new + handle_event printf), bootstrap.bpf.c 111, bootstrap.h 19, plus Makefile.
- eunomia examples/bpftools/bootstrap/bootstrap.bpf.c 110 lines: whitespace-only diff vs libbpf-bootstrap's.

## Docs / references verified (HTTP 200 or read)
- https://eunomia.dev/eunomia-bpf/ (last updated Mar 8 2026), /introduction/, /architecture/, /ecc/usage/,
  /ecc/github-template/, /online/, /ecli/, /supporting-external-BTF/, /setup/.
- Intro page claims "library itself <1MB", "<100ms" load: **project claims, not measured here**.
- Paper: Yusheng Zheng, Tong Yu, Yiwei Yang, Andrew Quinn, "Wasm-bpf: Streamlining eBPF Deployment in Cloud
  Environments with WebAssembly", arXiv:2408.04856, 9 Aug 2024. https://arxiv.org/abs/2408.04856
- Blog/talk text: "Securing and Simplifying eBPF Deployments with WebAssembly",
  https://eunomia.dev/others/miscellaneous/wasm-bpf-kubecon (venue not confirmed on sched; cite as eunomia.dev post).
- KubeCon EU 2025 "eBPF and Wasm: Unifying Userspace Extensions With Bpftime" (sched page verified) — bpftime, not ecc.
- Related: solo-io/bumblebee (OCI eBPF packaging, `bee`), bpfman, aquasecurity/btfhub, BTFGen.
- Emception: https://github.com/jprendes/emception (vendored under build-llvm/emception).
