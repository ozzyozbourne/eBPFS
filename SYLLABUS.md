# Syllabus

A chapter-wise guide to BPF/eBPF and to every actively maintained eunomia-bpf project
(org: https://github.com/eunomia-bpf). "Active" means non-fork, non-archived repositories
with commits in the last six months (survey run 2026-11-05).

## Part I · Foundations of BPF

| # | File | Topic |
|---|------|-------|
| 01 | `01-what-is-bpf.html` | From classic BPF (Berkeley Packet Filter, 1992/93) to eBPF; why the kernel gained a safe in-kernel VM |
| 02 | `02-ebpf-isa-and-vm.html` | Instruction set, registers, calling convention, interpreter and JIT, RFC 9669 |
| 03 | `03-verifier.html` | How the verifier proves safety: CFG checks, abstract interpretation, bounds tracking, PREVAIL and verifier research |
| 04 | `04-maps-helpers-kfuncs.html` | Maps, ring buffer, helpers, kfuncs, BPF-to-BPF calls, tail calls |
| 05 | `05-program-types-and-hooks.html` | kprobe, fentry/fexit, tracepoints, uprobes/USDT, perf, LSM, cgroup, struct_ops, sched_ext |
| 06 | `06-btf-core-libbpf.html` | BTF, CO-RE, vmlinux.h, libbpf skeletons, bpftool, the load lifecycle |
| 07 | `07-networking-xdp-tc.html` | XDP, AF_XDP, tc/TCX, socket programs |
| 08 | `08-ecosystem.html` | bcc, bpftrace, libbpf, cilium/ebpf, aya, libbpf-rs; Cilium, Tetragon, Falco, Katran; eBPF for Windows |

## Part II · Learning and tooling

| # | File | Repos |
|---|------|-------|
| 09 | `09-bpf-developer-tutorial.html` | bpf-developer-tutorial |
| 10 | `10-eunomia-bpf-ecc-ecli.html` | eunomia-bpf, eunomia-template, ecli-webui, homebrew-tap |
| 11 | `11-starter-templates.html` | libbpf-starter-template, libbpf-rs-starter-template |
| 12 | `12-wasm-bpf.html` | wasm-bpf, wasm-bpf-guest-sdk-c / -rust / -go |
| 13 | `13-bpf-compatible.html` | bpf-compatible (BTF portability for old kernels) |

## Part III · Userspace eBPF runtimes

| # | File | Repos |
|---|------|-------|
| 14 | `14-bpftime-architecture.html` | bpftime: design, OSDI '25 paper, binary rewriting, shared maps |
| 15 | `15-bpftime-in-practice.html` | bpftime: uprobe/syscall tracing, attach modes, GPU support, examples |
| 16 | `16-llvmbpf.html` | llvmbpf: LLVM JIT/AOT for eBPF, PTX/GPU target |

## Part IV · Verifier, correctness and performance

| # | File | Repos |
|---|------|-------|
| 17 | `17-bpfix.html` | bpfix: explaining and fixing verifier errors with LLMs |
| 18 | `18-ebpf-correctness-verifier.html` | ebpf-correctness-verifier: Z3 + PREVAIL transformation validation |
| 19 | `19-bpf-benchmark.html` | bpf-benchmark, bpfperf: agent-driven eBPF optimization |

## Part V · eBPF for GPUs and accelerators

| # | File | Repos |
|---|------|-------|
| 20 | `20-gpu-ext.html` | gpu_ext (and the merged eGPU): eBPF for GPU UVM and scheduling |
| 21 | `21-nccl-ebpf.html` | nccl-eBPF (NCCLbpf): eBPF policies inside NCCL |
| 22 | `22-xpu-perf.html` | xpu-perf: continuous CPU+GPU profiling |

## Part VI · eBPF for AI agents

| # | File | Repos |
|---|------|-------|
| 23 | `23-agentsight.html` | agentsight, agentsight-website |
| 24 | `24-actplane.html` | ActPlane: information-flow enforcement for agents |
| 25 | `25-agentcgroup.html` | agentcgroup: OS resources of AI agents |
| 26 | `26-reward-guard-and-safe-change.html` | reward-guard, agent-check-restore-safety |
| 27 | `27-actime-and-akeep.html` | actime, akeep, backup-client-sdk |

## Part VII · Kernel extension research

| # | File | Repos |
|---|------|-------|
| 28 | `28-namei-ext.html` | namei_ext: BPF-extensible VFS namespace policy |
| 29 | `29-qwen3-ebpf.html` | qwen3-ebpf: LLM forward pass inside eBPF |
| 30 | `30-llm-kernel-tooling.html` | schedcp, MCPtrace, GPTtrace (less active, but the org's LLM-for-kernel line) |

## Appendix

| # | File | Topic |
|---|------|-------|
| 31 | `31-org-meta.html` | eunomia.dev, agent-skills, research-skills, megakernel-profiling-feasibility |
| 32 | `32-glossary-and-reading-list.html` | Glossary, paper reading list, learning path |
