# 32 · Glossary and reading list: research notes

Sources: the `References` sections (and, for checking, the prose) of chapters 01–31 as present on 2026-11-06.
Extraction: a script parsed each chapter's `<h2>References</h2>` list and every `h2`/`h3` heading (anchor ids computed with the same rule as `assets/app.js`).
Chapter 23 had no References section yet (another agent was still writing it); its paper (AgentSight) is cited by chapters 08, 24–27.

- Glossary terms: 148 (every link target checked against the headings that exist; chapter 23 is linked as a whole).
- Papers: 97, deduplicated by title.

## Papers by theme (title — authors — venue, year — URL — cited in)

### BPF origins and the ISA (2)

- The BSD Packet Filter: A New Architecture for User-level Packet Capture — S. McCanne, V. Jacobson — USENIX Winter Conference, 1993 — https://www.tcpdump.org/papers/bpf-usenix93.pdf — ch. 01
- BPF Instruction Set Architecture (ISA), RFC 9669 — D. Thaler (ed.) — IETF Standards Track RFC, 2024 — https://www.rfc-editor.org/rfc/rfc9669.html — ch. 01, 02, 08, 16, 18 — note: standard, not a research paper

### Verifier and formal methods (15)

- Simple and Precise Static Analysis of Untrusted Linux Kernel Extensions (PREVAIL) — E. Gershuni, N. Amit, A. Gurfinkel, N. Narodytska, J. A. Navas, N. Rinetzky, L. Ryzhyk, M. Sagiv — PLDI, 2019 — https://doi.org/10.1145/3314221.3314590 — ch. 03, 08, 14, 17, 21
- Sound, Precise, and Fast Abstract Interpretation with Tristate Numbers — H. Vishwanathan, M. Shachnai, S. Narayana, S. Nagarakatte — CGO, 2022 — https://doi.org/10.1109/CGO53902.2022.9741267 — ch. 03 — note: also arXiv:2105.05398
- Verifying the Verifier: eBPF Range Analysis Verification (Agni) — H. Vishwanathan, M. Shachnai, S. Narayana, S. Nagarakatte — CAV, 2023 — https://doi.org/10.1007/978-3-031-37709-9_12 — ch. 03, 17
- Validating the eBPF Verifier via State Embedding — H. Sun, Z. Su — OSDI, 2024 — https://www.usenix.org/conference/osdi24/presentation/sun-hao — ch. 03, 17
- Specification and verification in the field: Applying formal methods to BPF just-in-time compilers in the Linux kernel (Jitterbug) — L. Nelson, J. Van Geffen, E. Torlak, X. Wang — OSDI, 2020 — https://www.usenix.org/conference/osdi20/presentation/nelson — ch. 02, 18, 19
- Jitk: A Trustworthy In-Kernel Interpreter Infrastructure — X. Wang, D. Lazar, N. Zeldovich, A. Chlipala, Z. Tatlock — OSDI, 2014 — https://www.usenix.org/conference/osdi14/technical-sessions/presentation/wang_xi — ch. 02
- Synthesizing JIT Compilers for In-Kernel DSLs — J. Van Geffen, L. Nelson, I. Dillig, X. Wang, E. Torlak — CAV, 2020 — https://doi.org/10.1007/978-3-030-53291-8_29 — ch. 02
- Translation Validation — A. Pnueli, M. Siegel, E. Singerman — TACAS (LNCS 1384), 1998 — https://doi.org/10.1007/BFb0054170 — ch. 18
- Translation Validation for an Optimizing Compiler — G. C. Necula — PLDI, 2000 — https://doi.org/10.1145/358438.349314 — ch. 18
- Alive2: Bounded Translation Validation for LLVM — N. P. Lopes, J. Lee, C.-K. Hur, Z. Liu, J. Regehr — PLDI, 2021 — https://doi.org/10.1145/3453483.3454030 — ch. 18
- Heimdall: Formally Verified Automated Migration of Legacy eBPF Programs to Rust — V. A. Dasu, M. Santra, M. R. U. Rashid, A. Kumar, S. Tizpaz-Niari, G. Tan — arXiv:2605.25411, 2026 — https://arxiv.org/abs/2605.25411 — ch. 18 — note: preprint
- Rex: Closing the language-verifier gap with safe and usable kernel extensions — J. Jia et al. — USENIX ATC, 2025 — https://www.usenix.org/conference/atc25/presentation/jia — ch. 17
- An Empirical Study on the Challenges of eBPF Application Development — M. Deokar, J. Men, L. Castanheira, A. Bhardwaj, T. A. Benson — eBPF '24 (SIGCOMM workshop), 2024 — https://doi.org/10.1145/3672197.3673429 — ch. 17
- Design and implementation of a tool to improve error reporting for eBPF code — R. Rizza, R. Sisto, F. Valenza — IEEE CSR, 2025 — https://doi.org/10.1109/CSR64739.2025.11130075 — ch. 17
- Characterizing and Bridging the Diagnostic Gap in eBPF Verifier Rejections (bpfix) — Y. Zheng, Z. Ji, W. Tao, X. Gao, J. Su, W. Zhang, A. Quinn, D. Williams — paper draft, venue not confirmed, 2026 — https://github.com/yunwei37/ebpf27-bpfix — ch. 17 — note: unpublished draft

### JIT, optimization and JIT security (8)

- Synthesizing Safe and Efficient Kernel Extensions for Packet Processing (K2) — Q. Xu, M. D. Wong, T. Wagle, S. Narayana, A. Sivaraman — ACM SIGCOMM, 2021 — https://doi.org/10.1145/3452296.3472929 — ch. 18, 19 — note: also arXiv:2103.00022
- Merlin: Multi-tier Optimization of eBPF Code for Performance and Compactness — J. Mao, H. Ding, J. Zhai, S. Ma — ASPLOS, 2024 — https://doi.org/10.1145/3620666.3651387 — ch. 18, 19
- EPSO: A Caching-Based Efficient Superoptimizer for BPF Bytecode — Q. Zhu, Y. Liu, Z. Zhu, S. Liu, L. Bu — ASE, 2025 — https://arxiv.org/abs/2511.15589 — ch. 18 — note: arXiv:2511.15589
- Domain Specific Run Time Optimization for Software Data Planes (Morpheus) — S. Miano, A. Sanaee, F. Risso, G. Rétvári, G. Antichi — ASPLOS, 2022 — https://doi.org/10.1145/3503222.3507769 — ch. 19
- BPF-Ext: Safely Extending the eBPF Compilation Pipeline with Native Operations — Y. Zheng, Z. Ji, W. Tao, H. Sun, W. Zhang, D. Williams, A. Quinn — ATC '26 (accepted), 2026 — https://arxiv.org/abs/2606.24213 — ch. 19 — note: proceedings not yet published when chapter 19 was written
- bpf-bench / BPFOptBench (agent-driven eBPF optimization benchmark) — authors not given in chapter 19 — paper draft (commit 17588bd), draft — https://github.com/yunwei37/ebpf27-bpfoptbench — ch. 19 — note: unpublished draft; numbers preliminary
- EPF: Evil Packet Filter — D. Jin, V. Atlidakis, V. P. Kemerlis — USENIX ATC, 2023 — https://www.usenix.org/conference/atc23/presentation/jin — ch. 02
- SoK: Make JIT-Spray Great Again — R. Gawlik, T. Holz — USENIX WOOT, 2018 — https://www.usenix.org/system/files/conference/woot18/woot18-paper-gawlik.pdf — ch. 02

### Networking (3)

- The eXpress Data Path: Fast Programmable Packet Processing in the Operating System Kernel — T. Høiland-Jørgensen, J. D. Brouer, D. Borkmann, J. Fastabend, T. Herbert, D. Ahern, D. Miller — ACM CoNEXT, 2018 — https://dl.acm.org/doi/10.1145/3281411.3281443 — ch. 07
- The Path to DPDK Speeds for AF_XDP — M. Karlsson, B. Töpel — Linux Plumbers Conference, Networking Track, 2018 — http://oldvger.kernel.org/lpc_net2018_talks/lpc18_paper_af_xdp_perf-v2.pdf — ch. 07
- uXDP: Frictionless XDP Deployments in Userspace — Y. Zheng, P. Gavriil, M. Kogias — eBPF '25 (SIGCOMM workshop), 2025 — https://dl.acm.org/doi/10.1145/3748355.3748360 — ch. 15

### Userspace runtimes, isolation and Wasm (9)

- Extending Applications Safely and Efficiently (bpftime, EIM) — Y. Zheng, T. Yu, Y. Yang, Y. Hu, X. Lai, D. Williams, A. Quinn — OSDI, 2025 — https://www.usenix.org/conference/osdi25/presentation/zheng-yusheng — ch. 05, 08, 14, 15, 16, 21
- bpftime: userspace eBPF Runtime for Uprobe, Syscall and Kernel-User Interactions — Y. Zheng, T. Yu, Y. Yang, Y. Hu, X. Lai, A. Quinn — arXiv:2311.07923, 2023 — https://arxiv.org/abs/2311.07923 — ch. 12, 14, 15, 16 — note: preprint
- Wasm-bpf: Streamlining eBPF Deployment in Cloud Environments with WebAssembly — Y. Zheng, T. Yu, Y. Yang, A. Quinn — arXiv:2408.04856, 2024 — https://arxiv.org/abs/2408.04856 — ch. 10, 12 — note: preprint
- zpoline: a system call hook mechanism based on binary rewriting — K. Yasukata, H. Tazaki, P.-L. Aublin, K. Ishiguro — USENIX ATC, 2023 — https://www.usenix.org/conference/atc23/presentation/yasukata — ch. 14, 15
- Fast (Trapless) Kernel Probes Everywhere — J. Jia, M. V. Le, S. Ahmed, D. Williams, H. Jamjoom, T. Xu — USENIX ATC, 2024 — https://www.usenix.org/conference/atc24/presentation/jia — ch. 14
- ERIM: Secure, Efficient In-process Isolation with Protection Keys (MPK) — A. Vahldiek-Oberwagner et al. — USENIX Security, 2019 — https://www.usenix.org/conference/usenixsecurity19/presentation/vahldiek-oberwagner — ch. 14
- Retrofitting Fine Grain Isolation in the Firefox Renderer (RLBox) — S. Narayan et al. — USENIX Security, 2020 — https://www.usenix.org/conference/usenixsecurity20/presentation/narayan — ch. 14
- Bringing the Web up to Speed with WebAssembly — A. Haas et al. — PLDI, 2017 — https://doi.org/10.1145/3062341.3062363 — ch. 12
- Empowering WebAssembly with Thin Kernel Interfaces (WALI) — A. Ramesh, T. Huang, B. L. Titzer, A. Rowe — arXiv:2312.03858, 2023 — https://arxiv.org/abs/2312.03858 — ch. 12 — note: preprint; year from the arXiv number

### GPUs, collectives and accelerator profiling (13)

- gpu_ext: Extensible OS Policies for GPUs via eBPF — Y. Zheng, T. Yu, Y. Yang, M. Jiang, X. Gao, J. Su, Y. Hu, W. Mao, W. Zhang, D. Williams, A. Quinn — arXiv:2512.12615, 2025 — https://arxiv.org/abs/2512.12615 — ch. 08, 16, 20, 21 — note: preprint
- Safe and Programmable OS-Level GPU Resource Management with eBPF — Y. Zheng et al. — ASPLOS '27, 2027 — https://doi.org/10.1145/3845814.3850045 — ch. 20
- eGPU: Extending eBPF Programmability and Observability to GPUs — Y. Yang, T. Yu, Y. Zheng, A. Quinn — HCDS '25 (workshop), 2025 — https://doi.org/10.1145/3723851.3726984 — ch. 15, 16, 20
- GPREEMPT: GPU Preemptive Scheduling Made General and Efficient — R. Fan et al. — USENIX ATC, 2025 — https://www.usenix.org/conference/atc25/presentation/fan — ch. 20
- XSched: Preemptive Scheduling for Diverse XPUs — W. Shen et al. — OSDI, 2025 — https://www.usenix.org/conference/osdi25/presentation/shen-weihang — ch. 20
- NVBit: A Dynamic Binary Instrumentation Framework for NVIDIA GPUs — O. Villa, M. Stephenson, D. Nellans, S. W. Keckler — MICRO, 2019 — https://doi.org/10.1145/3352460.3358307 — ch. 20, 22
- UVMBench: A Comprehensive Benchmark Suite for Researching Unified Virtual Memory in GPUs — Y. Gu et al. — arXiv:2007.09822, 2020 — https://arxiv.org/abs/2007.09822 — ch. 20 — note: preprint
- NCCLbpf: Verified, Composable Policy Execution for GPU Collective Communication — Y. Zheng — eBPF '26 (workshop), 2026 — https://doi.org/10.1145/3837779.3838156 — ch. 21 — note: preprint arXiv:2603.11438
- Demystifying NCCL: An In-depth Analysis of GPU Communication Protocols and Algorithms — Z. Hu, S. Shen, T. Bonato, S. Jeaugey, C. Alexander, E. Spada, J. Dinan, J. Hammond, T. Hoefler — IEEE HOTI, 2025 — https://arxiv.org/abs/2507.04786 — ch. 21
- AutoCCL: Automated Collective Communication Tuning for Accelerating Distributed and Parallel DNN Training — G. Xu, Z. Le, Y. Chen, Z. Lin, Z. Jin, Y. Miao, C. Li — NSDI, 2025 — https://www.usenix.org/conference/nsdi25/presentation/xu-guanbin — ch. 21
- TACCL: Guiding Collective Algorithm Synthesis using Communication Sketches — A. Shah et al. — NSDI, 2023 — https://www.usenix.org/conference/nsdi23/presentation/shah — ch. 21
- Measurement and Analysis of GPU-accelerated Applications with HPCToolkit — K. Zhou, L. Adhianto, J. Anderson, et al. — Parallel Computing 108, 2021 — https://arxiv.org/abs/2109.06931 — ch. 22
- MPK: A Compiler and Runtime for Mega-Kernelizing Tensor Programs — X. Cheng, Z. Zhang, Y. Zhou, J. Ji, et al. — OSDI, 2026 — https://www.usenix.org/conference/osdi26/presentation/cheng — ch. 31 — note: also arXiv:2512.22219

### AI agents (16)

- AgentSight: System-Level Observability for AI Agents Using eBPF — Y. Zheng, Y. Hu, T. Yu, A. Quinn — PACMI '25 (workshop, with SOSP '25), 2025 — https://doi.org/10.1145/3766882.3767169 — ch. 08, 24, 25, 26, 27 — note: also arXiv:2508.02736; chapter 23 describes it in prose
- ActPlane: Programmable OS-Level Policy Enforcement for Agent Harnesses — Y. Zheng, T. Wu, Q. Fu, T. Yu, W. Mao, T. Ma, D. Williams, W. Wang, A. Quinn — arXiv:2606.25189, 2026 — https://arxiv.org/abs/2606.25189 — ch. 08, 24, 26, 27 — note: preprint
- AgentCgroup: Understanding and Controlling OS Resources of AI Agents — Y. Zheng, J. Fan, Q. Fu, Y. Yang, W. Zhang, A. Quinn — arXiv:2602.09345, 2026 — https://arxiv.org/abs/2602.09345 — ch. 08, 25 — note: preprint
- ACRFence: Preventing Semantic Rollback Attacks in Agent Checkpoint-Restore — Y. Zheng, Y. Yang, W. Zhang, A. Quinn — arXiv:2603.20625, 2026 — https://arxiv.org/abs/2603.20625 — ch. 26 — note: preprint
- When Can Agents Safely Checkpoint, Fork, Restore, and Merge? Exact Checking for Execution Edits — Y. Zheng, X. Song, Y. Hu, L. Cheng, Y. Huang, W. Zhang — arXiv:2608.22928, 2026 — https://arxiv.org/abs/2608.22928 — ch. 26 — note: preprint
- RewardHackingAgents: Benchmarking Evaluation Integrity for LLM ML-Engineering Agents — Y. Atinafu, R. Cohen — arXiv:2603.11337, 2026 — https://arxiv.org/abs/2603.11337 — ch. 26 — note: preprint
- EvilGenie: A Reward Hacking Benchmark — J. Gabor, J. Lynch, J. Rosenfeld — arXiv:2511.21654, 2025 — https://arxiv.org/abs/2511.21654 — ch. 26 — note: preprint
- ImpossibleBench: Measuring LLMs' Propensity of Exploiting Test Cases — Z. Zhong, A. Raghunathan, N. Carlini — arXiv:2510.20270, 2025 — https://arxiv.org/abs/2510.20270 — ch. 26 — note: preprint
- Defining and Characterizing Reward Hacking — J. Skalse, N. H. R. Howe, D. Krasheninnikov, D. Krueger — NeurIPS, 2022 — https://arxiv.org/abs/2209.13085 — ch. 26
- Reward Tampering Problems and Solutions in Reinforcement Learning: A Causal Influence Diagram Perspective — T. Everitt, M. Hutter, R. Kumar, V. Krakovna — arXiv:1908.04734, 2019 — https://arxiv.org/abs/1908.04734 — ch. 26
- Sycophancy to Subterfuge: Investigating Reward-Tampering in Large Language Models — C. Denison, M. MacDiarmid, F. Barez, D. Duvenaud, S. Kravec, S. Marks, N. Schiefer, R. Soklaski, A. Tamkin, J. Kaplan, B. Shlegeris, S. R. Bowman, E. Perez, E. Hubinger — arXiv:2406.10162, 2024 — https://arxiv.org/abs/2406.10162 — ch. 26 — note: year from the arXiv number
- SWE-bench: Can Language Models Resolve Real-World GitHub Issues? — C. E. Jimenez et al. — ICLR, 2024 — https://arxiv.org/abs/2310.06770 — ch. 25
- SWE-rebench: An Automated Pipeline for Task Collection and Decontaminated Evaluation of Software Engineering Agents — I. Badertdinov et al. — arXiv:2505.20411, 2025 — https://arxiv.org/abs/2505.20411 — ch. 25 — note: preprint
- Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection — K. Greshake, S. Abdelnabi, S. Mishra, C. Endres, T. Holz, M. Fritz — ACM AISec, 2023 — https://doi.org/10.1145/3605764.3623985 — ch. 24
- Securing AI Agents with Information-Flow Control (FIDES) — M. Costa et al. — arXiv:2505.23643, 2025 — https://arxiv.org/abs/2505.23643 — ch. 24 — note: preprint
- Defeating Prompt Injections by Design (CaMeL) — E. Debenedetti et al. — arXiv:2503.18813, 2025 — https://arxiv.org/abs/2503.18813 — ch. 24 — note: preprint

### LLMs and ML in or for the kernel (12)

- KEN: Kernel Extensions using Natural Language — Y. Zheng, Y. Yang, M. Chen, A. Quinn — arXiv:2312.05531, 2023 — https://arxiv.org/abs/2312.05531 — ch. 17, 30 — note: preprint
- Kgent: Kernel Extensions Large Language Model Agent — Y. Zheng, Y. Yang, M. Chen, A. Quinn — eBPF '24 (SIGCOMM workshop), 2024 — https://doi.org/10.1145/3672197.3673434 — ch. 17, 30
- Towards Agentic OS: An LLM Agent Framework for Linux Schedulers (schedcp) — Y. Zheng, Y. Hu, W. Zhang, A. Quinn — arXiv:2509.01245 (MLforSystem 2025), 2025 — https://arxiv.org/abs/2509.01245 — ch. 30
- Learning Scheduling Algorithms for Data Processing Clusters — H. Mao, M. Schwarzkopf, S. B. Venkatakrishnan, Z. Meng, M. Alizadeh — ACM SIGCOMM, 2019 — https://doi.org/10.1145/3341302.3342080 — ch. 30
- LiteFlow: Towards High-Performance Adaptive Neural Networks for Kernel Datapath — J. Zhang et al. — ACM SIGCOMM, 2022 — https://doi.org/10.1145/3544216.3544229 — ch. 29
- Towards a Machine Learning-Assisted Kernel with LAKE — H. Fingler et al. — ASPLOS, 2023 — https://doi.org/10.1145/3575693.3575697 — ch. 29
- Can eBPF Run a Real Language Model? Lessons from a Kernel-Resident Qwen3 Forward Pass — Y. Zheng — report in the qwen3-ebpf repository, 2026 — https://github.com/eunomia-bpf/qwen3-ebpf/blob/main/paper/bpfllm.pdf — ch. 29 — note: not peer reviewed
- Qwen3 Technical Report — A. Yang et al. (Qwen Team) — arXiv:2505.09388, 2025 — https://arxiv.org/abs/2505.09388 — ch. 29
- GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints — J. Ainslie et al. — EMNLP, 2023 — https://arxiv.org/abs/2305.13245 — ch. 29
- RoFormer: Enhanced Transformer with Rotary Position Embedding — J. Su et al. — arXiv:2104.09864, 2021 — https://arxiv.org/abs/2104.09864 — ch. 29
- Online normalizer calculation for softmax — M. Milakov, N. Gimelshein — arXiv:1805.02867, 2018 — https://arxiv.org/abs/1805.02867 — ch. 29
- I-BERT: Integer-only BERT Quantization — S. Kim et al. — ICML, 2021 — https://arxiv.org/abs/2101.01321 — ch. 29

### Adjacent systems: IFC, filesystems, memory, profiling (19)

- A Lattice Model of Secure Information Flow — D. E. Denning — Communications of the ACM 19(5), 1976 — https://doi.org/10.1145/360051.360056 — ch. 24
- JFlow: Practical Mostly-Static Information Flow Control — A. C. Myers — ACM POPL, 1999 — https://doi.org/10.1145/292540.292561 — ch. 24
- Labels and Event Processes in the Asbestos Operating System — P. Efstathopoulos, M. Krohn, S. VanDeBogart, C. Frey, D. Ziegler, E. Kohler, D. Mazières, F. Kaashoek, R. Morris — ACM SOSP, 2005 — https://doi.org/10.1145/1095810.1095813 — ch. 24
- Making Information Flow Explicit in HiStar — N. Zeldovich, S. Boyd-Wickizer, E. Kohler, D. Mazières — OSDI, 2006 — https://www.usenix.org/conference/osdi-06/making-information-flow-explicit-histar — ch. 24
- Information Flow Control for Standard OS Abstractions (Flume) — M. Krohn, A. Yip, M. Brodsky, N. Cliffer, M. F. Kaashoek, E. Kohler, R. Morris — ACM SOSP, 2007 — https://doi.org/10.1145/1294261.1294293 — ch. 24
- TaintDroid: An Information-Flow Tracking System for Realtime Privacy Monitoring on Smartphones — W. Enck et al. — OSDI, 2010 — https://www.usenix.org/conference/osdi10/taintdroid-information-flow-tracking-system-realtime-privacy-monitoring — ch. 24
- CamFlow: Managed Data-Sharing for Cloud Services — T. Pasquier, J. Singh, D. Eyers, J. Bacon — IEEE Transactions on Cloud Computing 5(3), 2017 — https://doi.org/10.1109/TCC.2015.2489211 — ch. 24
- Runtime Analysis of Whole-System Provenance (CamQuery) — T. Pasquier, X. Han, T. Moyer, A. Bates, O. Hermant, D. Eyers, J. Bacon, M. Seltzer — ACM CCS, 2018 — https://doi.org/10.1145/3243734.3243776 — ch. 24
- TMO: Transparent Memory Offloading in Datacenters — J. Weiner et al. — ASPLOS, 2022 — https://doi.org/10.1145/3503222.3507731 — ch. 25
- Serverless in the Wild: Characterizing and Optimizing the Serverless Workload at a Large Cloud Provider — M. Shahrad et al. — USENIX ATC, 2020 — https://www.usenix.org/conference/atc20/presentation/shahrad — ch. 25
- cache_ext: Customizing the Page Cache with eBPF — T. Zussman et al. — ACM SOSP, 2025 — https://doi.org/10.1145/3731569.3764820 — ch. 20
- Extension Framework for File Systems in User space (ExtFUSE) — A. Bijlani, U. Ramachandran — USENIX ATC, 2019 — https://www.usenix.org/conference/atc19/presentation/bijlani — ch. 28
- To FUSE or Not to FUSE: Performance of User-Space File Systems — B. K. R. Vangoor, V. Tarasov, E. Zadok — USENIX FAST, 2017 — https://www.usenix.org/conference/fast17/technical-sessions/presentation/vangoor — ch. 28
- High Velocity Kernel File Systems with Bento — S. Miller et al. — USENIX FAST, 2021 — https://www.usenix.org/conference/fast21/presentation/miller — ch. 28
- Understanding Manycore Scalability of File Systems (FxMark) — C. Min et al. — USENIX ATC, 2016 — https://www.usenix.org/conference/atc16/technical-sessions/presentation/min — ch. 28
- namei_ext: Programmable VFS Name Resolution without Filesystem Ownership — authors not given in chapter 28 — paper draft in docs/paper/, draft — https://github.com/eunomia-bpf/namei_ext — ch. 28 — note: unpublished draft
- The Flame Graph — B. Gregg — Communications of the ACM 59(6), 2016 — https://doi.org/10.1145/2909476 — ch. 22
- Google-Wide Profiling: A Continuous Profiling Infrastructure for Data Centers — G. Ren, E. Tune, T. Moseley, Y. Shi, S. Rus, R. Hundt — IEEE Micro 30(4), 2010 — https://doi.org/10.1109/MM.2010.68 — ch. 22
- Coz: Finding Code that Counts with Causal Profiling — C. Curtsinger, E. D. Berger — ACM SOSP, 2015 — https://doi.org/10.1145/2815400.2815409 — ch. 31 — note: Best Paper; also arXiv:1608.03676 and CACM 2018

## Deliberately excluded

- Non-paper references: kernel docs, man pages, LWN articles, blog posts, mailing-list patch series, LPC talks given only as videos/slides (bpftime LPC 2023, gpu_ext LPC 2025, "Towards truly portable eBPF" LPC 2021), Black Hat 2016 slides, project sites, specifications other than RFC 9669 (MCP spec, Agent Skills spec, BLAKE3 spec, RFC 8878, RFC 8628, age).
- RFC 9669 is included in the origins group although it is a standard, because it is the ISA's primary source; it is marked as such.
- Prose-only mentions with no entry in any References list (no URL in the curriculum, so not included): KFlex (SOSP '24, ch 14); Neutrino (OSDI '25), TimeGraph (ATC '11), Gdev (ATC '12), Paella (SOSP '23), LithOS (SOSP '25), Forest (ISCA '25), SUV (MICRO '24) (ch 20); Resource Central (SOSP '17, ch 25); KPerfIR (OSDI 2025), GPA (CGO 2021), DrGPU (ICPE 2023), Daydream (USENIX ATC 2020), Event Tensor (MLSys 2026) (ch 31, as part of a citation audit summary).
- Artifact DOI (Zenodo 10.5281/zenodo.22907396, ch 19) is an artifact, not a paper.

## Not verified here

- URLs and bibliographic details are copied from the citing chapters; they were not re-fetched for this appendix.
- Years for WALI (arXiv:2312.03858) and Sycophancy to Subterfuge (arXiv:2406.10162) are taken from the arXiv identifier.
- The two unpublished drafts (BPFOptBench, namei_ext) have no author list in the citing chapters.
