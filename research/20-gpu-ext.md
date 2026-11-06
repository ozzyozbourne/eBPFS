# Research notes — Chapter 20: gpu_ext (and eGPU)

Collected 2026-11-06. No GPU in the orb; nothing was built or run.

## Sources studied

| Source | Revision | How |
|---|---|---|
| https://github.com/eunomia-bpf/gpu_ext | `50a51ad4e8584d295df7c1942fe7e736cdd101ba` (2026-09-24) | `git clone --depth 1 --filter=blob:none --sparse`, sparse-checkout of `/*.md`, `Makefile`, `extension/`, `tools/`, selected `docs/`, `microbench/*/README.md`, `workloads/README.md`, `workloads/bpftime-device-smoke/` into `/home/user/workspace/src/gpu_ext` |
| https://github.com/eunomia-bpf/gpu_ext-kernel-modules | submodule pin `c4fd5655a08dce6eb3e027ac3ed58b0b85b9543c` (branch `port/nvidia-610.43.02`); default branch `test-sched` head `86e7e0dd` (2026-09-04) | GitHub API only: commit list, `compare/57130a27...c4fd5655`, raw file contents |
| https://github.com/NVIDIA/open-gpu-kernel-modules | tag `575.57.08` | GitHub API raw: `uvm_perf_prefetch.c`, `uvm_gpu_replayable_faults.c`, `uvm_va_block.c`, `uvm_pmm_gpu.c` |
| https://github.com/eunomia-bpf/eGPU | `166c175` (2025-11-13) | shallow clone; README only. **Not archived** per GitHub API (`archived:false`), but README says it "has been merged into bpftime and will be maintained there" |
| Paper submodule https://github.com/yunwei37/gbpf-paper | `8cf95bd8` (2026-09-24) | API: `main.tex`, `camera-ready-metadata.tex`, `tex-revision/{abstract,design,implementation,eval}.tex` |

## Papers (verified)

- arXiv:2512.12615 (arXiv API checked): **"gpu_ext: Extensible OS Policies for GPUs via eBPF"**. Authors: Yusheng Zheng, Tong Yu, Yiwei Yang, Minghui Jiang, Xiangyu Gao, Jianchang Su, Yanpeng Hu, Wenan Mao, Wei Zhang, Dan Williams, Andi Quinn. v1 2025-12-14, v2 2025-12-20, cs.OS. Affiliations (PDF): eunomia-bpf, UC Santa Cruz, Alibaba, UW, UConn, ShanghaiTech, Virginia Tech.
- Camera-ready (Crossref checked, DOI 10.1145/3845814.3850045): **"Safe and Programmable OS-Level GPU Resource Management with eBPF"**, Proceedings of the 32nd ACM ASPLOS, Volume 1, pages 804–820, published 2027-04-10 (Crossref date). Crossref lists 10 authors (no Yanpeng Hu); the paper repo's hidden author block lists 11. `camera-ready-metadata.tex`: "ASPLOS '27 ... submission #1797, April cycle", Heraklion, April 11–15 2027. `docs/revision-shepherd-comment.md` holds the ASPLOS 2027 revision/shepherd record.
- eGPU (Crossref checked, DOI 10.1145/3723851.3726984): "eGPU: Extending eBPF Programmability and Observability to GPUs", Yiwei Yang, Tong Yu, Yusheng Zheng, Andrew Quinn, Proc. 4th Workshop on Heterogeneous Composable and Disaggregated Systems (HCDS '25), pp. 73–79, 2025.
- LPC 2025 talk: "Extending eBPF to GPU Device and Driver Contexts", Yusheng Zheng, Tong Yu, 12 Dec 2025, eBPF track, https://lpc.events/event/19/contributions/2168/ . Abstract claims device approach "can be 3–10× faster than NVBit".

## Numbers quoted (source)

arXiv v2:
- Abstract: throughput up to 4.8×, tail latency up to 2×.
- Impl: Linux 6.15, ~1 KLOC kernel file for hook registration and verifier extensions; ~100 LOC instrumentation in NVIDIA modules; ~10 KLOC loader/JIT built on bpftime; ~1 KLOC LLVM backend to PTX.
- Setup: Server A Core Ultra 9 285K, 128 GB, RTX 5090 (32 GB); Server B 2× Xeon Gold 6138, 256 GB, P40. 10 trials geomean.
- llama.cpp GPT-OSS-120B MXFP4 (59 GiB, 1.84× oversubscription): decode 4.8× over framework offloading (ncmoe).
- vLLM Qwen-30B FP8 MoE, 100 concurrent ShareGPT requests: mean and p99 TTFT 1.7–2×, decode throughput 1.3× vs vLLM CPU offload (`--cpu-offload-gb 8`).
- Faiss SIFT IVF4096,Flat: build time −21–29%, search latency −10–16%.
- Microbench (vector add, 40 GB, 1.25× oversub): device-only prefetch 1.34×, host+device stride 1.77×, sequential −8%.
- Multi-tenant compute-bound (2 LC + 4 BE): LC P99 launch latency 1188 µs → 53 µs; BE throughput 11.38 → 11.47 kernels/s (+0.8%). Timeslices LC 1 s, BE 200 µs.
- Memory-bound multi-tenant (HotSpot, GEMM, K-Means): total completion −55–92%; scheduler-only <1%.
- Two-tenant llama.cpp + GNN: TPOT −40–45%, TTFT −14–20%, GNN epoch +28% (23.2 s → 16.7 s).
- Hooks enabled, no policy: <0.2% overhead (GEMM/HotSpot, 1.1× oversub).
- Table 1 LOC: FIFO 145, LFU 304, Quota LRU 472, Adaptive Seq 375, Stride 472, GPU L2 stride (device) 45, Tree prefetch 454, Dynamic timeslice 408, Preemption control 925, MaxSteals 16, LatencyBudget 19.
- Table 2 (P40, llama.cpp prefill): kernelretsnoop 153 LOC 8% vs NVBit 85%; threadhist 89 LOC 3% vs 87%; launchlate 347 LOC 14% vs 93%.
- Fig. 12: warp-uniform execution reduces overhead 60–80% vs eGPU-style; CPU map via PCIe ~6000× slower.
Camera-ready (`tex-revision/`):
- Abstract: AI-generated policies 1.76× throughput over application-tuned baselines; tail latency up to 2×; seven prior policies reimplemented close to native; zero kernel panics during optimization.
- Eval: llama.cpp decode 1.76× over cudaMemAdvise hints, 4.8× over ncmoe=64; vLLM TTFT 1.7–2×, TPOT −27.3%; GPREEMPT-style 96% (1188→53 µs); agent ran 20 days, 974 benchmark runs, 244 edits, 59 policies, 5.5M tokens ($388); matched ports: MoE-Infinity TTFT −22.1% native / −22.5% gpu_ext, Expert Buffering −12.85% both, FineMoE +24.6% (0.21% from native), Hummingbird p99 −7.5–8.2% native / −5.9–9.1% gpu_ext, POD-Attention −0.44%…+1.18% vs native.
- UVM hooks at four locations: activate, access, evict_prepare, prefetch. TSG task_init/task_destroy.
ARTIFACT.md: LMCache local-disk read p99 FIFO / native200 / bpf200 = 323.707 / 123.141 / 118.097 ms.

## Repo caveats found (important for honest text)

- `docs/revision-safety-design.md` (2026-09-03): the GPU SIMT verifier lives in a bpftime branch (`revision/r5-safety-evidence`, `36610ee`); the bpftime build used for experiments (`build-cuda-pr503`) has `ENABLE_EBPF_VERIFIER=OFF`. "strict verifier-to-device deployment is not established by the CPU tests".
- `microbench/fig15-device/legacy-evidence-audit.md`: the device overhead figure (eGPU-style vs warp-aggregated) "has no pinned warp-aggregation implementation or official eGPU artifact behind its two labels"; recommends stopping that comparison.
- Correction (review part 5): no version of the paper (arXiv v1, v2, camera-ready tex) names `BPF_PROG_TYPE_GPU_*` program types. The real paper-vs-code gap is the hook/kfunc names: the paper's listings use `gpu_activate`, `gdrv_mem_*_ctx_t`, `bpf_gpu_move_head/tail`, `bpf_gpu_set_attr`, `gdrv_sched_preempt`, `bpf_gpu_prefetch_async`, none of which exist in the fork. The code uses standard `BPF_PROG_TYPE_STRUCT_OPS` with `struct gpu_mem_ops` (nvidia-uvm) and `struct nv_gpu_sched_ops` (nvidia), plus kprobe/uprobe programs calling kfuncs.
- README says kernel module is based on 575.57.08; the pinned submodule commit is the 610.43.02 port (`GPUBPF-PORT.md`: built for 6.15.11 and 7.1.12, "Runtime load/attach testing is pending"). The 575 line lives on `test-sched`.
- `nv_gpu_sched_ops` has three members on the 610 port, four (`on_timeslice_control` added) on `test-sched` and in `extension/gpu_sched_set_timeslices.h`.
- Cross-VA-block migration kfunc `bpf_gpu_migrate_range()` removed after safety review; 14 policies listed in `DEFERRED_VA_SPACE_APPS` are excluded from the default build (extension/Makefile).
- extension/README (Chinese): "eviction 逻辑放在 gpu_block_activate，不是 gpu_block_access。后者从未被调用"; use PERCPU_ARRAY not HASH (HASH timeouts caused Xid 31); struct_ops run in UVM kernel thread context so `bpf_get_current_pid_tgid()` is not the app PID; `bpftool struct_ops unregister` segfaults on 6.15.11 → `cleanup_struct_ops_tool`. In upstream, `uvm_pmm_gpu_mark_root_chunk_used` is called only from `block_mark_memory_used` (uvm_va_block.c:3565) when a 2 MB block becomes GPU-resident.
- CLAUDE.md: struct_ops is a global singleton; experiments must run serially.

## Kernel side facts (fork at c4fd5655 vs NVIDIA 57130a27)

Files changed (compare API): `kernel-open/nvidia-uvm/uvm_bpf_struct_ops.{c,h}` (new, 457+61), `uvm_perf_prefetch.c` (+98 −29), `uvm_pmm_gpu.c` (+273 −26), `uvm_pmm_gpu.h`, `uvm.c` (+23), `uvm_migrate.c` (+42), `uvm_devmem.c`, `uvm_pmm_test.c` (+520), test ioctl files; `kernel-open/nvidia/nv-gpu-sched-hooks.{c,h}` (new, 515+134), `nv.c` (+14); `kernel-open/common/inc/nv-gpu-transition-validator.h` (new, 529); `kernel-open/tests/transition-validator/` (new); `src/nvidia/.../kernel_channel_group_api.c` (+97), `kernel_channel_group.c`, `kernel_channel.c`, `osapi.c`, `nv-gpu-sched-hooks.h` (RM side), `exports_link_command.txt`; `GPUBPF-PORT.md`.

- `uvm_bpf_struct_ops.c`: `struct gpu_mem_ops` with 6 members; `register_bpf_struct_ops(&gpu_mem_ops_struct_ops, gpu_mem_ops)`; `reg` uses `cmpxchg(&uvm_ops, NULL, ops)` → single instance (`-EEXIST`); kfuncs `bpf_gpu_strstr` (test), `bpf_gpu_set_prefetch_region` (KF_TRUSTED_ARGS), `bpf_gpu_request_reorder` (KF_TRUSTED_ARGS); registered for STRUCT_OPS and KPROBE prog types; `btf_struct_access` returns `-EACCES` (no direct writes); `/proc/bpf_testmod_trigger` calls `gpu_test_trigger`; wrappers `uvm_bpf_call_gpu_*` with RCU.
- Action codes: DEFAULT 0, BYPASS 1, ENTER_LOOP 2.
- `compute_prefetch_region()` in uvm_perf_prefetch.c now calls `uvm_bpf_call_gpu_page_prefetch`, validates with `nv_gpu_transition_validate_region`, BYPASS → validated region, ITERATE → per-subregion `gpu_page_prefetch_iter`, else native threshold loop (default threshold 51%, module param `uvm_perf_prefetch_threshold`).
- PMM: `chunk_update_lists_locked` → `uvm_bpf_call_gpu_block_activate` after native move-tail to USED; `root_chunk_update_eviction_list(..., invoke_access_hook)` → `uvm_bpf_call_gpu_block_access` for USED; `pick_root_chunk_to_evict` → `uvm_bpf_call_gpu_evict_prepare` when free lists empty, before unused/used selection.
- Scheduling: `nv_gpu_sched_ops` (on_task_init, on_bind, on_task_destroy [+ on_timeslice_control on test-sched]); kfuncs `bpf_nv_gpu_set_timeslice`, `bpf_nv_gpu_set_interleave`, `bpf_nv_gpu_reject_bind` (KF_TRUSTED_ARGS), `bpf_nv_gpu_preempt_tsg` (KF_SLEEPABLE, also registered for BPF_PROG_TYPE_UNSPEC). Noinline traceable functions `nv_gpu_sched_task_init/bind/token_request/task_destroy`. Call site in `kchangrpapiConstruct_IMPL` validates via `nv_gpu_transition_validate_scheduler` then `kfifoChannelGroupSetTimeslice` / `kchangrpSetInterleaveLevel`.
- Upstream fault path names (575.57.08): `uvm_parent_gpu_service_replayable_faults` → `fetch_fault_buffer_entries` → `service_fault_batch` → `service_fault_batch_dispatch` → `service_fault_batch_block` → `service_fault_batch_block_locked` → `uvm_va_block_select_residency` / `uvm_va_block_service_locked` → `uvm_va_block_get_prefetch_hint` → `uvm_perf_prefetch_get_hint_va_block` → `compute_prefetch_mask` → `compute_prefetch_region`; `push_replay_on_gpu`.
- Kernel-modules commit history: first gpu_ext commit `920d44e6` 2025-11-21 "Add BPF struct_ops support and initialization to UVM driver"; eviction hooks 2025-11-24; scheduling struct_ops 2025-12-05; rename `uvm_gpu_ext` → `gpu_mem_ops` 2026-02-27; cross-block prefetch 2026-02/03; 610 port 2026-08-31; transition validators 2026-09-01; test-sched 2026-09-02..04 (GSP propagation, per-runlist identity, timer correlation).

## gpu_ext repo recent activity

- Repo created 2025-11-20, 72 stars, 1.6 GB. History gap: commit `d5ff7b51` 2026-04-16 then `d47e6c2` 2026-08-31.
- 2026-08-31 … 2026-09-24: ~1,311 commits (shallow fetch since 2026-06-01): ASPLOS revision experiments (MoE-Infinity, Expert Buffering, FineMoE, Hummingbird, POD-Attention, XSched, GPREEMPT, LMCache local disk), artifact guide (`ARTIFACT.md`, CPU-only `scripts/artifact/reanalyze.py`), safety evidence (`docs/experiment/revision-safety/`), MoE adaptive-prefetch governor campaign (2026-09-10), final 2026-09-24 "Update paper submodule to gpu_ext camera-ready version".

## Device side

- `workloads/bpftime-device-smoke/probe.bpf.c`: `SEC("kretprobe/_Z9vectorAddPKfS0_Pfi")`, map type 1502 (bpftime per-GPU-thread array); negative fixture uses helper 511 (lane id) in a branch for verifier rejection.
- Runtime is bpftime (`attach/nv_attach_impl`) + llvmbpf PTX; covered in chapters 15 and 16.
- Paper: warp leader via `__ffs(__activemask())`, `__ballot_sync`/`__shfl_sync`; uniformity dataflow; banned GPU-wide barriers and non-uniform atomics; hierarchical maps flushed at kernel completion.
