# Research notes — 09 · bpf-developer-tutorial

Repo: https://github.com/eunomia-bpf/bpf-developer-tutorial
Clone: /home/user/workspace/src/bpf-developer-tutorial (shallow, `--depth 1`)
**Commit studied: `110b91f87320a952c4c55dba1d6e8e3f814a789c`** (2026-09-05, "fix: keep GnuTLS and NSS probing enabled by default in sslsniff (#227)")
Survey date: 2026-11-06.

## Repo metadata (gh api, 2026-11-06)

- Description: "eBPF Developer Tutorial: Learning eBPF Step by Step with Examples"
- Homepage: https://eunomia.dev/tutorials/ (HTTP 200 checked with curl)
- Created 2022-12-02; MIT; 4334 stars, 607 forks, 26 open issues (incl. PRs); last push 2026-11-04 (branches).
- Top contributors: yunwei37 (189), github-actions[bot] (26), Littlefisher619 (17), xuruidong (13), Officeyutong (12).
- Gitee mirror: https://gitee.com/yunwei37/bpf-developer-tutorial (from README).

## Top-level layout

```
CLAUDE.md  LICENSE  README.md  README.zh.md  TUTORIAL_IDEAS.md  imgs/  scripts/  src/
.agents/skills/{bpf-tutorial-writing-style, find-bpf-tutorial-topic, test-bpf-tutorial-kvm, write-bpf-production-tutorial}
.claude/  .github/{ISSUE_TEMPLATE, check_links.py, workflows/}
```

- `src/` holds lessons: 55 numbered dirs `0-introduce` … `54-exec-image-inspector`, plus `features/` (bpf_arena, bpf_iters, bpf_token, bpf_wq, dynptr, struct_ops), `xpu/` (flamegraph, gpu-kernel-driver, npu-kernel-driver), `cgroup/`, `bpftrace-tutorial/`, `third_party/`, `Makefile`, `SUMMARY.md(.zh)`, `compatibility.md(.zh)`.
- `src/third_party/`: `blazesym` (submodule → libbpf/blazesym @ e4f0557f), `bpftool` (submodule → libbpf/bpftool @ 4222ef1c; its nested libbpf submodule checked out f5dcbae7), `libbpf` is a **symlink** to `bpftool/libbpf`, `vmlinux/` with per-arch headers: arm, arm64, loongarch, powerpc, riscv, x86 (e.g. `x86/vmlinux.h`, `x86/vmlinux_601.h`).
- `.gitmodules`: blazesym and bpftool only.
- `src/Makefile`: master Makefile finds `find . -mindepth 2 -maxdepth 2 -name Makefile` and runs `make -C` each.
- `git ls-files src`: 673 files; 67 README.md; 71 `*.bpf.c`; 68 README.zh.md (repo-wide).
- Bilingual: each lesson README.md + README.zh.md.

## Lesson metadata: `.config`

Each lesson has `.config` key=value: `level` (Basic|Advance|Depth), `type` (GPU, Scheduler, Networking, Tracing, Security, Features, Other, Android — Depth only), optional `desc`, `kernel_min`, `kernel_min_basis`, `architectures`, `btf`, `kernel_config`, `hardware`, `root`, `test_status` (ci-runtime, ci-build, not-in-ci, docs-only).
Example `src/44-scx-simple/.config`: level=Depth type=Scheduler kernel_min=6.12 ... CONFIG_SCHED_CLASS_EXT=y, test_status=ci-build.
Example `src/47-cuda-events/.config`: type=GPU, kernel_min=5.8, hardware=nvidia-cuda-gpu, architectures=x86_64, test_status=ci-build.

`scripts/generate_toc.py` builds README/SUMMARY TOC from `.config` + first `#` title; section order Basic, Advance, Depth; Depth subsection order GPU, Scheduler, Networking, Tracing, Security, Features, Other, Android. `scripts/generate_compatibility.py` builds `src/compatibility.md` table.
Observation: `32-wallclock-profiler/.config` has `level=Depth` but **no `type=`**, so it is not listed in the generated README index (checked: no "32-" entry in README). `bpftrace-tutorial` has no `.config` → also not in index.
SUMMARY.md: 65 bullet entries = 1 compat matrix + 64 lessons (Basic 11, Advance 11, GPU 4, Scheduler 2, Networking 7, Tracing 8, Security 8, Features 10, Other 2, Android 1).

## Index (README at 110b91f8)

Basic (ecc-based): 0-introduce, 1-helloworld, 2-kprobe-unlink, 3-fentry-unlink, 4-opensnoop, 5-uprobe-bashreadline, 6-sigsnoop, 7-execsnoop (perf event array), 8-exitsnoop (ring buffer), 9-runqlat, 10-hardirqs.
Advance (libbpf): 11-bootstrap, 12-profile (Rust, libbpf-rs 0.24 + blazesym), 13-tcpconnlat, 14-tcpstates, 15-javagc (USDT), 16-memleak, 17-biopattern, 18-further-reading, 19-lsm-connect, 20-tc, 21-xdp.
Depth:
- GPU: 47-cuda-events, xpu/flamegraph (CUPTI), xpu/gpu-kernel-driver (bpftrace scripts for drm scheduler, i915, amdgpu, nvidia, vblank), xpu/npu-kernel-driver.
- Scheduler: 44-scx-simple, 45-scx-nest.
- Networking: 23-http, 29-sockops, 41-xdp-tcpdump, 42-xdp-loadbalancer, 46-xdp-test, 50-tcx, 53-egress-pacer.
- Tracing: 30-sslsniff, 31-goroutine, 33-funclatency, 37-uprobe-rust, 39-nginx (bpftrace), 40-mysql (bpftrace), 48-energy, 52-fsession-latency.
- Security: 24-hide, 25-signal, 26-sudo, 27-replace, 28-detach, 34-syscall, 51-tcp-quarantine, 54-exec-image-inspector.
- Features: 35-user-ringbuf, 36-userspace-ebpf, 38-btf-uprobe, 43-kfuncs, features/{bpf_arena, bpf_iters, bpf_token, bpf_wq, dynptr, struct_ops}.
- Other: 49-hid, cgroup. Android: 22-android.
- Unindexed: 32-wallclock-profiler, bpftrace-tutorial.

kernel_min per lesson (from .config): 1→4.8, 2→5.2, 3→x86_64:5.5/arm64:6.0, 4→4.8, 8→5.8, 11→5.8, 19→5.7, 20/21→5.2, 35→6.1, 43→6.11, 44/45→6.12, 46→5.18, 47→5.8, 49→6.3, 50→6.6, 51→6.5, 52→7.0, 53→6.16, 54→6.19, bpf_arena 6.9, bpf_token 6.9, bpf_wq 6.10, dynptr 6.4, struct_ops unknown.

## Build systems

1. **eunomia-bpf (ecc/ecli)** for most Basic lessons and 19/20/21 (only `.bpf.c` + optional `.h`, no Makefile).
   From 1-helloworld README:
   - `wget https://aka.pw/bpf-ecli -O ecli && chmod +x ./ecli`
   - `wget https://github.com/eunomia-bpf/eunomia-bpf/releases/latest/download/ecc && chmod +x ./ecc`
   - `./ecc minimal.bpf.c` → "Compiling bpf object... Packing ebpf object and config into package.json..."
   - `sudo ./ecli run package.json`; docker: `docker run -it -v \`pwd\`/:/src/ ghcr.io/eunomia-bpf/ecc-\`uname -m\`:latest`
   - aarch64: ecc-aarch64 / ecli-aarch64.
   - Comments drive ecli: `/// @description "Process ID to trace"` → `--pid_target`; `/// @tchook {"ifindex":1, "attach_point":"BPF_TC_INGRESS"}`, `/// @tcopts {"handle":1, "priority":1}`; `/// @ifindex 1`, `/// @flags 0`, `/// @xdpopts {"old_prog_fd":0}`.
   - ecc with header: `ecc exitsnoop.bpf.c exitsnoop.h` → "Generating export types..." and ecli prints ringbuf events as columns.
2. **libbpf + bpftool skeleton** (libbpf-bootstrap style Makefile, e.g. `src/11-bootstrap/Makefile`): clang `-g -O2 -target bpf -D__TARGET_ARCH_$(ARCH)` → `.tmp.bpf.o` → `bpftool gen object` → `bpftool gen skeleton` → `.skel.h` → cc user program, link `libbpf.a -lelf -lz`. Uses `../third_party/vmlinux/$(ARCH)/vmlinux.h`, builds static libbpf and bootstrap bpftool from submodules. Optional blazesym via cargo.
   Deps (11 README): `sudo apt install clang libelf1 libelf-dev zlib1g-dev`; `git submodule update --init --recursive; make; sudo ./bootstrap`.
3. Rust (12-profile Cargo, libbpf-rs 0.24; 37-uprobe-rust cargo build), bpftrace `.bt` scripts (39, 40, 47, xpu/gpu-kernel-driver), CUDA `.cu` (47).
4. 44-scx-simple ships `include/scx/{common.bpf.h, compat.bpf.h, ...}`; README "Building" text says "Navigate to the kernel's tools/sched_ext/ directory and run: make" while the lesson also has its own Makefile (CI runs `make -C src/44-scx-simple`). Toolchain list: clang >= 16, pahole >= 1.25, rust >= 1.70. Run `./scx_simple -f` (FIFO), prints `local=... global=...`.
   scx_simple.bpf.c uses `scx_bpf_dispatch`, `scx_bpf_dispatch_vtime`, `scx_bpf_consume` (declared in its `include/scx/common.bpf.h`). Upstream renamed these in v6.13 to `scx_bpf_dsq_insert`, `scx_bpf_dsq_insert_vtime`, `scx_bpf_dsq_move_to_local` (kernel commits cc26abb1a19a, 5209c03c8ed2; see torvalds/linux tools/sched_ext/include/scx/compat.bpf.h). docs.ebpf.io says scx_bpf_consume alias was removed in v6.17. => Running unmodified lesson 44 on ≥6.17 not verified; likely to fail load. Mark as limitation, "per docs.ebpf.io".

## Local verification (this orb)

- Kernel 6.1.189+, Debian clang 14.0.6, libelf/zlib headers present.
- `git submodule update --init --recursive --depth 1 src/third_party/bpftool` then `make -j4` in `src/11-bootstrap`: built bpftool, libbpf, `bootstrap.bpf.o`, `bootstrap.skel.h` (116,660 bytes), binary `bootstrap`.
- `sudo timeout -s 2 3 ./bootstrap` printed header and EXEC/EXIT lines (e.g. `EXEC  git ... /opt/git/bin/git`, `EXIT  git ... [128] (1ms)`). Then `make clean`.
- Did not run ecc/ecli, XDP, LSM, sched_ext or CUDA lessons (no GPU; LSM/sched_ext need kernel config).

## CI (.github/workflows)

- `test-libbpf.yml` (name: "Test eunomia-bpf example CI", ubuntu-24.04): installs clang llvm libelf dwarves linux-headers-generic-hwe-24.04; `make -C` for 11–17, 23, 24, 26–30, 32–35, 38, 41–54, features/*, cgroup; runtime smoke with `sudo timeout -s 2 3` for 11, 13, 14, 16, 17, 23, 30, 35; 51 runs `sudo timeout 30 make -C src/51-tcp-quarantine test`; builds 43 kfunc module and struct_ops module against headers.
- `test-eunomia.yaml` (ubuntu-latest, go 1.17.13, `apt install clang llvm-14-dev llvm`): downloads ecc/ecli, compiles and runs lessons 1–10, 20, 23, 34, 25, 31 with `ecli run package.json`.
- `test-bpftrace.yml`: Rust 1.97 cargo build for 37 and a bpftrace uprobe attach test.
- `check-docs.yml`: unit tests for scripts, regenerate TOC/compat and `git diff --exit-code`, internal link check.
- `auto-generate-docs.yml`: on README/.config changes, runs generate_toc + generate_compatibility, commits "docs: auto-generate documentation".
- `trigger-sync.yml`: checks out eunomia-bpf/eunomia.dev, copies `src/*` into `website/docs/tutorials/`, SUMMARY → index.md, builds Next.js static export (`npm ci; npm run build`), then repository-dispatch `trigger-tutorial-sync` to eunomia.dev.

## Recent activity (gh api commits, PRs)

- 2026-09-05 #227 sslsniff GnuTLS/NSS default probing.
- 2026-07-24 "docs: streamline tutorial code excerpts"; 07-22 #223 exec image monitor, #225 "Make tutorials 50–53 safer to operate", docs improvements 50–54.
- 2026-07-20 #222 topic registry (TUTORIAL_IDEAS.md) + find-bpf-tutorial-topic skill; #220 "Add advanced eBPF tutorials 51–54 and tutorial agent skills"; 07-19 #218 repo-local agent skills.
- 2026-07-14: #211 fix verified examples, #215 stop tracking generated artifacts, #214 CI validate sync with Next.js site, #213 CI cover all libbpf Makefile tutorials, #212 compatibility matrix, #209 bilingual indexes, #210 Rust 1.97.
- 2026-03-11 #203 tcx + bpf token tutorials; 2026-02 dynptr TC demo, runqlat fix, fentry troubleshooting, Rust uprobe fix; 2026-01-31 cgroup guard lesson; 2025-11 struct_ops example with kernel module.
- Open PRs: #236 (2026-11-04) pin eunomia CI to Ubuntu 22.04 because ubuntu-latest (26.04) lacks llvm-14-dev (run 41256561216); #224 (2026-07-22) adds 55-dns-egress, 56-tc-flow-index, 57-oom-watch, 60-afxdp-dump (validated on Linux 7.2.0-rc4 per PR body); #231 dedup bpftime intro in 5/15/16/30; #235, #234, #229 Chinese doc fixes.
- TUTORIAL_IDEAS.md (last audit 2026-07-20): top candidates container-aware service dependency map (90), signed BPF program verification (88), io_uring latency (87), OOM pre-kill profile (85), AI-agent runtime audit (83), sk_lookup (82), LLM/MCP call timeline (81)...; watchlist tracing_multi, rhashtable map, sleepable tracepoints, libarena (Linux 7.2).

## Lessons read (code copied into chapter)

- 1-helloworld/minimal.bpf.c (tp/syscalls/sys_enter_write, bpf_printk, BPF_NO_GLOBAL_DATA).
- 2-kprobe-unlink/kprobe-link.bpf.c (kprobe/kretprobe do_unlinkat, BPF_CORE_READ(name, name)).
- 3-fentry-unlink/fentry-link.bpf.c (direct name->name). README claims fentry "about 10x faster than kprobes" — not verified, not repeated as fact.
- 4-opensnoop/opensnoop.bpf.c (const volatile pid_target, `/// @description`), ecli -h output.
- 8-exitsnoop (ringbuf reserve/submit, task->exit_code >> 8).
- 11-bootstrap bootstrap.bpf.c / bootstrap.c (hash map exec_start, rodata min_duration_ns, ring_buffer__new/poll).
- 19-lsm-connect (lsm/socket_connect, blocks 1.1.1.1 = 16843009, -EPERM; needs CONFIG_BPF_LSM and `bpf` in /sys/kernel/security/lsm).
- 20-tc tc.bpf.c (SEC("tc"), bounds checks, @tchook), 21-xdp xdp.bpf.c (XDP_PASS, packet size).
- 44-scx-simple scx_simple.bpf.c (struct_ops ops, SHARED_DSQ, vtime).
- 47-cuda-events cuda_events.bpf.c / cuda_events.c (uprobes on libcudart via bpf_program__attach_uprobe_opts with func_name; default `/usr/local/cuda/lib64/libcudart.so`; options -v -t -r -p -d). README bench: ~2 µs overhead per call (repo's own claim, quoted with attribution).
- 52-fsession-latency (fsession/vfs_read, bpf_session_cookie, Linux 7.0).
- 0-introduce: learning plan (5–7h intro, 10–15h dev).

## URLs

- https://github.com/eunomia-bpf/bpf-developer-tutorial/tree/110b91f87320a952c4c55dba1d6e8e3f814a789c
- https://eunomia.dev/tutorials/
- https://github.com/eunomia-bpf/eunomia-bpf (ecc/ecli)
- https://github.com/libbpf/libbpf-bootstrap
- https://github.com/iovisor/bcc/blob/master/docs/tutorial_bcc_python_developer.md (inspiration per README)
- https://docs.kernel.org/bpf/libbpf/program_types.html
- https://docs.kernel.org/scheduler/sched-ext.html
- https://docs.ebpf.io/linux/kfuncs/scx_bpf_consume/ (rename/alias removal)
- https://github.com/torvalds/linux/blob/master/tools/sched_ext/include/scx/compat.bpf.h
- https://docs.kernel.org/bpf/prog_lsm.html
- eGPU paper cited by lesson 47: https://dl.acm.org/doi/10.1145/3723851.3726984 (link from lesson README; not independently checked beyond that).
