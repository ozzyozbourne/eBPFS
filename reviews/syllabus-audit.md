# Syllabus audit: the curriculum as a whole (chapters 01–32)

Date: 2026-11-06. Scope: org coverage, eBPF concept coverage, cross-chapter consistency, links and
anchors, the prev/next chain, and index/syllabus accuracy. No chapter was edited. Chapter 23 was still
being written during this audit (its file ends at a `<!-- PART4 -->` placeholder), chapter 32 did not
exist yet, and chapters 25–31 were being validated by other agents. Findings on those files describe
the state at audit time.

## How it was checked

- **Org survey.** `gh api --paginate 'orgs/eunomia-bpf/repos?per_page=100'` returned 154 repositories.
  100 are non-fork and non-archived. For each,
  `gh api repos/eunomia-bpf/<r>/commits?since=2026-05-05T00:00:00Z&per_page=1` found 43 with a commit
  on the default branch since 2026-05-05. Three of those are empty repositories (HTTP 409:
  `ebpf-wasm-rust-sdk`, `ebpf-wasm-go-sdk`, `ci-checker-test`). That leaves **40 active repositories**,
  the same count chapter 31 reports. Each name was searched with case-insensitive `grep -F` over
  `chapters/[0-9]*.html`, and separately as a `github.com/eunomia-bpf/<r>` link.
- **Concepts.** I extracted every `h2`/`h3` heading of chapters 01–08 (and 23, 27, 30, 31). Then I ran
  per-chapter term counts on tag-stripped text for 35 concepts and read the matching lines for each
  low-count term.
- **Consistency.** I grepped the tag-stripped text for limits (`MAX_CALL_FRAMES`, `MAX_TAIL_CALL_CNT`,
  1M instructions), for feature/kernel-version pairs (a script pairs each feature term with any
  `Linux/kernel/vX.Y` within 60 characters), and for the bpftime, AgentSight, ActPlane, AgentCgroup and
  bpfix numbers and paper metadata. Then I read each hit in context. `MAX_CALL_FRAMES` was checked
  against `include/linux/bpf_verifier.h` at v7.1, v7.2 and master on GitHub.
- **Links.** A Python `HTMLParser` script read every `<a href>` in `chapters/NN-*.html` (1,864 links).
  It resolved each relative chapter file. For each `#fragment` it rebuilt the target page's ids the way
  `assets/app.js` does: explicit `id` attributes, plus `h2`/`h3` inside `<main>` without an id, using
  the heading's text content lowercased, with `[^a-z0-9]+` replaced by `-` and leading/trailing `-`
  trimmed. Plain-text mentions of `NN-*.html` file names were also checked against `chapters/`.
- **Chain.** Read each chapter's `.chapter-nav` prev/next pair.

## Critical (blocks a complete, navigable curriculum)

1. **Chapter 32 does not exist, but three links point to it.**
   - `chapters/08-ecosystem.html:791`
   - `chapters/31-org-meta.html:681`
   - `chapters/31-org-meta.html:748` (the "Next" button)

   Fix: write `chapters/32-glossary-and-reading-list.html` (in progress). Its prev link must be
   `31-org-meta.html` and its next link `../index.html`.
2. **Chapter 23 is unfinished.**
   - It has no `.chapter-nav`, so the prev/next chain breaks at 23 → 24. 22's next link and 24's prev
     link both point to 23 correctly.
   - It has no quiz or references yet.
   - Its two links to `#ref-paper` (`chapters/23-agentsight.html:74` and `:114`) have no target.

   Fix in `chapters/23-agentsight.html`:
   - add the references list with `id="ref-paper"` on the AgentSight paper entry;
   - add `<div class="chapter-nav">` with prev `22-xpu-perf.html` and next `24-actplane.html`;
   - add the quiz.
3. **`index.html` is stale.** It says "30 chapters" and has no card for chapter 23 (or 32).
   Fix: after 23 and 32 land, run `python3 tools/build_index.py`. Do not hand-edit `index.html`.

## Major

4. **Org map contradiction about agentqos.**
   - `chapters/31-org-meta.html:678` says agentqos is "Not covered by a chapter".
   - `chapters/27-actime-and-akeep.html` has an `h2` "agentqos, briefly" (around line 1411) and a row
     in its "Which parts use eBPF" table (line 89).

   Fix in `31-org-meta.html`: map agentqos to `27-actime-and-akeep.html`, and change "That is all 40
   active repositories" only if the count changes (it does not). **No new chapter or section is
   needed.** agentqos is a README-sized Rust CLI with no eBPF code, and ch27's section is the right size.
5. **agentsight-website is mapped to chapter 23, which does not mention it.**
   - The map row is at `chapters/31-org-meta.html:660`.
   - `grep -i agentsight-website chapters/23-agentsight.html` finds nothing.

   Fix: add one or two sentences on the website repo to the "The web UI and the timeline" section (or
   to related work) in `chapters/23-agentsight.html`, plus a link to
   `https://github.com/eunomia-bpf/agentsight-website`. No new section is needed.
6. **Signed BPF programs are missing.** No chapter covers program signing. It was merged in Linux
   6.18: the `BPF_PROG_LOAD` `signature`/`signature_size`/`keyring_id` fields, a signed loader program,
   exclusive maps, and `bpftool` signing. Sources: LWN "Signed BPF programs"
   (https://lwn.net/Articles/1038961), LWN "6.18 merge window, part 1"
   (https://lwn.net/Articles/1040203). The only hit is a lesson-idea list in ch09 (line ~1342).
   Fix: add an `h3` "Signed programs (6.18)" under "Privileged and unprivileged loading" in
   `chapters/03-verifier.html`, or a subsection next to "BPF links and pinning" in
   `chapters/06-btf-core-libbpf.html`, since signing is done by bpftool and loader skeletons. Also add
   a glossary entry in ch32.
7. **BPF tokens appear only in passing.**
   - `chapters/03-verifier.html` "Privileged and unprivileged loading" explains them in one sentence
     (line ~1009) and then shows code.
   - ch06 has an strace line probing `BPF_TOKEN_CREATE`.
   - ch09 lists the `bpf_token` lesson (6.9).

   No chapter shows the delegate mount options (`delegate_cmds`, `delegate_maps`, `delegate_progs`,
   `delegate_attachs`) or a user-namespace container using a token. Fix: extend that section of
   `03-verifier.html` with a short `h3` "BPF tokens (6.9)": what the bpffs mount delegates, how libbpf
   picks up a token (`LIBBPF_BPF_TOKEN_PATH` / `bpf_token_path`), and a link to the ch09 lesson.
8. **BPF in Kubernetes/containers has no section.**
   - It is touched only via Cilium (ch07 "Who runs this in production", ch08 "Networking: Cilium and
     Hubble").
   - ch12 has "Packaging and deployment: OCI, WasmEdge and Kubernetes" and the bpfman/Inspektor
     Gadget related work.
   - ch10 has a bpfman row.

   A learner never sees how a DaemonSet loads BPF, which capabilities and mounts it needs (`CAP_BPF`,
   `CAP_PERFMON`, `/sys/fs/bpf`, `/sys/kernel/btf`), or how cgroup ids map to pods. Fix: add an `h3`
   "eBPF in Kubernetes" under "The major projects" in `chapters/08-ecosystem.html`, linking to ch12's
   section, ch03's token section and ch06's pinning section.
9. **Debugging and measurement tooling is scattered and partly missing.**
   - `bpf_printk`/`trace_pipe` is shown in ch01 ("Look inside: bytecode, bpftool and the verifier") and
     ch05 ("Try it: build and run the examples").
   - **`bpftool prog tracelog` is never mentioned.**
   - veristat is covered in ch03 "Using the verifier: real commands".
   - bpftrace is covered in ch08 "One program, seven frameworks" and ch30 "MCPtrace".
   - **Measuring a program's own overhead** is only in ch19: `kernel.bpf_stats_enabled`,
     `run_cnt`/`run_time_ns` via `bpftool prog show`. **`bpftool prog profile` is absent.**
   - Hook cost is covered in ch05 "What it costs" (uprobes) and ch14 "The cost of an inline hook".

   Fix: add an `h2` "Debugging and measuring eBPF programs" to `chapters/06-btf-core-libbpf.html`
   (after "BPF links and pinning"), or a short `h3` in `chapters/03-verifier.html` "Using the verifier:
   real commands". Cover `bpftool prog tracelog`, `bpftool prog show` with `sysctl
   kernel.bpf_stats_enabled=1`, `bpftool prog profile`, `BPF_PROG_TEST_RUN`/`bpftool prog run`, and
   pointers to veristat (ch03) and bpftrace (ch08).

## Minor

10. **MAX_CALL_FRAMES wording differs.**
    - ch02 (line ~537) says "8 … (v6.12, v6.18 and v7.1 still have 8) and is 16 from v7.2 on".
    - ch04 (line ~1345) says "16 since v7.2, 8 in older kernels".
    - ch03's limits table (line 996) says "16 on master (8 in older kernels)".

    The values agree and are correct: GitHub shows `#define MAX_CALL_FRAMES 8` at v7.1 and 16 at v7.2
    and master. Fix: in `chapters/03-verifier.html:996`, replace "16 on master" with "16 since v7.2",
    so all three name the release.
11. **Duplicate generated heading ids** (the TOC link jumps to the first one):
    - `chapters/11-starter-templates.html:121` and `:833`: two `h3` "Directory map";
    - `chapters/26-reward-guard-and-safe-change.html:750` and `:1220`: two `h3` "Benefits and
      limitations".

    Fix: make the headings distinct, e.g. "Directory map (C template)" / "Directory map (Rust
    template)", and suffix the project name in ch26.
12. **BPF exceptions are not covered** (`bpf_throw`, Linux 6.7). Fix: one paragraph in
    `chapters/04-maps-helpers-kfuncs.html` near "kfuncs", or in ch03 "Loops", which already covers
    `may_goto`. Optional.
13. **Security of eBPF as an attack surface is thin.**
    - ch03 covers privilege levels, Spectre and "Verifier bugs in the wild".
    - ch02 covers constant blinding.
    - ch05 notes `bpf_probe_write_user`.

    Nothing covers eBPF used *by* attackers (rootkits, tampering with other programs' maps) or the
    `security_bpf*` LSM hooks that guard `bpf()`. Fix: a short `h3` in `chapters/03-verifier.html`
    after "Spectre mitigations" (with signing, item 6). Optional.
14. **Hardware description, ch24 vs ch25.** ch24 gives "125 GiB RAM" and ch25 "128 GB DDR5" for what
    looks like the same Intel Core Ultra 9 285K / Linux 6.15.11 machine. These are not contradictory
    (usable vs installed), but if they are the same machine, use one phrasing. Check against the
    papers. Files: `24-actplane.html:1167`, `25-agentcgroup.html:233`.
15. **AgentSight paper venue.** ch08 cites "PACMI '25" (doi:10.1145/3766882.3767169) and ch25 cites
    arXiv:2508.02736. ch23, the AgentSight chapter itself, should give both. Check when ch23's
    references are written.

## Coverage of the org (task 1)

All 40 active repositories appear in at least one chapter, and each has a chapter that is its home:

| Repo (last commit since 2026-05-05) | Home chapter | Notes |
|---|---|---|
| bpf-developer-tutorial (09-05) | 09 | also cited from 05, 07, 29 |
| eunomia-bpf (08-09), eunomia-template (09-17), ecli-webui (09-07), homebrew-tap (09-16) | 10 | |
| libbpf-starter-template, libbpf-rs-starter-template (09-17) | 11 | |
| wasm-bpf (09-04), wasm-bpf-guest-sdk-c/-rust/-go (09-09) | 12 | |
| bpf-compatible (07-14) | 13 | |
| bpftime (11-03) | 14, 15 | |
| llvmbpf (10-25) | 16 | |
| bpfix (08-05) | 17 | |
| ebpf-correctness-verifier (09-17) | 18 | |
| bpf-benchmark (11-06), bpfperf (05-09) | 19 | |
| gpu_ext (09-24) | 20 | gpu_ext-kernel-modules and eGPU are forks, so excluded |
| nccl-eBPF (09-29) | 21 | |
| xpu-perf (09-17) | 22 | cupti-tutorial is also cited here |
| agentsight (10-23) | 23 | |
| agentsight-website (11-05) | 23 *(planned)* | **only in ch31's map so far (item 5)** |
| ActPlane (10-16) | 24 | |
| agentcgroup (07-22) | 25 | |
| reward-guard (09-16), agent-check-restore-safety (09-16) | 26 | |
| actime (10-13), akeep (10-13), backup-client-sdk (08-02) | 27 | |
| agentqos (06-15) | 27 ("agentqos, briefly") | **ch31 wrongly says uncovered (item 4)** |
| namei_ext (10-11) | 28 | |
| qwen3-ebpf (10-28) | 29 | |
| eunomia.dev (11-05), agent-skills (10-04), research-skills (08-21), megakernel-profiling-feasibility (08-06), .github (10-04), basic-cuda-tutorial (07-19), cupti-tutorial (07-22) | 31 | the GPU tutorials and `.github` are covered by ch31's section "The GPU tutorials and the .github template" |

The less active schedcp, MCPtrace, GPTtrace and GPTtrace-web are kept in ch30, and nvbit-tutorial in
ch31. **No new chapter is needed.** Note that `commits?since=` only checks the default branch, while
ch31 uses `pushed_at`. That is why ch31's dates are newer for some repos, e.g. bpf-developer-tutorial
11-04 vs a last default-branch commit on 09-05. Both methods give the same set of 40.

## Coverage of eBPF concepts (task 2)

| Concept | Where it lives | Verdict |
|---|---|---|
| bpf_link and pinning | 06 "BPF links and pinning" (h2); 04 "Pinning maps in bpffs" (h2); 07 "TCX: link-based tc attachment" | covered |
| BPF tokens | 03 "Privileged and unprivileged loading" (one sentence + code); 06 strace probe; 09 lesson list | passing mention (item 7) |
| Signed BPF programs | none | **missing (item 6)** |
| BPF iterators | 05 "Iterators: pulling kernel state" (h2); 01 timeline (5.8) | covered |
| dynptrs | 04 "Variable-size records: dynptrs" (h3); 17 (verifier errors) | covered |
| Arena | 04 "Arena: a heap shared with user space" (h3); 29 (BF16 weights in arena) | covered |
| BPF in Kubernetes | 07/08 via Cilium; 12 "Packaging and deployment: OCI, WasmEdge and Kubernetes"; 10 bpfman | passing mention (item 8) |
| bpftool prog tracelog / bpf_printk | `bpf_printk` + `trace_pipe` in 01, 05, 06, 09; `tracelog` nowhere | partial (item 9) |
| veristat | 03 "Using the verifier: real commands"; 08 "The kernel's own tooling" | covered |
| bpftrace | 08 "One program, seven frameworks"; 30 "MCPtrace: bpftrace as four MCP tools"; 15 (bpftrace under bpftime) | covered |
| Unprivileged BPF / security of eBPF itself | 03 "Privileged and unprivileged loading", "Spectre mitigations", "Verifier bugs in the wild"; 02 "Constant blinding"; 01 (sysctl) | covered for the verifier side; attacker use missing (item 13) |
| eBPF on Windows | 08 "eBPF for Windows and PREVAIL" (h3); mentions in 01, 02, 03, 14 | covered |
| Performance overhead measurement | 05 "What it costs"; 14 "The cost of an inline hook"; 15 "nginx extension overhead"; 19 (`bpf_stats_enabled`, `run_time_ns`); 21/24 "Overhead" | project-specific only; no general how-to (item 9) |
| Also checked, covered | ring buffer and user ring buffer (04), kfuncs (04), tail calls (02, 04), timers (04 "Timers"), spin locks and kptrs (04), struct_ops / sched_ext / HID-BPF (05), USDT (05), BPF LSM (05, 24), TCX / netfilter / netkit (07), `may_goto` (02, 03), bpf_wq (04, 29) | |
| Also checked, missing | BPF exceptions (`bpf_throw`) | item 12 |

## Consistency (task 3)

Checked and consistent:

- **Limits.** `MAX_TAIL_CALL_CNT = 33` is the same in 02 and 04. The 1M-instruction limit is the same
  in 01, 03, 23 and 29, and "raised in 5.2" in 01 and 03. The 512-byte stack is the same in 02, 03,
  16 and 19.
- **Feature versions.** These are the same in 01's timeline and 04, 05 and 07: XDP 4.8, BTF 4.18,
  bounded loops 5.3, trampoline 5.5, struct_ops 5.6, BPF LSM 5.7, ring buffer and iterators 5.8,
  sleepable 5.10, dynptr 5.19, netfilter 6.4, TCX 6.6, arena and token 6.9, bpf_wq 6.10, sched_ext
  6.12. ch10's "ring buffer needs Linux 5.8" agrees.
- **Verifier log levels.** `log_level` 1/2 semantics are described the same way in 03, 17 and 19.
- **bpftime.** All of 14, 15 and 16 agree:
  - default VM is llvm, ubpf without LLVM, override with `BPFTIME_VM_NAME`;
  - OSDI '25 "Extending Applications Safely and Efficiently", pp. 557–574 (also in 05, 08, 21);
  - the "10x" uprobe claim (14) against the repo benchmark's 13.5×/16.1× (15);
  - the nginx overhead: 2% from the paper (14) vs 1.67% from the repo's JSON (15), with each labelled
    by its source.

  20 and 15 agree that eGPU was merged into bpftime.
- **gpu_ext.** arXiv:2512.12615 is the same in 08, 16, 20 and 21.
- **AgentSight/ActPlane.** The following match across 08, 24, 25, 26 and 27:
  - the ActPlane title and arXiv:2606.25189;
  - the AgentSight title and arXiv:2508.02736;
  - the BPF-LSM-or-notify/kill fallback (08 vs 24, 27);
  - the "AgentSight = uprobes on TLS + process/file tracing" description (23 vs 27);
  - the Rust collector (23 vs 27 `cargo install`);
  - the "Linux 5.10+ with BTF" ActPlane requirement (24 and 27).
- **AgentCgroup and bpfix.** "144 SWE-rebench tasks" appears only in ch25. The bpfix numbers (235
  cases, 75 tasks) appear only in ch17.

Inconsistent: items 4 (agentqos) and 10 (MAX_CALL_FRAMES phrasing). Item 14 is a possible wording
difference.

## Links (task 4)

- 1,864 `<a href>` were checked. Problems found:
  - the 3 links to missing ch32 (item 1);
  - 2 same-page `#ref-paper` anchors in ch23 (item 2).
- There are no broken cross-chapter anchors. ch15's `#gpu-and-cuda-probes` and the other `#id`
  targets resolve.
- No plain-text mention of a chapter file names a missing file other than ch32.

## Prev/next chain (task 5)

The chain is continuous from 01 (prev = `../index.html`) to 22, and from 24 to 31. It breaks in two
places:

- 23 has no nav (item 2);
- 31 → 32 points to a missing file (item 1).

Every prev/next file name matches its neighbour.

## Fixes per file (for dispatch)

| File | Fix | Item |
|---|---|---|
| `chapters/23-agentsight.html` | add references with `id="ref-paper"`, quiz, `.chapter-nav` (22 ↔ 24), a mention and link for agentsight-website, PACMI '25 + arXiv | 2, 5, 15 |
| `chapters/32-glossary-and-reading-list.html` | create; nav prev 31, next `../index.html`; glossary entries for token, signing, link, pin, iterator, dynptr, arena | 1, 6 |
| `chapters/31-org-meta.html` | line 678: map agentqos → `27-actime-and-akeep.html` | 4 |
| `chapters/03-verifier.html` | line 996 "16 on master" → "16 since v7.2"; add `h3` "BPF tokens (6.9)" and `h3` "Signed programs (6.18)" under "Privileged and unprivileged loading"; optional `h3` on eBPF as an attack surface | 6, 7, 10, 13 |
| `chapters/06-btf-core-libbpf.html` | add `h2` "Debugging and measuring eBPF programs" (`bpftool prog tracelog`, `bpf_stats_enabled` + `bpftool prog show`, `bpftool prog profile`, `bpftool prog run`) | 9 |
| `chapters/08-ecosystem.html` | add `h3` "eBPF in Kubernetes" under "The major projects" | 8 |
| `chapters/04-maps-helpers-kfuncs.html` | optional paragraph on BPF exceptions (`bpf_throw`, 6.7) | 12 |
| `chapters/11-starter-templates.html` | lines 121/833: make the two "Directory map" headings distinct | 11 |
| `chapters/26-reward-guard-and-safe-change.html` | lines 750/1220: make the two "Benefits and limitations" headings distinct | 11 |
| `chapters/24-actplane.html` / `25-agentcgroup.html` | align the RAM wording if it is the same machine | 14 |
| `index.html` | regenerate with `python3 tools/build_index.py` after 23 and 32 exist | 3 |

## Not verified

- Kernel versions for features were checked for agreement *between chapters*, not re-verified
  against kernel source. Part1-a and part1-b did that for 01–08. The exceptions are
  `MAX_CALL_FRAMES`, checked on GitHub, and signing (6.18), checked against LWN.
- Chapters 25–31 were being validated in parallel. Facts that appear only in those chapters were not
  re-checked against their repos here.
- Word counts (tag-stripped `wc -w`, prose plus code): 01–31 range from 7,018 (ch08) to 11,694 (ch03).
  ch02, ch03, ch04, ch14, ch16 and ch27 are over 10,000 including code. ch23 is at 5,456 while
  unfinished.
