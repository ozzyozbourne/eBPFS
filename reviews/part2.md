# Review: Part II, chapters 09–12

Reviewer: validation subagent. Date: 2026-11-06.
Scope: `chapters/09-bpf-developer-tutorial.html`, `10-eunomia-bpf-ecc-ecli.html`,
`11-starter-templates.html` and `12-wasm-bpf.html`. I checked them against `research/09–12`, `AUTHORING.md`,
`SYLLABUS.md` and the repositories cloned under `/home/user/workspace/src/`. I edited only these four chapters.

## How the chapters were checked

- **Commits.** Every studied repository is shallow at the commit the chapter cites. `git ls-remote` showed that
  each of these commits is still the remote HEAD on 2026-11-06, so "the cited commit" and "current master" are the
  same code:
  - bpf-developer-tutorial `110b91f8`
  - eunomia-bpf `a5408a8`
  - eunomia-template `739efb3`
  - ecli-webui `6816d61`
  - homebrew-tap `aefe55a`
  - libbpf-starter-template `6e572b6`
  - libbpf-rs-starter-template `8927eea`
  - wasm-bpf `01f1419`
  - the three guest SDKs at `c8b1d8a`, `7d0b615` and `27b5c51`

  libbpf-rs and libbpf-bootstrap were compared at `9680ea7` and `820a1bd`.
- **`data-file` blocks (77 blocks).** A script compared every line that was not elided, after whitespace
  normalisation and in order, with the file at the cited path.
  - 67 blocks match outright.
  - The other 10 differ only in deliberate condensation: README command blocks merged, with `$` prompts and short
    comments added. Each also has a `/* ... */` elision line whose text summarises the omitted code. I reviewed
    these by hand. Five of the condensed README blocks are now labelled (issue 9.6).
- **Kernel facts.** I fetched `kernel/sched/ext.c` at v6.13, v6.16, v6.17 and v6.18 from GitHub. I read the LSM BPF
  documentation for the meaning of `ret`.
- **Repo claims.** These were re-read in source rather than taken from the research notes: the CLI flags of `ecc`,
  `ecli`, `wasm-bpf` and `cuda_events`; the `.config` keys of all 66 lessons; the CI workflow contents; the
  bool-flag rules in `arg_builder.rs`; the export-map selection; the BTF selection order; the OCI-means-Wasm rule;
  and the `Config::default()` swap. I also checked the map_operate signatures (Rust and Go bindings use i64, the
  host uses u32), the Rust ring-buffer `replace()`, the C++ per-record callback, the Rust template's crossed
  `targ_pid`/`targ_tgid`, `docker.yml`'s missing `docker_build` id, and the `repository_owner` guard.
- **Make behaviour.** I reproduced the C template's `$(wildcard %.h)` claim with a two-rule Makefile: touching the
  header does not trigger a rebuild. The claim is confirmed.
- **GitHub API.** Titles, states and merge dates checked for:
  - bpf-developer-tutorial PRs #200, #201, #203, #209, #211–215, #220, #222–225, #227, #231 and #236
  - wasm-bpf issue #48 (open, 2023-03-01) and PRs #119, #160 and #163
- **Papers and talks.**
  - arXiv API: 2408.04856 (Wasm-bpf; Zheng, Yu, Yang, Quinn; 9 Aug 2024; cs.OS), 2311.07923 (bpftime) and
    2312.03858 (WALI, "Empowering WebAssembly with Thin Kernel Interfaces", Ramesh, Huang, Titzer, Rowe). All three
    exist and match the chapters' citations.
  - I read the Wasm-bpf PDF for Tables 2–4: 1885.26/1117.43 ns, 3186.83/1509.18 ns, 0.176/0.656, and the sizes
    72K, 92K, 1.7M and 1.3M/5.0M. All match ch12.
  - Also from the paper: 1386 lines of Rust and 510 of C++, bpfman/Inspektor-Gadget/bpfd as the "RPC to daemon"
    model, the containerd-shim replacement, and the pt_regs relocation pass.
  - Crossref confirms PLDI 2017 for Haas et al.
  - The sched.com page confirms the KubeCon NA 2023 talk: Michael Yuan and Yusheng Zheng, Thu 9 Nov 2023, with a
    slides PDF.
  - docs.ebpf.io says the old scx names are "aliased until v6.17".
  - The eunomia.dev KubeCon write-up title matches the citation.
- **Links.** All 97 distinct external URLs were requested with `curl -L`. 95 returned 200. The other two returned
  403 (doi.org and sched.com bot blocking) and were verified separately, through Crossref and by reading the page.
- **Mechanics.**
  - An HTMLParser tag-balance check found no unbalanced tags and no duplicate ids in any of the four chapters.
  - No unescaped `<` or `&` inside `<pre>`.
  - Each quiz has 6 questions with exactly one `data-right`. I re-derived every answer against the source.
  - Each chapter has 2–3 SVGs, a stepper, tabs, and 15–26 `data-file` blocks.
  - Prose is roughly 5,900–7,700 words per chapter, inside the 4,000–9,000 target.
  - prev/next links are correct: 08→09, 09↔10↔11↔12, 12→13, and 13's prev link points to 12.
  - Cross-links to chapters not yet written (20, 22, 23, 30, 31) use SYLLABUS file names and will resolve once
    those chapters exist.
- **Not re-run.** I did not re-run the orb experiments: the ecc/ecli runs, the template build, the wasm-bpf C++
  runtime build, and the webui package rejection. The chapters report those as runs done in the orb, and I left
  them as written.

Severity scale (same as part1-a): **High** means a wrong technical statement a reader would act on. **Medium** means
wrong or contradicting, but limited impact. **Low** means imprecise, a missing attribution, or a pedagogy or
mechanics fix.

## Chapter 09 · bpf-developer-tutorial

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 9.1 | Medium | Lesson 19 text and the Q4 answer state as a rule that "a BPF LSM program cannot turn a denial into an allow". The kernel does not enforce this. `ret` is "the return value from the previous BPF program or 0 if it's the first hook" (docs.kernel.org `prog_lsm`). Passing it on is a convention, and a program that returns 0 regardless can undo an earlier BPF denial. | Rewrote the paragraph around the documentation quote and labelled the behaviour a convention. Reworded the Q4 correct option and its explanation. |
| 9.2 | Medium | The sched_ext warning rested only on docs.ebpf.io ("alias removed in 6.17") and said the load failure was untested. That fact can be checked in source. | Checked `kernel/sched/ext.c`: v6.16 defines `scx_bpf_dispatch`, `scx_bpf_dispatch_vtime` and `scx_bpf_consume`; v6.17 has no mention of any of them. The lesson declares them as non-weak `__ksym`, so libbpf should refuse to load it. Added this evidence and kept the "not run" caveat. |
| 9.3 | Low | "12 unnumbered lesson directories". The count is 11: `features/*` (6), `xpu/*` (3), `cgroup` and `bpftrace-tutorial`. | Fixed. |
| 9.4 | Low | The author attribution was awkward: `yunwei37` and "lesson 36 is signed by Yusheng Zheng" read as two different people. | Rewrote it as `yunwei37` (Yusheng Zheng, who also signs lesson 36). |
| 9.5 | Low (gap / overlap) | ch05 already quotes lesson 19, the lesson 44 `select_cpu` callback and lesson 52 `fsession`, but ch09 did not point to those sections. The GPU paragraph omitted the bpftime-on-GPU path that the lesson 47 README itself names. | Added cross-links to 05 at lessons 19, 44 and 52, and a sentence linking bpftime GPU examples to chapters 15 and 16. |
| 9.6 | Low (mechanics) | Five `data-file` README blocks (lessons 1, 2, 19, 44 and 47) merge separate README code blocks and add prompts and comments. They are not verbatim, and AUTHORING requires labelling. | Added a first-line comment to each: `# condensed from the README's code blocks; some prompts and comments added`. |

Verified as correct and left alone:
- Repo metadata and the CI workflow table, including the lesson lists for both test workflows and the 124-exit
  convention.
- Every `kernel_min` cited in the group table and the tip; the two `.config` files.
- The generated-index behaviour (`generate_toc.py` requires both `.config` and `README.md`; 32 has no `type`).
- The ecc/ecli commands; the `cuda_events` options `-v -t -r -p -d` and its eleven functions.
- The lesson 47 "2us" quote, which the chapter attributes to the repository.
- PR #236's description of the Ubuntu 26.04 `llvm-14-dev` failure.
- The PR history list; `TUTORIAL_IDEAS.md` scores; GPTtrace in the README.
- Lesson 9 using `raw_tp`; lesson 52's kfunc override.

## Chapter 10 · eunomia-bpf, ecc and ecli

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 10.1 | Low (mechanics) | 15 `data-file` paths lacked the repository prefix (`compiler/cmd/...` instead of `eunomia-bpf/compiler/cmd/...`). The other chapters and the curriculum's checker use repo-prefixed paths. | Prefixed them with `eunomia-bpf/`. With the prefix, all 18 blocks match the source. |
| 10.2 | Medium | Called the release binaries "statically linked self-mounting executables". Two paragraphs later the chapter explains that v1.0.38 ecc fails because it carries its own older glibc and loads the host's libLLVM. A statically linked binary would not do that, so the statement contradicts itself. | Now describes them as AppImages with bundled shared libraries, including glibc, built with cargo-appimage, and says they are not static. |
| 10.3 | Low (cross-chapter) | "The Wasm-bpf paper names this problem and describes extra relocation for it" implies the fix exists. ch12 found no pt_regs pass in wasm-bpf. I also found none in ecc, bpf-loader or ecli (`rg pt_regs` outside third_party: no hits). | Added that the pass is described in the paper but not implemented at the studied commits, with a link to 12. |

Verified as correct and left alone:
- The `ecc -h` flag list matches the `CompileArgs` derive.
- The `ecli` subcommands: run, push and pull.
- The `try_load_program_buf_and_guess_type` order (file, then URL, then OCI) and that OCI is always Wasm.
- The "Export map … no export type is provided" error. Q1 is right.
- The bool-flag rules in `arg_builder.rs`. Q3 is right: an initializer alone yields `--name`.
- The last export map wins, with a warning, in `set_and_warn_existsing_map`.
- The BTF selection order in `builder.rs`.
- The docs-versus-code callout: `@export`, `ecli push package.json`, `xdp_drop` and `--interface` are all present
  in the READMEs and absent from the code.
- `bootstrap.h` uses `unsigned char`, while the template uses `bool`.
- The homebrew-tap contents and rule quote.
- The `online-compile.md` fixes; the "Better uprobe support" and "Enhanced XDP support" roadmap items.
- POSITIONING.md's comparison with BumbleBee.

## Chapter 11 · Starter templates

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 11.1 | Low | The `targ_pid`/`targ_tgid` swap was said to be "inherited from upstream", and the claim was not checked. | Checked: upstream libbpf-rs `examples/runqslower/src/main.rs` at `9680ea7` still assigns `targ_pid = opts.pid` and `targ_tgid = opts.tid`. Added that fact. |

Verified as correct and left alone (each re-checked in source):
- The `$(wildcard %.h)` dependency gap, reproduced.
- `make -C` instead of `$(MAKE)`; `CLANG_BPF_SYS_INCLUDES`; the vmlinux symlink layout (x86 → `vmlinux_601.h`;
  6.8 and 7.1 present; no powerpc or mips directory).
- The dockerfile copies a prebuilt binary; the devcontainer has no `runArgs`.
- `docker.yml`'s missing `docker_build` id; the unused matrix.
- The Rust template's `rerun-if-changed`, which covers only the `.bpf.c` (upstream also lists the header).
- The Rust template's Makefile has no `install` target.
- The `repository_owner == 'eunomia-bpf'` guard; the fenix/naersk flake.
- libbpf-rs 0.24 `SkelBuilder::open` changelog text; upstream uses the ring buffer and clap 4, gets `vmlinux` from
  libbpf/vmlinux.h `991dd4b`, and writes the skeleton into `src/bpf/`.
- libbpf-bootstrap's `-MMD -MP`, its Rust examples, and its BSD-3 licence.
- The 1032→1400 cross-reference to ch06, consistent with ch06's table.

## Chapter 12 · wasm-bpf

| # | Sev | Issue | Change |
|---|-----|-------|--------|
| 12.1 | Low | "The CI builds Go examples with TinyGo 0.29". The test workflows (`c-cpp.yml`, `rust.yml`) run `make tinygo`, which installs 0.27.0. Only `publish-example-images.yml` installs 0.29.0. | Corrected and named both. |
| 12.2 | Low | "The README installs [wasi-sdk] release 17 … CI uses 20". The release-17 install is in `examples/bootstrap/README.md` and the top-level Makefile, which the test workflows use via `make /opt/wasi-sdk`. Only the publishing workflow uses 20. | Corrected the attribution. |
| 12.3 | Low | The paper's bpftime fallback was described as general ("when kernel eBPF is unavailable"). The paper limits it to uprobe programs. | Added "for uprobe programs". |

Verified as correct and left alone:
- **Seven-function ABI.** The WAMR signature strings, and the import sections described by the research notes,
  are consistent with the source.
- **map_operate mismatch.** The Rust binding declares `key`, `value` and `next_key` as `u64`/`i64`, the Go SDK uses
  `int64`, and the Rust host takes `WasmPointer` (u32). The chapter's "would probably be rejected … not tested"
  wording is appropriate.
- **`Config::default()` swap.** Confirmed in `lib.rs` against the CLI defaults.
- **Rust ring buffer.** `replace()` overwrites the cell and the guest is called once after `poll()`, while the C++
  runtime calls the guest per record. The chapter labels this as untested, which is right.
- **Truncated records.** The C++ runtime passes the untruncated `size`.
- **`--export-table`.** The Rust runtime's error message names the flag.
- **fd-attach history.** Issue #48 and PRs #160 and #163 match the GitHub API; PR #119 (SDK split) merged
  2023-05-22; the Rust libbpf-rs-like SDK dates from June 2023.
- **Examples.** Their kernel sides match the source: `can_not_rm` and `return -1` in lsm, the sockfilter TODO, the
  uprobe sections, and `Ctrl C exit...` in `main.cpp`.
- **Citations.** All paper figures and the KubeCon citation.

## Cross-chapter consistency

- **Fixed.** The paper's pt_regs relocation pass is now described the same way in 10 and 12: in the paper, not in
  the code (10.3).
- **Checked and consistent.**
  - ch05 and ch09 quote the same lesson 19, 44 and 52 code. The excerpts are identical, and they now cross-link
    (9.5).
  - 06, 10, 11 and 12 all present libbpf-bootstrap's `bootstrap` as the baseline. ch10 and ch11 both say the copies
    differ only in whitespace.
  - The ecc/ecli division of labour is described identically in 09, 10 and 12.
  - 10 and 12 give the OCI media types identically.
  - All four chapters report the orb's kernel and clang version (6.1.189, clang 14.0.6) consistently.

## Left as is, or not resolved

- **Some code blocks are not labelled as condensed.** In ch09, the lesson 8 and lesson 21 README blocks have small
  normalisations: a stray `".` dropped from the README's header line, and an added `$` prompt. In ch11 and ch12,
  the elision comments describe the omitted code. None of these were labelled; I judged them within "trimmed with
  `/* ... */`".
- **Orb experiments not re-run.** These were not reproduced in this review:
  - the v1.0.38 ecc glibc failure;
  - relative paths falling through to OCI under `sudo`;
  - the ecli-webui package rejection;
  - the template build and run;
  - the wasm-bpf C++ build;
  - `bootstrap.wasm -d 50`.
- **Not verifiable here.**
  - Whether the C template's submodules survive "Use this template". The chapter already labels this unverified.
  - Whether `ghcr.io/eunomia-bpf/libbpf-template` still exists. Checking needs a packages token.
  - The 404s of the GitHub Pages packages. The chapter reports these from the research notes.
- **First-person voice** ("I", "we") in all four chapters, which part1-a also noted. Not changed.
