# Review: chapter 23 (AgentSight) and chapter 32 (glossary and reading list)

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/23-agentsight.html` and `chapters/32-glossary-and-reading-list.html`, checked against
`research/23-agentsight.md`, `AUTHORING.md` and `reviews/syllabus-audit.md`. One mechanical fix (audit item 11) was also
made in `chapters/11-starter-templates.html` and `chapters/26-reward-guard-and-safe-change.html`. No other file was
edited. Nothing was committed.

## How the chapters were checked

- **Source.** AgentSight sparse clone at `c1574366` (v1.0.35, 2026-10-23), the commit the chapter names. The sparse set
  already covered every path the chapter cites (`bpf/`, `collector/`, `agentsight-capture/`, `ext/`, `docs/`,
  `skills/`, `compat/`), so no sparse paths were added. `git ls-tree` confirmed that the only `.rs` files outside the
  checked-out set are two proxy experiments under `docs/experiment/`.
- **`data-file` blocks (23).** A script compared every non-elided line, after whitespace normalisation and in order,
  with the cited file. All 22 repository blocks match. The 23rd, `Formula/agentsight.rb`, was compared by hand with
  the file fetched through `gh api repos/eunomia-bpf/homebrew-tap/contents/Formula/agentsight.rb`. It matches; the
  elided lines are the `sha256` and `license` lines and the `test do` block.
- **Uprobe targets.** All `ATTACH_*` calls in `sslsniff.c` (`attach_openssl`, `attach_boringssl`, `attach_gnutls`,
  `attach_nss`, the offset variants, `attach_codex_rustls`, `attach_grok_rustls`) were listed and compared with the
  chapter's table. The `--binary-path` flow at `sslsniff.c` L1085–1147 was read in full.
- **Kernel hooks.** Every `SEC()` in `process.bpf.c`, `process_ext/*.h` and `stdiocap.bpf.c` was compared with the
  hook table. Map sizes were checked in `bpf_state.h` and `process.bpf.c`.
- **Rust.** Every function, type, string and line count named in the prose was looked up with `rg`: runners,
  analyzers, `TimestampNormalizer`, `boot_ns_to_epoch_ms`, `configure_ssl_runner` and `add_http_analyzers`,
  `SSEProcessor` (including the "Exact-identity captures …" comment), `AuthHeaderRemover` headers, `EventKind`,
  `ingest_llm_response` and the orphan path, `SessionProcessMatcher`, `web.rs` routes and the `evidence.read` check,
  `nodeClient.ts`, `binary_resolver.rs`, the `main.rs` CLI definitions and the `top --sort` keys.
- **Paper.** arXiv API for 2508.02736: title, 4 authors, v1 2025-08-02, v2 2025-08-15, cs.OS. Crossref for
  10.1145/3766882.3767169: title, the same 4 authors, *Proceedings of the 4th Workshop on Practical Adoption Challenges
  of ML for Systems*, pp. 110–115, published 2025-10-13, SOSP '25 in Seoul. The arXiv v2 PDF was downloaded and its
  text extracted. Affiliations, quotes, Table 1, the testbed, the 100–500 ms window, the 6,000/3,000 LoC figures and
  all three case studies were checked against it.
- **Commands.** Compared with `README.md`, `docs/agents.md`, `docs/build.md`, `docs/usage.md`, `bpf/README.md` and the
  clap definitions in `collector/src/main.rs` and `cmd_debug.rs`.
- **GitHub API.** The release list and v1.0.35 asset digests; the formula's history (`aefe55a3`, 2026-09-16, pins
  v1.0.31); the last 30 `master` commits (all hashes, titles and PR numbers in "Recent development" match); and the
  `agentsight-website` repository and README.
- **Related-work citations in ch23.** arXiv API for 2411.05285 (Dong), 2411.03455 (Rombaut), 2403.02691 (Zhan) and
  2407.20859 (Zhang): titles and first authors are correct.
- **ch32 links.** The same `HTMLParser` method as the audit: each page's ids were rebuilt from explicit `id`s plus
  `main` `h2`/`h3` text (lowercased, `[^a-z0-9]+` → `-`, trimmed). That covered 575 links in ch32 and 55 in ch23, and
  every chapter was rerun after the heading edits. There are no broken links or anchors, apart from three placeholders
  in `_template.html`.
- **ch32 reading list.** A script took the 97 (now 101) rows, read each row's URL, DOI or arXiv id and its title, and
  searched the chapters named in *Cited in*. Every paper was found in every chapter it names.
- **Filter widget.** The page's own `<script>` was run in Node against a small DOM stub built from the 152 entries.
  Results: `loop` gives 5 terms (`bpf_loop`, `may_goto`, open-coded iterator, CFG check, speculative ReJIT); `gpu`
  gives 14; `throw` gives 1; `iterator` gives 2. Words are ANDed (`LOOP  map` gives 0). No match shows `#gloss-empty`,
  Escape clears the box, and the counter reads "N of 152 terms" or "152 terms".
- **Mechanics.** In all four edited files: tag balance, duplicate ids, unescaped `<`/`&` in `<pre>` and duplicate
  generated heading ids are all clean. Both quizzes have 6 questions with exactly one `data-right` each, and all 12
  answers were re-derived. ch23 has 8,280 words of prose (excluding code and SVG).

Severity scale as in part 3: **High** = wrong technical statement a reader would act on; **Medium** = wrong or
misleading, limited impact; **Low** = imprecise, pedagogy or consistency.

## Chapter 23: AgentSight

### Specific claims the task asked to check

| Claim | Verdict |
|---|---|
| Uprobe target functions | **Correct.** OpenSSL/BoringSSL: `SSL_write`, `SSL_read`, `_ex` variants, `SSL_do_handshake` (entry + return), optional `SSL_free`. GnuTLS: `gnutls_record_send`/`_recv`, optional `gnutls_deinit`. NSS: `PR_Write`, `PR_Send`, `PR_Read`, `PR_Recv`, optional `PR_Close`. rustls programs are disabled with `bpf_program__set_autoload(..., false)` unless the binary is Codex or Grok (L1007–1013). `OPENSSL_is_boringssl` selects BoringSSL. The "Bun v1.3.x" and "refusing to continue …" quotes are verbatim. One wording problem (23.1). |
| BPF code | All 8 BPF blocks match. Verified facts: 256 KB / 16 MB / 63 events, the 512 KB / 2 MB / "3 concurrent" comment, `clamp_probe_size` with the TencentOS 4 comment, `start_boottime` of the group leader, `MAX_COMMAND_LEN` 256 (255 bytes read), `signal->maxrss`, `pid != tid`, the `file_opens_seen` LRU (65,536), `event_agg_map` (16,384), the "ring-buffer order" comment, the `Copyright (c) 2020 Facebook` header, and `stdiocap` with fds 0–2 or `--all-fds`. The hook table was missing hooks (23.2). |
| Rust code | All 14 Rust/TS blocks match. Verified facts: `sudo -n` with the `sudo -v` hint, `BinaryRunner::ssl/stdio` tuples, `ProcessRunner` (`timestamp`, `CLOCK_SYNC`, `PROBE_LIVENESS`), `OnceLock` + `sysinfo::System::boot_time()`, `http_parser.rs` 4,432 lines, the `SSEProcessor` comment, the three removed headers, `EventKind`, and `"unlinked"` orphans. The function name in the thread-name callout was stale (23.3), and so was the evidence-type claim (23.4). |
| Paper facts (arXiv + Crossref + PDF) | **Correct.** The overhead table matches Table 1 exactly (127.98/132.33/3.4%, 22.54/23.64/4.9%, 92.40/92.72/0.4%, average 2.9%). Ubuntu 22.04, Linux 6.14.0, Claude Code 1.0.62 with Claude 4, 3 runs, 100–500 ms, 6,000 + 3,000 lines, 521 → 37 events, the crewAI/gpt-4o-mini loop and 6 subagents with 3,153 events are all as in the paper. The quotes "semantic gap …", "aggressive, dynamic in-kernel eBPF filter", "complete lineage tree" and "AI to watch AI" are verbatim. "System call ABIs …" is verbatim apart from the capital S. Note, not changed: 92.40 → 92.72 is +0.35%, which the paper prints as 0.4%; the chapter copies the paper. |
| Commands vs README | **Correct.** The usage block lines and comments are verbatim. The README also has `report --db run.db` and `report token`, which the chapter's subset omits; that is fine. The other commands come from `docs/agents.md` (`record -c "python"`, `-c node`, `k8s://agents/openclaw/gateway`), `docs/usage.md` (`debug trace --server`), `bpf/README.md` (sslsniff `2.1.39`, `stdiocap -p 12345`), the README (`--otel`) and `CLAUDE.md` (`./bpf/process -c python`). Every flag exists in the clap definitions. |
| Homebrew formula claims | **Correct.** It downloads `agentsight-x86_64` v1.0.31 (`using: :nounzip`), depends on `gcc`/`patchelf` (build), `glibc` and `:linux`, and patchelf sets the brew glibc interpreter and rpath. The last bump was 2026-09-16 (#3). v1.0.32–1.0.35 exist, so it is "four releases behind". The README says "The current Homebrew formula supports Linux x86-64." The unsuffixed release asset is an x86_64 alias: it has the same sha256 as `agentsight-x86_64`. |
| agentsight-website mentioned and linked | **Was missing (audit item 5). Fixed** (23.5). |
| Consistency with ch24, 26, 27 | **Consistent.** ch24 "descends from AgentSight's code base" matches ch23's "grew out of". The `record --db … --no-server -c/--` modes in ch26 and the `record --no-server --db … --pid` call in ch27 match the CLI. The ch27 table ("uprobes on TLS libraries and process/file/network tracing") and `cargo install agentsight` match. Paper title, authors and venue are the same in 08, 24, 25, 26, 27. Audit item 15 is satisfied: ch23 gives both PACMI '25 + DOI and arXiv. |
| Quiz answers | All 6 are correct. Q4 was checked against `insert_orphan_llm_response` (`correlation_status = "unlinked"`). |
| prev/next 22 ↔ 23 ↔ 24 | **Correct.** 22's next is 23; 23's prev is 22 and next is 24; 24's prev is 23. `#ref-paper` exists. |

### Issues found and changes made

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 23.1 | Low | The `--binary-path` fallback was described as three steps tried "in order", ending "If all three fail". In the code, symbols come first; on `-ENOENT`, Codex/Grok binaries take the rustls path, and *only otherwise* are the BoringSSL byte patterns tried. The two fallbacks are alternatives, not a cascade. | Reworded the intro, items 2–3 and the closing sentence. |
| 23.2 | Low | Network row of the hook table omitted `kretprobe/inet_listen` and the `fexit/inet_bind`/`fexit/inet6_bind` fallbacks in `bpf_net.h`. | Added them. |
| 23.3 | Medium | The thread-name callout said the comm-filter logic is in `build_trace_agent()` in `cmd_trace.rs`. That function no longer exists; the logic is in `build_ssl_args()` (L264–303, comment "Skip --comm for sslsniff when --binary-path is set"). The name came from `CLAUDE.md`, which is stale. | Changed to `build_ssl_args()` and noted that `CLAUDE.md` still uses the old name. |
| 23.4 | Medium | The session matching paragraph listed five evidence types (`proc_fd`, `ebpf_file`, `llm_traffic`, `command_match`, `sticky`) and said "the matcher's entry point takes exactly those inputs". The five come from the design note. The Rust code defines only `proc_fd`, `ebpf_file` and `sticky` (`ext/session/src/lib.rs` L25–27; `rg` finds no `llm_traffic` or `command_match` in any `.rs` file), and `match_sessions` takes fd paths and eBPF paths only. | Rewritten: design note lists five; code defines three; the entry point takes the inputs for the first two. |
| 23.5 | Medium | Audit item 5: `agentsight-website` was not mentioned. | Added a paragraph at the end of "The web UI and the timeline", taken from the repository's README (fetched with `gh api repos/eunomia-bpf/agentsight-website/readme`). It covers the Next.js static export at agentsight.us, the hosted app at app.agentsight.us (the default `bind --app-url`), `npm ci` / `npm run dev` / `npm run verify` and the 23-page catalog, and the README's statement that product facts come from the main repo. It links the repo. Also linked the repo from the "Project site" reference. |

Verified and left alone: the "Why this matters" and architecture prose; the `record` auto-discovery (`resolve_binary_path_for_ssl` then `binary_embeds_ssl` "SSL_write"; Docker via `docker inspect`, k8s via `kubectl`/`crictl`, so "Docker or the CRI" is fair); the 7395 / `--no-server` / `--server-port` defaults and `--listen` 127.0.0.1; the `/api/v1/*` routes; `audit_limit`; the timeline filters (source, comm, PID in `EventFilters.tsx`); the directory map; `docs/build.md` requirements and make targets; the README requirements (4.1+, 5.0+ recommended, `CAP_BPF`/`CAP_SYS_ADMIN`; `top`/`bind`/`vis`/`report` on Windows/macOS/Linux); `vis` writing `output/agent-nebula.gif`; the FAQ "less than 3% CPU overhead"; the Cursor/protobuf limitation; the skills README quote; the release dates and the "~25 MB" binary (25,196,360 B); and all related-work citations.

## Chapter 32: glossary and reading list

### Glossary spot-check (more than 25 definitions)

Checked against the linked chapter section and, for version numbers, against known kernel history:
512-byte stack, ALU/ALU64, Arena (6.9, ≤ 4 GB, 1.5 GB in qwen3-ebpf), bpf_loop (5.17), bpf_wq (6.10), BPF LSM,
BPF link, BPF token, Complexity limit (1M / 4,096), eBPF (3.15, 11 registers), fmod_ret, kfunc (5.13), LDDW, may_goto
(6.9, `can_loop`), Open-coded iterator (6.4, `bpf_for`), Perf buffer, Precision tracking, Registers R0–R10, Ring buffer
(5.8), sched_ext (6.12), seccomp-bpf (3.5), Socket filter, State pruning, struct_ops, Tail call (33), TCX (6.6),
Tracepoint/raw/tp_btf, Trampoline, Unprivileged BPF (5.13 `CONFIG_BPF_UNPRIV_DEFAULT_OFF` → 2), uprobe, USDT,
vmlinux.h, XDP, XDP actions, zpoline (ATC '23), K2 (SIGCOMM '21), Merlin (ASPLOS '24), PREVAIL (PLDI '19), Agni
(CAV '23), uXDP. All are accurate except fmod_ret (32.1). All links and anchors resolve (575 links, 0 broken).

### Issues found and changes made

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 32.1 | Low | fmod_ret: "allowed only on functions marked for error injection" and "make it return a chosen value without running its body". The kernel also allows `security_*` functions, as ch05's table says ("security_* or error-injectable functions"), and the body is skipped only when the program returns non-zero. | Fixed both. |
| 32.2 | Medium | Requested glossary terms: BPF token, `bpf_link`, dynptr and arena were present. **Signed BPF program, pinning, BPF iterator (the `iter/*` program type, as distinct from open-coded iterators) and `bpf_throw` were missing.** | Added four entries in alphabetical position: `g-signed-bpf-program`, `g-pinning`, `g-bpf-iterator`, `g-bpf-throw-bpf-exceptions`. Updated the count from 148 to 152 in the meta summary, the intro and the counter. Signing facts come from the LWN patch-set cover letter (v5: `signature`/`signature_size`/`keyring_id`, check before `security_bpf_prog`, exclusive frozen metadata map, bpftool signing) and LWN's 6.18 merge-window article. `bpf_throw` facts come from LWN "Exceptions in BPF" and docs.ebpf.io (v6.7, cookie, `__exception_cb`, no throw while holding resources). While I worked, another agent added an `h2` on BPF exceptions to ch04 (uncommitted), so the `bpf_throw` entry links there as well as to LWN and docs.ebpf.io. The BPF token entry gained "(Linux 6.9)" and the `delegate_*` mount options. |
| 32.3 | Medium | Papers cited in ch23 were missing from the reading list, because ch23 was unfinished when ch32 was written. AgentSight's *Cited in* lacked 23 ("chapter 23 describes it in prose"), and AgentOps, Watson, InjecAgent and Breaking Agents were absent. | Added 23 to AgentSight's row and four rows to "AI agents" (venue and year as ch23 states them, preprints marked). Updated 97 → 101, the AI-agents bar in Figure 32.1 (16 → 20, same 24.2 px/paper scale) and the caption, since the agent group is now the largest. |
| 32.4 | Low | The AgentSight glossary entry linked to ch23 as a whole, and "How the section links were made" said ch23 "was being written". | Linked "Boundary tracing: the design in one picture" and "Correlating intent with actions", and removed the stale sentence. |

Verified and left alone: every one of the 101 papers is found (by DOI/arXiv id or title) in each chapter its *Cited in*
column names; the reverse direction for ch23 now holds; the `assets/app.js` `data-file` block matches the file; all 6
quiz answers (Q4 tnum 0b0100/0b0011 → 4–7; Q6 namei_ext return range 0–3 per ch28 L205); prev 31, next
`../index.html`.

## Mechanical fix: duplicate generated heading ids (audit item 11)

| File | Before | After |
|---|---|---|
| `chapters/11-starter-templates.html` L121 / L833 | `h3` "Directory map" ×2 | "Directory map (C template)" / "Directory map (Rust template)" |
| `chapters/26-reward-guard-and-safe-change.html` L751 / L1234 | `h3` "Benefits and limitations" ×2 | "Benefits and limitations (RewardGuard)" / "Benefits and limitations (agent-check-restore-safety)" |

No link anywhere pointed at `#directory-map` or `#benefits-and-limitations` in those files (grep over `chapters/` and
`index.html`), so nothing else had to change. Rerunning the duplicate-slug check gives none in either file.

## Not resolved / not verified

- **Live capture was not re-run.** The "What happened when we tried it" callout (glibc 2.38 probes on Debian 12) comes
  from the research notes and was not reproduced in this review.
- **The new ch32 links to ch03 point at uncommitted work.** The anchors `#bpf-tokens-linux-6-9` and
  `#signed-bpf-programs-linux-6-18` come from `h3` sections another agent is adding to `03-verifier.html` (audit items
  6–7; uncommitted, not mine). If those headings are renamed, rerun the link check. `06-btf-core-libbpf.html` is also
  being changed by another agent (a "Debugging and measuring" section); nothing in ch32 links to it yet.
- **Also uncommitted: ch04's "BPF exceptions: bpf_throw and bpf_assert" section**, which the `bpf_throw` entry links to
  (`#bpf-exceptions-bpf-throw-and-bpf-assert`). Rerun the link check if it is renamed.
- **Stale research note.** `research/23-agentsight.md` (and upstream `CLAUDE.md`) still name `build_trace_agent()`, and
  the note's evidence-type list mirrors the design doc. Outside my edit scope; not changed.
- **`index.html`** still needs `python3 tools/build_index.py` (audit item 3). Not run, because only the four chapters
  were in scope.
- **Glossary spot-check limits.** The checks covered the definition text against the linked chapters and well-known
  version facts. Version numbers were not re-checked against kernel source.
