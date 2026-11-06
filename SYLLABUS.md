# Syllabus

This is a chapter-by-chapter guide to BPF/eBPF and to every actively maintained eunomia-bpf project
(org: https://github.com/eunomia-bpf). "Active" means a repository that is not a fork, not archived
and not empty, with a commit on its default branch since 2026-05-05. The survey was re-run on
2026-11-06 and found 40 active repositories. Every one of them has a home chapter below. See
`reviews/syllabus-audit.md` for the method.

Titles are the chapters' `<h1>` as written. "Repos" lists the eunomia-bpf repositories a chapter is
the home for; other chapters may also cite them.

Status key:

- **reviewed**: written and validated, with the review report named in brackets.
- **validating**: written; validation in progress.
- **drafting**: being written.
- **planned**: not written yet.

## Part I · Foundations

| # | File | Title | Covers | Status |
|---|------|-------|--------|--------|
| 01 | `01-what-is-bpf.html` | What is BPF? From packet filter to in-kernel VM | BSD Packet Filter (1993), tcpdump/libpcap, socket filters, seccomp-bpf, the 2014 eBPF rewrite, feature timeline, first programs | reviewed (part1-a) |
| 02 | `02-ebpf-isa-and-vm.html` | The eBPF Instruction Set and Virtual Machine | Registers, calling convention, 512-byte stack, encoding and classes, atomics, BPF-to-BPF calls, interpreter and x86-64 JIT, constant blinding, RFC 9669, `-mcpu` | reviewed (part1-a) |
| 03 | `03-verifier.html` | The eBPF verifier | CFG pass, symbolic execution, tnums and ranges, NULL and packet checks, pruning, precision, loops, limits, privileged/unprivileged loading and BPF tokens, Spectre, veristat, PREVAIL/Agni/state-embedding research | reviewed (part1-a) |
| 04 | `04-maps-helpers-kfuncs.html` | Maps, helpers and kfuncs | Map types, local storage, arena, pinning, global variables, ring/perf/user ring buffer, dynptrs, helpers, kfuncs, BPF-to-BPF calls, tail calls, spin locks, timers | reviewed (part1-a) |
| 05 | `05-program-types-and-hooks.html` | Program types and hooks: where eBPF runs | kprobe, fentry/fexit, tracepoints, perf_event, uprobes/USDT, BPF LSM, cgroup, struct_ops, sched_ext, HID-BPF, iterators | reviewed (part1-b) |
| 06 | `06-btf-core-libbpf.html` | BTF, CO-RE and libbpf | BTF, vmlinux.h, CO-RE relocations, BTFHub, build pipeline, object lifecycle, skeletons, `bpf()` syscall, links and pinning | reviewed (part1-b) |
| 07 | `07-networking-xdp-tc.html` | eBPF in the networking stack: XDP, AF_XDP, tc/TCX and socket programs | XDP, AF_XDP, tc/cls_bpf, TCX, netfilter programs, socket filters, sockops/sockmap, sk_lookup | reviewed (part1-b) |
| 08 | `08-ecosystem.html` | The eBPF ecosystem map, and where eunomia-bpf fits | bpftrace, BCC, libbpf, cilium/ebpf, aya, libbpf-rs; Cilium, Tetragon, Falco, Katran; bpftool; eBPF for Windows; uBPF/rbpf; map of the org | reviewed (part1-b) |

## Part II · Learning and tooling

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 09 | `09-bpf-developer-tutorial.html` | bpf-developer-tutorial: learning eBPF one small tool at a time | bpf-developer-tutorial | reviewed (part2) |
| 10 | `10-eunomia-bpf-ecc-ecli.html` | eunomia-bpf: ecc and ecli | eunomia-bpf, eunomia-template, ecli-webui, homebrew-tap | reviewed (part2) |
| 11 | `11-starter-templates.html` | Starter templates for libbpf and libbpf-rs | libbpf-starter-template, libbpf-rs-starter-template | reviewed (part2) |
| 12 | `12-wasm-bpf.html` | wasm-bpf: eBPF user space in WebAssembly | wasm-bpf, wasm-bpf-guest-sdk-c / -rust / -go | reviewed (part2) |
| 13 | `13-bpf-compatible.html` | bpf-compatible: CO-RE on kernels without BTF | bpf-compatible | reviewed (part3) |

## Part III · Userspace eBPF runtimes

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 14 | `14-bpftime-architecture.html` | bpftime architecture: eBPF without the kernel round trip | bpftime (design, syscall server, shared maps, inline hooks, OSDI '25 EIM paper) | reviewed (part3) |
| 15 | `15-bpftime-in-practice.html` | bpftime in practice: running eBPF tools in userspace | bpftime (CLI, unmodified libbpf tools, mixed mode, CUDA probes, XDP/nginx, benchmarks) | reviewed (part3) |
| 16 | `16-llvmbpf.html` | llvmbpf: an LLVM JIT/AOT Compiler for eBPF | llvmbpf (JIT, AOT, PTX/SPIR-V) | reviewed (part3) |

## Part IV · Verifier, correctness and performance

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 17 | `17-bpfix.html` | bpfix: explaining and fixing verifier errors | bpfix | reviewed (part4) |
| 18 | `18-ebpf-correctness-verifier.html` | ebpf-correctness-verifier: Translation Validation for eBPF Rewrites | ebpf-correctness-verifier | reviewed (part4) |
| 19 | `19-bpf-benchmark.html` | bpf-benchmark and bpfperf: Agent-Driven eBPF Optimization | bpf-benchmark, bpfperf | reviewed (part4) |

## Part V · eBPF for GPUs and accelerators

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 20 | `20-gpu-ext.html` | gpu_ext: eBPF policies inside the GPU driver | gpu_ext (also the gpu_ext-kernel-modules fork and eGPU, merged into bpftime) | reviewed (part5) |
| 21 | `21-nccl-ebpf.html` | NCCLbpf: verified eBPF policies inside NCCL | nccl-eBPF | reviewed (part5) |
| 22 | `22-xpu-perf.html` | xpu-perf: one flame graph for CPU and GPU | xpu-perf (cites cupti-tutorial) | reviewed (part5) |

## Part VI · eBPF for AI agents

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 23 | `23-agentsight.html` | AgentSight: system-level observability for AI agents | agentsight, agentsight-website | drafting |
| 24 | `24-actplane.html` | ActPlane: information-flow enforcement for AI agents | ActPlane | reviewed (part5) |
| 25 | `25-agentcgroup.html` | AgentCgroup: understanding and controlling the OS resources of AI agents | agentcgroup | validating |
| 26 | `26-reward-guard-and-safe-change.html` | RewardGuard and safe change after external operations | reward-guard, agent-check-restore-safety | validating |
| 27 | `27-actime-and-akeep.html` | Actime and Akeep: one runtime for agent policy, observability and backup | actime, akeep, backup-client-sdk, agentqos | validating |

## Part VII · Kernel extension research

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 28 | `28-namei-ext.html` | namei_ext: programmable VFS name resolution | namei_ext | validating |
| 29 | `29-qwen3-ebpf.html` | qwen3-ebpf: a language model forward pass inside eBPF | qwen3-ebpf | validating |
| 30 | `30-llm-kernel-tooling.html` | LLM agents for the kernel: schedcp, MCPtrace, GPTtrace | schedcp, MCPtrace, GPTtrace, GPTtrace-web (less active, but the org's LLM-for-kernel line) | validating |

## Appendix

| # | File | Title | Repos | Status |
|---|------|-------|-------|--------|
| 31 | `31-org-meta.html` | The org behind the code: eunomia.dev, agent skills and research notes | eunomia.dev, agent-skills, research-skills, megakernel-profiling-feasibility, .github, basic-cuda-tutorial, cupti-tutorial, nvbit-tutorial; map of every active repo | validating |
| 32 | `32-glossary-and-reading-list.html` | Glossary and reading list | Glossary, paper reading list, learning path | drafting |

## Known gaps

`reviews/syllabus-audit.md` lists what to add. In short: signed BPF programs (6.18) are missing; BPF
tokens, BPF in Kubernetes, and debugging/measurement tooling (`bpftool prog tracelog`,
`kernel.bpf_stats_enabled`, `bpftool prog profile`) are only touched in passing; BPF exceptions are
not covered.
