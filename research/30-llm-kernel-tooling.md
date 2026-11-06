# Research notes — Chapter 30: LLM kernel tooling (schedcp, MCPtrace, GPTtrace, KEN, GPTtrace-web)

Survey date: 2026-11-06. Clones in /home/user/workspace/src/ (`--depth 1 --filter=blob:limit=2m`).

## Activity (gh api, 2026-11-06)

| Repo | Last commit (SHA, date UTC) | pushed_at | Stars | Description |
|---|---|---|---|---|
| eunomia-bpf/schedcp | 730e2589 · 2026-02-12T00:22:21Z "Add comprehensive documentation for scheduler usage..." (#9) | 2026-02-12 | 122 | MCP Server for Linux Scheduler Management and Auto optimization |
| eunomia-bpf/MCPtrace | 1bd88555 · 2026-02-12T01:32:41Z "Fix stdout logging breaking MCP protocol communication (#4)" | 2026-02-12 | 76 | MCP server: using eBPF to tracing your kernel |
| eunomia-bpf/GPTtrace | a1f83c7b · 2026-03-07T03:47:06Z "Fix pylint errors and add test CI workflow (#19)" | 2026-03-07 | 275 | Generate eBPF programs and tracing with ChatGPT |
| eunomia-bpf/KEN | 7575d9ba · 2024-08-07T16:05:09Z "update" | 2024-08-07 | 43 | Kernel Extensions Large Language Model Agent |
| eunomia-bpf/GPTtrace-web | 02bc89f7 · 2024-08-07T16:08:43Z "Update README.md" | 2024-08-07 | 22 | Generate bpftrace eBPF programs online with GPT or LLM |

All MIT, none archived/forked. MCPtrace earlier commits: 2025-07-25, 2025-08-01 (x3), then 2026-02-12.
schedcp commits before last: 2026-02-03 (paper link), 2026-01-17, 2025-12-10, 2025-12-09.

## MCP spec (verified)
- Announced by Anthropic 2024-11-25 (https://www.anthropic.com/news/model-context-protocol).
- Spec: https://modelcontextprotocol.io/specification/2025-06-18 ; revisions on GitHub releases:
  2024-11-05, 2025-03-26, 2025-06-18, 2025-11-25, 2026-07-28 (latest).
- JSON-RPC 2.0; Hosts / Clients / Servers; server features Resources, Prompts, Tools; client features
  Sampling, Roots, Elicitation (2025-06-18). Lifecycle: initialize → initialized notification → operation.
- tools/list, tools/call; result `content[]`, `isError`; protocol errors vs tool errors (`isError: true`).
- stdio transport: newline-delimited JSON-RPC; server MUST NOT write non-MCP to stdout; MAY log to stderr.
- Security: "Tools represent arbitrary code execution"; hosts must obtain consent before invoking tools.
- Both schedcp and MCPtrace use rmcp 0.2.0 (Rust SDK, github.com/modelcontextprotocol/rust-sdk) and report
  `ProtocolVersion::V_2024_11_05`, tools capability only, stdio transport.

## schedcp (commit 730e2589)
- README: "SchedCP - Automatically Optimize Linux Scheduler with MCP Server"; experimental; WIP benchmark.
- Components: `mcp/` (Rust MCP server `schedcp` + `schedcp-cli`), `autotune/` (Rust; launches Claude Code CLI
  at hardcoded `/usr/local/bin/claude` with a prompt), `scheduler/` (scx submodule, schedulers.json with 20
  entries, sche_description/*.md, custom_schedulers, template, ml-scheduler), `workloads/` (linux-build-bench,
  basic/schbench, processing, llama.cpp, cxl-micro, pytorch, redis, nginx, ...), `document/` (paper PDF+txt
  v2, design docs, AI_AGENTS.md, motivation_exp).
- MCP tools (mcp/src/main.rs): list_schedulers, run_scheduler (stops any running first, 500 ms sleep),
  stop_scheduler, get_execution_status, workload (create/list/get_history/add_history),
  create_and_verify_scheduler, system_monitor (start/stop; /proc/stat, /proc/meminfo, /proc/schedstat each 1 s).
- schedulers.json embedded via rust-embed; binaries loaded from `~/.schedcp/scxbin` (run `make install`),
  extracted into a temp dir (process_manager crate).
- Workload profiles persisted in `schedcp_workloads.json` (storage.rs): profile = id + NL description;
  history = scheduler, args, result_description.
- create_and_verify_scheduler: write `<name>.bpf.c`, clang `-g -O2 -target bpf -mcpu=v3 -D__TARGET_ARCH_x86`,
  includes llvm-19 clang includes + scx headers; then run generic loader with sudo for 10 s (default), kill,
  fail if stderr contains "error"/"Error"/"failed". Kernel verifier runs at load. Custom schedulers marked
  production_ready=false.
- Sudo: main.rs reads `SUDO_PASSWORD` (else tries passwordless sudo); cli.rs, docs and
  scheduler_generator.rs `spawn_with_sudo` (used by create_and_verify) read `SCHEDCP_SUDO_PASSWORD`.
  Inconsistency at this commit.
- process_manager `stop()`: SIGTERM first, then SIGKILL if still alive; children `kill_on_drop(true)`.
- autotune `cc` prompt (autotune/src/prompt.rs): test default + max 3 other schedulers, record history.
- `.mcp.json`: stdio server `mcp/target/release/schedcp`.
- AI_AGENTS.md: the four agents are conceptual; "agent behaviors emerge from" AI + MCP tools + autotune prompts
  + schedulers.json. Safety in impl: compile, 10-s verification test, sudo, Ctrl-C restores default.
- Paper's micro-VM, scheduler-specific static analyzer, signed deployment token, canary, circuit breaker,
  vector DB: NOT found in the code (rg for circuit/canary/vector in mcp/ autotune/ -> no hits).
- Generated batch-workload schedulers: workloads/processing/schedulers/*.bpf.c (two DSQs, comm/filename
  matching via pid_filename_header.h tracepoints sched_process_exec/exit).
- mcp/new_sched/example.bpf.c: comment says "3ms for short tasks" but SHORT_SLICE_NS = 30000000ULL (30 ms).

## Paper (verified on arXiv)
- "Towards Agentic OS: An LLM Agent Framework for Linux Schedulers", Yusheng Zheng, Yanpeng Hu, Wei Zhang,
  Andi Quinn. arXiv:2509.01245 (cs.AI; cs.MA, cs.OS). v1 1 Sep 2025, v2 3 Sep, v3 26 Sep, v4 30 Sep 2025.
  Journal-ref: "MLforSystem 2025". README links it as "SchedCP: Towards Agentic OS".
- Numbers (v2 text in repo, v4 HTML agree on these): up to 1.79x kernel compile (13.57 s → 7.60 s;
  scx_rusty first attempt 1.63x 8.31 s; scx_layered after 3 iterations +16%); schbench on machine 2:
  EEVDF P99 40.3 ms, 910 req/s; first attempt scx_bpfland 46.1 ms, 741 req/s; after 3 iterations scx_rusty
  19.1 ms (2.11x), 1452 req/s (1.60x); batch: 8 workloads, 40 tasks (39 short + 1 long), LJF, 20% avg
  reduction; $0.15 per analysis (Opus 4, Aug 2025 pricing); Sonnet failed to classify all 8; generation
  33 min → 2.5 min (13x); cost $6 → $0.5 (v2) / $0.45 synthesis cost (v4).
- Motivation: Claude Code "write a FIFO scheduler in eBPF": 1 of 3 succeeded; 33 min, 221 API calls,
  15+ iterations, ~$6.
- Machines: 86-core/172-thread Xeon 6787P, 758 GB, CXL, Linux 6.14; 8-core Core Ultra 7 258V, 30 GB, 6.13.
- Implementation size claim: 4000 lines Rust + 6000 lines Python incl. tests.
- Kernel build: 6.14 tinyconfig, make -j 172. Pre-trained RL baseline (LWN 1027096) no improvement.

## MCPtrace (commit 1bd88555)
- Rust crate `bpftrace-mcp-server` 0.1.1 (crates.io, created 2025-08-01); Python FastMCP legacy server.py.
- Tools (Rust): list_probes(filter) → `sudo -S bpftrace -l [filter]`; bpf_info → `bpftrace --info`;
  exec_program(program, timeout default 10, clamp 1..60) → background `sudo -S bpftrace -e`, buffer
  10 000 lines, waits 500 ms to catch syntax errors, returns execution_id `exec_XXXXXXXX`;
  get_result(execution_id, offset, limit). Buffers cleaned after 1 h.
- Python server.py tools: list_probes, list_helpers, exec_program, get_result.
- Password via BPFTRACE_PASSWD (.env); exits silently if unset. Logging only if RUST_LOG set (last fix).
- README: "No script validation - trust the AI client". src/tools/*.bt + examples.json shipped but not
  exposed as a tool in main.rs (no include_str!).
- doc/COMPARISON_WITH_GPTTRACE.md compares.
- Setup scripts: setup/setup_claude.sh, setup/setup_claude_code.sh.

## GPTtrace (commit a1f83c7b)
- pip `gpttrace` (PyPI 0.1.2). CLI: `python3 -m gpttrace "..."`, `-c CMD_NAME QUERY`, `-v`, `-k KEY`.
- Pipeline: construct_running_prompt → FAISS vector search over tools/examples.json (OpenAIEmbeddings,
  top 2) → ChatCompletion (gpt-3.5-turbo) with function `bpftrace` (JSON schema of bpftrace flags) +
  `SaveFile` → construct_command → user confirmation prompt "Enter 'y' to proceed" → `sudo bpftrace ...`
  with timer (default 300 s) → if stderr non-empty, construct_prompt_on_error and recurse (retry=5) →
  explain output (truncate 2048 chars) via gpt-3.5-turbo-0613.
- `-c`: bcc tools via function calls generated from help text (cmd.py), LangChain conversation.
- README: "This experiment is not suitable for production use"; points to MCPtrace.

## KEN / Kgent / GPTtrace-web
- KEN: arXiv:2312.05531 "KEN: Kernel Extensions using Natural Language", Zheng, Yang, Chen, Quinn, 9 Dec 2023.
  80% correct, 2.67x vs LLM-empowered synthesis baseline.
- Kgent: "Kgent: Kernel Extensions Large Language Model Agent", Proc. ACM SIGCOMM 2024 Workshop on eBPF and
  Kernel Extensions (eBPF '24), Sydney, pp. 30–36, doi 10.1145/3672197.3673434. Abstract: program
  comprehension + symbolic execution + feedback loops; 80% correct, 2.67x vs GPT-4 synthesis baseline;
  rarely false positives. DOI page returns 403 to curl (ACM bot block); metadata from CITATION.cff and
  schedcp paper ref [36].
- KEN arXiv HTML (v1) details: Prompter, Synthesis Engine (VectorDB few-shot), Comprehension Engine
  (LLM writes Hoare-logic assume/assert per kernel function, from auto-generated KernelCompDataset of Z3
  contracts), Symbolic Verifier (SeaHorn over LLVM IR, Z3), then kernel eBPF verifier; 3 trials default;
  51 LOC added to bpftrace for assume/assert; 4244 LOC Python. eBPFNLDataset 145 pairs (79 bpftrace,
  66 libbpf); test set 40 cases. Table: ChatGPT-4 30% / FP 2.5%; +Feedback 60% / 7.5%; +Symbex 77.5% / 5%;
  KEN 80% / 2.5%; human-expertise baseline 72.5%.
- Decima: Mao et al., SIGCOMM 2019, doi 10.1145/3341302.3342080 (Crossref-verified title).
- LWN 1027096 "Improved load balancing with machine learning", Corbet, July 1, 2025 (verified).
- MCPtrace src/tools has 39 .bt files.
- GPTtrace argparse requires positional input_string even with -c (so `-c NAME QUERY` alone may fail);
  chapter avoids showing a -c invocation.
- workloads/processing/README.md claims "30-35% performance improvements"; paper says 20%. Chapter quotes paper.
- KEN repo contents (README): dataset/libbpf/output.json, dataset/bpftrace/output.json,
  dataset/spec/helper_spec.json, kprobe_spec.json (Z3 specs), evaluation/.
- GPTtrace-web README: "GPT2Bpftrace"; online demo gpt-2-bpftrace.vercel.app; npm install / npm run dev;
  clone URL in README points to eunomia-bpf/GPT2Bpftrace.

## Unverified / not checked
- Did not build or run any of the three (needs sched_ext kernel 6.12+, root, Claude Code / OpenAI keys).
- Vercel demo liveness not checked.
- MLforSystem 2025 venue (NeurIPS workshop?) only from arXiv journal-ref; not independently confirmed.
