# Review: chapters 17–19 (bpfix, ebpf-correctness-verifier, bpf-benchmark/bpfperf)

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/17-bpfix.html`, `18-ebpf-correctness-verifier.html`, `19-bpf-benchmark.html`, checked against
`research/17–19`, `AUTHORING.md` and `SYLLABUS.md`. Only these three chapters were edited.

## How the chapters were checked

- **Sources at the cited commits.** bpfix `4b9decaa` (paper submodule `f98e7e2`, in `src/bpfix-paper`),
  ebpf-correctness-verifier `59ca424`, bpf-benchmark `193c2b9b` (sparse clone; files outside the sparse set read with
  `git show HEAD:<path>`), bpfperf `085bcbc`, ebpf27-bpfoptbench `17588bd`, atc26-kinsn-camera-ready `2ff6d3f`.
  Note: bpf-benchmark's remote HEAD has already moved past `193c2b9` (now `5e6e3b2`). The chapter pins its commit, so this is fine.
- **`data-file` blocks (53).** A script compared every non-elided line with the cited file, after whitespace
  normalisation and in order. The bpfix replay log came from `empirical-fixtures.tar.gz`, and `log.c` was fetched at tag
  v6.9. Every block matches. The only reports were checker artefacts from inline `/* ... */` elisions, plus one real
  miscount (19.1).
- **Experiments rerun in this orb** (Debian 12, kernel 6.1, clang 14, Z3 4.8.12):
  - ch18: used the existing `build/` binaries. Rebuilt all 9 raw instruction pairs in the "Limitations, measured" table
    and the worked example, and ran them through `smt_ebpf_equiv`. Every verdict matched the chapter (sub-imm/div-reg/JLT/
    `s> 2000`/signed-halving: PASS; `/2` vs `>>1`: FAIL; `s> 500`: FAIL; mul8/shl3: PASS; shl2: FAIL). Rebuilt the
    clang C pairs through `ebpf-tv check --equiv-backend smt`. `-mcpu=v1` gave FAIL and `-mcpu=v3` gave PASS (the object has
    `66 01 01 00 04 …` = `if w1 s> 4`). `p[0]*p[1]` vs `p[1]` gave PASS (the object has `2f 20` = `r0 *= r2`). All as stated.
  - ch17: built bpfix 0.1.10 (`cargo build --release -p bpfix`, 18 s, target dir in /tmp, deleted). The output on the
    6.15 replay log is byte-identical to the "after" tab. The output on `packet_eth_off_by_one_001/verifier.log` is
    identical to `diagnostic.txt`. Did not rerun the chapter's own 6.1 loads (`bpftool prog load`). Those tabs were
    taken on trust.
- **Papers.** Every DOI cited in ch17–19 was resolved through the Crossref API: title, authors, venue, year and pages
  all match. Checked: K2, Merlin, Pnueli et al., Necula (SIGPLAN Notices/PLDI 2000), Alive2, Deokar et al., Kgent,
  Pretty Verifier (IEEE CSR 2025, pp. 214–219), PREVAIL, Agni/CAV'23 and Morpheus (10.1145/3503222.3507769).
  arXiv records were checked through the export API: K2 2103.00022, EPSO 2511.15589 (795 rules, beats K2 on all and
  Merlin on 92.68%), Heimdall 2605.25411 (109/115, angr + Z3; angr confirmed in the arXiv HTML), KEN 2312.05531 (same 4 authors
  as Kgent) and Kops 2606.24213. The Zenodo DOI was checked through DataCite. Jitterbug (16 bugs, RV32 JIT) and Alive2 (47 bugs,
  so "dozens" is fine) were checked on the USENIX PDF and the PLDI page. Rex ATC'25 and Sun & Su OSDI'24 pages return 200.
  The Deokar "Error Handling and Verifier Messages" category was confirmed on the eBPF'24 slides.
- **Links.** All 57 external URLs were fetched. 45 returned 200. ACM `doi.org` returned 403 (bot blocking; confirmed
  through Crossref). crates.io returned 404 to curl, but the API confirms 0.1.10. Stack Overflow returned 403, but the API
  confirms Q53136145 exists. The DataCite DOI returned 202. All intra-curriculum anchors (`#limitations-measured`,
  `03-verifier.html#prevail-…`, `02-…#the-x86-64-jit`, …) exist under `app.js`'s id scheme. `30-llm-kernel-tooling.html`
  now exists (another agent wrote it).
- **Mechanics.** HTML tag balance, duplicate ids and unescaped `<`/`&` in `<pre>`: clean in all three. Each chapter has
  6 quiz questions with exactly one `data-right` each, and all 18 answers were re-derived. prev/next links are correct:
  16→17→18→19→20 (and 20's prev points to 19). Structure minimums are met: SVGs 4/2/3, stepper or tabs in each, ≥4 code blocks.
  Prose word counts (excluding code and SVG) are 7.6k/6.9k/7.9k, inside the 4–9k target.

Severity scale (same as part 3): **High** means a wrong technical statement a reader would act on. **Medium** means wrong
or misleading, with limited impact. **Low** means imprecise, or a pedagogy or consistency issue.

## Specific claims the task asked to re-check

| Claim | Verdict |
|---|---|
| ch18: unknown opcodes are silently dropped, giving false PASS | **Confirmed, by code and by rerun.** `opcode_2_idx()` (`inst.cc:906`) has `default: return 0`, which is `IDX_NOP`, so `get_opcode_type()` gives `OP_NOP`. `smt_prog::smt_block()` (`smt_prog.cc:50–58`) only emits `smt_inst()` for `OP_OTHERS/OP_LD/OP_ST/OP_CALL`, so the instruction adds no constraint. For an unmodelled conditional jump, `smt_inst_jmp` is never reached as a branch (and its own `default` returns `false`). Reruns: `r0-=5` (0x17), `r0/=r2` (0x3f) and `JLT` (0xa5) all PASS against programs that differ. The raw loader's `is_valid_opcode` check at `raw_program_loader.cc:546` only guards `clear_dst`. It does not reject. I added the mechanism, with function names, to the danger callout. |
| ch18: DIV is modelled as signed | **Confirmed.** `inst_codegen.h:274` has `DIV_EXPR(in1,in2,out) (out EQ in1 / in2)`. In `/usr/include/z3++.h:1673ff`, `operator/` on bit-vectors is `Z3_mk_bvsdiv`. Only `DIV64XC` (immediate) is in the opcode table. Rerun: `r0/=2` vs `r0>>=1` gives FAIL, and vs the signed-halving idiom gives PASS. The chapter's claim that the interpreter-vs-SMT test cannot catch it is also right: `compute_div` uses the same macro, and the test compares the two. Kept. |
| ch17: `@ file:line` first appeared in v6.9 `kernel/bpf/log.c` | **Confirmed.** Raw `log.c` at v6.7 has no `verbose_linfo`. At v6.8 it has `verbose_linfo` (L360) but no `" @ %s:%u"`. At v6.9, L425 has `verbose(env, " @ %s:%u\n", …)`. v6.7/v6.8 `verifier.c` have no such format either. The introducing commit is `7cc13adbd057` "bpf: emit source code file name and line number in verifier log" (2024-02-12, GitHub API), which landed in the 6.9 merge window. I added the commit to the callout. |
| ch19: the repo contains no LLM agent code | **Confirmed as far as search can show (labelled as a search result).** GitHub code search over the repo finds no hits for `chat/completions`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `litellm`, `claude -p` or `--dangerously-skip-permissions`. The `openai`/`anthropic` hits are bibliography/grant `.bib`/`.tex` files and archived notes. `rg` over the sparse checkout agrees. Archived notes (`docs/archive/shared/exploration-process-analysis.md`) say Codex was driven externally "via `codex exec`". `.agents/skills/` has 21 skills, and `runner/libs/agent.py`'s "agent" is the app process (block verified). I added the search basis to the sentence. |
| ch19: arXiv 2606.24213 is the BPF-Ext/Kops paper | **Confirmed.** arXiv API: "Kops: Safely Extending the eBPF Compilation Pipeline with Native Operations", v1 2026-06-23, with 7 authors (Zheng, Ji, Tao, Sun, Zhang, Williams, Quinn), the same as the camera-ready `\author` list and the chapter's reference. The abstract names "EInsn" and says "reaching 2.358x". In the camera-ready, `\tool` = `\textsc{BPF-Ext}`, and the abstract says "speeding up Cilium by 19%". CITATION.cff gives "BPF-Ext … (accepted paper #1160)", ATC '26. |
| ch19: Cilium 2.358× vs 1.194× story | **Confirmed.** `corpus/results/cilium_x86_config_parity_counterbalanced_20261010/SUMMARY.md` (read with `git show`) gives median 1.1938× (IQR 1.1853–1.2056, range 1.0744–1.2077) over six guests. It says "The old paper-era 2.357974x … Its JIT arm enabled `POLICY_AUDIT_MODE`, while the retained native recipe did not. Replays of that recipe drop the native traffic as policy reason 133", and that the result "supersedes it for same-work claims". The functional gate has 8 roots, 51 live programs, 382 tail-map edges and zero drops. Stats-on 659.20 → 463.88 ns/run. The artifact guide row matches. The Q5 answer was slightly overstated (19.4). |

## Issues found and changes made

### Chapter 17: bpfix

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 17.1 | Medium | The error-ID table stopped at E018, but `docs/error-catalog.yaml` also defines E019 (dynptr helper contract), E020 (IRQ flag lifecycle), E021 (map relocation/metadata) and E023 (modern BPF object protocol), and lists E017/E022 as historical. A reader decoding `BPFIX-E021` would find nothing. | Added one row for E019–E021 and E023, with the historical-ID note. |
| 17.2 | Medium | Related work said "Chapter 18 covers the org's Z3 and PREVAIL translation-validation project". Chapter 18 shows that PREVAIL was removed on 2026-07-02 (`ec136b4`). This contradicts the next chapter. | Changed to "Z3-based … (its early PREVAIL stage has since been removed)". |
| 17.3 | Low | The v6.9 source-span claim had no primary pointer beyond the tag. | Added commit `7cc13adbd057` and its date. |
| 17.4 | Low | "The 0 is the range before the branch" was stated as fact. It is a reading of the log (`r=0` before the `data+13` check), not checked in the label code. | Labelled as the author's reading. |
| 17.5 | Low | `data-file` paths lacked the repo prefix (AUTHORING `repo/path`, and ch13–16 after part 3). | Prefixed with `bpfix/` (content unchanged). |

Verified and left alone: the README example and the running-example narrative (pc 23 `r5=0`, pc 30 `r5+=40`, pc 31
`if r3==0`, "from 31 to 34" with `R5_w=40`, and `; @ prog.c:0` present ×3); 60 snapshots; 54 `TERMINAL_ERROR_MARKERS`; 73
`ProofSignal` variants; all 9 corpus-outcome rows (sum 936); 191/18/14/7/5; the 12 root causes; the fanout table
(28/9, 26/5, 18/4, 13/4); 167→82 templates; 15 multi-cause templates; 47% EINVAL; "src 24, cmp 4"; the abstract's 0–37% and
11–21pp; the "two case studies"; the Pretty Verifier regex description (paper §5); every BPFix-Bench summary.json (12 runs,
exactly as tabled); ablation 24/26/29/38 with tokens 102,456/119,725/113,974/125,303 and p = 0.5078/0.0117; cost run
21/75 ≥399,578 vs 38/75 117,159; the 116,163-char prompt; "62" 3B load failures; dirty-tree and "natural-frequency"
disclosures; the task layout (6 files), split 75 lines; the retry context (raw load stdout/stderr, never the fix);
475 commits (Link header); PRs #8–#10 open on 2026-10-31, #2 merged 2026-08-05; crates.io 0.1.10 created 2026-06-17.
The diagnostic.txt "0 bytes" label inconsistency is real.

### Chapter 18: ebpf-correctness-verifier

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 18.1 | **Medium** | Merlin "is 106× faster than K2". The paper says **10⁶ times** faster (the superscript was lost). The 73% figure is relative to the original (unoptimized) programs, not to K2. | Rewrote both numbers with their baselines. |
| 18.2 | Low | Directory map: "~130 small … programs". `tests/real_apps/*.c` has 120 files (plus `common.h`). | Changed to 120. |
| 18.3 | Low | The unsound-cases callout said unknown ALU opcodes are "not translated into any constraint" without saying why. This is the claim readers most need to trust. | Added the mechanism (`opcode_2_idx` → `IDX_NOP`/`OP_NOP`, skipped by `smt_block`). |
| 18.4 | Low | "The combiner is four lines". It is 11 lines. | Changed to "short". |
| 18.5 | Low | `data-file` paths lacked the repo prefix. | Prefixed with `ebpf-correctness-verifier/`. |

Verified and left alone: the commit history (64 commits; 29 "Model …" commits, 13 on 07-02 and 15 on 07-03, which fits
"about thirty"; `ec136b4`, `2c7986a`); about 19,800 lines of C++/shell (chapter: "about 19,700"); all line counts in the
directory map; 62 corpus cases = 58/1/3 (the 3 UNKNOWN are trace_printk, redirect and queue map, as described); 190 codegen
checks; 62 modelled helper IDs ("about 60"); the reason strings; `SMT_DEFAULT_PACKET_SIZE = 64`; the `[-1024, 1024]`
input bound; the K2 origin commit; the README/contract quotes; LLVM 20 → v3 (kernel `bpf_devel_QA`); RFC 9669 DIV
unsigned; K2 abstract numbers (6–26%, "6 orders of magnitude"); EPSO; Heimdall; Jitterbug; Alive2. The data-file and
heimdall-notes summaries are accurate. The chapter is consistent with ch02 (JMP32 is ISA v3; SDIV/SMOD use `off=1`) and
ch03 (bounded loops since 5.3).

### Chapter 19: bpf-benchmark and bpfperf

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 19.1 | Low | The kinsn YAML block said "… 23 more arm64 operations …" after one entry. The file has 25 arm64 entries (so 24 more). The x86 lines are a non-contiguous selection of 37 with no elision marker between them. | Fixed the count and added an elision marker saying the x86 lines are a selection of 37. |
| 19.2 | Medium | Quotes from `rejit/docs/design.md` ("Tracee and Tetragon clearly regressed", "the paper currently cannot claim a stable speedup", the Insight 3 sentence, "isn't this Morpheus?") were shown as verbatim English. The source is Chinese, and these are translations. Only the "three sister ideas" quote was labelled. | Labelled as translated. The Morpheus quote was rephrased, and its differences are now attributed to the English related-work paragraph, which does exist there. |
| 19.3 | Medium | The "Safety is not correctness" callout said "The benchmark leans on workload checks and 'hidden correctness checks'". That phrase is the draft paper's claim. The chapter's own Limitations (and the draft README) say evaluator isolation and hidden evaluation are not built yet. The two statements contradicted each other. | Attributed to the draft and pointed to the README caveat. |
| 19.4 | Low | Q5's right answer said "the native traffic was being dropped". SUMMARY.md says the JIT arm had `POLICY_AUDIT_MODE`, the native recipe did not, and *replays* of that recipe drop native traffic (the old artifacts lack counters). | Reworded to match the source. |
| 19.5 | Low | The key-idea box said "Safety always comes from the stock kernel verifier". For kinsn, each native emitter is trusted code (the chapter says this later). | Added "plus, for kinsn, each operation's trusted native emitter". |
| 19.6 | Low | "There is no LLM driver in the source tree" did not say how this was established. | Added the basis (search of tracked code at `193c2b9`; archived notes show `codex exec` run externally). |
| 19.7 | Low | "The task description called the repo 'extremely active'" leaked the authoring brief into reader-facing prose. The per-day list also omitted the 2 commits on 11-06. | Reworded, and added the 2. |
| 19.8 | Low | ATC '26 dates: the artifact guide says Nov 16–18. The camera-ready `\acmBooktitle` and atc.sigops.org say Nov 15–18 (the 15th is workshops). | Kept the attributed 16–18 and added the official 15–18. |
| 19.9 | Low | `data-file` paths lacked repo prefixes. The bpfperf ones used a "(eunomia-bpf/bpfperf)" suffix. | Prefixed with `bpf-benchmark/` and `bpfperf/`. |

Verified and left alone: the RFC cover letter and Alexei's reply. lore.kernel.org is behind Anubis and blocks this orb,
so I read both through the **patchwork API** (cover 14156897, 2026-10-05, Yusheng Zheng; comment 2026-10-17 by
Alexei Starovoitov). Confirmed there: 27 benchmarks, 1.71×/2.05×, "within 7%", "The loss is in the JIT, not in the
bytecode", "no new instruction encoding and no UAPI change", "21 chosen call sites gave 7.3% more throughput, but all 62
gave 0.5% less", the "yes." / "Copy only." answers, KF_FASTCALL and the "no need for bodies, emit, capture of __k constants,
… register renaming, body table in btf" sentence. Also verified: every artifact-guide row (all 8 rows, environment, build costs);
`rejit/docs/evaluation.md` intervals and the §5 filter (29.6%→17.7%, 127 vs 90); branch_flip 1.054/0.899; the draft
paper's 2,640 sessions, 445M+531M tokens, 2,487/3,197, 2,299, ~30 crashes, K2 3 programs/2%, Merlin 4%, 12%, the
motivation table, "OS-level policy" + ActPlane, VIP caching, and `evaluation-sessions.md` 2,874; README "six … 146 … 42";
the AGENTS.md quotes (all present); 21 skills; 118,482 files under `corpus/results/`; size 861,538 KB now (859,843 at
survey); 29 micro programs; 15/11 kinsn module files; `libbpfrejit_shim.c` 1,859 lines plus ~8,000 lines of headers; bpfprof
4,564 lines with no `branch_snapshot`, period 200,000, the quoted comments, the Arrow Lake check; the micro README smoke
numbers; the bpfopt README quotes; the paper-prototype design hub (+869/−101, the won't-do table); `kinsn/docs/design.md`
(7 kfuncs, 5 x86 emitters); the kprog formal README counts (248 / 124,531,802 / 306 / 2,065 / 488); the
`check_paper_counts.py` docstring; the last-500-commit keyword counts (formal 50, Step 0 56, harness 38, others 0);
the static-Go fallback (design.md §, tetragon/cilium-agent/otelcol); `bpf_get_branch_snapshot` since 5.16. The widget
JS was checked by reading it. The ratio, the `min(run_cnt) ≥ 100` filter and the geomean are implemented as
described, and the sample data is labelled invented.

## Pedagogy

- Each chapter states clearly what its project is for. ch17: a log-only diagnostic CLI plus a corpus, a repair benchmark
  and a skill, with non-goals. ch18: a translation validator with no safety claims and no transformation generator. ch19:
  a harness, three backends, and a draft benchmark framing, with the "agent" ambiguity resolved.
- Consistent with ch02/ch03: JMP32/v3, SDIV `off=1`, bounded loops 5.3, `log_level` semantics, NULL-check example,
  and the x86 JIT as a per-opcode switch. The cross-links into ch02/ch03 resolve.
- The cross-chapter story 17 → 18 → 19 (getting past the verifier, then checking that a rewrite is still equivalent, then searching for
  rewrites) is coherent after fix 17.2. ch18 and ch19 both note that bpf-benchmark does not call `ebpf-tv`. I re-ran
  `rg` over the bpf-benchmark checkout and the GitHub code search: no `ebpf-tv`/`correctness-verifier` references.
- Gap, not fixed (no edit needed for correctness): ch19 never shows a full `make corpus` result directory or a
  `result.json` excerpt. It is described only in prose, because nothing was run. A reader cannot see the raw-counter format.

## Not resolved / not verified

- The ch17 6.1-kernel tabs (`bpftool prog load` of `quick-start.bpf.o`, `nullmap.bpf.c`) and the `run_suite.py` oracle run
  were not rerun. The 6.15 outputs were reproduced exactly.
- ch18's formula dump (scratch driver printing `_pl_orig`) and the `pkt-ptrs` `struct xdp_md` rows were not rerun. All raw and
  C rows of the limitations table were rerun.
- ch19: nothing in bpf-benchmark was built or run (the chapter says so). All numbers are checked against repo files,
  not reproduced. The "no LLM driver" verdict rests on code search. GitHub code search skips large files and
  the private submodules (`docs/paper`, `docs/kprog-simulator-in-ebpf`, `docs/speculative-optimization`,
  `vendor/academic-writing-skills`), which could not be read.
- lore.kernel.org could not be fetched (Anubis). The RFC text was verified through patchwork's API copy of the same messages.
- Whether upstream K2 (`smartnic/superopt`) has the same opcode/signed-DIV gaps was not checked. ch18 attributes them
  to "the instruction model inherited from K2", which matches the vendored code but was not compared against upstream.
