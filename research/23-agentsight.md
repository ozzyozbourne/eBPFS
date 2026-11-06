# Research notes — 23 AgentSight

Repo: https://github.com/eunomia-bpf/agentsight
Studied commit: c1574366122a90c451bca6a84713e28813ab95e2 (2026-10-23, "chore: release agentsight 1.0.35")
Local sparse clone: /home/user/workspace/src/agentsight

## README facts (README.md)
- Tagline: "System-wide AI agent profiling and monitoring with eBPF"; "local-first top/strace-like observability tool for AI agents".
- No SDK / proxy / vendor integration. Works for closed-source CLIs.
- Install: `cargo install agentsight`, release binary `agentsight-x86_64` / `agentsight-aarch64`,
  Homebrew `brew tap eunomia-bpf/tap; brew install eunomia-bpf/tap/agentsight` (Linux x86-64 only).
- Commands: `agentsight top`, `agentsight vis`, `sudo agentsight record -- claude`, `agentsight report`
  (`list`, `prompts --json`, `token`, `token --group-by dir`, `audit --json`, `serve`, `export -o snapshot.json`, `--local`),
  `agentsight monitor install-service`, `sudo ./agentsight debug trace --otel --otel-endpoint http://localhost:4318`,
  `sudo ./agentsight record -c python`, `record -c node --binary-path docker://openclaw`.
- Prereqs: kernel 4.1+ (5.0+ recommended) for record; `top`/`bind`/`vis`/`report` work from agent-native session files without eBPF (Windows/macOS/Linux).
- Web UI at http://127.0.0.1:7395 routes: `/` overview, `/timeline`, `/tree`, `/logs`, `/metrics`.
- Sessions saved to `agentsight-*.db` SQLite in cwd; monitor DBs under `~/.agentsight/monitor`.
- FAQ: "less than 3% CPU overhead" (README claim; cross-check vs paper).
- Static SSL: Claude/Bun = BoringSSL statically linked; Node = OpenSSL statically linked.
- Cursor not via eBPF (Electron, protobuf) -> agent-native session path.
- OTel GenAI `gen_ai.*` span export over OTLP/HTTP.
- Library crate `agentsight-capture` on crates.io.

## CLAUDE.md (= AGENTS.md symlink) facts
- Architecture: "eBPF Programs (kernel) → JSON stdout → Capture Core → Analysis Extension → Output/Web Extension/Files"
- bpf/: sslsniff (SSL_read/SSL_write uprobes), process (tracepoints), stdiocap (stdio payloads); JSONL via bpf/jsonl.h; browsertrace experimental (`make experimental`), not embedded.
- agentsight-capture/src: runners exec eBPF binaries, normalize JSON -> EventStream; sources: agent-native session files, /proc snapshots, saved SQLite.
- ext/analysis/src: analyzers, materialized view, SQLite/OTel sinks, CLI/TUI output. ext/session: session parsers + WASM component. ext/runtime: WASM component host (not linked yet). ext/web: Next.js pages. frontend/: build shell. agentsight-protocol: Node API contract.
- collector/src/main.rs CLI: top, monitor, record, report (summary, token, audit, prompts, export, list), debug (ssl, process, stdio, trace, system). collector/src/server: hyper web server, /api/events.
- Builder: `SslRunner::new().with_args(&args).add_analyzer(Box::new(HTTPParser::new())).run().await`; AgentRunner orchestrates via RunnerOrchestrator.
- Timestamps: ns since boot (bpf_ktime_get_ns); Event::datetime() uses boot time from /proc/stat.
- --comm NOT passed to sslsniff when --binary-path set: bpf_get_current_comm returns thread name; Claude's SSL on "HTTP Client" thread. Logic in build_ssl_args() collector/src/cmd_trace.rs.
- Auto-discovery: resolve_binary_path(comm), adopted only if binary_embeds_ssl() (contains "SSL_write" string).
- docker://name, k8s://ns/pod/container: resolve_container_binary_path() in binary_resolver.rs; docker inspect State.Pid; walk /proc/<pid>/task/*/children.
- Port 7395 default, --server-port.
- Build: `make build`, `make build-bpf`, `cd collector && cargo build --release`, `cd bpf && make test`, `make install` (deps).
- Direct: `sudo ./bpf/sslsniff --binary-path <path>`, `sudo ./bpf/process -c python`.

## bpf/sslsniff.bpf.c (831 lines) + sslsniff.c (1217)
- Based on BCC sslsniff (Adrian Lopez, Mark Drayton); Yusheng Zheng 2023.
- MAX_BUF_SIZE 256KB, ring 16MB; comment explains every reserve is worst-case; 63 concurrent.
- tls_library enum: OPENSSL, GNUTLS, NSS, RUSTLS, BORINGSSL.
- Pattern: uprobe entry stashes buf ptr/ts/handle/library in hash maps keyed by tid; uretprobe reads PT_REGS_RC len, bpf_probe_read_user(buf), ringbuf submit. Maps: bufs, start_ns, transport_handles, tls_libraries, readbytes_ptrs (for _ex), capture_loss.
- Probes: openssl/gnutls/nss/boringssl _SSL_rw entry; uretprobe SSL_read/SSL_write; *_SSL_write_ex/_read_ex entry + uretprobe; do_handshake; TLS_close (SSL_free, gnutls_deinit, PR_Close); rustls_write, rustls_write_vectored, rustls_buffer_plaintext (Codex / Grok).
- attach_openssl(): SSL_write, SSL_read, SSL_write_ex, SSL_read_ex, SSL_do_handshake (+uretprobes), optional SSL_free.
- attach_gnutls: gnutls_record_send / gnutls_record_recv, gnutls_deinit.
- attach_nss: PR_Write, PR_Send, PR_Read, PR_Recv, PR_Close.
- System libs found via find_library_path("libssl.so"), "libgnutls.so", "libnspr4.so".
- --binary-path: elf_has_symbol(OPENSSL_is_boringssl) -> attach_boringssl else attach_openssl; on -ENOENT (stripped): Codex -> attach_codex_ssl (rustls offsets from codex_offsets.h), Grok -> rustls buffer_plaintext, else find_boringssl_offsets() byte-pattern (prologue patterns derived from Bun v1.3.x profile builds) -> attach_openssl_by_offset. Refuses to continue with partial capture.
- Prints "AGENTSIGHT_SSL_READY" on stderr when ready.
- JSON fields: function (READ/WRITE/CLOSE), timestamp_ns, capture_seq, comm, pid, len, buf_size, uid, tid, transport_handle, process_start_ns, ringbuf_reserve_failures, tls_library, connection_closed, latency_ms, is_handshake, data..., truncated, bytes_lost, container fields.
- clamp_probe_size: mask 0x7ffff + barrier_var for 6.6 verifiers (TencentOS 4) "R2 min value is negative".

## bpf/process.bpf.c (472) + process_ext/*.h
- uretprobe//usr/bin/bash:readline (EVENT_TYPE_BASH_READLINE)
- tp/sched/sched_process_exec: pid, ppid (real_parent->tgid), filename via __data_loc, full argv from mm->arg_start read with bpf_probe_read_user fixed MAX_COMMAND_LEN-1 (no loops, 5.15 1M insn limit), arg_len stashed in exit_code.
- tp/sched/sched_process_exit: duration from exec_start map, exit_code, maxrss -> exit_mem map.
- tp/syscalls/sys_enter_openat, sys_enter_open (fallback), fexit/security_file_open (resolved path via bpf_d_path, access r/w/x, overlay layer detection, LRU dedup map file_opens_seen 65536).
- process_ext: bpf_fs.h (unlinkat, unlink, renameat2, renameat, rename, mkdirat, mkdir, ftruncate, chdir), bpf_write.h (write, pwrite64, writev enter/exit), bpf_net.h (bind, listen, kprobe inet_listen, connect, fexit inet_bind_sk/inet6_bind_sk/inet_bind/inet6_bind, inet_csk_accept), bpf_signals.h (setpgid, setsid, kill, sched_process_fork), bpf_mem.h (mmap), bpf_cow.h (kprobe do_wp_page).
- High-frequency events aggregated in-kernel: event_agg_map HASH 16384 (agg_key -> count,total_bytes,last_ts,comm); flushed by userspace map_flush.h; types FILE_DELETE, FILE_RENAME, DIR_CREATE, FILE_TRUNCATE, CHDIR, WRITE, NET_BIND, NET_LISTEN, NET_CONNECT, NET_ACCEPT, PGRP_CHANGE, SESSION_CREATE, SIGNAL_SEND, PROC_FORK, MMAP_SHARED, COW_FAULT.
- Scoping: is_scope_tracked() (target pidns inode, cgroup id / tracked_cgroups), is_pid_tracked() (tracked_pids map); userspace pid_tracker in process_filter.h (FILTER_MODE_ALL/PROC/FILTER).
- stdiocap.bpf.c: sys_enter/exit_read, write tracepoints (MCP stdio payloads).
- browsertrace.bpf.c (experimental): NSS PR_Write/PR_Read/SSL_ImportFD/PR_Close, chrome_plaintext_request_* offsets.

## Paper (verified on arXiv abs + HTML v2, and ACM DL page)
- Title: "AgentSight: System-Level Observability for AI Agents Using eBPF"
- Authors: Yusheng Zheng (UC Santa Cruz), Yanpeng Hu (ShanghaiTech), Tong Yu (eunomia-bpf Community), Andi Quinn (UC Santa Cruz)
- Venue: PACMI '25: Proceedings of the 4th Workshop on Practical Adoption Challenges of ML for Systems (co-located with SOSP '25, Seoul, Oct 13-16 2025), pages 110-115, published 13 Oct 2025, DOI 10.1145/3766882.3767169, CC-BY 4.0.
- arXiv:2508.02736 [cs.OS], v1 2 Aug 2025, v2 15 Aug 2025.
- Concepts: "semantic gap" between intent (LLM prompts) and actions (syscalls); "boundary tracing" at stable interfaces (kernel + network); intent stream vs action stream.
- Two-stage correlation: real-time engine + secondary "observer" LLM ("AI to watch AI"); outputs natural-language analysis + confidence score.
- Three correlation signals: Process Lineage (fork/execve tree), Temporal Proximity (window after LLM response), Argument Matching (filenames/URLs/commands in response vs syscall args).
- Impl: "6000 lines of Rust/C" daemon, TypeScript frontend "3000 lines" (2025 numbers; repo much larger now). 100-500ms temporal window. Mentions kprobes for openat2/connect/execve (paper); current code uses tracepoints + fexit.
- Evaluation: Ubuntu 22.04, Linux 6.14.0, Claude Code 1.0.62 w/ claude 4; tutorial repo bpf-developer-tutorial; 3 runs each.
  Table 1: Understand Repo 127.98 -> 132.33 s (3.4%); Code Writing 22.54 -> 23.64 (4.9%); Repo Compilation 92.40 -> 92.72 (0.4%); average 2.9%.
- Case 1 prompt injection: README -> URL with hidden prompt -> read & send /etc/passwd; 521 events merged into 37 by correlation engine; observer LLM high-confidence attack score.
- Case 2 reasoning loop: crewai + gpt-4o-mini research agent, repeated failing web search ("try-fail-re-reason" loop).
- Case 3: 6 collaborating Claude Code subagents, 3153 total events after correlation engine; file locking contention.
- Related: InjecAgent (Zhan et al. 2024, ACL Findings, arXiv 2403.02691), Breaking Agents (Zhang et al. arXiv 2407.20859), AgentOps (Dong et al. arXiv 2411.05285), Watson (arXiv 2411.03455), Falco, Tracee, Langfuse, LangSmith, Helicone, OTel GenAI.

## Rust pipeline (agentsight-capture / ext/analysis / collector)
- agentsight-capture/src/event.rs: Event { timestamp: u64, source: String, pid: u32, comm: String, data: serde_json::Value }; datetime() = from_timestamp_millis.
- time.rs: boot_ns_to_epoch_ms() — "All timestamps standardized to milliseconds since UNIX epoch" (CLAUDE.md says ns since boot from bpf; TimestampNormalizer converts).
- runners/mod.rs: EventStream = Pin<Box<dyn Stream<Item=Event>+Send>>; trait Runner { async fn run(); fn add_analyzer() }.
- analyzers/mod.rs: trait Analyzer { async fn process(&mut self, stream) -> Result<EventStream> }.
- runners/agent.rs: AgentRunner merges runner streams with futures select_all, applies global analyzers.
- runners/common.rs: BinaryExecutor spawns embedded binary (sudo -n if not root), kill_on_drop, process_group(0), reads JSON lines; BinaryRunner::ssl(path) ("SSL","ssl","timestamp_ns"), ::stdio; parse_json_event requires timestamp field, pid, comm, else "diagnostic" runner_parse_error event.
- runners/process.rs: ProcessRunner, timestamp field "timestamp", CLOCK_SYNC & PROBE_LIVENESS events, --seed-pid args.
- binary_extractor.rs: include_bytes!("../vendor/bpf/process"), sslsniff, stdiocap -> extracted into TempDir, chmod.
- collector/src/cmd_trace.rs build_trace_agent_with_view(): adds BinaryRunner::ssl + configure_ssl_runner, stdio (requires --pid), ProcessRunner + TimestampNormalizer, SystemRunner(interval); global MaterializingAnalyzer::with_view(view) + SqliteStore sink + OtelExporter sink.
- configure_ssl_runner: TimestampNormalizer, SSLFilter(patterns), then add_http_analyzers: SSEProcessor(30000 timeout).defer_transport_to_http, HTTPParser (disable_raw_data unless raw), HTTPDecompressor, SSEProcessor again, HTTPFilter, AuthHeaderRemover (unless disabled).
- ext/analysis analyzers: auth_header_remover, capture_metadata, connection_registry, filter_base, filter_metrics, http_decompressor, http_filter, http_parser (4432 lines), materializing, protocol_events, sse_processor (1161, accumulates Anthropic text/json + OpenAI reasoning/tool_calls), ssl_filter, timestamp_normalizer.
- ext/analysis view/: canonical.rs, llm.rs, media.rs, process_select.rs, projection.rs (1590), session_process_match.rs, mod.rs. sinks: sqlite.rs, otel.rs. sources: agent_native.rs (2379), sqlite.rs. runners/system.rs.

## Correlation in current code (ext/analysis/src/view)
- MaterializedView (view/mod.rs): BTreeMaps llm_calls, token_usage, audit_events, process_nodes, tool_calls, sessions, network_targets, resource_samples; pending requests keyed (pid, handle?) for request/response pairing; active_processes pid -> node id; sinks (SQLite, OTel). MAX_AUDIT_EVENTS_IN_MEMORY 20000.
- canonical.rs EventKind: HttpRequest, HttpResponse, LlmRequest, LlmResponse, LlmError, ProcessExec, ProcessExit, FsOpen, FsWrite, FsMutation, StdioMessage, StdioRpc, ResourceSample, Unknown.
- projection.rs: ingest_llm_request/response pair by http_exchange_id or h2_stream correlation (correlation_method/status/version, "unlinked" orphans); ingest_sse_tools extracts tool calls from OpenAI `tool_calls` JSON and Anthropic SSE `content_block` type "tool_use" -> ToolCallRow{tool_name, input, related_pid, confidence}; process exec/exit -> AuditEventRow + ProcessNodeRow (id "process-{pid}-{ts}"); file/network audits.
- docs/design/view-session-process-model.md: "Session-to-process mapping is core, but it is not Session == PID" — AgentSession --SessionProcessMatch--> ProcessTree, with evidence and confidence. SessionProcessMatcher uses session file paths open by fds, eBPF paths, cwd, time.
- Secondary-LLM analysis today lives in skills/ (agent-interaction-insights, agentsight-system-friction, evolve-agent-skills, agentpprof-flamegraph, agentsight-testing) — prototypes, "not AgentSight runtime code". (My inference: the paper's observer LLM maps to these skills; not verified as identical.)
- Web server collector/src/server/web.rs: GET /api/v1/info, POST /api/v1/capabilities, GET /api/v1/snapshot, GET /api/v1/overview, /api/v1/sessions/<id>, POST /api/v1/sessions/<id>/messages; other paths serve embedded frontend. (CLAUDE.md mentions /api/events — not found in web.rs; stale.)
- Frontend: ext/web/components/timeline/{Timeline,TimelineAxis,TimelineGroup,TimelineMinimap,...}.tsx, process-tree/{ProcessNode,UnifiedBlock,...}.tsx.
- CLI (collector/src/main.rs Commands): Vis, Bind (hosted app https://app.agentsight.us/), Bridge(hidden), Top (-p, -c, --sort cpu|rss|tokens|execs|fail|files|net|agent, --view, -i, -n, --once, --plain), Monitor, Record (-c, -p, --binary-path, --db, --no-server, --server-port 7395, -- command), Report (summary, token, audit, prompts, export, serve, list), Debug.

## GitHub API (2026-11-06)
- agentsight: 775 stars, 120 forks, language C, created 2025-07-07, MIT, homepage https://eunomia.dev/agentsight/, desc "lightweight system-level observability for AI Agents".
- Releases: v1.0.35 2026-10-23 (agentsight-x86_64 25,196,360 B; aarch64 23,231,056; agentpprof ~7.7MB), v1.0.34 10-05, v1.0.33 10-05, v1.0.32 10-04, v1.0.31 09-05.
- Recent commits (master): c1574366 release 1.0.35 (10-23); 33390661 correlate HTTP exchanges by TLS connection and stream (#216); cee47f9e truncated HTTP/1.1 marker (#245); 4b1434c4 nested PID namespaces --pidns-of (#244); 43c84962 docker:// children forked by any thread (#246); 34241a66 feat(bpf) TLS transport identity and capture metadata (#210); 94285b29 CI green (Ubuntu 26.04, Codex 0.164.0, opencode 1.19.4) (#243); 99df6ed7 Codex token totals (#224); 308c70f6 sidecar capture by PID namespace + liveness (#237); 79d76779 media-kind evidence (#223); 78233fd1 process probe liveness/file paths/listener (#234); 3e51adc4 SSL readiness, exact bytes, HPACK safety (#226); 6af05912 inbound socket evidence (#229); 3f5e4f9a load probes on newer kernels (#231); 95612527 resolved file access in process probe (#227); e81fb871 CodeBuddy CLI + Codex rustls plaintext fix (#212); 4febee5e shared agent skills (#206); 4bdb292d Homebrew docs (#196); Aug 2026: container messaging/bridges, audit-event provenance (#204).
- homebrew-tap Formula/agentsight.rb: pins v1.0.31 agentsight-x86_64 (sha256 1f30c316...), depends_on gcc/patchelf build, glibc, :linux; patchelf sets interpreter to brew glibc. Last commit aefe55a3 2026-09-16 "Bump AgentSight formula to v1.0.31 (#3)". So brew lags (1.0.31 vs 1.0.35).
- agentsight-website: "Static product website for AgentSight..." Next.js static export at https://agentsight.us/; app at https://app.agentsight.us/; 23-page content catalog; `npm ci; npm run dev; npm run verify`; daily SEO commits (Nov 2026: TLS command filtering, network target count, snapshot export, process EXIT status, capture-loss).

## What happened on this orb (Linux 6.1.189+, Debian 12 glibc 2.36, BTF present, no /proc/sys/net/core/bpf_jit_enable -> no JIT)
- Downloaded v1.0.35 agentsight-x86_64 (25,196,360 B); sha256 6b7c7760bf1fddd1308587e873025b4b001de62216010499938effa946cc2d9e matches release asset digest.
- `./agentsight --version` -> "agentsight 1.0.35" with warning "weak version `GLIBC_2.39' not found" (still runs).
- `--help` lists vis, bind, top, monitor, record, report, debug; `--listen` default 127.0.0.1. `debug` subcommands: ssl, process, stdio, trace, system.
- `sudo ./agentsight debug process -- -c python3` -> "Error: Process exited with exit status: 1".
  Cause: carved embedded ELF (process userspace loader, ~2.0 MB; sslsniff ~1.7 MB; stdiocap ~1.6 MB, each with a nested BPF object) and ran it: "version `GLIBC_2.38' not found". The embedded probes are dynamically linked against glibc >= 2.38, so they do not start on Debian 12. Kernel compatibility was therefore NOT tested here.
- `./agentsight top --once --plain` works without eBPF: 0 sessions, note "live eBPF capture did not start: Process exited during startup with exit status: 1".
- Source build not attempted: sparse clone lacks libbpf/, bpftool/, vmlinux/ submodule dirs needed by bpf/Makefile; no cargo on orb.
