# Research notes — Chapter 02: eBPF ISA and VM

Date: 2026-11-05. Linux sources read at master `d68ce4e71248e1ff5af9654b407541d9260b3ba5`
(fetched raw from GitHub; latest tag at the time `v7.4-rc1`). Not cloned (AUTHORING forbids
cloning the kernel); individual files were downloaded with curl into
`/home/user/workspace/src/linux-files/`.

## Primary sources

- RFC 9669, "BPF Instruction Set Architecture (ISA)", D. Thaler (Ed.), IETF Standards Track,
  October 2024. https://www.rfc-editor.org/rfc/rfc9669.html
  - Sections: 2.4 conformance groups; 3 encoding; 4 arithmetic & jump; 5 load/store;
    6 security considerations; 7 IANA (two registries: BPF Instruction Conformance Groups,
    BPF Instruction Set); Appendix A initial opcode table.
  - Conformance groups: base32 (mandatory), base64, atomic32, atomic64, divmul32, divmul64,
    packet (Historical / deprecated).
  - Acknowledgements: "generated from instruction-set.rst in the Linux kernel repository".
  - RFC 9669 does NOT contain the register/calling-convention text; that is in the
    kernel's `Documentation/bpf/standardization/abi.rst` ("BPF ABI Recommended Conventions
    and Guidelines v1.0").
- LWN news item, "The BPF instruction set architecture is now RFC 9669", 2024-11-05,
  https://lwn.net/Articles/997002/ (motivation: NVMe vendors wanting offload, e.g. XRP).
- LWN "Standardizing BPF", David Vernet, 2023-04-10, https://lwn.net/Articles/926882/
- docs.kernel.org/bpf/standardization/instruction-set.html (kernel version of the spec).
- docs.kernel.org/bpf/standardization/abi.html — registers:
  - "BPF has 10 general purpose registers and a read-only frame pointer register, all of
    which are 64-bits wide."
  - R0 return value / exit value; R1–R5 args; R6–R9 callee saved; R10 read-only FP.
  - "R0 - R5 are scratch registers".
- docs.kernel.org/bpf/classic_vs_extended.html — design rationale:
  - registers 2 → 10 + read-only FP; 32-bit → 64-bit; jt/jf → jt/fall-through;
    5-argument limit because of hardware argument registers;
  - x86-64 mapping R0 rax, R1 rdi, R2 rsi, R3 rdx, R4 rcx, R5 r8, R6 rbx, R7 r13,
    R8 r14, R9 r15, R10 rbp;
  - example pseudo-program and its x86-64 JIT output (old style, `sub $0x228,%rsp`);
  - "eBPF is limited to 4096 insns" (historical; see BPF_MAXINSNS below);
  - `op:16, jt:8, jf:8, k:32 ==> op:8, dst_reg:4, src_reg:4, off:16, imm:32`.
- docs.kernel.org/bpf/clang-notes.html — `-mcpu=v3` = current ISA; atomics with fetch need
  v3 (or +alu32); `-O0` may generate `BPF_CALL|BPF_X|BPF_JMP` (0x8d), not supported by
  the verifier.
- docs.kernel.org/admin-guide/sysctl/net.html — bpf_jit_enable (0/1/2), bpf_jit_harden
  (0 off, 1 unprivileged only, 2 all users; "privileged" = CAP_BPF or CAP_SYS_ADMIN),
  bpf_jit_kallsyms disabled when hardening, bpf_jit_limit.
  - Note: doc says default 0, but code uses
    `bpf_jit_enable = IS_BUILTIN(CONFIG_BPF_JIT_DEFAULT_ON)` (core.c:552) and
    `CONFIG_BPF_JIT_ALWAYS_ON` forces JIT (core.c:131).

## Kernel source facts (master d68ce4e7)

include/uapi/linux/bpf.h
- `struct bpf_insn { __u8 code; __u8 dst_reg:4; __u8 src_reg:4; __s16 off; __s32 imm; }` (l.93)
- `enum { BPF_REG_0 = 0, ... BPF_REG_10, __MAX_BPF_REG }`
- `BPF_MEMSX 0x80`, `BPF_ATOMIC 0xc0`, `BPF_JCOND 0xe0` (may_goto), `BPF_FETCH 0x01`,
  `BPF_XCHG (0xe0|FETCH)`, `BPF_CMPXCHG (0xf0|FETCH)`, `BPF_LOAD_ACQ 0x100`,
  `BPF_STORE_REL 0x110` (the last two are post-RFC).
- `BPF_PSEUDO_CALL 1`, `BPF_PSEUDO_KFUNC_CALL 2` (l.1431/1435)
- helper id 1 = map_lookup_elem (`FN(map_lookup_elem, 1, ...)`).
include/uapi/linux/bpf_common.h: `BPF_MAXINSNS 4096`.
include/linux/bpf.h: `BPF_COMPLEXITY_LIMIT_INSNS 1000000`, `MAX_TAIL_CALL_CNT 33`.
include/linux/bpf_verifier.h: `MAX_CALL_FRAMES` = 8 in v6.12 and v6.18, **16 in v7.3 and
  v7.4-rc1/master**.
include/linux/filter.h
- `BPF_REG_FP BPF_REG_10`; `BPF_REG_PARAMS MAX_BPF_REG` (new: stack-argument pseudo reg,
  present in v7.3); `BPF_REG_AX (MAX_BPF_REG + 1)` hidden aux reg.
- l.99-105: `MAX_BPF_STACK 512`; `MAX_BPF_STACK_JIT 2048` with comment "Stack budget of
  a program on a JIT that lays out frames of that size. The interpreter and JITs without
  such support keep MAX_BPF_STACK." — present in v7.4-rc1, absent in v7.3.
- Atomic semantics comment block (l.390-401).
kernel/bpf/core.c
- `bpf_jit_blind_insn()` l.1364: uses `get_random_u32()`, rewrites `ALU|K` ops into
  `mov AX, rnd^imm; xor AX, rnd; op dst, AX`; "Constant blinding is only used by JITs,
  not in the interpreter."
- `bpf_jit_blind_constants()` l.1572.
- `___bpf_prog_run()` l.1874: `jumptable[256]` computed-goto dispatch; `select_insn: goto
  *jumptable[insn->code];`; shift masking comment; JMP_CALL: "Function call scratches
  BPF_R1-BPF_R5 registers, preserves BPF_R6-BPF_R9, and stores return value into BPF_R0."
- `DEFINE_BPF_PROG_RUN(stack_size)` l.2422: `u64 stack[stack_size/8]; u64
  regs[MAX_BPF_EXT_REG]; FP = &stack[ARRAY_SIZE(stack)]; ARG1 = ctx;` instantiated for
  32..512 in steps of 32.
- `bpf_prog_select_interpreter()` l.2619: `idx = round_up(stack_depth, 32)/32 - 1`.
- `bpf_prog_jit_compile()` l.2697 — blind then `bpf_int_jit_compile`; falls back to
  interpreter on blinding failure.
arch/x86/net/bpf_jit_comp.c
- `reg2hex[]` l.161 (mapping above; BPF_REG_AX → r10, AUX_REG → r11, r12 unused for
  programs except arena, r9 for trampoline). Comment: "x86-64 register R10 is used for
  blinding (if enabled)".
- `simple_alu_opcodes[]` l.276.
- `emit_prologue()` l.525: CFI, 5-byte nop (X86_PATCH_SIZE) for trampoline, `push rbp;
  mov rbp, rsp`, ENDBR, `sub rsp, round_up(stack_depth, 8)`.
- `emit_atomic_rmw()` l.1591: `lock` prefix unless XCHG; add→`01`, fetch_add→`0F C1`
  (xadd), xchg→`87`, cmpxchg→`0F B1`.
- `do_jit()` l.2516; `case BPF_JMP | BPF_CALL` l.3421 → `emit_call` (E8 rel32);
  `bpf_int_jit_compile()` l.4805; `MAX_PASSES 20` l.4802 (iterates until image size
  converges).

## Release history (from bcc docs/kernel-versions.md)
https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md
- eBPF 3.15 (bd4cf0ed331a); x86_64 JIT 3.16 (622582786c9e); arm64 3.18;
  constant blinding 4.7 (4f3446bb809f "bpf: add generic constant blinding for use in jits",
  Daniel Borkmann); RV32 5.7 (5f316b65e99f, the Jitterbug-verified JIT).
- ISA versions (pchaigno, https://pchaigno.github.io/bpf/2021/10/20/ebpf-instruction-sets.html):
  v2 jlt/jle/jslt/jsle (Linux 4.14); v3 JMP32 + ALU32 (Linux 5.1); v4 sdiv/smod,
  sign-ext loads/mov, 32-bit JA, bswap — Linux 6.6. Patch set: LWN
  https://lwn.net/Articles/936824/ (Yonghong Song, June 2023). LLVM version for v4 not
  independently verified (pchaigno's table says 18.0) — chapter omits exact LLVM version.
- load-acquire / store-release: LLVM commit 17bfc00 (Peilin Ye, 2025-03-04),
  `BPF_LOAD_ACQ 0x100`, `BPF_STORE_REL 0x110` as STX|ATOMIC imm values.

## Papers
- L. Nelson, J. Van Geffen, E. Torlak, X. Wang. "Specification and verification in the
  field: Applying formal methods to BPF just-in-time compilers in the Linux kernel." OSDI
  2020, pp. 41-61. https://www.usenix.org/conference/osdi20/presentation/nelson
  — Jitterbug; new verified RV32 JIT; 16 previously unknown bugs in five other JITs;
  examined JIT commits May 2014–April 2020.
- X. Wang, D. Lazar, N. Zeldovich, A. Chlipala, Z. Tatlock. "Jitk: A Trustworthy In-Kernel
  Interpreter Infrastructure." OSDI 2014.
  https://www.usenix.org/conference/osdi14/technical-sessions/presentation/wang_xi
  (classic BPF; built on CompCert). OSDI '14 pp. 33-47; authors verified on the USENIX page.
- J. Van Geffen, L. Nelson, I. Dillig, X. Wang, E. Torlak. "Synthesizing JIT Compilers for
  In-Kernel DSLs." CAV 2020. https://doi.org/10.1007/978-3-030-53291-8_29 (JitSynth,
  eBPF→RISC-V).
- D. Jin, V. Atlidakis, V. P. Kemerlis. "EPF: Evil Packet Filter." USENIX ATC 2023.
  https://www.usenix.org/conference/atc23/presentation/jin
- R. Gawlik, T. Holz. "SoK: Make JIT-Spray Great Again." WOOT 2018.
  https://www.usenix.org/system/files/conference/woot18/woot18-paper-gawlik.pdf
- K. McAllister, "Attacking hardened Linux systems with kernel JIT spraying", blog, Nov 2012.
  http://mainisusuallyafunction.blogspot.com/2012/11/attacking-hardened-linux-systems-with.html
- E. Reshetova, F. Bonazzi, N. Asokan, "Randomization can't stop BPF JIT spray", Black Hat
  Europe 2016.

## Experiment: real compiler output
Environment: Debian 12 orb, `apt install clang llvm libbpf-dev` → Debian clang 14.0.6,
libbpf-dev 1.1.2. Source in /home/user/workspace/src/ch02-demo/count.c and atomics.c.
Commands:
```
clang -target bpf -O2 -g -I/usr/include/x86_64-linux-gnu -c count.c -o count.o
llvm-objdump -d -r count.o
clang -target bpf -O2 -mcpu=v3 -I/usr/include/x86_64-linux-gnu -c count.c -o count_v3.o
clang -target bpf -O2 -mcpu=v3 -c atomics.c -o atomics.o
```
Outputs are pasted verbatim into the chapter. Observations:
- default cpu (clang 14 "generic") emits `r1 <<= 32; r1 >>= 32` for u32 truncation;
  `-mcpu=v3` uses `w1 -= w2` (ALU32 zero-extends) — 2 fewer insns.
- `lddw` placeholder `18 01 00.. ` + relocation `R_BPF_64_64 pkt_count`.
- subprogram call `85 10 00 00 ff ff ff ff` (src_reg=1 pseudo call, imm=-1) with
  relocation `R_BPF_64_32 .text`.
- `__sync_fetch_and_add` with unused result → `db 06 .. imm 0` (`lock *(u64 *)(r6 + 0) += r0`)
  even on default cpu; with result used under v3 → imm 0x01 `atomic_fetch_add`;
  cmpxchg imm 0xf1; xchg imm 0xe1.
- Could NOT load programs: the orb kernel exposes no /proc/sys/net/core/bpf_jit_* and
  bpftool is not usable, so no JIT dump (`bpftool prog dump jited`) was produced. The
  chapter uses the documented x86-64 output from classic_vs_extended.rst, labelled as such.

## Additional checks
- bcc kernel-versions.md: "bpf2bpf function calls | 4.16 | cc8b0b92a169".
- Atomics (BPF_ATOMIC with FETCH/XCHG/CMPXCHG): in 5.12 (5.12-rc3 already carries Brendan
  Jackman's fixes "bpf, x86: Fix BPF_FETCH atomic and/or/xor with r0 as src").
- verifier.c: "frame pointer is read only", "combined stack size of %d calls is %d. Too large",
  "BPF_NEG uses reserved fields" etc.
- x86 JIT: BPF_NOSPEC -> EMIT_LFENCE(); classic programs from non-CAP_SYS_ADMIN get
  emit_spectre_bhb_barrier at exit. File is 5230 lines at d68ce4e7.
- clang 14 `llc -march=bpf -mcpu=help`: generic, probe, v1, v2, v3 (no v4 in 14).
- Latest docs.kernel.org clang-notes says 0x8d callx is accepted when the verifier can prove a
  static BPF function target (see linux-notes.rst); the docs.kernel.org 7.3 page still says
  unsupported. The decoder note reflects the newer text.
- Claim NOT made (unverified): which LLVM release made -mcpu=v3 the default.

## Chapter verification
- Decoder logic tested in Node against all 21 instructions from the real objdump output
  (0 mismatches) plus v4/acquire/32-bit atomic samples.
- Page rendered in headless Chromium (agent-browser); three SVG figures and the decoder checked
  visually; HTML tag balance checked with Python's HTMLParser; no unescaped < or & in <pre>.
