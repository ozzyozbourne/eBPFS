# Review: Part I, chapters 01–04

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/01-what-is-bpf.html`, `02-ebpf-isa-and-vm.html`, `03-verifier.html`,
`04-maps-helpers-kfuncs.html`, checked against `research/01–04`, `AUTHORING.md` and `SYLLABUS.md`.
Only these four chapters were edited.

## How the chapters were checked

- **Kernel source.** Fetched as single raw files from GitHub at the commit the chapters cite,
  `d68ce4e71248e1ff5af9654b407541d9260b3ba5` (master, 2026-11-05). The kernel was not cloned.
  Version claims were checked by fetching the same headers at the tags v6.12, v6.17–v6.19,
  v7.0–v7.3 and v7.4-rc1.
- **`data-file` code blocks (51 blocks).** A script compared every non-elided line, after whitespace
  normalisation and in order, with the file at the cited path (kernel at d68ce4e7, libbpf-bootstrap at
  820a1bd8). Result: all 51 match. A planted wrong line was reported correctly, so the checker works.
- **Compiling and running code.** In this orb (Linux 6.1.189, clang 14.0.6, libbpf 1.1.2,
  bpftool 7.1.0):
  - ch02 `count.c`: `llvm-objdump` output is identical to the chapter.
  - ch03 histogram program: compiles and loads.
  - ch01 "bad" program: compiles, and the load is rejected with `R0 invalid mem access 'map_value_or_null'`,
    as the chapter shows.
  - ch04 `execsnoop`: `execsnoop.h`, `execsnoop.bpf.c` and `execsnoop.c` were extracted from the HTML,
    built with the chapter's exact commands, and run. It printed exec events and `dropped: 0`.
- **Primary sources.**
  - RFC 9669 text.
  - docs.kernel.org pages: abi, clang-notes, sysctl/net, sysctl/kernel, bpf_design_QA, filter,
    seccomp_filter, ringbuf, kfuncs, map_lpm_trie, verifier.
  - bcc `docs/kernel-versions.md`.
  - The 1993 BPF paper, the PREVAIL paper and the Jitk paper (PDFs).
  - The USENIX pages for Jitterbug, Jitk, EPF and SEV; the arXiv abstract for CGO'22; the Springer page
    for Agni; Crossref metadata for the PLDI'19, CGO'22 and both CAV DOIs.
  - The NVD API for all five CVEs.
  - 24 LWN articles and postings (every LWN URL in ch01–04), read for title, author, date and the
    quoted text.
  - The ebpf.io and Brendan Gregg quotes; the libbpf-bootstrap README; LLVM commit 17bfc00.
  - Subject lines and dates of all 25 kernel commits cited in ch01–04.
- **Links.** All 124 external URLs were requested with `curl -L`, and 97 returned 200. The rest were
  checked by hand:
  - LWN rate-limited the burst with HTTP 429. Every LWN URL was then read individually and resolves.
  - dl.acm.org returned 403 and NVD timed out or returned 403; both are bot blocking. Crossref and the
    NVD API confirm the records.
  - doi.org for the CGO'22 DOI returned 202; Crossref confirms it.
- **Mechanics.**
  - A Python HTMLParser tag-balance check found no unbalanced tags and no duplicate ids.
  - No unescaped `<` or `&` inside `<pre>`.
  - Every quiz question has exactly one `data-right`, and each answer was re-derived by hand.
  - prev/next links are correct: 01←index, 01→02, 02→03, 03→04, 04→05.
  - All cross-chapter links use file names from SYLLABUS.md.
  - The ch02 instruction decoder was run in Node on 16 encodings, including the v4, atomic, may_goto
    and callx forms, and all decoded correctly.
  - Widgets use the shared classes: `.callout`, `.tabs`/`.tab-panel`, `.stepper`/`.step`,
    `.quiz`/`.q`, `.grid`/`.card`. Each chapter has one dependency-free script at the end of the page,
    which AUTHORING allows.

## Issues found and changes made

Severity scale: **High** means a wrong technical statement a reader would act on. **Medium** means
wrong or contradicting, but limited impact. **Low** means imprecise, stale, a missing attribution, or
a pedagogy fix.

### Chapter 01: What is BPF?

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 1.1 | Medium | The intro to "Your first eBPF programs" says outputs were "copied from that run", but the `trace_pipe` lines in the "Build & run" tab are the sample output from the libbpf-bootstrap README (PID 3840345 appears verbatim there). They cannot have come from this orb: it has no `syscalls:*` tracepoints, so `sys_enter_write` cannot be attached. I verified that `/sys/kernel/tracing/events/syscalls` is absent. | Added a comment in the code block that says the output is quoted from the README and why it was not reproduced. |
| 1.2 | Low | Says `@[comm] = count()` is a "hash map"; ch04 says bpftrace uses a per-CPU hash. | Verified in the orb: bpftrace 0.17 creates a `percpu_hash` map. Clarified ch01 to match ch04. |
| 1.3 | Low | "The BPF trampoline (5.5) made function entry and exit hooks nearly free": overstated. | Changed to "much cheaper than kprobes". |
| 1.4 | Low | The code-map table cites `Documentation/bpf/instruction-set.rst`; the file is in `standardization/`. | Fixed the path. |
| 1.5 | Low | The references for LWN 437981, 475043 and 599755 had no author or exact date. The research notes said the bylines could not be extracted. | All three are by Jonathan Corbet (Apr 12 2011, Jan 11 2012, May 21 2014). Added. |

Verified as correct and left alone:
- Paper title, venue and the "20×" and "100×" figures; the "PDP-11" quote in the Q1 explanation;
  "filtering packets early and in place pays off".
- All tcpdump opcode arithmetic: 0x28, 0x15, 0x30, 0x45, 0xb1, 0x48 and the jump targets.
- `bpf_check_classic` requires a final `ret`: confirmed in `net/core/filter.c`.
- seccomp in 3.5, and kernelnewbies' Chromium note.
- The ebiederm LWN comment quote; Ingo Molnar's suggestion of the `bpf_attr` union.
- The Gregg "VKIS", "v8" and "Netflix 15 / Facebook 40" quotes; the ebpf.io quotes.
- The timeline versions against the bcc table.
- The `unprivileged_bpf_disabled` semantics.

### Chapter 02: ISA and VM

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 2.1 | Medium | Says the bpftool commands "were not run in this orb, whose kernel does not allow loading BPF programs". That is false: this orb loads programs, as ch01, ch03 and ch04 all show. It also contradicts those chapters. | Loaded the chapter's own `count.o` and captured a real `bpftool prog dump xlated`. It replaces the unrun command list, together with a short paragraph explaining the visible rewrites: `map[id:…]`, the helper call address, `xdp_md` offsets 0/4 becoming `xdp_buff` offsets 0/8, the subprogram appended at index 19, and the interpreter's `__bpf_prog_run_args32` call form. The orb has no JIT, so `dump jited` is noted as unavailable. |
| 2.2 | Medium | Lists `LLONG_MIN / -1 → LLONG_MIN` as ISA semantics and says the RFC covers that case. RFC 9669 never mentions it; the rule was added later to the kernel's `instruction-set.rst` (lines 334–362 at d68ce4e7). The text also says the RFC and the kernel file "are kept in sync", which is no longer true. The Q5 explanation repeats this. | Attributed the rule to the kernel document as post-RFC. Replaced "kept in sync" with "has kept evolving since; the two are no longer identical", in the body and in the Q5 explanation. The RFC bullet now names division and modulo by zero only. |
| 2.3 | Medium | The EPF callout said the main defences are `unprivileged_bpf_disabled` and requiring `CAP_BPF`. EPF's abstract says the payloads are BPF code "provided by unprivileged users"; classic BPF socket and seccomp filters are not gated by that sysctl. | Rewrote the callout: it now says what EPF bypasses, why the sysctl alone does not help, and what defences the paper proposes. |
| 2.4 | Low | Says `MAX_CALL_FRAMES` is "16 in v7.3 and later". It is 16 from v7.2 (v7.1 has 8). | Fixed. |
| 2.5 | Low | Says `BPF_REG_PARAMS` and stack arguments were "added in v7.3"; they are present in v7.2. The quote "x86-64 uses R9 for both private stack frame pointer and arg6" was attributed to the x86 JIT, but it is a comment in `kernel/bpf/verifier.c`. | Fixed both. |
| 2.6 | Low | "JITs rely on the hardware doing the same thing" (shift masking) is overgeneralised. | Narrowed to x86-64 and arm64. |
| 2.7 | Low | "The verifier analyses each subprogram in the context of its call site" is true only for static subprograms. | Added the global-function exception, with a link to ch04. |

Verified as correct and left alone:
- `MAX_BPF_STACK_JIT 2048`: first in v7.4-rc1, absent in v7.3.
- `reg2hex`, `emit_atomic_rmw` and the interpreter excerpts (all `data-file` blocks match).
- The `emit_prologue` order; `MAX_PASSES 20`; the BHB barrier applies only to classic programs from
  non-`CAP_SYS_ADMIN` loaders.
- The sysctl semantics and the JIT architecture list.
- Constant blinding (4f3446bb809f, 4.7).
- Jitterbug: 16 bugs in five JITs, RV32; OSDI'20 pp. 41–61.
- Jitk: termination and bounded-stack theorems (Theorems 5 and 6) and the JIT-spraying caveat, all
  in the paper's text; OSDI'14 pp. 33–47.
- JitSynth, CAV'20.
- The RFC conformance-group quote and "future work"; the LWN 997002 and Vernet 2023 details,
  including NVMe and XRP; LLVM 17bfc00 (Peilin Ye, 2025-03-04).

### Chapter 03: Verifier

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 3.1 | High | "Pointer plus pointer becomes a plain scalar, which is forbidden for unprivileged loaders." This is wrong. `adjust_reg_min_max_vals()` rejects every pointer-to-pointer ALU op for everyone (`R%d pointer %s pointer prohibited`), except subtraction when `allow_ptr_leaks` (`CAP_PERFMON`) is set. | Rewrote the bullet to match the code. |
| 3.2 | Medium | The table of "more messages" claimed every entry is "present as format strings in the current source". Three were not: `invalid indirect read from stack off …` (the current string is `invalid read from stack R2 off …`, and 6.x adds "indirect"), `invalid stack off=8 size=8` (actually `invalid write to stack R1 off=8 size=8`), and `misaligned access off 4 size 8` (actually `misaligned value access off (0x0; 0x0)+4 size 8`). | Updated the three spellings from the format strings at d68ce4e7. Softened the intro to say wording varies between versions. |
| 3.3 | Low | "Since 5.3, back-edges are allowed for privileged loaders (`CAP_BPF`)": `CAP_BPF` only arrived in 5.8. | Changed to "`CAP_SYS_ADMIN` at first, `CAP_BPF` since 5.8". |
| 3.4 | Low | "BPF token" is used without explanation, a concept used before it is defined. | Added a one-sentence definition. |
| 3.5 | Low | The "resource safety" guarantee names acquire/release but does not point to where it is taught. | Added a link to ch04. |
| 3.6 | Low | The reference list dates LWN 1050779 to 2026; it was published December 23, 2025. | Fixed. |

Verified as correct and left alone:
- Every 2026 claim: `cfg.c` and `states.c` first in v7.1; cnum in v7.2 (256f0071f9b6); diagnostics in
  v7.3; SCEV in v7.4-rc1; base/step only in 7.4-rc1, which the chapter calls "recent master".
- The `bpf_check()` call order; `reg_bounds_sync()`; the "64k insn" stale comment.
- The limits (1M, 4096, 8192, 64); the unprivileged program types; the default of 2 under
  `CONFIG_BPF_UNPRIV_DEFAULT_OFF`.
- All 25 commit hashes, with their titles and dates.
- The tnum worked example, recomputed by hand.
- The stepper arithmetic.
- PREVAIL: 192 programs, intervals fail 64, zones verify all but one, the "syntactic pattern matching
  and ad hoc case analysis" quote, termination not proved.
- CGO'22: 33% faster, merged.
- Agni: 16 versions 4.14–5.19, 27 bugs, about 97% POCs, sound after 5.13.
- SEV: 15 bugs, 10 fixed, 2 LPE.
- The five CVE descriptions and fix commits, against NVD.
- LWN 794934 (80% of saved states never prune).
- Precision-fix history in 2023 and 2026, confirmed by a GitHub commit search.

### Chapter 04: Maps, helpers, kfuncs

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 4.1 | High | "LPM trie ... prefix lengths are multiples of 8 from 8 to 2048." This is wrong. `map_lpm_trie.rst` says the *maximum* prefix length (the key data size) must be a multiple of 8 in [8, 2048]. Individual prefixes such as /19 are allowed. A reader would think CIDR /19 or /27 routes are impossible. | Rewrote the sentence. |
| 4.2 | Medium | The flag table is introduced as "defined in `include/linux/btf.h`" and lists `KF_DEPRECATED`. That flag is only described in `kfuncs.rst`; there is no `#define` in `btf.h` at d68ce4e7. | Added a note to the row. |
| 4.3 | Low | Says the timer callback "receives the map, the key and the timer". The verifier types R3 as `PTR_TO_MAP_VALUE` (`set_timer_callback_state`); it is the map value. The selftest declares it as `struct bpf_timer *` only because the value's single member is the timer. | Corrected and explained. |
| 4.4 | Low | "I have not verified which release first shipped" `BPF_MAP_TYPE_INSN_ARRAY`, `BPF_MAP_TYPE_RHASH` and `BPF_F_RB_OVERWRITE`. These can be checked. | Checked the uapi header at each tag: INSN_ARRAY and RB_OVERWRITE first appear in v6.19, RHASH in v7.2. Filled these in. |
| 4.5 | Low | `MAX_CALL_FRAMES` is given as "currently 16" with no version; the 2 KiB stack has no version. | Added "since v7.2" and "since v7.4-rc1", consistent with ch02 and ch03. |
| 4.6 | Medium (gap) | Variable-size ring-buffer records are missing. The chapter lists "reserve sizes must be constants" as a limitation, but `bpf_ringbuf_reserve_dynptr()` and dynptrs (5.19, bcc table) remove it. Dynptrs also appear in ch03's type table ("dynptr slices") and are never explained in 01–04. | Added a short subsection, "Variable-size records: dynptrs", with the helper names and versions and the uapi quote that submit or discard is mandatory. It links back to ch03. Amended the limitation bullet. |

Verified as correct and left alone:
- All 17 `data-file` blocks.
- The map-type versions against the bcc table; `-E2BIG` when a hash is full; flags 0x480 and 0x400.
- `LOOKUP_AND_DELETE` for hash in 5.14.
- The Nakryiko blog points: the fork/exec/exit ordering anecdote, page-multiple and power-of-2 size,
  no lost callback.
- The ringbuf mmap permissions and the "carefully check and validate" quote.
- The tail-call uapi quotes; the bpf2bpf+tailcall arch versions; 211 helpers and 164 kfuncs (LWN 977013).
- LWN 856005: 5.13, TCP congestion control as the driver.
- The kfunc stability quotes; the `KF_*` set in `btf.h`; `bpf_task_acquire` flags.
- Arena: 6.9, up to 4 GB, the cover-letter quote, LWN 1019885 title and date.
- The RHASH posting (Mykyta Yatsenko, Jun 2026).

## Cross-chapter consistency

- Fixed: whether this orb can load BPF programs (2.1); call-frame and stack-size versions, which are now
  identical in ch02, ch03 and ch04 (2.4, 4.5); and bpftrace map type (1.2).
- Checked and consistent: ch02 and ch04 both cover BPF-to-BPF calls. ch02 covers encoding and the
  interpreter and JIT; ch04 covers static versus global linkage. They cross-link both ways, which is the
  right split, so no text was merged. Tail calls are introduced in ch02 and deferred to ch04. The
  NULL-check example appears in ch01 (teaser), ch03 (analysis) and ch04 (API), each at a different depth.

## Left as is, or not resolved

- **The first-person voice** in ch04 ("When I changed…", "I built and ran…") is unusual for the
  curriculum but harmless. Not changed.
- **Unverified: Jitterbug's "May 2014–April 2020" commit window.** It comes from the research notes and
  is not in the USENIX abstract. I did not re-read the full paper.
- **LWN rate limiting.** The `curl -sIL` pass got HTTP 429 from LWN partway through. Every LWN URL in
  ch01–04 was then fetched individually and resolves, with the titles and dates given above.
- **No JIT output.** This orb's kernel has no JIT (no `net.core.bpf_jit_*` sysctls), so no chapter
  shows real JIT output. ch02 already labels its x86 listing as documented output from
  `classic_vs_extended.rst`.
- **Word counts** against the 4,000–9,000 target were not measured. All four chapters are long and meet
  the structural minimums: at least 2 SVGs, 4 or more real code samples, a stepper or tabs, 6 quiz
  questions, and references.
