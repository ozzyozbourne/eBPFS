# Research notes — 26 · RewardGuard and safe change after external operations

## Sources studied

- `eunomia-bpf/reward-guard` @ `98d4f28530032c23bc8f5ee20239a95a44d895c4` (2026-09-16),
  cloned `--depth 1 --filter=blob:limit=2m` into `/home/user/workspace/src/reward-guard`,
  then deepened by 40 commits for the log.
- `eunomia-bpf/agent-check-restore-safety` @ `c3fbdae3675b7e83b9b1e261eea37d9d4c066d60`
  (2026-09-17), same clone method, `/home/user/workspace/src/agent-check-restore-safety`.

## reward-guard facts

- README: "The paper claim is not 'use eBPF to monitor agents.' The claim is that the benchmark
  trial's reward pipeline is the right runtime enforcement unit for reward-mechanism hacking."
- Contract (README, docs/canonical-paper-state.md, docs/design.md): reward-private sources,
  reward-critical objects, reward-visible sinks, validation gates, agent domain.
- Taxonomy (docs/design.md): E1 evaluator/test mutation, E2 hidden/gold access, E3 runtime evaluator
  manipulation (sitecustomize, conftest, LD_PRELOAD, PATH), E4 score/log/submission forgery,
  E5 exfiltration/external oracle, E6 service-side reward mutation; S1 public-test hardcoding
  (semantic), S2 pure spec shortcut, S3 LLM judge persuasion (non-OS-enforceable).
- Three lowering modes: event rule, flow rule (taint), temporal rule (unless after ... since ...).
- Code: `reward_guard/manifest.py` (Asset/Rule/Manifest dataclasses, kind source|sink, action
  block|notify|kill), `reward_guard/policy.py` (render_policy -> readable IR, "not an ActPlane kernel
  policy yet"), `reward_guard/cli.py`, `reward_guard/simulator.py`, `reward_guard/audit.py`.
- Latest commit 98d4f28 fixes `render_rule` dropping `tainted_by` when `unless_after` also present.
- Ran locally: `python3 -m reward_guard examples/minimal-task/rewardguard.json` -> prints IR (output
  copied into chapter). `python3 -m unittest`: 36 tests, 1 error (import of `yaml` missing in orb for
  tests/test_rewardhackingagents_actplane_grid.py) — environment issue, not repo bug.
- ActPlane policies actually used: `policies/actplane/rewardhackbench-runtime.yaml` (reserve rules
  for child-domain root), `write_rewardhackingagents_policy()` in
  `scripts/run_rewardhackingagents_actplane_guard.py` (block write evaluator, block open leak files),
  `write_submission_block_policy()` + `install_submission_blockers()` in
  `scripts/run_rewardhackbench_actplane_content_guard.py` (attach `actplane attach --pid` only to
  trial containers whose name starts with a trial dir prefix and ends `-main-1`).
- `is_retrieval_like_call()` decides retrieval provenance (webfetch/websearch/task/agent tools, bash
  with curl/wget/git/python + URL).
- AgentSight invoked as `agentsight record --db ... --no-server -c <comm>` (attach mode) or
  `agentsight record --db ... --no-server -- <cmd>` (wrap mode). ActPlane invoked
  `actplane --policy P run ...`, `actplane --policy P attach --pid N`, `actplane --policy P watch`.
- Results quoted (docs/canonical-paper-state.md, docs/evaluation.md lines ~118-123, 834):
  - R095/R098/R099/R105: 240 cells total; no-defense `naive_hf` hacks 45/45; ActPlane+AgentSight
    blocks 45/45 evaluator writes; controls 0/75 blocks; R102 no-hint 0/20 hacks, 0/20 blocks.
  - R105: 180/180 cells; no-defense naive_hf 30/30 hacks, reported 1.0 vs true 0.748452, gap 0.251548;
    blocked 30/30, reported=true=0.748452; controls 0/60 hacks, 0/60 blocks.
  - R098 SST-2: true 0.904817, gap 0.095183. R099 CIFAR-10: true 0.842720, gap 0.157280.
  - R093: long live paths (151-158 chars) — exact-path policy did not fire; fixed with short
    `/tmp/rg-rha/...` paths (R094 preflight, 45-char path).
  - RewardHackBench (README): webfetch=deny tool guard bypassed via `task` subagent or `bash`;
    R033/R034 reward 1.0; R017 ActPlane+AgentSight content block (submission zero bytes);
    R021 ActPlane-only still blocks; R022 AgentSight-only does not block; benign rows (pytest-6202,
    sympy-14531, sympy-12489 control) reward 1.0 with no attach.
  - Historical Tetragon matrix: no-defense 9/9 downloads; exec policy blocked 6/9; plus
    tcp_connect egress 9/9.
  - EvilGenie: detection only; post-hoc PID attach did not block Inspect/Docker write.
  - ImpossibleBench: intake/pilot only, no visible-pass/original-fail result yet.
- contrib/agentsight-net-detection: sslsniff uprobes on SSL_read/SSL_write; pin AgentSight >= v0.2.66
  (PR #133 merge e92acc23) — earlier MAX_BUF_SIZE 512 KB / RING_BUFFER_SIZE 2 MB drops events.
- Recent commits: 98d4f28 (09-16) render_rule fix #11; 26b861d, 1d5a2af (08-05) analysis notes;
  2bbf8b9 (08-05) AgentSight kernel-TLS detection harness #1; 33041c0 (07-24) inducement gradient;
  2026-07-09 many "Log ... refinement" paper-writing commits.

## agent-check-restore-safety facts

- README: "Change a live service without letting an interrupted external operation run twice or
  silently move to the new destination." `make safe-change-demo` -> `runtime-microservice-demo` ->
  `bash runtime/deploy/microservice/run.sh`.
- Core terms (runtime/README.md): History, Requirement, Operation, Rule, Certificate.
- Compose networks: payment [effects]; control [control, effects]; effect-proxy [workload, control];
  order [workload]; control-ingress [front, control]; order-ingress [front, workload]. All but front
  are `internal: true`. Payment runs `-drop-first-response=true`.
- Order (internal/order/service.go `submitProxy`): call ID `order/<order_id>/payment`, header
  `X-Safe-Change-Call-ID`, posts to effect proxy route; no token, no payment URL.
- Effect proxy (internal/effectproxy/proxy.go): route name -> kind/method/url; `callIdentity()`
  frames Idempotency-Key with route name; executor.Execute to control; 409 when outcome unknown.
- Gateway (internal/gateway/gateway.go `execute`): existing Operation -> request rebuilt from History
  (`requestFromOperation`), body must match; Succeeded -> Reused=true; Dispatched by other boot ->
  Unknown; Unknown -> query if queryable else retry only if RetrySafe.
- Payment (internal/payment/service.go `charge`): requires `X-Operation-ID == Idempotency-Key`;
  commits only if no record for id; counts deliveries.
- Demo expected: first order A-17 -> HTTP 409 phase unknown; v2 certificate planned and applied;
  proxy and order recreated; control restarted; retry A-17 -> 200 succeeded (charge-v1, v1 target);
  B-18 -> 200 via v2; payment stats deliveries 3, commits 2, /v1/charge 2, /v2/charge 1.
- Kernel phases: prepared, dispatched, unknown, succeeded, failed, cancelled.
- eBPF: NOT used. `docs/implementation.md` "Not implemented": "eBPF effect receipt mechanism";
  line 266 "eBPF inference is lower priority than an explicit, proof-aligned dispatch path."
  The only eBPF mentions are the Go module path (github.com/eunomia-bpf/...) and the legacy ACRFence
  paper (legacy/acrfence/main.tex) which proposed capturing context via AgentSight eBPF monitors.
- CRIU: NOT used. Mentioned only in docs/experiments.md (planned/simplification: Python deepcopy,
  session truncation) and legacy paper ("We use Claude Code's built-in checkpoint-restore rather than
  OS-level mechanisms such as CRIU"). Actual checkpoint/restore backends: QEMU full-VM snapshot and
  Firecracker microVM snapshot (runtime/internal/firecracker, Makefile targets).
- Demo NOT run here: needs Docker Compose image build with golang:1.25 base (Go build of several
  binaries); exceeds "light Python only" criterion.
- Papers: ACRFence arXiv:2603.20625 (Zheng, Yang, Zhang, Quinn; Mar 2026, cs.CR);
  "When Can Agents Safely Checkpoint, Fork, Restore, and Merge? Exact Checking for Execution Edits"
  arXiv:2608.22928 (Zheng, Song, Hu, Cheng, Huang, Zhang; Aug 2026, cs.PL) — current docs/paper/main.tex.
- Recent commits: c3fbdae/cfbf326/9c5218b (09-16/17) dependabot grpc, x/crypto; d0c855a (08-22) arXiv
  package; 44884e3, b5c16fc (08-17) History-gated Firecracker start / full-VM restore; 8d9f819 ..
  84841d8 (08-17) recover operations across microVM/Claude loss; 7689a30..c9fcbe1 (08-16) MCP
  continuity; fba6b86 (08-16) Firecracker restore backend.

## Verified papers (arXiv abs pages fetched 2026-11-06)

- RewardHackingAgents, Atinafu & Cohen, arXiv:2603.11337, Mar 2026.
- EvilGenie, Gabor, Lynch, Rosenfeld, arXiv:2511.21654, Nov 2025 (v2 May 2026).
- ImpossibleBench, Zhong, Raghunathan, Carlini, arXiv:2510.20270, Oct 2025.
- ActPlane, Zheng et al., arXiv:2606.25189, Jun 2026.
- AgentSight, Zheng, Hu, Yu, Quinn, arXiv:2508.02736, 2025 (ACM DOI 10.1145/3766882.3767169).
- Everitt, Hutter, Kumar, Krakovna, Reward Tampering..., arXiv:1908.04734.
- Denison et al., Sycophancy to Subterfuge, arXiv:2406.10162, 2024.
- Skalse et al., Defining and Characterizing Reward Hacking, arXiv:2209.13085 (NeurIPS 2022).
- From repo docs only (not independently fetched): TRACE arXiv 2601.20103, BenchJack 2605.12673,
  SpecBench 2605.21384, RewardHackBench github.com/islo-labs/reward-hack-bench.
