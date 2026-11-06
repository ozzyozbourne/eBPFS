# Research notes — 08 · The eBPF ecosystem map

Survey date: 2026-11-05. Volatile numbers (stars, contributor counts) deliberately omitted.

## Framework sources studied (shallow clones in /home/user/workspace/src/)

| Repo | Commit studied | Files used in the chapter |
|------|----------------|---------------------------|
| bpftrace/bpftrace | a3db9f5222e884745d2ab7ab6bee5060254df896 | `tools/execsnoop.bt`, `docs/tutorial_one_liners.md` (Lesson 3, 4), `README.md` (LLVM backend + libbpf) |
| iovisor/bcc | c398a9a7a41cba623b520cda27457b92d7fcad2b | `tools/execsnoop.py` (Python + embedded C, kprobe on `get_syscall_fnname("execve")`), `libbpf-tools/execsnoop.bpf.c`, `libbpf-tools/execsnoop.c` (skeleton open/load/attach, perf_buffer) |
| cilium/ebpf | 4efde8ed8e2cb96180971b6149170864bbe17722 | `examples/kprobe/kprobe.c`, `examples/kprobe/main.go` (`//go:generate go tool bpf2go -tags linux bpf kprobe.c -- -I../headers`), `examples/README.md` (`go run -exec sudo ./kprobe`) |
| aya-rs/book | f1a68f4f7cbdffcd2573c6acb761ad38fea4adc4 | `examples/tracepoint/tracepoint-ebpf/src/main.rs`, `examples/tracepoint/tracepoint/src/main.rs`, `examples/tracepoint/README.md`, `src/book/start/development.md` (stable+nightly, bpf-linker, cargo-generate) |
| aya-rs/aya | be4f54471271c295379a0c3a336a2ab3535e8bbd | `README.md`: "does not rely on libbpf nor bcc ... using only the libc crate"; BTF relocation; musl static binary |
| libbpf/libbpf-rs | 9680ea7054dc92e42248ca29c8ba1ed468a2b59d | `examples/runqslower/build.rs` (SkeletonBuilder), `examples/runqslower/src/main.rs`, `examples/runqslower/src/bpf/runqslower.bpf.c`. No official execve example in libbpf-rs; runqslower chosen (a BCC tool port) and labeled as such. |
| libbpf/libbpf-bootstrap | 820a1bd8b4f4cb4b78b442ae4eb3994738651f12 | referenced only (bootstrap example) |
| eunomia-bpf/eunomia-bpf | a5408a8c3614bd4e008c1f999bb4ee9738e2fc41 | `examples/bpftools/bootstrap/bootstrap.bpf.c`, `.../README.md` (`ecc bootstrap.bpf.c bootstrap.h`, `ecli run .../package.json`), top-level `README.md` (`ecli run ghcr.io/eunomia-bpf/execve:latest`) |

Facts:
- cilium/ebpf README: "pure Go library ... minimal external dependencies"; packages asm, cmd/bpf2go, link, perf, ringbuf, features, rlimit, btf, pin. Linux amd64/arm64, Windows amd64 (eBPF for Windows) supported.
- bpftrace README: "uses LLVM as a compiler backend, and libbpf for interacting with the Linux BPF subsystem".
- BCC README: "kernel instrumentation in C (and includes a C wrapper around LLVM), and front-ends in Python and lua".
- aya book: needs Rust stable + nightly (rust-src) + bpf-linker; bpftool for bindings (aya-tool).
- libbpf-rs: "Idiomatic Rust wrapper around libbpf"; libbpf-cargo builds skeletons.
- No official one-liner for "count execve per process" exists in bpftrace docs; the chapter's one-liner is Lesson 4 with the probe swapped, labeled illustrative.

## Major projects (READMEs read via gh api)
- Cilium: CNCF incubating Oct 2021, graduated 2023-10-11 (cncf.io announcement). Created by Isovalent.
- Hubble: "fully distributed networking and security observability platform ... built on top of Cilium and eBPF".
- Tetragon: "eBPF-based Security Observability and Runtime Enforcement"; process_exec/process_exit events by default; Kubernetes-aware.
- Falco: CNCF graduated 2024-02-29; drivers (kernel module, modern eBPF probe) in falcosecurity/libs; libscap + libsinsp.
- Tracee (aquasecurity): "runtime security and observability tool".
- Pixie: Kubernetes observability, eBPF auto-telemetry, in-cluster storage, PxL query language.
- Parca Agent: always-on eBPF sampling profiler, pprof output, kernel 5.3+ with BTF; 19 Hz sampling (from README).
- Katran (facebookincubator): C++ library + BPF program for L4 LB forwarding plane on XDP.
- eBPF for Windows: three modes — native (bpf2c + PREVAIL → .sys driver, preferred, HVCI), JIT (uBPF via eBPFSvc), interpreter (uBPF, debug builds only). libbpf-compatible API via ebpfapi.dll.
- PREVAIL: "Polynomial-Runtime EBPF Verifier using an Abstract Interpretation Layer"; PLDI 2019, Gershuni et al., DOI 10.1145/3314221.3314590.
- uBPF: Apache-licensed userspace VM; assembler, disassembler, interpreter, JIT (x86-64, Arm64); new "safe" interpreter-only profile.
- rbpf: Rust userspace VM based on uBPF; interpreter, x86_64 JIT, disassembler.
- eBPF Foundation: announced 2021-08-12 by Linux Foundation; founding members Meta (Facebook), Google, Isovalent, Microsoft, Netflix.

## eunomia-bpf org (READMEs via `gh api repos/eunomia-bpf/<name>/readme`), HEAD SHAs on 2026-11-05
bpftime 25e250d6, wasm-bpf 01f14194, llvmbpf 7e384dbb, bpfix 4b9decaa, ebpf-correctness-verifier 59ca4247,
bpf-benchmark 08ee4de0, gpu_ext 50a51ad4, nccl-eBPF 9a6006e2, xpu-perf b4fcc885, agentsight c1574366,
ActPlane bb89c77b, agentcgroup 551ca168, namei_ext 3f67fcbd, qwen3-ebpf 3999b887, eunomia-template 739efb3d,
libbpf-starter-template 6e572b6d, libbpf-rs-starter-template 8927eea1.

- eunomia-bpf: compiler (ecc, `compiler/`) + runtime (ecli, `ecli/`, `bpf-loader-rs/`); auto-exports ringbuf/perf events, samples hash maps, generates CLI args from globals; OCI push/pull; legacy remote HTTP mode removed (kept on `archive/ecli-remote-http`).
- wasm-bpf: Wasm library/toolchain/runtime on CO-RE libbpf; `cargo install wasm-bpf`; WasmEdge plugin.
- bpftime: userspace runtime (loader, verifier, helpers, maps, ufunc, events); binary rewriting; uprobe/USDT/syscall/XDP(experimental)/GPU; VM backends llvmbpf, ubpf; OSDI '25 "Extending Applications Safely and Efficiently", pp. 557–574.
- llvmbpf: standalone LLVM JIT/AOT VM; PTX and SPIR-V GPU targets; no maps/helpers/verifier/loader.
- bpfix: verifier log → Rust-style diagnostics; `cargo install bpfix`; repo description mentions LLM fixing.
- ebpf-correctness-verifier (`ebpf-tv`): equivalence checker between old/new objects; PASS/FAIL/UNKNOWN; SMT/Z3 backend; repo description "based on Z3 and prevail"; explicitly does not prove safety.
- bpf-benchmark (bpf-bench): agent-driven optimization loop; artifact for "BPF-Ext: Safely Extending the eBPF Compilation Pipeline with Native Operations" (ACM ATC '26) — paper URL not verified beyond README; Zenodo DOI 10.5281/zenodo.22907396 in README.
- gpu_ext: eBPF struct_ops in (modified NVIDIA open) GPU kernel modules; eviction/prefetch/scheduling policies; arXiv 2512.12615 "gpu_ext: Extensible OS Policies for GPUs via eBPF" (title confirmed via arXiv API).
- nccl-eBPF (NCCLbpf): bpftime inside NCCL tuner/profiler/net plugins; research prototype targeting eBPF Workshop at SOSP 2026.
- xpu-perf: eBPF + CUPTI CPU/GPU profiler, flamegraphs; README says WIP.
- agentsight: eBPF + TLS tracing observability for AI agents; arXiv 2508.02736; PACMI '25 (4th Workshop on Practical Adoption Challenges of ML for Systems), DOI 10.1145/3766882.3767169.
- ActPlane: IFC policy engine for agent harnesses; BPF-LSM block/notify/kill; arXiv 2606.25189 "ActPlane: Programmable OS-Level Policy Enforcement for Agent Harnesses".
- agentcgroup: sched_ext + memcg_bpf_ops resource control per tool call; arXiv 2602.09345 "AgentCgroup: Understanding and Controlling OS Resources of AI Agents".
- namei_ext: sched_ext-style BPF extension point in VFS path resolution; modified kernel submodule.
- qwen3-ebpf: Qwen3-0.6B forward pass in eBPF (28 decoder layers, KV cache in map); XDP + BPF arena + workqueue path; tested on Linux 6.17 arm64.

## Unverified / left out
- Whether bpftrace now offers AOT compilation as stable — left out.
- Exact CO-RE support status for Rust-written aya eBPF code — described cautiously.
- BPF-Ext ATC '26 paper URL — cited only via the repo README.
