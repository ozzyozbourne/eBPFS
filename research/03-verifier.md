# Research notes — Chapter 03: the eBPF verifier

Date: 2026-11-05. Author: chapter subagent.

## Source studied

- Linux `master` at commit **d68ce4e71248e1ff5af9654b407541d9260b3ba5**
  (2026-11-05, "Merge tag 'mm-core-7.4-rc2'"). Latest tag: v7.4-rc1.
  Files fetched as single raw files from GitHub (the kernel was **not** cloned, per AUTHORING.md):
  - `kernel/bpf/verifier.c` (24,331 lines)
  - `kernel/bpf/cfg.c` (1,033) — `bpf_check_cfg()`, moved out of verifier.c by f8a8faceab99 (2026-04-12, first in v7.1)
  - `kernel/bpf/states.c` (1,767) — `regsafe()`, `range_within()`, `bpf_is_state_visited()`; moved by c82834a5a11f (v7.1)
  - `kernel/bpf/backtrack.c` (1,052) — precision backtracking, `bpf_mark_chain_precision()`
  - `kernel/bpf/liveness.c`, `loops.c`, `scev.c`, `cnum.c`, `cnum_defs.h`, `const_fold.c`, `fixups.c`, `diagnostics.c`, `log.c`
  - `kernel/bpf/tnum.c`, `include/linux/tnum.h`, `include/linux/bpf_verifier.h`, `include/linux/bpf.h`
  - `kernel/bpf/syscall.c` (unprivileged checks), `Documentation/bpf/verifier.rst`
  - `tools/testing/selftests/bpf/veristat.c` (option table)

## Big 2026 changes (must be described accurately)

1. **The verifier was split into many files (v7.1+, 2026).** `check_cfg` → `cfg.c` (`bpf_check_cfg`),
   state equivalence → `states.c`, precision → `backtrack.c`, etc. Copyright headers "2026 Meta".
2. **Circular numbers (cnum) replace the 8 min/max fields.** Commit 256f0071f9b6
   (Eduard Zingerman, 2026-04-24, "bpf: representation and basic operations on circular numbers"),
   first released in **v7.2**. Message: unified signed/unsigned range representation; inspired by
   Shung-Hsi Yu's post and the wrapped-intervals paper (Navas et al., TOPLAS); operations checked
   with CBMC (repo github.com/eddyz87/cnum-verif). Preparatory commit b93f7180f0bc replaced direct
   field accesses with accessors `reg_smin()`, `reg_umax()` etc. `struct bpf_reg_state` now has
   `struct cnum64 r64; struct cnum32 r32;` plus `u16 base, step` (interval-with-step, 0892ef2a7ef3,
   2026-10-09). Accessors still expose smin/smax/umin/umax/s32_min/... so the log and the mental model
   are unchanged.
3. **SCEV loop widening.** 1501b536818b "Compute scalar evolution expressions for loops",
   6ccf49f79327 "Use SCEV to widen bounded loops" (2026-10-09), first in **v7.4-rc1**. Also
   `loops.c`: dominators (6254fb693289), loop hierarchy (9ae7f5e8bf1d). LWN 1076121 covers the plan.
4. **Structured diagnostics** (`diagnostics.c`, Kumar Kartikeya Dwivedi, 2026-08-15, first in v7.3):
   messages now also carry categories ("Memory Safety", "Program Structure", ...) and hints, e.g.
   cfg.c back-edge: hint "Load with privileges that allow this back-edge, or rewrite the control flow...".

## Facts with locations (at d68ce4e7)

- Header comment of verifier.c (lines ~63–186): "The first pass is depth-first-search to check that
  the program is a DAG... The second pass is all possible path descent from the 1st insn." (The
  comment still says "limited to 64k insn", outdated — actual limit is 1M.)
- `BPF_COMPLEXITY_LIMIT_INSNS 1000000 /* yes. 1M insns */` — include/linux/bpf.h:2585.
  Check in do_check: verifier.c:20648, message "BPF program is too large. Processed %d insn".
- `BPF_COMPLEXITY_LIMIT_JMP_SEQ 8192` (verifier.c:203) → "The sequence of %d jumps is too complex."
- `BPF_COMPLEXITY_LIMIT_STATES 64` (states.c:10).
- syscall.c:3013: `attr->insn_cnt > (bpf_cap ? BPF_COMPLEXITY_LIMIT_INSNS : BPF_MAXINSNS)` —
  program size limit 4096 for unprivileged, 1M for CAP_BPF.
- syscall.c:3010: `if (sysctl_unprivileged_bpf_disabled && !bpf_cap) goto put_token;`
- syscall.c:3018: unprivileged may only load SOCKET_FILTER and CGROUP_SKB.
- syscall.c:68: default of `unprivileged_bpf_disabled` = 2 if CONFIG_BPF_UNPRIV_DEFAULT_OFF.
  Kconfig knob added by 08389d888287 (Daniel Borkmann, 2021-05-11), first in v5.13.
- bpf.h:3065–3087: `bpf_allow_ptr_leaks()` and `bpf_allow_uninit_stack()` require CAP_PERFMON;
  `bpf_bypass_spec_v1/v4()` true if JIT bypass, `cpu_mitigations_off()`, or CAP_PERFMON.
- verifier.c bpf_check: `env->bpf_capable = is_priv = bpf_token_capable(..., CAP_BPF)`;
  unprivileged verification is serialized by `bpf_verifier_lock`.
- cfg.c push_insn(): back-edge allowed `if (env->bpf_capable)`; else "back-edge from insn %d to %d".
  bpf_check_cfg also rejects "unreachable insn %d", "jump out of range", "jump into the middle of ldimm64".
- Bounded loops: 2589726d12a1 "bpf: introduce bounded loops" (Alexei Starovoitov, 2019-06-15), v5.3.
- Precision tracking: b5dc0163d8fd "bpf: precise scalar_value tracking" (2019-06-15), v5.3.
- 1M limit: c04c0d2b968a "bpf: increase complexity limit and maximum program size" (2019-04-02), v5.2.
- bpf_loop: e6f2dd0f8067 "bpf: Add bpf_loop helper" (Joanne Koong, 2021-11-30), v5.17. LWN 877062.
  fixups.c `inline_bpf_loop()` can inline it.
- Open-coded iterators: 06accc8779c1 "bpf: add support for open-coded iterator loops" (2023-03-08), v6.4.
- may_goto: 011832b97b31 "bpf: Introduce may_goto instruction" (2024-03-05), v6.9.
- Signed/unsigned bounds: b03c9f9fdc37 "bpf/verifier: track signed and unsigned min/max values"
  and f1174f77b50c "bpf/verifier: rework value tracking" (Edward Cree, 2017-08-07), v4.14.
- 32-bit bounds: 3f50f132d840 "bpf: Verifier, do explicit ALU32 bounds tracking" (John Fastabend, 2020-03-30).
- Spectre v1: b2157399cc98 "bpf: prevent out-of-bounds speculation" (2018-01-08), v4.15;
  979d63d50c0c "bpf: prevent out of bounds speculation on pointer arithmetic" (Daniel Borkmann, 2019-01-02).
  Spectre v4: af86ca4e3088 "bpf: Prevent memory disambiguation attack" (2018-05-15), v4.17.
  Current code: `sanitize_ptr_alu()` (verifier.c:16151), speculative path states, `nospec` insertion
  when `error_recoverable_with_nospec()`.
- `PTR_TO_*_OR_NULL` → `PTR_MAYBE_NULL` flag: c25b2ae13603 (Hao Luo, 2021-12-17).
- tnum: `struct tnum { u64 value; u64 mask; }` (tnum.h). `tnum_add` (tnum.c:63). `tnum_mul` replaced by
  05924717ac70 "bpf, tnums: Provably sound, faster, and more precise algorithm for tnum_mul"
  (2021-05-30, v5.14) — this is the CGO'22 paper's algorithm; further 1df7dad4d5c4 (2025-08-26).
- `reg_bounds_sync()` (verifier.c:2374) — the "reduction" step Agni identified.
- `regsafe()` (states.c:527): `if (!rold->precise && exact == NOT_EXACT) return true;` for scalars;
  scalars otherwise `range_within() && tnum_in()`; packet pointers need `rold->range <= rcur->range`.
- `find_good_pkt_pointers()` (verifier.c:18082), `mark_ptr_or_null_reg(s)()` (verifier.c:18648).
- Error strings (verifier.c): "%s invalid mem access '%s'" (7332), "invalid access to packet, off=%d size=%d, ..." (4805),
  "%s unbounded memory access, make sure to bounds check any such access" (4876),
  "%s min value is negative, ..." (4845), "math between %s pointer and %lld is not allowed" (16004),
  "Unreleased reference id=%d alloc_insn=%d" (12428), states.c:1582 "infinite loop detected at insn %d".

## Experiments run in the orb (Linux 6.1.189, clang 14.0.6, libbpf 1.1.2, sudo)

Scratch dir /tmp/v03 (deleted after writing). A 20-line libbpf loader set `log_level` and printed the
kernel log. JIT is not available in this orb's kernel (no /proc/sys/net/core/bpf_jit_enable), so
`bpf_loop` programs were rejected with "callbacks are not allowed in non-JITed programs" — the
bpf_loop example in the chapter is compiled but its successful load was **not** verified here.

Captured results (verbatim excerpts used in the chapter):
- map lookup without NULL check: `R0 invalid mem access 'map_value_or_null'`, processed 7 insns.
- with NULL check: loads; log shows `from 7 to 11: safe` (pruning).
- packet read without data_end check: `invalid access to packet, off=12 size=1, R1(id=0,off=12,r=0)` /
  `R1 offset is outside of the packet`.
- with check: `5: (2d) if r3 > r2 goto pc+7 ; ... R3_w=pkt(off=14,r=14,imm=0)`.
- array index from `bpf_get_prandom_u32()` unchecked: `R6 unbounded memory access, make sure to bounds check any such access`.
- with `if (i >= 16)`: `R0_w=scalar(umax=15,var_off=(0x0; 0xf))`, after `<<= 3`
  `scalar(umax=120,var_off=(0x0; 0x78))`, precision backtracking lines `regs=1 stack=0 before ...`.
- loop over unknown n with inner break: `The sequence of 8193 jumps is too complex.` (122,878 insns processed).
- loop over unknown n without branches in the body: `BPF program is too large. Processed 1000001 insn`.
- `r1 = 0; 1: if r1 == 0 goto 1b`: `infinite loop detected at insn 1`.
- constant-bound loop (64): accepted, processed 661 insns.

## Papers (all checked against Crossref / publisher pages)

1. Gershuni, Amit, Gurfinkel, Narodytska, Navas, Rinetzky, Ryzhyk, Sagiv. "Simple and Precise Static
   Analysis of Untrusted Linux Kernel Extensions". PLDI 2019, pp. 1069–1084. DOI 10.1145/3314221.3314590.
   PDF: https://vbpf.github.io/assets/prevail-paper.pdf. Code: https://github.com/vbpf/prevail
   (old name vbpf/ebpf-verifier redirects). Key facts from the paper: zone domain (X−Y ≤ c) chosen;
   intervals failed 64/192 programs; zone verified all but 1 of 192; benchmark set of 192 programs
   (linux 86, linux-prototype 23, ovs 18, suricata 5, cilium 24, cilium-tests 36); verifies safety of
   loops but not termination; each benchmark ≤ 5.2 s; Linux faster on those benchmarks; found 9 commits
   that worked around Linux false positives and verified the originals. eBPF for Windows uses PREVAIL
   (its README links it).
2. Vishwanathan, Shachnai, Narayana, Nagarakatte. "Verifying the Verifier: eBPF Range Analysis
   Verification". CAV 2023, LNCS 13966, pp. 226–251. DOI 10.1007/978-3-031-37709-9_12.
   Tool Agni: https://github.com/bpfverif/agni. Facts: extracts semantics from kernel C via LLVM IR,
   checks with Z3; 16 kernel versions 4.14–5.19; 27 previously unknown bugs (fixed by unrelated
   patches); POCs for ≈97% of violations; proves range analysis sound for kernels newer than 5.13
   under refined (reduction-aware) spec.
3. Vishwanathan, Shachnai, Narayana, Nagarakatte. "Sound, Precise, and Fast Abstract Interpretation
   with Tristate Numbers". CGO 2022, pp. 254–265. DOI 10.1109/CGO53902.2022.9741267. arXiv 2105.05398.
   Facts: first proofs of soundness and optimality of tnum add/sub; new tnum multiplication 33% faster
   on average and more precise, merged into Linux (05924717ac70).
4. Hao Sun, Zhendong Su. "Validating the eBPF Verifier via State Embedding". OSDI 2024.
   https://www.usenix.org/conference/osdi24/presentation/sun-hao. 15 previously unknown logic bugs
   in one month, 10 fixed, two exploitable for LPE.

## CVEs (checked on NVD API)

- CVE-2017-16995: check_alu_op incorrect sign extension; fix 95a762e2c8c9 (Jann Horn).
- CVE-2020-8835: 32-bit bounds restriction bug (5.5+, 5.4.7+); fix f2d67fec0b43 "Undo incorrect __reg_bound_offset32 handling". ZDI write-up by Manfred Paul.
- CVE-2021-3490: ALU32 bounds for AND/OR/XOR; fix 049c4e13714e.
- CVE-2021-31440: ZDI, 5.11.15; fix 10bf4e83167c.
- CVE-2022-23222: pointer arithmetic on *_OR_NULL types; NVD references fix 64620e0a1e71.

## LWN articles (titles verified)

- 740157 A thorough introduction to eBPF (2017)
- 794934 Bounded loops in BPF for the 5.3 kernel (2019)
- 877062 A different approach to BPF loops (bpf_loop, 2021)
- 982077 A look inside the BPF verifier (2024)
- 1017116 Taking BPF programs beyond one-million instructions (2025)
- 1050779 Verifier-state pruning in BPF (Jan 2026)
- 1076121 BPF loop verification with scalar evolution (June 2026)

## Not verified / left out

- Exact kernel release of the `base/step` representation (0892ef2a7ef3): appears to be the same merge
  as SCEV (v7.4-rc1) but not checked with compare API — chapter says "recent master".
- bpf_loop example load success (no JIT in orb).
- I did not benchmark anything; no performance numbers beyond those quoted from papers/logs.
