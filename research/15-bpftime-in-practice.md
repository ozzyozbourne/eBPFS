# Research notes — Chapter 15: bpftime in practice

Studied: https://github.com/eunomia-bpf/bpftime at commit
`25e250d651ad1d2a2608bbbaeaf7b9ee90cca401` (2026-11-03, "refactor: use argparse for
bpftimetool commands (#719)"), local clone `/home/user/workspace/src/bpftime`.
Not built (per instructions). All commands below are copied from repo docs/source.

## Installation

- `installation.md`: docker image `ghcr.io/eunomia-bpf/bpftime:latest`
  (`docker run -it --rm --name test_bpftime -v "$(pwd)":/workdir -w /workdir ghcr.io/eunomia-bpf/bpftime:latest /bin/bash`).
- Dependencies (apt): `libelf1 libelf-dev libssl-dev zlib1g-dev make cmake git libboost-all-dev binutils-dev libyaml-cpp-dev ca-certificates clang llvm pkg-config llvm-dev`, then `git submodule update --init --recursive`. Tested on Ubuntu 23.04; gcc >= 12, clang >= 16.
- `make release JOBS=$(nproc)`; `export PATH=$PATH:~/.bpftime`. Makefile `release` = `cmake -Bbuild -DCMAKE_BUILD_TYPE:STRING=RelWithDebInfo -DBUILD_BPFTIME_DAEMON=1` + `cmake --build build --config RelWithDebInfo --target install -j$(JOBS)`.
- Installs into `~/.bpftime`: `bpftime`, `bpftime-vm`, `bpftimetool`, `bpftime_daemon`, `libbpftime-agent.so`, `libbpftime-agent-transformer.so`, `libbpftime-syscall-server.so` (installation.md list). tools/README also lists `bpftime-aot`.
- CMake options (installation.md): `BPFTIME_LLVM_JIT` (default ON), `BPFTIME_UBPF_JIT`, `ENABLE_EBPF_VERIFIER` (OFF), `BPFTIME_BUILD_WITH_LIBBPF`, `BPFTIME_BUILD_KERNEL_BPF`, `BPFTIME_BUILD_STATIC_LIB`, `BPFTIME_ENABLE_MPK`, `BPFTIME_ENABLE_IOURING_EXT`, `BPFTIME_ENABLE_CUDA_ATTACH` + `BPFTIME_CUDA_ROOT`, `BUILD_BPFTIME_DAEMON`.
- Dockerfile: ubuntu:24.04, clang-16/llvm-16, RelWithDebInfo, `-DBUILD_BPFTIME_DAEMON=1`, `make install`.
- Releases (gh api, 2026-11-06): v0.9.0 (2026-08-14), v0.2.0 (2025-10-02), v0.1.0 (2025-08-23), v0.0.3, v0.0.2. **No binary assets attached** to any of the five latest releases. `.github/workflows/docker.yml` pushes `ghcr.io/<owner>/bpftime` tagged with the release tag/version and creates the GitHub release. So "release binaries" = container image.

## bpftime CLI (tools/cli/main.cpp)

Global: `-i/--install-location` (default `$HOME/.bpftime`), `-d/--dry-run`.
Subcommands:
- `load COMMAND...` — LD_PRELOAD `libbpftime-syscall-server.so`. Options: `--no-jit`
  (BPFTIME_DISABLE_JIT), `--spdlog-level`, `--bpftime-log-output`, `--allow-external-maps`,
  `--fuzzy-backtracer`, `--memory-size` (MB), `--run-with-kernel-verifier`
  (BPFTIME_RUN_WITH_KERNEL), `--bpftime-not-load-pattern`.
- `start [-s|--enable-syscall-trace] COMMAND...` — LD_PRELOAD agent; with `-s` LD_PRELOAD is
  `libbpftime-agent-transformer.so` and `AGENT_SO=` points to the agent.
- `attach [-s] PID` — Frida `frida_injector_inject_library_file_sync(..., "bpftime_agent_main", ...)`.
- `detach` — opens shm, for each pid in alive agent set sends IPC "detach" and SIGUSR1.
- `trace [--pid PID | --pidof COMM] [--auto-refresh-ms N(default 500)] COMMAND...` — spawn loader
  with syscall-server (drops to target uid/gid when root), then IPC refresh to an existing agent
  (abstract unix socket `bpftime-agent-<pid>`) or Frida inject with arg
  `loader_pid=..;force_reinit=1;auto_refresh_ms=..;cuda_late_ptx_dir=...` (runs
  `cuobjdump --extract-ptx all` first). On Ctrl+C: detach agent first, then SIGINT loader.
- Library resolution prefers the build tree (`runtime/agent/`, `runtime/syscall-server/`,
  `attach/text_segment_transformer/`) when the binary runs from a build dir.

## Env vars (usage.md, runtime/src/bpftime_config.cpp)

BPFTIME_DISABLE_JIT, BPFTIME_USE_JIT (old), BPFTIME_RUN_WITH_KERNEL, BPFTIME_NOT_LOAD_PATTERN,
SPDLOG_LEVEL, BPFTIME_LOG_OUTPUT (default `~/.bpftime/runtime.log`; `console`),
BPFTIME_ALLOW_EXTERNAL_MAPS, BPFTIME_SHM_MEMORY_MB (1..10240), BPFTIME_MAX_FD_COUNT (default 6144),
BPFTIME_FRIDA_FUZZY_BACKTRACER, BPFTIME_HELPER_GROUPS (tokens `ufunc`,`kernel`,`shm_map`),
BPFTIME_VM_NAME, BPFTIME_VERIFIER_LEVEL (STRICT/WARNING/NO_VERIFY; default WARNING = verifier
failure is only a warning), BPFTIME_GLOBAL_SHM_NAME (default `bpftime_maps_shm`),
BPFTIME_GPU_ARRAY_GDRCOPY, BPFTIME_CUOBJDUMP, BPFTIME_CUDA_DEVICE, BPFTIME_ALLOW_PTRACE.

## bpftimetool (tools/bpftimetool/arguments.hpp, README.md)

Subcommands: `load <fd> <JSON>`, `export <filename>`, `import <filename>`, `remove`,
`run <id> <data_file> [repeat N] [type JIT|AOT|INTERPRET]` (also `--repeat`, `--type`),
`run-on-cuda <program> [count [gridX gridY gridZ blockX blockY blockZ]]` (CUDA builds).
**No `dump` subcommand exists**; `export` is the dump. Handler types in JSON:
bpf_map_handler, bpf_prog_handler, bpf_perf_event_handler, bpf_link_handler.
The README's "Performance Notes" (~100-500ns etc.) are not measurements; not quoted.

## Examples read

- example/malloc: malloc.bpf.c `SEC("uprobe/libc.so.6:malloc")`, hash map keyed by pid;
  malloc.c attaches with `bpf_program__attach_uprobe_opts(..., -1, "libc.so.6", 0, &opts)`.
  README in top-level shows `bpftime load ./example/malloc/malloc` / `bpftime start ./example/malloc/victim` / `sudo bpftime attach 101771`.
- example/tracing/opensnoop: bcc libbpf-tools opensnoop; tracepoints
  `syscalls/sys_enter_open[at]`, `sys_exit_open[at]`, perf event array output,
  `bpf_get_stack(..., BPF_F_USER_STACK)`. usage.md shows `bpftime load ./example/opensnoop/opensnoop` (path outdated; now example/tracing/opensnoop) and `bpftime start -s example/opensnoop/victim`.
- example/tracing/bashreadline: `SEC("uretprobe//bin/bash:readline")`, comm check, perf output.
- example/tracing/sslsniff: uprobes/uretprobes on SSL_write/SSL_read/SSL_do_handshake,
  gnutls_record_send/recv, PR_Write/PR_Send/PR_Read/PR_Recv. Run:
  `sudo LD_PRELOAD=.../libbpftime-syscall-server.so example/sslsniff/sslsniff` + `sudo LD_PRELOAD=.../libbpftime-agent.so wget https://www.google.com`.
- example/tracing/bpftrace: `sudo ~/.bpftime/bpftime load bpftrace -e 'uretprobe:/bin/bash:readline {...}'` + `sudo ~/.bpftime/bpftime start /bin/bash`; syscall: `bpftime start -s cat ...`. Tested with bpftrace commit 75aca47d.
- example/minimal: uprobe.bpf.c `SEC("uprobe/./victim:target_func")`; uprobe-override.bpf.c uses
  `bpf_override_return(ctx, 0)`; attach_override.h uses perf type `BPF_TYPE_UPROBE_OVERRIDE 1008`.
  syscall: `sudo ~/.bpftime/bpftime start -s example/minimal/victim` or
  `AGENT_SO=... LD_PRELOAD=build/attach/text_segment_transformer/libbpftime-agent-transformer.so`.
- example/error-inject, hotpatch/{redis,vim}, bpf_features/{bloom_filter_demo,get_stack_id_example,lpm_trie_demo,queue_demo,tailcall_minimal}, xdp-counter, attach_implementation (nginx), libbpftime_example, runtime_library (new, #700), otel-ebpf-profiler.
- example/gpu: cuda-counter (cuda_probe.bpf.c: `SEC("kprobe/_Z9vectorAddPKfS0_Pf")`/`kretprobe`, helpers 501–505 declared as `(void *)501`), kernelretsnoop, threadhist, launchlate, mem_trace, directly_run_on_gpu, rocm-counter, threadscheduling(_dynamic_hook) (helpers 509/510/511 sm/warp/lane id), gpu_shared_map, host_map_test, cudagraph, cutlass, faiss-test, llama-cpp-test, pytorch-test, atomizer, kernel_trace.
  Dynamic: `sudo BPFTIME_LOG_OUTPUT=console ./build/tools/cli/bpftime trace --pidof vec_add --auto-refresh-ms 500 example/gpu/threadscheduling_dynamic_hook/threadscheduling`.
- attach/nv_attach_impl: Frida hooks `__cudaRegisterFatBinary`, `__cudaRegisterFunction`,
  `__cudaRegisterFatBinaryEnd`, `cudaLaunchKernel`; extracts PTX, eBPF->PTX via LLVM, register
  guards, recompiles. `ATTACH_CUDA_PROBE = 8`, `ATTACH_CUDA_RETPROBE = 9` (nv_attach_impl.hpp:43-44).
  Option `BPFTIME_ENABLE_GDRCOPY`.
- GPU map types (runtime/include/bpftime_shm.hpp): GPU_MAP_OFFSET=1500; GPU_HASH_MAP, PERGPUTD_ARRAY_MAP,
  GPU_ARRAY_MAP, GPU_KERNEL_SHARED_ARRAY_MAP, GPU_RINGBUF_MAP, PERGPUTD_ARRAY_HOST_MAP, GPU_ARRAY_HOST_MAP.
- eGPU repo (github.com/eunomia-bpf/eGPU) says "merged into bpftime".

## Map types handled (runtime/src/handler/map_handler.cpp switch)

HASH, ARRAY, PROG_ARRAY, PERF_EVENT_ARRAY, PERCPU_HASH, PERCPU_ARRAY, STACK_TRACE, LRU_HASH,
LPM_TRIE, ARRAY_OF_MAPS, QUEUE, STACK, RINGBUF, BLOOM_FILTER; kernel-user
(KERNEL_USER_MAP_OFFSET=1000): KERNEL_USER_HASH, _ARRAY, _PERCPU_ARRAY, _PERF_EVENT_ARRAY;
GPU types under `BPFTIME_ENABLE_CUDA_ATTACH`.

## Helpers (runtime/src/bpf_helper.cpp groups)

kernel group: probe_read, get_smp_processor_id, csum_diff, xdp_adjust_head, xdp_adjust_tail,
probe_read_kernel, probe_read_user, ktime_get_ns, ktime_get_boot_ns, trace_printk,
get_prandom_u32, get_current_pid_tgid, get_current_uid_gid, get_current_comm, override_return,
strncmp, probe_write_user, set_retval, probe_read_user_str, probe_read_str, get_stack,
get_stackid, ktime_get_coarse_ns, ringbuf_reserve/submit/discard/output, perf_event_output,
tail_call, get_attach_cookie, get_func_ip.
shm_maps group: map_lookup/update/delete/push/pop/peek_elem. ufunc group: `__ebpf_call_find_ufunc_id`, `__ebpf_call_ufunc_dispatcher`.
Note: no bpf_get_current_cgroup_id in kernel group (the malloc README prose mentions cgroup but the code uses pid).

## Kernel-user mixed mode

- `BPFTIME_RUN_WITH_KERNEL=true` in syscall-server: BPF_MAP_CREATE goes to the real kernel, bpftime
  records type + 1000 (kernel-user map) (runtime/syscall-server/syscall_context.cpp ~L493-527).
  Programs verified by kernel verifier; `BPFTIME_NOT_LOAD_PATTERN` skips kernel load for some.
- daemon/: `bpftime_daemon` uses kernel eBPF (kernel/bpf_tracer.bpf.c) to trace bpf(),
  perf_event_open(), ioctl() and redirects uprobe programs to userspace. Options from
  daemon/user/main.cpp: -p/--pid, -u/--uid, -o/--open, -v/--verbose, -w/--whitelist-uprobe.
  Run: `sudo SPDLOG_LEVEL=Debug build/daemon/bpftime_daemon`, then `sudo example/malloc/malloc`, then `bpftime start example/malloc/victim`.

## XDP / DPDK / nginx

- example/xdp-counter: `LD_PRELOAD=build/runtime/syscall-server/libbpftime-syscall-server.so example/xdp-counter/xdp-counter example/xdp-counter/.output/xdp-counter.bpf.o veth1 example/xdp-counter/base.btf`; only bpf_link XDP attach supported. runtime/extension/userspace_xdp.h.
- XDP-eBPF-in-DPDK repo: **archived** (gh api). Nginx-eBPF-module: last push 2024-01-14.
- uXDP paper: "uXDP: Frictionless XDP Deployments in Userspace", Zheng, Gavriil, Kogias, eBPF '25 workshop (SIGCOMM 2025), DOI 10.1145/3748355.3748360.
- example/attach_implementation: nginx module filtering URL prefix, controller + adaptor + module.
  Build: `cmake -DBPFTIME_LLVM_JIT=0 -DCMAKE_BUILD_TYPE:STRING=Release -DBUILD_ATTACH_IMPL_EXAMPLE=YES -B build -S .` + `cmake --build build --config Release --target attach_impl_example_nginx -j$(nproc)`.

## Benchmark numbers (as reported in repo)

- benchmark/uprobe/example_results.md (2025-04-30, Linux 6.11, Intel Core Ultra 7 258V, ns):
  uprobe kernel 2561.57 vs userspace 190.02 (13.48x); uretprobe 3019.45 vs 187.10 (16.14x);
  uprobe+uretprobe 3119.28 vs 191.63 (16.28x). __bench_read 25865.43 vs 1653.45; __bench_write
  26478.92 vs 1542.49. hash_map_lookup kernel 12375.69 vs userspace 22152.81 (slower);
  per_cpu_hash_map_update 35580.60 vs 76526.24 (slower); hash_map_update 53376.22 vs 23992.67.
- benchmark/syscall/example_results.md (2025-04-30, Linux 6.11): native 404.44 ns, kernel
  tracepoint 438.92 ns, userspace 484.65 ns (mean of 10 runs). benchmark/syscall/README.md (2023,
  i7-11800H, 6.2): baseline 213.62, userspace 446.20, kernel tracepoint 365.45 ns.
  => syscall tracing in userspace is NOT faster than kernel tracepoints in these numbers.
- benchmark/gpu/README.md (10,000 iterations): P40 baseline 51.8 μs, bpftime 81.1 μs (1.56x), NVBit
  174.4 μs (3.37x); RTX 5090 4.1 / 8.2 (2.0x) / 55.8 (13.6x).
- example/attach_implementation/benchmark/example_benchmark_results.json (2025-05-12, wrk 30s, 64
  conns, 8 threads, 20 iterations): rps no_module 4536.86, baseline C 4559.84, bpftime 4461.00,
  wasm 4008.00, lua 3982.76, rlbox 4148.58, erim 4024.11; overhead vs no_module bpftime 1.67%,
  wasm 11.66%, lua 12.21%, rlbox 8.56%, erim 11.30%. Std dev ~1000 rps (large).
- benchmark/ssl-nginx/README.md: claims kernel sslsniff "lead to a 2x performance drop" of nginx (qualitative; no table quoted).

## Recent commits (gh api, 50 latest, 2026-08-01 .. 2026-11-03)

Themes: bpftimetool argparse (#719), runtime library example (#700), ringbuf record contiguity
(#706), BPFTIME_LOG_OUTPUT in tools (#694), epoll readiness (#689), CUDA __constant__/__device__
globals after probe attach (#695), trap-based uprobe backend for archs without Frida/riscv64
(#665, #674), get_stack semantics (#663, #631), handler fd bounds (#671), hash map fixes (#650,
#658), syscall-trace clone/clone3 (#649), GB300 sm_103 + CUDA 13 (#647), no-fault probe memory
copies (#642), preload fail-open (#640), fuzzy backtracer (#633), host-process contract docs
(#634), preload logging off host stdio (#632), daemon fixes (#662, #651, #687, #586), OTel profiler
mirror (#623). Open PRs: #720 host-side CUDA API uprobe trace, #705 reject unregistered helper
calls at load time, #702 signal-handler-based probe_read/write, #661 QNX 8.0 aarch64 port,
#624 conservative GPU SIMT verification, #545 experimental macOS build.

## Papers / URLs

- OSDI '25: "Extending Applications Safely and Efficiently", Zheng, Yu, Yang, Hu, Lai, Williams, Quinn — https://www.usenix.org/conference/osdi25/presentation/zheng-yusheng (200 OK).
- arXiv 2311.07923 "bpftime: userspace eBPF Runtime for Uprobe, Syscall and Kernel-User Interactions" (200 OK).
- eGPU HCDS '25 https://dl.acm.org/doi/10.1145/3723851.3726984 (ACM 403 for curl; confirmed via search).
- uXDP eBPF '25 https://dl.acm.org/doi/10.1145/3748355.3748360 (confirmed via search).
- zpoline ATC '23 https://www.usenix.org/conference/atc23/presentation/yasukata (200 OK).
- LPC 2023 talk https://lpc.events/event/17/contributions/1639/ (200 OK).
