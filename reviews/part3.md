# Review: chapters 13–16 (bpf-compatible, bpftime ×2, llvmbpf)

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/13-bpf-compatible.html`, `14-bpftime-architecture.html`, `15-bpftime-in-practice.html`,
`16-llvmbpf.html`, checked against `research/13–16`, `AUTHORING.md`, `SYLLABUS.md`. Only these four chapters were edited.

## How the chapters were checked

- **Sources at the cited commits.** bpf-compatible `4ed5e65`, eunomia-bpf `a5408a8`, bpftime `25e250d6`,
  llvmbpf `7e384db`, libbpf `872299d`, bpftool `1f6bbb7`, bcc `c398a9a`, btfhub `6348f13` (all clones under `src/`).
- **`data-file` blocks (all 98).** A script compared every non-elided line, after whitespace normalisation and in
  order, with the cited file. All blocks match. The remaining reports were all checker artefacts: inline
  `/* ... */` elisions inside a line, a README command that the chapter says it joined from two wrapped lines
  (sslsniff), and the nginx commands that ch15 labels as "quoted from the README's prose" (checked by hand).
- **Experiments rerun in this orb** (Debian 12, kernel 6.1.189+, clang 14, bpftool 7.1, LLVM 15.0.6):
  - ch13: compiled `execsnoop.bpf.o` (73,288 B, identical size), `min_core_btf` against the orb kernel (358 B),
    ran the real `script/btfgen fetch` (2.6 s, 269 MB cache) and `btfgen` over the 85 demo kernels (85 entries,
    2,004 B tar.gz versus 2,012 in the chapter). Loaded with `btf_custom_path` set: orb BTF gives
    `1416 -> 1400`/`1404 -> 1388`; Ubuntu 5.4.0-26 BTF on the 6.1 kernel loads with `1416 -> 2280`/`1404 -> 2268`.
    This matches the chapter exactly.
  - ch16: built `libllvmbpf_vm.a` and ran scratch drivers (deleted afterwards). The BPF-to-BPF stack-frame bug was
    reproduced (99 versus 7; the control at `r10-520` gives 7). Found a new bug in division (see 16.1).
  - ch14: tested `mprotect(PROT_EXEC)` read behaviour (see 14.1).
- **Papers.** OSDI '25 PDF (USENIX) was text-extracted. Every quoted sentence and number in ch14 was matched against it:
  Table 3, servers A/B, 2%/11%/12%/9%, 54%, 1.5×, 28.06%/7.41%/3.79, 48/30 ms, 190/106/1.35 ns, 1.53×/1.72×,
  1/22/23 conformance failures, 17 tools, TCB, threat model, the EIM figures, MPK text. arXiv 2311.07923: the
  title, the six authors ("Andrew Quinn"), v1 14 Nov 2023, v2 8 Dec 2023, and the "10x" abstract were checked on the
  arXiv abstract page. eGPU (HCDS '25, pp. 73–79, Yang/Yu/Zheng/Quinn, DOI 10.1145/3723851.3726984) and the
  quoted PTX sentence were checked on the ACM-hosted HTML. uXDP (eBPF '25, Zheng/Gavriil/Kogias, DOI
  10.1145/3748355.3748360, "up to 3.3×", Katran 40%) was checked on the SIGCOMM workshop page. gpu_ext arXiv
  2512.12615: the "LLVM-based backend (∼1 KLOC)" sentence is in the PDF.
- **Repo-quoted text.** Every quoted string in ch14–16 was matched against the READMEs, usage.md, installation.md,
  AGENTS.md, the benchmark files, git commit messages, and the uBPF/rbpf READMEs. All quotes were found.
- **Links.** All 76 external URLs were requested with `curl -L`. 71 returned 200. crates.io returned 404 to curl but is
  fine in a browser (the API confirms 0.1.3, updated 2023-05-28). dl.acm.org/doi.org returned 403 (bot blocking).
  The records were confirmed through search and Crossref (PLDI'19 PREVAIL DOI).
  The ch16 anchors into ch02 (`#bpf-to-bpf-calls` and others) were checked against the ids that `app.js` generates.
  All exist.
- **Mechanics.** Tag balance, duplicate ids and unescaped `<`/`&` in `<pre>` were checked: all clean. Every quiz has
  exactly one `data-right`, and all 24 answers were re-derived. prev/next links are correct: 12→13→14→15→16→17
  (`17-bpfix.html` now exists).
- **GitHub API** was used for releases (5 latest have 0 assets), PR #666/#689 titles and dates, the eGPU,
  XDP-eBPF-in-DPDK (archived, pushed 2024-09-11) and Nginx-eBPF-module (pushed 2024-01-14) repos, and the
  eunomia-bpf/btfhub-archive tree (85 files; the widget sample entries all exist).

Severity scale: **High** means a wrong technical statement that a reader would act on. **Medium** means wrong or
misleading, with limited impact. **Low** means imprecise, or a pedagogy or consistency issue.

## Specific claims the task asked to re-check

| Claim | Verdict |
|---|---|
| ch16: BPF-to-BPF frames overlap because `STACK_SIZE` = 64 is used as bytes | **Confirmed.** `compiler.cpp:42` defines `STACK_SIZE = (EBPF_STACK_SIZE+7)/8`. The CALL branch (`~L1456`) does `r10 -= getInt64(STACK_SIZE)` on an i64 register, and `localFuncReturnBlock` (`~L549`) adds it back. Reproduced: 99 instead of 7. The claim is labelled as observed, with an illustrative test. Wording kept. I added the rerun note and corrected which conformance tests miss it. |
| ch14: PREVAIL skips uprobe programs | **Confirmed by code reading.** `syscall_context.cpp:643–661` is the only call site of `verify_ebpf_program`. It maps only `TRACEPOINT`/`SOCKET_FILTER`. libbpf `SEC_DEF("uprobe+", KPROBE, ...)`. Not run (needs a verifier build). It was already labelled unverified. I sharpened the wording (only call site, applies even with STRICT, a code-reading inference). |
| ch14: perf_event_open's PID is unused | **Confirmed by code reading.** `uprobe_perf_event_data.pid` is stored. `bpf_attach_ctx.cpp:448–453` builds the private data from `_module_name` + `offset` only. The only `pid` checks in the frida attach code concern `/proc/<pid>/map_files` paths. Already labelled "In my reading". Kept. |
| ch13: bpf-loader-rs checks the archive before kernel BTF | **Confirmed.** `builder.rs:84–89` bails if the archive file is missing before `vmlinux_btf_exists` is computed. Labelled as code reading. Kept. The order summary right after it was wrong (13.1). |

## Issues found and changes made

### Chapter 13: bpf-compatible

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 13.1 | Medium | The text summarised bpf-loader-rs's selection order as "kernel BTF if readable; otherwise the archive entry; otherwise `BTF_FILE_PATH`". The code is `if archive && !vmlinux → archive; else if BTF_FILE_PATH set → env file; else if !vmlinux → error`. So `BTF_FILE_PATH` overrides even a readable kernel BTF. | Rewrote the sentence to match the code. |
| 13.2 | Low | "CentOS 7 kernels never have BTF." BTFHub's table lists them all with BTF "-", but its own note says the latest ones "might support BTF". | Changed to "are all listed without BTF". |
| 13.3 | Low | The text says bpf-compatible-sys reuses "only the path builder" from the -rs crate. It also uses the re-exported `tar` crate (`bpf_compatible_rs::tar::Archive`). | Added this. |
| 13.4 | Low | The 2,012-byte archive size is not exactly reproducible. The rerun gave 2,004 B. | Added a note that the size varies by a few bytes between runs (probably tar timestamps; labelled as presumption). |

Verified and left alone: all code blocks; the 358 B/10-type trimmed BTF dump; nm output (0x7dc = 2012); the libbpf
`btf_custom_path` comment and `obj_needs_vmlinux_btf`; the libbpf warning string (`btf.c:6190`); the bcc
`ID_FMT`/`VERSION_FMT` (247 lines, "~250"); ecc `-b/--btfgen`, `fetch_btfhub_repo` cloning the full aquasecurity
archive; `get_output_tar_path` writes `{object_name}.tar` versus README "btfgen.tar.gz"; ecli `.tar` → `ProgramType::Tar`;
`clean_core_btf_rs` unlinks and frees; Cargo deps; btfhub `tools/btfgen.sh` reports `[FAIL]` (supports the comparison
table); the CentOS 8.0/8.1 rows; the demo-archive contents. The "aarch64 vs arm64" and RHEL `VERSION_ID` limitations
are correctly marked as untested.

### Chapter 14: bpftime architecture

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 14.1 | Medium | "Page 0 is then set to execute-only, so ordinary NULL loads and stores still fault" (body and Q3 explanation). On x86-64, `PROT_EXEC`-only pages are readable unless the CPU has PKU (execute-only is implemented with a protection key). Tested in this orb (no `pku` flag): a `PROT_EXEC` page could be read, and a write faulted. | Rewrote both places: stores fault; loads fault only where execute-only can be enforced (PKU). Quotes the source comment. |
| 14.2 | Medium | Sessions: "when the agent sees the epoch change it destroys its old attachments and rebinds" implies continuous monitoring. The epoch is only read when `init_attach_ctx_from_handlers` runs: at startup, or on refresh (IPC/auto-refresh thread from `bpftime trace`). | Clarified, with a cross-link to ch15's CLI section. |
| 14.3 | Medium | Provenance not noted: the paper's Table 3 uprobe and uretprobe rows (2561.57/190.02, 3019.45/187.10) are identical, digit for digit, to the repo's `benchmark/uprobe/example_results.md`, which says it ran on a Core Ultra 7 258V laptop, not on Server A. | Added to the "Reading the numbers" callout, with a cross-link to ch15. This is reported as an observation, not as a judgement on the paper. |
| 14.4 | Low | "`bpf-benchmark` ... is where the project keeps its current benchmarks" overstates. The README points there for how they evaluate, and `benchmark/` is still in-tree. | Reworded and cross-linked to ch15's benchmark section. |
| 14.5 | Low | Quotation marks around "faster uprobes" / "a safe extension framework for applications" made them look like paper quotes. They are not in the paper. | Removed the quotation marks. |
| 14.6 | Low | PREVAIL/uprobe wording: see the table above. | Sharpened, and labelled as a code-reading inference. |
| 14.7 | Low (dup) | "Building and using it" partly duplicates ch15's install section. | Added a lead sentence that it is the short version and that ch15 has the full install and examples. Kept it short; no text was removed. |

Verified and left alone: all OSDI/arXiv citations and numbers (see above); the syscall-server overrides; `unsetenv("LD_PRELOAD")`;
handler variant; 50 MB / 6144 defaults; the `pthread_spin_lock` guard; KERNEL_USER offset 1000; agent retry 60×50 ms;
the riscv-only trap backend (`StandardSettings.cmake:76–80`) and README numbers (4706/1346/5654, "two signal deliveries
per hit"); `NR_syscalls = 512`; the zpoline mechanics; `dlmopen(LM_ID_NEWLM)` (the explanation is labelled as the author's);
MPK (`pkey_alloc(0, PKEY_DISABLE_WRITE)`, `pkey_mprotect`, off by default) and how it differs from the paper's WRPKRU
text; `ENABLE_EBPF_VERIFIER` OFF; WARNING default; PROBE_READ/WRITE_CHECK ON; daemon defaults
(`enable_replace_uprobe` true, `enable_replace_prog` false); "LLVM >= 15"; the README "up to 10x" and ~974 files ("about
1,000"); C++20; the EIM-not-in-repo callout (no EIM/Extension_Class/YAML code found).

### Chapter 15: bpftime in practice

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 15.1 | Medium | The benchmark table presents map and memory rows as if per operation. Each benchmark function in `benchmark/uprobe/uprobe.bpf.c` loops 1,000 times, so the rows are per probe hit × 1,000 ops (about 1,000× the paper's Table 3). The uprobe rows are also the same numbers as the paper's Table 3, so they are not an independent measurement. | Added both cautions under the table, with a cross-link to ch14's Table 3. |
| 15.2 | Medium | The "Verifier default" callout tells the reader to set `BPFTIME_VERIFIER_LEVEL=STRICT` for safety. That may not cover uprobe programs (see the PREVAIL claim). This contradicts ch14's caveat. | Added the caveat (labelled code reading), pointing to the kernel verifier for uprobes. |
| 15.3 | Low | "only then `dlopen`s the agent". The code uses `dlmopen(LM_ID_NEWLM, …)`, and ch14 makes a point of it. | Fixed, consistent with ch14. |
| 15.4 | Low | nginx benchmark: "standard deviation of roughly 1000 rps for most configurations". The JSON gives 645–1031 rps (4 of 7 are under 800). | Changed to "between about 640 and 1,030 rps". |
| 15.5 | Low | `data-file` paths lacked the repo prefix (`installation.md`, `example/...`), unlike ch13/14 and AUTHORING's `repo/path` rule. | Prefixed all 15 paths with `bpftime/` (content unchanged). |

Verified and left alone: CLI subcommands and flags (`main.cpp`, 1,290 lines); the env-var table; the releases with no
assets; the Dockerfile details; `build-vm`/`build-llvm`; "GPU support is still experimental"; the bpftimetool subcommands
(no `dump`); map and helper lists; GPU helpers 501–506 and 509–511; ATTACH ids 6/7/1008/1009 and CUDA 8/9; the
syscall benchmark numbers (both runs); the GPU numbers; the nginx rps/overheads; eGPU "merged into bpftime"; DPDK repo
archived; PR #666 (2026-09) and #689; uXDP 3.3×/40%; all six quiz answers. The 14/15 split is right: 14 has the
mechanisms and paper, 15 has the commands and outputs. The overlap (malloc example, verifier modes, mixed mode) is
at different depths and already cross-linked. No contradictions remain after 15.2/15.3.

### Chapter 16: llvmbpf

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 16.1 | **High (new bug)** | The chapter says the DIV/MOD cases are safely guarded with `select(src == 0, 0, dst / src)` and that it "handles `INT_MIN / -1`". A `select` evaluates both operands, so the `udiv`/`sdiv`/`urem`/`srem` still runs. Tested at 7e384db, LLVM 15.0.6, with operands loaded from the context: u64 div by 0, u64 mod by 0, s64 div by 0 and `INT64_MIN / -1` all kill the host with **SIGFPE**, at both -O3 and -O0. A non-zero divisor gives the correct result, and a constant-0 divisor is folded to 0 (which is why bpf_conformance `*-by-zero-reg`, using `mov r1,0`, passes). For bpftime this means a uprobe program can crash the traced application. | Added an "Observed bug (found in review)" callout with the test method and its limits (illustrative test, only LLVM 15 tested). Changed "handles" to "tries to handle". Updated the conformance paragraph and the limitations bullet. Not reported upstream. |
| 16.2 | Low | "The repository's `call_local` conformance test does not use deep stack slots". `call_local` is from bpf_conformance, and both it and `rfc9669_call_local` do not touch the stack at all. | Corrected the attribution and added the rerun note. |
| 16.3 | Low | The text says verification is safe "with bpftime in strict verifier mode" (comparison section and Q5 explanation). This ignores that strict mode may not cover uprobes. | Qualified both, with a link to ch14. |
| 16.4 | Low | `data-file="src/…"` / `example/…` lacked the repo prefix. | Prefixed with `llvmbpf/`. |

Verified and left alone: line counts in the layout table; STACK_SIZE/MAX_LOCAL_FUNC_DEPTH/CALL_STACK_SIZE (64/32/64,
2058 slots, 320 call-stack slots); `uint16_t` pc; the helper symbol format and helper-12 behaviour; JIT/AOT map_val
split; the PTX commit 118919d (+3117/−96, 20 files, 2025-05-21); SPIR-V b8e4eea (2025-10-04); #23/#35/#40/#41/#49/#50/#52/#54
dates; 56 commits, 13 author names, 8 in 2026; the bpftime submodule pin `87bac39`; "Big Switch Networks" header; uBPF
"intentionally unavailable" and rbpf "very simple verifier" quotes; the eGPU PTX quote; gpu_ext "~1 KLOC"; the
kernel sysctl doc lists 13 eBPF JIT arches; the optimised IR matches the README; all quiz answers.

## Not resolved / not verified

- PREVAIL skipping uprobe programs and the unused perf-event PID were confirmed only by reading code. A
  verifier-enabled bpftime build was not run (bpftime was not built; it is too large for the orb).
- The division bug (16.1) was tested only with LLVM 15.0.6 on x86-64 and only through llvmbpf directly, not inside
  bpftime. On arm64, `udiv` by 0 returns 0 in hardware, so the symptom would differ (not tested). Not reported upstream.
- The ch13 2 KB figure and BTF loading were reproduced, but the bpf-compatible-sys runtime itself was not built
  (no cargo), and nothing was tested on a kernel without BTF.
- The OSDI page range 557–574 was taken from the research notes and the PDF's running footer (page 564 seen). It was not checked
  against the USENIX proceedings index.
- dl.acm.org pages could not be fetched with curl (HTTP 403). The ACM metadata was confirmed through search results and
  ACM-hosted HTML.
- Word counts were not measured. All four chapters meet the structural minimums.
