# Review: Part I chapters 05–08

Scope: `chapters/05-program-types-and-hooks.html`, `06-btf-core-libbpf.html`,
`07-networking-xdp-tc.html`, `08-ecosystem.html`, checked against `research/05–08`, kernel
source on GitHub (mainline HEAD `d68ce4e7`, plus tagged releases v4.2–v7.3), docs.kernel.org,
the clones in `/home/user/workspace/src/`, project READMEs, Crossref and the arXiv API.
Reviewed 2026-11-06. Only chapters 05–08 were edited.

Severity: **high** = factually wrong in a way that misleads a learner; **medium** = wrong or
overstated detail, missing cross-reference, or a real gap; **low** = precision, citation
metadata, or presentation.

## How it was checked

- **Code blocks.** A script extracted every `<pre data-file>` block, split it on `/* ... */`
  markers, and matched each segment line by line (ignoring whitespace) against the cloned
  file, or against the file fetched from torvalds/linux for `linux/...` paths. 61 blocks
  match. The 10 that are left are command listings put together from README fragments
  (`$` prompts, output, prose in between), plus two benign trims (an added `/*` opener in
  `bpf_core_read.h`, and a field summary comment in the `__sk_buff` excerpt). Each one was
  checked by hand, and every command in them appears in the cited README.
- **URLs.** All 156 distinct external links in the four chapters were checked with
  `curl -sIL`. 149 returned 200. The ACM/DOI 403s are bot blocking, so those three DOIs were
  confirmed through the Crossref API (title, authors, venue, pages, year). The LWN 429s
  are rate limiting, so all 12 LWN articles were fetched another way and their title,
  author and date compared with the citation.
- **Papers.** The arXiv IDs 2512.12615, 2508.02736, 2602.09345 and 2606.25189 all exist,
  and their titles match (arXiv API). OSDI '25 bpftime: the title, the 7 authors and
  pp. 557–574 match the USENIX page. The quoted sentence "improves the throughput of
  profiling microservices by a factor of 1.5 compared to eBPF" was found in the PDF on
  p. 558. The XDP CoNEXT '18 numbers (24 Mpps for XDP against 43.5 Mpps for DPDK, one
  core) were checked against `xdp-paper.tex` in tohojo/xdp-paper.
- **Kernel versions.** Checked against the tagged UAPI headers and source files:
  `BPF_TRACE_FSESSION` (absent in v6.19, present in v7.0), `UPROBE_SESSION` (6.12 → 6.13),
  `KPROBE_SESSION` (6.9 → 6.10), `UPROBE_MULTI` (6.5 → 6.6), syscall 336 `uprobe`
  (6.17 → 6.18), `scx_bpf_dsq_insert` (6.12 → 6.13), `trace_call_bpf` in `trace_uprobe.c`
  (4.2 → 4.3), `BPF_PROG_TYPE_NETFILTER` (6.3 → 6.4), and `veth_gro_requested`
  (5.12 → 5.13). Commits 56101b69c919 (in v6.18), 2f064a59a1 (in v5.14) and 84601d6ee68a
  (in v6.4) were checked with the GitHub compare API.
- **Mechanics.** A Python `HTMLParser` balance check found no unclosed or stray tags in any
  of the four chapters. Every quiz has exactly one `data-right` per question (5, 6, 6 and 6
  questions), and each answer was re-derived. The prev/next links form a correct
  04→05→06→07→08→09 chain. Every local `NN-*.html` link in 05–08, including all of
  chapter 08's links to later chapters, uses a file name from `SYLLABUS.md`. Widgets use
  only the shared classes (`tabs`/`tab-panel`, `stepper`/`step`, `quiz`/`q`/`opt`/`why`,
  `grid`/`card`, `callout`).

## Issues found and what was done

### Chapter 05 — Program types and hooks

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 05-1 | high | The comparison table said `bpf_probe_write_user` "taints the kernel log". At `d68ce4e7` the helper has no warning or taint. It is only offered to `CAP_SYS_ADMIN` programs and returns NULL under `LOCKDOWN_BPF_WRITE_USER` (`kernel/trace/bpf_trace.c`). | Reworded to "needs `CAP_SYS_ADMIN` and is disabled under kernel lockdown". |
| 05-2 | medium | The LSM section said "A BPF program cannot override a denial from another LSM, which is why the examples pass a non-zero `ret` through." This mixes two things. `ret` carries the verdict of earlier *BPF* programs. Denials by other LSMs cannot be overridden because `call_int_hook()` stops at the first non-default return value. | Rewrote the sentence to separate the two mechanisms and cite `security/security.c`. |
| 05-3 | medium | Figure 5.1 said "~250 LSM hooks". Mainline `lsm_hook_defs.h` has 280 `LSM_HOOK(` entries. | Changed to "~280". |
| 05-4 | low | The fmod_ret rule (error-injection list or `security_*`) is only true with `CONFIG_FUNCTION_ERROR_INJECTION=y`. Without it, the verifier allows the arch syscall entry functions instead. | Added a one-sentence parenthetical. |
| 05-5 | low | In the uprobe cost table, the `uretprobe-nop` row (Dec 2024 bpf-next) already uses the 6.11 uretprobe syscall for the return path. Readers could think it is the pure-trap baseline. | Labelled the row "int3 entry + return through the 6.11 uretprobe syscall". The numbers were checked against the LWN cover letter. |
| 05-6 | low | "These commands come from its README": the multi-target `make minimal kprobe …` line is adapted. The README builds one example at a time. | Changed to "adapted from its README". |
| 05-7 | medium (gap) | The chapter never shows how to find out which attach targets exist on a given kernel (tracepoint formats, `available_filter_functions`, the kprobe blacklist, BTF FUNC records, `bpftrace -l/-lv`, USDT notes, `bpftool feature probe`). A learner needs this before writing a `SEC()` name. | Added a short section, "Finding hook points on a running kernel", with a labelled command block. Each path was checked against kernel source or tool docs. The `kprobes/blacklist` debugfs file was confirmed in `kernel/kprobes.c`. |
| 05-8 | — | Checked and correct, no change: every "Since" version in the table, the trampoline quotes (LWN 804937, v4, 14 Nov 2019), the STRUCT_OPS quote (LWN 807973, 20 Dec 2019), `check_attach_modify_return()`, the uprobe walkthrough function names at `d68ce4e7`, uretprobe syscall 335 (6.11) and uprobe syscall 336 (6.18), the Kernelnewbies "10-30%" quote, the sched_ext doc quotes and sysfs paths, the 6.10 vs 6.11 HID-BPF doc difference, the bpftime OSDI quote, and the cgroup_guard flags. | — |

### Chapter 06 — BTF, CO-RE and libbpf

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 06-1 | medium | "libbpf v1.9 (commit 872299d)" presents an unreleased version as a release. The latest tag is v1.8.0 (2026-10-05). `872299d` is master, where `libbpf_version.h` already says 1.9. | Reworded the text and reference to "master after v1.8.0, version 1.9 in development". |
| 06-2 | medium | "libbpf v1.9 also has `bpf_object__prepare()`" suggests the API is new. In `libbpf.map` it is part of `LIBBPF_1.6.0`. | Changed to "Since v1.6, libbpf also has …". |
| 06-3 | low | "kinds 1–19" for BTF kinds is true for every released kernel through v7.3. Mainline (7.4-rc) adds `BTF_KIND_LOC_PARAM`, `LOC_PROTO` and `LOCSEC` (20–22). | Added a clause noting the three new kinds. The `vlen`/kind bit ranges (0–23 and 24–30) match current `btf.rst` and `btf.h` and were left as they are. |
| 06-4 | — | Checked and correct, no change: the btf-dedup "~100×" figure (124 MB → 1.5 MB; 104× for type descriptors), the CO-RE post's BCC downsides and "more than 25" tools, the bpftool-gen `-L`/`--sign` text, `min_core_btf` wording, the `2f064a59a1` rename in 5.14, the poison value `195896080`, `btf__load_vmlinux_btf()` paths, LWN 1031854 (Daroc Alden, 12 Aug 2025), libbpf-bootstrap's commit date (2026-10-22), and the strace and log excerpts, which were consistent with the measured offsets. | — |

### Chapter 07 — Networking: XDP, AF_XDP, tc/TCX, sockets

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 07-1 | high (gap + broken cross-ref) | The text said `BPF_PROG_TYPE_NETFILTER` is "covered in chapter 05". Chapter 05 only lists it and sends networking to chapter 07, so neither chapter covered it. | Added the section "Netfilter programs (Linux 6.4)": context `bpf_nf_ctx`, the `NF_DROP`/`NF_ACCEPT` return range (verifier), link-only attach with `bpf_program__attach_netfilter()` (libbpf 1.3), the pf/hooknum/priority rules from `nf_bpf_link.c`, `BPF_F_NETFILTER_IP_DEFRAG` (6.6), and the kernel selftest as a `data-file` sample (verified). Pointed the earlier mention there and added a reference item. |
| 07-2 | medium | The "veth gotcha" said redirected or `XDP_TX` frames into a veth need an XDP program on the peer. Since 5.13 the actual condition is that NAPI is enabled on the peer, which an XDP program *or* GRO (`veth_gro_requested()`) turns on. `veth_xdp_xmit()` checks `rq->napi`. | Rewrote the condition and kept the tutorial's stub-program example. |
| 07-3 | medium | "Other hooks … See chapter 05" overstates. Chapter 05 covers the cgroup hooks, but not flow dissector, LWT or SO_REUSEPORT. | Now says the cgroup hooks are in 05, and the rest are in libbpf's program-types table (linked). |
| 07-4 | low | "Cloudflare pushes some mitigations into iptables-hosted BPF" is unsourced. | Replaced with a sourced statement about the `xt_bpf` (`iptables -m bpf`) match, and linked to the new netfilter section. |
| 07-5 | — | Checked and correct, no change: XDP paper authors/venue/pages (Crossref), 24 vs 43.5 Mpps, 14.88 Mpps / 67 ns, `xdp_md`/`xdp_action`, `XDP_PACKET_HEADROOM`, map-type versions, TCX return codes and the libbpf `tc/ingress` alias for tcx, Cilium using TCX by default since 1.16 on 6.6+ (Borkmann LSF/MM/BPF 2024 slides) and netkit on 6.8+, `bpftool net attach` types (bpftool-net.rst), Katran README limits, the Karlsson/Töpel LPC 2018 paper, and LWN 750845 (Corbet, 9 Apr 2018). | — |

### Chapter 08 — Ecosystem

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 08-1 | medium | "the cilium/ebpf library above came out of this project": ebpf-go started in 2017 as `newtools/ebpf` and was co-written by Cilium and Cloudflare developers. Cilium 1.7 was the first Cilium release to use it. | Reworded and cited the Cilium 1.7 blog post. |
| 08-2 | medium | Quiz Q6 said "cilium/ebpf with bpf2go … (as Tetragon does)", and its explanation called this "the pattern Cilium and Tetragon use". Tetragon does use cilium/ebpf (go.mod), but it builds its BPF objects with its own `bpf/Makefile`, not bpf2go. The claim about Cilium was unsupported. | Removed "(as Tetragon does)" from the answer and rewrote the explanation to describe Tetragon accurately. Dropped the Cilium claim. |
| 08-3 | low | The AgentCgroup and ActPlane references had no authors or year, and gpu_ext had no year (AUTHORING requires venue and year). | Added authors and year from the arXiv API, all marked "arXiv preprint". |
| 08-4 | low | Silent trims in `data-file` blocks. aya's example dropped `#![feature(cstr_display)]`, which hides the nightly requirement. libbpf-tools `execsnoop.bpf.c` skipped `empty_event`/`valid_uid()` without a marker and did not show its `SEC("tracepoint/…")`, although the tab tells readers to look at the attach point. cilium/ebpf `main.go` dropped comment lines without a marker. | Restored the two aya lines, added `/* ... */` markers, and added the real `sys_enter_execve` tracepoint function to the execsnoop excerpt. |
| 08-5 | low | `data-file` paths in this chapter use `owner/repo/...` (for example `iovisor/bcc/...`), while 05–07 use `repo/...` as AUTHORING describes. | Left as is: the paths are unambiguous and match the references. I am noting this for consistency only. |
| 08-6 | — | Checked and correct, no change: all four arXiv IDs and titles; AgentSight PACMI '25 DOI (Crossref, pp. 110–115); PREVAIL PLDI 2019 authors and DOI; Cilium and Falco CNCF dates; eBPF Foundation founders, date and the Meta load-balancer statement (LF press release); eBPF for Windows' three execution modes (README); the uBPF safe profile and Arm64 JIT; Parca's 19 Hz and kernel 5.3+ with BTF; the nccl-eBPF SOSP 2026 workshop target; bpf-benchmark as the ATC '26 BPF-Ext artifact; the qwen3-ebpf and XDP-on-GPU README quotes; Tetragon's "inline with the operation itself"; and figure colors (accent is orange = uses libbpf, accent2 is blue = own loader, consistent with chapter 05's legend). | — |

## Cross-chapter consistency (01–08)

- The version claims in 01 (XDP 4.8, cgroup 4.10, BTF 4.18, trampoline 5.5, struct_ops 5.6,
  LSM 5.7, sched_ext 6.12) agree with the tables in 05 and 07.
- 05 and 07 handed netfilter programs to each other and neither covered them. Fixed in 07
  (07-1).
- 06 and 08 both explain the BCC vs CO-RE trade-off. 08 links back to 06 and does not
  re-derive the mechanism, which is acceptable as is.
- Chapter 05's "Networking, briefly" and Figure 5.1 list `netfilter` under chapter 07,
  which is now true.

## Not resolved or not verified

- Chapters 01 and 02 show working-tree modifications that I did not make (presumably
  another reviewer's work). I did not touch them.
- I could not run the new chapter 05 discovery commands end to end on this orb. Its 6.1
  kernel has no readable `/sys/kernel/tracing` without root, no
  `/sys/kernel/debug/kprobes/`, and bpftrace 0.17, which lacks `fentry:` (hence the comment
  about `kfunc:`). The orb's libc has no stapsdt notes. Each command and path was checked
  against kernel source or the tool's documentation instead.
- The ATC '26 BPF-Ext paper is cited only through the bpf-benchmark README. No public paper
  URL was found, so none was added.
