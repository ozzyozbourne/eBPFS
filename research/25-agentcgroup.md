# Research notes — Chapter 25: AgentCgroup

## Source
- Repo: https://github.com/eunomia-bpf/agentcgroup, default branch `main`,
  studied at `551ca1689b7d2d30db6b8a8613414750103cc68b` (2026-07-22, "Correct nested sub-agent timing analysis (#8)").
- Clone: `/home/user/workspace/src/agentcgroup` (`--depth 1 --filter=blob:limit=2m`); submodules
  (third_party/scx, third_party/bpftool, paper-repo, agentsight) NOT fetched (empty dirs).
- GitHub metadata (gh api, 2026-11-06): Python, GPL-2.0, created 2026-01-31, pushed 2026-10-28, 84 stars,
  size 83,828 KB, not fork, not archived.
- README clone URL still says `github.com/yunwei37/agentcgroup.git`.

## Paper
- arXiv:2602.09345 [cs.OS, cs.AI], "AgentCgroup: Understanding and Controlling OS Resources of AI Agents".
  Authors: Yusheng Zheng, Jiakun Fan, Quanzhi Fu, Yiwei Yang, Wei Zhang, Andi Quinn.
  v1 10 Feb 2026, v2 21 Feb 2026, v3 22 Jul 2026. Verified from arxiv.org/abs page (export.arxiv.org API returned 503).
  Affiliations (HTML v3): UC Santa Cruz (Zheng, Yang, Quinn), Virginia Tech (Fan, Fu), UConn (Zhang).
  DOI 10.48550/arXiv.2602.09345. License CC BY 4.0.
- Setup (§3.1): Intel Core Ultra 9 285K, 24 cores, 128 GB, Ubuntu 24.04, Linux 6.15.11, cgroup v2; Podman
  containers, SWE-rebench images 2.9–17.3 GB, no limits; Claude Code with Claude Haiku 4.5 (cloud) and
  GLM-4.7-Flash (local GPU). 111 GLM tasks + 33 Haiku tasks (subset) = 144. 1-s sampling (podman stats).
- Findings: OS-level execution 55–60% of latency; LLM reasoning 40–45%; init 31–48%; tool exec 13–24%
  of lifecycle; tool share of active time mean 19.8% (Haiku), 34.9% (GLM).
  Bash+subagent >90% of Haiku tool time (80.6% / 17.3%); GLM Bash 98.8%.
  Test execution share of Bash time: Haiku 73.3%, GLM 44.5%.
  Avg CPU Haiku 13.2%, GLM 7.6% (one core =100%). Peak mem 2–4 GB -> 32–64 instances on 128 GB.
  ~185 MB framework baseline (Haiku 183, GLM 188). Bash peak memory differs 13.7x by command.
  pytest P95 spike 518 MB (Haiku)/234 MB (GLM); pip ~233 MB; file exploration 4.5 MB, git 13.5 MB.
  98.5% of >300 MB bursts in tool calls (Haiku, 28.5% of time); GLM 67.3% in 35.8% of time.
  pydicom peak 4060 MB vs avg 264 MB = 15.4x. Up to 2.9 GB change in 1 s; max rate 3 GB/s.
  Retry loops: 85% (28/33) Haiku, 97% (108/111) GLM; up to 56 consecutive; 502 MB unreleased worst.
  CPU–mem correlation −0.84..+0.50, mean −0.39. Images avg 3.5 GB. iterative/dvc 402/222/259 s = 1.8x.
  Peak memory 197 MB–4 GB, CV 147%.
- Mismatches: granularity, responsiveness, adaptability (Table 2).
- Design §5: bash wrapper, ephemeral `tool_<pid>_<ts>/`; sched_ext; memcg_bpf_ops; throttle then
  cgroup.freeze (paper claim; no `freeze` in agentcg/ code — grep found nothing); AGENT_RESOURCE_HINT;
  stderr feedback. "Linux 6.15 with memcg_bpf_ops patches (under upstream review)".
- Eval §6: Intel Core Ultra 7 258V, 4 cores, 16 GB, patched 6.19.0-rc5 (bpf-next + memcg RFC).
  Traces replayed 50x; HIGH dask/dask (peak 421 MB, memory.high=max), two LOW github3.py (406 MB, memory.high=400 MB).
  Tight 1100 MB: baseline 66% survival, BPF 100%, 239 delay triggers, HIGH +2.8%.
  1300 MB: HIGH P95 alloc latency 70.97 -> 50.14 ms (29%). P50 +0.3%, total time −1.1%.
  Selftest 2000 ms delay -> 2.000 ± 0.046 s (<2.3%).
  Repo copy: agentcg/memcg/EXPERIMENT_REPORT.md lines ~530–550, 375, 440.

## Code facts (paths relative to repo)
- agentcg/bash_wrapper.sh (121 lines): installed as /usr/bin/bash, real bash at /usr/bin/real-bash; only `-c`
  invocations wrapped; AGENTCG_ROOT default /sys/fs/cgroup/agentcg/session_high; AGENTCG_LOG default
  /tmp/agentcg_tools.jsonl; AGENTCG_DISABLE=1; hints memory:low=256 MiB, medium=1 GiB, high=max, Ng, Nm
  -> memory.high; writes $$ to tool cgroup cgroup.procs; reads memory.peak/current; exit 137 -> stderr
  feedback; JSONL log; moves back to parent and rmdir.
- agentcg/bash_wrapper_local.sh: tmpdir simulation, /proc VmRSS.
- agentcg/agentcgroupd.py (351 lines): setup_cgroup_hierarchy: session_high, session_low,
  subtree_control "+memory +cpu" on root and session_high, cpu.weight 150/50. Starts
  scheduler/scx_flatcg -i 5; memcg controller; process/process -m 2 -c python,bash,pytest,node,npm.
  Options --cgroup-root (default /sys/fs/cgroup/agentcg), --no-scheduler, --no-memcg, --commands, -v. Requires root.
  handle_event only logs (EXEC/EXIT/FILE_OPEN/BASH_READLINE).
- agentcg/memcg_controller.py: BpfMemcgController (runs memcg/memcg_priority --high --low --delay-ms 50
  --threshold 1 --below-low) chosen if binary exists; else CgroupMemcgController fallback: signals memory.events
  high delta, memory.pressure "some total" delta, memory.current >= 85% memory.max; protection: HIGH memory.low =
  80% of parent max (or 1 GiB), LOW memory.high = 50% (or 512 MiB); window 1 s.
- agentcg/memcg/memcg_priority.bpf.c (209 lines): tp/memcg/count_memcg_events counts PGFAULT (hard-coded 23)
  for high_cgroup_id in 1 s window; threshold -> trigger_ts; 1 s protection window;
  struct_ops below_low, below_min (HIGH, `high_mcg_ops`), get_high_delay_ms (LOW, `low_mcg_ops`),
  both SEC(".struct_ops.link").
- agentcg/memcg/memcg_priority.c: cgroup id = st_ino of cgroup dir; bpf_map__attach_struct_ops_opts with
  opts.relative_fd = cgroup fd (from patch series). Options --high --low --delay-ms --threshold --below-low --below-min -v.
- agentcg/memcg/patches.mbox: [RFC PATCH bpf-next v6 00/12] "mm: memcontrol: Add BPF hooks for memory
  controller", Hui Zhu, 4 Feb 2026, Message-ID cover.1770194182.git.zhuhui@kylinos.cn; 5 patches by Roman Gushchin
  from "mm: BPF OOM" v2 (lore 20251027231727.472628-1-roman.gushchin@linux.dev, 27 Oct 2025).
  struct memcg_bpf_ops { handle_cgroup_online, handle_cgroup_offline, below_low, below_min, get_high_delay_ms }.
  BPF_MEMCG_CALL macro with SRCU. mem_cgroup_below_low/min short-circuit; __mem_cgroup_handle_over_high
  penalty = max(penalty, bpf_high_delay). memcontrol_bpf_online inherits parent's bpf_ops.
  LWN entry for v3: https://lwn.net/Articles/1055698/ (23 Jan 2026).
  Upstream torvalds master mm/bpf_memcontrol.c has no memcg_bpf_ops (checked 2026-11-06) → not merged.
- agentcg/scheduler/scx_flatcg.bpf.c (954 lines): copy of kernel tools/sched_ext/scx_flatcg with compat
  changes (__COMPAT_scx_bpf_task_cgroup, scx_bpf_dsq_move_to_local(dsq) 1-arg); scx_flatcg.c adds -d dump option
  and uses online CPUs. No agent-specific logic; priority comes from cpu.weight (cgroup_set_weight callback,
  SCX_OPS_HAS_CGROUP_WEIGHT).
- agentcg/process/process.bpf.c: uretprobe//usr/bin/bash:readline, tp sched_process_exec/exit,
  tp syscalls sys_enter_openat/open; ring buffer. From AgentSight lineage.
- Tests: test_agentcgroupd.py (43 tests), test_bash_wrapper.sh (14). docs/exp_log2_per_tool_call.md:
  wrapper overhead 1–4 ms, hint accuracy 5/5 with Claude Haiku.
- Stale docs: README mentions top-level scx_flatcg/ and memcg/ (removed by 9fa4deec, 2026-02-21),
  docs/REPRODUCING.md says `cd memcg/multi_tenant_test/bpf_loader` (does not exist; loader lives in agentcg/memcg).
- Data: experiments/all_images_haiku, all_images_local; analysis/characterization.py etc.

## Observations by reading (not verified live)
- cgroup v2 no-internal-process rule: session_high has controllers in subtree_control, so writing a pid back to
  session_high/cgroup.procs likely fails (EBUSY), and rmdir of the tool cgroup while the wrapper is still in it
  would fail. Unverified; flagged as such in chapter.
- memcg tracepoint filter compares to session_high id only; faults charged to tool_* children carry the child id.
  Unverified effect on triggering.
- Paper claims per-tool-call sched_ext metadata & freeze; code at 551ca168 does not implement these.

## Recent commits (gh api)
551ca168 2026-07-22 Correct nested sub-agent timing analysis (#8); 5af9e7b8 2026-03-07 agentsight bump (#6);
7e4b64f6/47b2fa92/4211cc79/207f0995 2026-03-05/06 eBPF cross-analysis + cgroup-aware swebench tracing;
0b20bf04..17883e1a 2026-03-04 branch-context motivation plans; 9fa4deec 2026-02-21 remove old scx_flatcg/ memcg/;
7fdadd54 2026-02-22 README fix (#2); 2c05f82c 2026-02-17 per-tool-call cgroup bash wrapper; 70ec9b39 2026-02-14 consolidate into agentcg/.
Open PR #11 (2026-10-28) fixes `_parse_mem_usage` in analysis/analyze_new_insights.py (issue #10, "193MB"→19 MB);
PR body says paper §3.3/§4 may need correction after rerun.

## URLs checked (HTTP 200 unless noted)
arxiv abs/html 2602.09345; lore cover.1770194182; lore BPF OOM v2; docs.kernel.org cgroup-v2, sched-ext, psi;
LWN 922405 (extensible scheduler class); LWN 1055698; github oomd; arXiv 2505.20411 (SWE-rebench);
arXiv 2508.02736 (AgentSight); USENIX ATC20 shahrad; github sched-ext/scx. ACM DL returns 403 to curl (DOI kept).
