# Research notes — Chapter 21: nccl-eBPF (NCCLbpf)

## Sources studied

- Repo: https://github.com/eunomia-bpf/nccl-eBPF at `9a6006e2fd21835ff614e854b8ba858edf595312`
  (2026-09-29, "Add Spark TP4 mid-size SIMPLE policy candidate"). Cloned to
  `/home/user/workspace/src/nccl-eBPF` with `--depth 1 --filter=blob:limit=2m`, then deepened by 60
  commits to read the history.
- Submodule pins (from `git ls-tree HEAD`):
  - `nccl` → `361915904b456d397e6e1578f8f65ea1a45bdd28` (`makefiles/version.mk`: 2.29.7)
  - `bpftime` → `8a359fc86438b8b3b0b58e38cff0b190c7e68893`
  - `libbpf` → `02bdeb7a2c2e7cb2c9cecb125527a9c5a6bbf139`, `bpftool` → `4a0b800a1d3b0c54544df153bcaa4f443b3deb76`
- NCCL source read on raw.githubusercontent.com at the pinned commit:
  `src/include/plugin/tuner/tuner_v5.h`, `src/include/plugin/nccl_tuner.h`, `src/enqueue.cc`
  (lines ~1887–2075: `initCollCostTable`, `updateCollCostTable`, `topoGetAlgoInfo`, `ncclGetAlgoInfo`),
  `src/include/device.h` (`ncclLLFifoLine`, LL128 line size 128), `src/plugin/tuner/tuner_v5.cc`
  (`dlsym(lib, "ncclTunerPlugin_v5")`), `src/plugin/net/net_v11.cc` (`dlsym(lib, "ncclNetPlugin_v11")`),
  `plugins/tuner/README.md`, `plugins/net/README.md`.
- NVIDIA docs: env vars page (NCCL_ALGO, NCCL_PROTO, NCCL_TUNER_PLUGIN, NCCL_NET_PLUGIN,
  NCCL_PROFILER_PLUGIN, NCCL_MAX/MIN_NCHANNELS), collectives page, NCCL 2.4 double-binary-tree blog,
  nccl-tests `doc/PERFORMANCE.md` (busbw = algbw·2(n-1)/n for allreduce).
- Paper in repo: `docs/paper/paper.tex` (frozen). Published: eBPF '26 (4th Workshop on eBPF and Kernel
  Extensions, Prague, Sep 29–Oct 2 2026), DOI 10.1145/3837779.3838156; ACM DL search excerpt lists
  pages 90–96 (direct fetch of dl.acm.org returned 403 to curl; pages from search excerpt).
  arXiv: 2603.11438 (v1 12 Mar 2026, v2 4 May 2026).

## NCCL facts used (with sources)

- tuner v5 struct: `init(ctx, commId, nRanks, nNodes, logFunction, nvlDomainInfo, constants)`,
  `getCollInfo(ctx, collType, nBytes, numPipeOps, float** collCostTable, numAlgo, numProto, regBuff, int* nChannels)`,
  `finalize`. Comments: ignored entries are -1.0 (`NCCL_ALGO_PROTO_IGNORE`); if getCollInfo fails NCCL falls
  back to default; plugin may set algo+proto together but not only one. No rank id in v5 init.
- `nccl_tuner.h`: ALGO TREE 0, RING 1, COLLNET_DIRECT 2, COLLNET_CHAIN 3, NVLS 4, NVLS_TREE 5, PAT 6;
  PROTO LL 0, LL128 1, SIMPLE 2; symbol `"ncclTunerPlugin_v5"`.
- `enqueue.cc ncclGetAlgoInfo`: local `float collCostTable[NCCL_NUM_ALGORITHMS][NCCL_NUM_PROTOCOLS]`,
  init to IGNORE, fill via `ncclTopoGetAlgoTime`, then `comm->tuner->getCollInfo(...)`, then
  `topoGetAlgoInfo` picks min non-negative entry; `info->nMaxChannels = nMaxChannels == 0 ? info->nMaxChannels : nMaxChannels`.
- `updateCollCostTable`: nRanks==1 → only Ring/Simple = 0; skips NVLS when !nvlsSupport, CollNet when unsupported etc.
- LL: `ncclLLFifoLine` = data1/flag1/data2/flag2 (4-byte data + 4-byte flag); LL128: 128-byte lines
  (`NCCL_LL128_LINESIZE 128`), `NCCL_LL128_DATAELEMS = LINEELEMS-1` (one 8-byte flag per 128-byte line).
- NCCL_PROTO doc: "enabling LL128 on platforms that don't support it can lead to data corruption".

## NCCLbpf facts

- Two plugins: `src/nccl-policy-plugin/` (tuner v5 + profiler v6 in `libnccl-policy.so`,
  exported `ncclTunerPlugin_v5` name "eBPFPolicy", `ncclProfiler_v6` name "eBPFPolicyProfiler"),
  `src/nccl-net-ebpf-plugin/` (net v11, `ncclNetPlugin_v11` with `.name = "Socket"`).
- Context `struct nccl_policy_ctx` (policy_context.h): 88 bytes v2; offsets n_bytes 0, latency fields
  8/16/24, call_count 32, coll_type 40, num_pipe_ops 44, reg_buff 48, n_ranks 52, n_nodes 56,
  current_channels 60, reserved 64 (holds sizeof ctx), n_nvl_domains 68, min 72, max 76, reserved2 80.
- Action: u64 packed: algo bits 0–7, proto 8–15, channels 16–23, aggressiveness 24–31, flags 32–39.
- `apply_policy_action`: channels applied if flag && >0; algo/proto applied only if both flags set, in
  range, and cell != IGNORE → set cell to 0.0f.
- Load path `load_program_from_object`: libbpf open → extract spec → create bpftime maps → distributed
  map opt-in check → attach kernel maps → relocate → `verify_program` (bpftime PREVAIL verifier; mode via
  NCCL_POLICY_VERIFY_MODE strict/warning/none; non-uprobe sections verified with "uprobe" rules) →
  `rank_agreement::check` for non-profiler programs → LLVM JIT (`set_vm_name("llvm")`, `bpftime_prog_load(true)`)
  → for distributed: dist_merge extract/verify/`rank_merge_verifier::check`/JIT.
- `rank_agreement_verifier.h`: forward abstract interpretation; shared ctx ranges {0,8},{40,48},{52,60},{64,80};
  rejects "rank-local action", "rank-local control flow" (unless r0 provably zero), writes to ctx/agreed map,
  subprogram calls, >200000 steps.
- Hot reload: `pluginReloadPolicyImpl` → `load_policy_state` then `std::atomic_exchange_explicit` on
  `shared_ptr` (paper describes as CAS of function pointer); distributed reload refused.
- Net plugin: resolves `ncclNetSocket` via dlsym RTLD_DEFAULT / dlopen NOLOAD sonames / /proc/self/maps;
  exec hook after successful op; observation only. Pinned NCCL does not export the symbol; experiment used
  a one-line visibility patch.
- Distributed agreed map: opt-in env; 1–8 ranks; rank from profiler v6; round-0 hash exchange; exchange
  every 1024 calls, activation at next 1024 boundary; 30 s default deadline; Unix socket same host, TCP via
  NCCL_POLICY_DIST_COORDINATOR. Non-atomic COMMIT caveat.

## My own checks (scratch, deleted afterwards)

- Built and ran `test_rank_agreement_verifier.cpp` and `test_rank_merge_verifier.cpp` with g++ -std=c++20:
  both print "... tests passed".
- Compiled policies with Debian clang 14 `-target bpf -O2 -g`. `llvm-objdump` of nvlink_ring_mid_v2 shows
  constants 12884902145 (=0x300000101 Ring/LL128 flags 3) and 12884902401 (=0x300000201 Ring/Simple).
- Wrote a small harness that feeds the `uprobe` section to `rank_agreement::check` with map relocations
  patched (my own approximation of the plugin's relocation): ACCEPT noop, size_aware_v5, nvlink_ring_mid_v2,
  nvl72_size_aware, spark_tp4_simple_64k_1m, distributed_max_latency (agreed_map marked agreed);
  REJECT adaptive_channels (insn 103 rank-local control flow), adaptive_channels_v2 (115, control flow),
  slo_enforcer (162, rank-local action), cpu_aware (23, control flow). Consistent with README statement that
  adaptive_channels/slo_enforcer are now rejected.
- Did NOT build bpftime, NCCL, or the plugins (no GPU, memory policy). `make test` not run.

## Evaluation numbers (only from repo)

- Paper Table 1 (CPU, 1M calls, AMD EPYC 9575F): native 20/30 ns P50/P99; noop 100/111; size_aware 100/111;
  lookup_only 130/140; lookup_update 140/151; adaptive_channels 140/151; slo_enforcer 150/160. Model
  80 + 30·lookups + 10·updates ns. 0.03% of ~394 µs 128 MiB 8-GPU allreduce.
- GPU noop: ~1.3 µs fixed (~4% of ~32 µs) for 8 B–256 KiB; eBPF dispatch 33 ns; <0.1% at ≥4 MiB.
- Verifier: 14 programs, 7 accepted, 7 rejected (phase3-safety-results.md table).
- Hot reload: 1.07 µs swap, ~9.4 ms total, zero lost of 400,000 calls (paper). phase3 run log: load=8824.853
  swap=0.606 (µs) on an earlier run.
- Sweep (Table 2, busbw GB/s, default NVLS vs Ring): 4M 133.5/148.1 +10.9%; 8M 196.3/249.7 +27.2%;
  16M 278.8/337.4 +21.0%; 32M 349.3/402.4 +15.2%; 64M 425.2/471.8 +11.0%; 128M 596.9/628.9 +5.4%;
  256M 656.5/632.5 −3.7%; 8G 836.3/697.6 −16.6%.
- Policy v2 (reps 4–5): 4M 132.1→139.8; 8M 194.9→246.5; 16M 277.5→336.1; 32M 348.5→401.6; 64M 425.1→470.8;
  128M 595.3→627.9 (5.5–26.5%). Cold-start instability 2–3 launches.
- bad_channels: paper 87–95% degradation; eval-plan table 87.7–93.5% at 1M/16M/128M.
- AllGather 128 MiB 20 runs: 565.6±0.9 (CV 0.15%) vs 565.5±0.6 (CV 0.10%).
- Composability: 2→12 channels over 100,000 calls; contention 12→2; recovery back to 12.
- Net plugin (RTX 5090, 2 ranks one GPU, Socket, 128 MB, 5 runs): mean 2.134 vs 2.094 GB/s (~1.87%), medians 2.13/2.15.
- Note discrepancies: paper's Listing 1 writes ctx fields (`ctx->algorithm = ...`, SEC("tuner")); repo policies
  return packed u64 and the checker rejects ctx writes → treat paper listing as illustrative. Paper says
  sentinel 1e9 for non-preferred; repo code only sets chosen cell to 0.0.

## Recent commits (summary)

- 2026-09-29 (LinuxDev9002): 4e74e1a rank-agreement checker; caf36b8 merge verifier; c2eaff1 compat;
  c7bb3ce same-host agreed map exchange (+1329 lines); b9513d8/9a247a3/3bf2bcc/7374a74 TCP exchange;
  docs 8007ca4/0052f9a/de6b4b6/7c4afcf/b88d107; a179abb distro LLVM; 18f18f7/9a6006e Spark TP4 policies;
  e087392 benchmark call summaries.
- 2026-09-24 (Yunwei): 50dc7b6 artifact packaging/CI; 0884fb3, fae10de, edfe374 artifact docs.
- 2026-09-06: d1ed426 merge PR #1 (GB300 NVL-domain policy, ctx v2, scripts/nccl_bench.sh).
- 2026-09-02: ACM rights metadata; 2026-08-13: many terse-message paper commits, source package.
- Earlier (Mar 2026): B300 eval, kernel_observer/cpu_aware, net plugin, paper revisions.

## Unverified / caveats

- ACM page range 90–96 from search excerpt only.
- Tracked top-level ELF files `check`, `tests`, `run_yaml`, `conformance_check` (42–75 MB, added in 040882b "a");
  purpose undocumented.
- Whether divergent channel counts hang or corrupt: repo itself says unknown (needs rerun).
