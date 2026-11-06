# Research notes — Chapter 22: xpu-perf

## Sources studied

- Repo: https://github.com/eunomia-bpf/xpu-perf, commit `b4fcc885875aacfc7c4605ee5458cea49e9e6672`
  (2026-09-17, "Install the libbpf headers the profiler build needs, and stop publishing before uploading").
  Cloned with `--filter=blob:limit=2m` to `/home/user/workspace/src/xpu-perf`, then unshallowed for history.
  173 commits total, first commit 2025-06-07. GitHub: 27 stars, 3 forks, MIT, topics `ebpf`, `gpu`,
  description "Continuous profiler for GPU & CPU with eBPF". README says **"WIP， not finished yet!!!"**.
- Submodule `profiler/opentelemetry-ebpf-profiler` -> https://github.com/eunomia-bpf/opentelemetry-ebpf-profiler
  pinned at `e19d3e80f7f74f2c5a89e0304ddccc8a4c777107` (2025-11-10). Cloned to
  `/home/user/workspace/src/otel-ebpf-profiler-fork`. Fork-specific commits on top of upstream `a47b46a` (Move config validate #897):
  - `0b6df71` "Enhance trace context handling: update OffTime to context_value, add custom trace program support" —
    adds `support/ebpf/custom_trace.ebpf.c`, `TRACE_CUSTOM` origin in `types.h`, renames `Trace.offtime` -> `context_value`,
    loads `custom__generic` in `tracer/tracer.go` and adds `GetCustomTraceProgramFD()` / `GetCustomContextMapFD()`.
  - `e19d3e8` rename OffTime -> ContextValue across host/reporter.
  - (`2689a43` "Update arm64 eBPF tracer object" is after the pinned commit.)
- Related tutorial repos (READMEs via `gh api`):
  - https://github.com/eunomia-bpf/cupti-tutorial — "Tutorials for NVIDIA CUPTI samples", 76 stars, pushed 2026-07-22.
    Covers Activity API, Callback API, Event API, Metric API, Profiling API; tutorials activity_trace, activity_trace_async,
    callback_event, callback_timestamp, callback_metric, cupti_query, event_sampling, pc_sampling, sass_source_map,
    unified_memory, nvlink_bandwidth, openacc_trace, userrange/autorange profiling. Samples come from NVIDIA's CUPTI samples.
  - https://github.com/eunomia-bpf/nvbit-tutorial — "The tutorial document for NVBit samples (Based on NVBit-1.7.5)", 12 stars,
    pushed 2026-03-02. Quick start: `LD_PRELOAD=./tools/instr_count/instr_count.so ./test-apps/vectoradd/vectoradd`.
    NVBit inspects/modifies SASS at load time; requires nvdisasm on PATH; SM 3.5–12.1.

## What xpu-perf is (current code, `profiler/`)

Go program (module `github.com/eunomia-bpf/xpu-perf`, go 1.24.0) that:
1. Embeds `libcupti_trace_injection.so` (`embedded_resources.go`, `//go:embed`), extracts to
   `$TMPDIR/xpu-perf/libcupti_trace_injection_<pid>.so`.
2. Creates FIFO `/tmp/cupti_trace_<pid>.pipe` (`createNamedPipe`), goroutine parses JSON lines from it (`cupti_parser.go`).
3. Loads the OTel eBPF profiler tracer (`tracer.NewTracer`) with `SamplesPerSecond: 50`, `LoadProbe: true`, `OffCPUThreshold: 0`.
4. Non-gpu modes: `trc.AttachTracer()` (perf_event CPU clock per online CPU, `native_tracer_entry`) + `EnableProfiling()`.
5. Attaches uprobes via `UprobeAttacher` interface:
   - `CorrelationIdUprobeAttacher` (default in gpu/merge since `-use-correlation-id` defaults to **true**): loads
     `ebpf/correlation_uprobe.ebpf.c` (bpf2go, `-target amd64`), reuses profiler's `custom_context_map` via
     `MapReplacements`, puts `custom__generic` FD in its own `prog_array[0]`, uprobe on
     `<extracted lib>:XpuPerfGetCorrelationId`.
   - `CudaKernelUprobeAttacher` (`-use-correlation-id=false`): `ldd` target to find libcudart, `nm -D` target for
     undefined `cudaLaunchKernel*` symbols, `trc.AttachUProbes(["<libcudart>:<sym>"...])`; fallback list hard-codes
     `/usr/local/cuda-12.9/...`, `/usr/local/cuda-13.0/...`, `/usr/local/cuda/...`.
6. Starts target with env `CUDA_INJECTION64_PATH=<lib>`, `CUPTI_TRACE_OUTPUT_FILE=<fifo>`, `CUPTI_ENABLE_MEMORY=1`,
   plus `CUPTI_ENABLE_CORRELATION_UPROBE=1` when correlation-ID mode. CPU mode: no injection.
7. Reporter (`simple_reporter.go`) filters: sampling traces only from target PID (cpu/merge); uprobe/custom traces in gpu/merge;
   drops uprobe traces with empty stacks; `meta.ContextValue` -> correlation ID.
8. After target exits: sleep 200 ms + 500 ms, `correlator.CorrelateTraces()`, `WriteFoldedOutput(-o)`.

CLI (main.go `parseFlags`, since commit `275f2f2` 2025-11-16): `xpu-perf <cpu|gpu|merge> [options] <target> [args]`,
flags `-o` (default `merged_trace.folded`), `-cupti-lib`, `-cuda-lib`, `-debug-dir`, `-use-correlation-id` (gpu/merge only,
default true). Must run as root (checked after flag parsing so `--help` works unprivileged). Launches the target itself;
there is no attach-to-PID option.

NOTE: `profiler/README.md` still documents the older flag style (`./profile -gpu-only ...`, `-cpu-only`) and says symbol
lookup uses "binary search"; `symbolizer.go` actually does a linear `VisitSymbols` scan per lookup. `profiler/Makefile`
`test` target still uses `--gpu-only` (would hit "Unknown command"). Top-level README uses the subcommand style (correct).

### CUPTI side (`cupti_trace/cupti_trace.cpp`, 385 lines)
- `InitializeInjection()` entry point (CUDA loads the lib named in `CUDA_INJECTION64_PATH` and calls it).
- Enables activity kinds RUNTIME + CONCURRENT_KERNEL; DRIVER+OVERHEAD if `CUPTI_ENABLE_DRIVER=1`;
  MEMCPY/MEMSET/MEMCPY2/MEMORY2 if `CUPTI_ENABLE_MEMORY=1`. 32 MB activity buffers; `BufferCompleted` prints each record as
  one JSON line (`cupti_trace_print.h`) and `fflush`es.
- `XpuPerfGetCorrelationId(uint32_t)` is `extern "C" __attribute__((noinline, used))`, increments a volatile counter.
  Called from `XpuPerfCallbackHandler` for every callback with data (both API_ENTER and API_EXIT sites, all runtime
  API functions when `CUPTI_ENABLE_CORRELATION_UPROBE=1` -> `cuptiEnableDomain(RUNTIME_API)`).
- Optional CUDA graph node tracking (`CUPTI_ENABLE_GRAPH=1`).
- Makefile default `CUDA_INSTALL_PATH ?= /usr/local/cuda-12.9`, builds with nvcc, links `-lcuda -lcupti`.

### Correlation (`correlation.go`)
- CPU mode: each sampling stack +1.
- merge: sampling stacks +1 each; uprobe/custom stacks get `[GPU_Kernel]<name>` appended and
  `samples = (end-start ns) * 50 / 1e9` (float64 accumulate).
- `correlateByCorrelationID`: map corrId -> kernel; traces with corr 0 counted `no_correlation`.
- `correlateUprobesToGPU` (timestamp path): if #cpu traces == #runtime launch events -> 1:1 by order; else greedy walk
  with 10 ms tolerance (`NewTraceCorrelator(..., 10.0, ...)`).
- `WriteFoldedOutput`: sorted, rounds `count+0.5`, min 1 if >0.
- `ExtractStackFromTrace`: reverse frames (root first), filter `libcupti.so`, `libcupti_trace_injection`, `XpuPerf*`;
  collapse repeated `cudaLaunchKernel*` frames to one `cudaLaunchKernel`.
- Reading-the-code observation (NOT verified on GPU): since the callback calls `XpuPerfGetCorrelationId` at both
  ENTER and EXIT, each launch can yield two custom traces with the same correlation ID, and
  `correlateByCorrelationID` adds the kernel duration once per trace. Possible 2x GPU weight. Unverified.

### eBPF side in the fork
- `support/ebpf/native_stack_trace.ebpf.c`: `SEC("perf_event/native_tracer_entry")` -> `collect_trace(..., TRACE_SAMPLING, ...)`;
  `unwind_native` loop uses stack deltas (`unwind_one_frame`), tail calls between unwinders.
- `tracer.go` `AttachTracer`: `perf.Attr.SetSampleFreq(samplesPerSecond)`, `perf.CPUClock`, `perf.Open(attr, AllThreads, cpu)` per online CPU, `SetBPF`.
- `support/ebpf/custom_trace.ebpf.c`: `custom_context_map` PERCPU_ARRAY(1) u64; `custom__generic` reads it and
  `collect_trace(ctx, TRACE_CUSTOM, pid, tid, ts, context_value)`.
- `doc/internals.md` explains stack deltas (.eh_frame-derived; PC -> CFA delta).
- Upstream README: no DWARF needed, uses .eh_frame; works without frame pointers; HLL unwinders (Hotspot, Python, Ruby,
  PHP, Node/V8, Perl; .NET in prep).

## Output format
Folded stacks for Brendan Gregg's `flamegraph.pl` (copy at `profiler/flamegraph.pl`). Frames carry `+0x<offset>` from
the symbolizer, so the same function at different call sites/IPs appears as different frames. Committed real sample
`gpu_trace.folded` (5 lines, 419 samples; libcuda.so.575.57.08) and `flamegraph.svg` at repo root;
`documents/examples/mock-cpu-gpu_flamegraph.svg`, `mock-gpu-only.svg`.
No web UI ships; `documents/server/frontend/*.md` and `demo/threejs_flamegraph.html`, `control_plane.html` are design docs/demos
from the earlier "SystemScope" phase. `documents/intro.md` is a vision essay ("Rethinking System with SystemScope").

## Build and run in the orb (2026-11-06)
- No Go installed: downloaded go1.24.9 to `/home/user/workspace/src/go-sdk`.
- Symlinked fork checkout into `profiler/opentelemetry-ebpf-profiler` (needed `GOFLAGS=-buildvcs=false` because of the symlinked submodule).
- `go generate ./...` (bpf2go + clang; libbpf headers present) — 7.7 s, produced `correlationuprobe_x86_bpfel.{go,o}`.
- No nvcc/CUDA: created an EMPTY placeholder `libcupti_trace_injection.so` so `go:embed` compiles (CPU mode never injects it).
- `go build -p=2 -o xpu-perf .` — 14.6 s wall, 27.5 MB binary.
- `./xpu-perf --help` prints usage; non-root -> "Error: This profiler must be run as root".
- `sudo ./xpu-perf cpu -o cpu.folded ./burn` (scratch C program, -O1 -fno-omit-frame-pointer) on kernel 6.1.189+:
  ran; stats line "Traces - Total: ..., Uprobe: 0, Sampling: ..."; final: "Wrote 6 unique stacks (2787 total samples)"
  over ~55 s (≈50 Hz, matches config). BUT every stack was only the leaf frame (`leaf_a+0x27 1916`, etc.) — no
  `main;work;`. 785 warnings "Outer map update failure: update: invalid argument" / "delete: key does not exist"
  from `processmanager/ebpf/asyncupdate.go` (stack-delta map-in-map updates). Cause not established; likely environment.
  Also ERROR "unsupported Go version go1.26.x" for other Go binaries on the host (system-wide sampling, filtered later).
- `perl profiler/flamegraph.pl cpu.folded > cpu.svg` works.
- GPU/merge modes not runnable (no GPU, no CUDA).

## CI / releases
- Workflows `publish.yml`, `docker.yml`; last runs on 2025-11-24 commits: failure (both). Latest commit marked [skip ci].
  `cd profiler && make` needs nvcc (cupti target) which ubuntu-latest lacks — plausible cause (not verified in logs).
- Releases v0.0.1..v0.0.9 all 2025-06-07..09 (SystemScope era); only v0.0.1 has an asset.
- `dockerfile` references `/root/src/bootstrap` which no longer exists.

## History (summary)
- 2025-06-07..13: initial "SystemScope" (Rust profiler `documents/rust-profiler`, frontend demos, releases).
- 2025-08-26..30: README/CUPTI trace injection lib + Python `gpuperf.py`, `merge_gpu_cpu_trace.py`, chrome trace converter;
  rename systemscope -> xpu-perf (`44ba1fb`, 2025-08-29).
- 2025-10-22..27: CUDA graph tracking, mock apps (vectorAdd, llm-inference), merging, `cudaLaunchKernel` stack trimming.
- 2025-11-02..11: Go profiler on OTel eBPF profiler (`02e5131`), uprobes + SimpleReporter, merge mode, correlation-ID
  uprobe (`7668dc0`, `9f68304`), CUPTI PC sampling example (`d37c8d2`).
- 2025-11-16: subcommand CLI (`275f2f2`), Makefile generate/test; bpftrace test runner for NVIDIA kernel modules.
- 2025-11-19..24: bpftrace scripts for nvidia_uvm (residency, prefetch hint, thrashing, chunk->VA), `tools/`; RAG2 PyTorch demo.
  `tools/bpftrace-script/TEST_RESULTS.md`: 3,202 traceable NVIDIA functions (nvidia 885, nvidia_uvm 2,019, nvidia_drm 192, nvidia_modeset 106).
- 2026-09-17: CI deps fix (libbpf-dev), action-gh-release v3.

## Related work facts (verified via web)
- Parca Agent: perf_event CPU_CLOCK at 19 Hz per logical CPU, pprof (parca.dev docs). Rebased on OTel eBPF profiler in
  v0.32.0 (Polar Signals blog 2024-08-13). GPU: parcagpu shim (CUPTI) + USDT probes + eBPF, released in parca-agent v0.43.0
  (Polar Signals blog 2025-10-22, https://www.polarsignals.com/blog/posts/2025/10/22/gpu-profiling); repo parca-dev/parcagpu.
  parca-agent has `--instrument-cuda-launch` flag.
- Grafana Pyroscope: Alloy `pyroscope.ebpf` embeds grafana/opentelemetry-ebpf-profiler (fork); Pyroscope accepts OTLP from
  OTel eBPF profiler (docs example uses 97 samples/s).
- OTel eBPF profiler: Elastic donation accepted (OTel blog 2024, https://opentelemetry.io/blog/2024/elastic-contributes-continuous-profiling-agent);
  donation finalized June 2024 (OTel "State of Profiling" 2024-10-25).
- iaprof (intel/iaprof): "AI/GPU flame graph", Intel Xe GPUs, EU stall sampling + CPU stacks + GPU kernel info; Gregg
  "AI Flame Graphs" 2024-10-29.
- Gregg: flame graphs site; "The Flame Graph", CACM 59(6) 2016, doi:10.1145/2909476; "The Return of the Frame Pointers" 2024-03-17.
- HPCToolkit GPU: Zhou et al., Parallel Computing 108 (2021) 102837, arXiv:2109.06931.
- NVBit: Villa et al., MICRO-52 2019, doi:10.1145/3352460.3358307.
- Google-Wide Profiling: Ren et al., IEEE Micro 30(4) 2010, doi:10.1109/MM.2010.68.
