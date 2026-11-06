# Research notes — Chapter 18: ebpf-correctness-verifier (`ebpf-tv`)

Studied 2026-11-06 inside an Amp orb.

## Source

- Repo: https://github.com/eunomia-bpf/ebpf-correctness-verifier
- Description on GitHub: "eBPF transformation correctness validation based on Z3 and prevail"
- Created 2026-06-30, last push 2026-09-17, 2 stars (GitHub API, 2026-11-06). MIT license.
- Commit studied: `59ca4247632688aaeb5a048750c32bc9c7963061` (2026-09-16, "Pass the built binaries through to the XDP example script").
- Clone: `/home/user/workspace/src/ebpf-correctness-verifier` (unshallowed to read history; 64 commits).

## Activity / history

- 2026-06-29 `ef674e4` "Initial research plan", `1a5eb19` "Refocus on analyzer reuse".
- 2026-06-30: Python CLI `ebpf-tv`, vendored K2 under `third_party/k2-superopt`, `k2_ebpf_equiv` backend,
  PREVAIL smoke (`5f10fd1` "Add Heimdall notes and PREVAIL smoke", `79fc9bb`, `bb03f3a` "Exercise real PREVAIL through ebpf-tv smoke").
  Old README (at `2a1d81d`) described a gate: "kernel verifier safety gate" → "bytecode-level equivalence or refinement checker" → "benchmark and regression gate",
  with `--prevail-bin` and stages `prevail_old` / `prevail_new`. `scripts/prevail-smoke.sh` cloned `vbpf/prevail` at `865b701`.
- 2026-07-02 `ec136b4` "Add maintained SMT verifier backend": moved `third_party/k2-superopt` to `lib/ebpf_smt`, deleted
  `scripts/prevail-smoke.sh`, `.github/workflows/prevail-smoke.yml`, `docs/research-survey.md`, `docs/reuse-matrix.md`.
- 2026-07-02/03: ~30 "Model <helper>" commits (one helper per commit).
- 2026-07-05 `2c7986a` "Replace Python CLI with C++ ebpf-tv".
- 2026-09-16 `59ca424` last commit. Nothing since (≈7 weeks quiet at time of writing).

## PREVAIL: is it used?

**No, not in the current tree.** `rg -i prevail` finds only `tests/cli_smoke.sh:91`, which asserts that the help text does NOT contain
`prevail`, `external`, `equiv-command`, `--k2`, `K2`, `superopt`. PREVAIL was used only in the 2026-06-30 Python design and removed on 2026-07-02.
README now says "`ebpf-tv` does not prove program safety". The GitHub description still mentions prevail (stale).

## What transformation is validated

Any transformation that maps an old eBPF object to a new eBPF object for the same section: compiler flag changes, hand rewrites,
optimizer output, agent output. Nothing in the repo produces transformations (docs/mvp-architecture.md "Non-Goals": no optimizer orchestration,
no synthesis). It is NOT wired into bpf-benchmark: `rg 'ebpf-tv|correctness-verifier'` over `/home/user/workspace/src/bpf-benchmark` and `bpfperf` finds nothing.
The early README framed inputs as "untrusted agent / optimizer / migration tool" output.

## Architecture

- `tools/ebpf_tv.cc` (2300 lines): C++17 CLI `ebpf-tv` with `check`, `doctor`, `capabilities`, `selftest`.
  - `check` stages: input existence → backend. `identity` (default): byte-identical → PASS, else UNKNOWN.
    `smt`: section program-type precheck (`infer_section_program_type`), legacy `maps` / BTF `.maps` extraction via `llvm-objcopy --dump-section`,
    relocation patching via `llvm-readelf -r` (`R_BPF_64_64`), writes `.maps` + `.desc`, dumps section bytes to `.ins`, runs `smt_ebpf_equiv`.
  - `combine()`: FAIL > UNKNOWN > PASS. `check` returns exit 0 only for PASS, 1 otherwise (UNKNOWN also 1 at the CLI level).
  - `--rule-command` runs only after PASS; exit 0/1/2 → PASS/FAIL/UNKNOWN; placeholders `{old} {new} {section} {old_section} {new_section} {function}`.
  - `infer_smt_input_type`: `xdp*` → `pkt` (1), TC classifier → `skb` (3), else `constant` (0). `pkt-ptrs` = 2 only on request.
  - `SMT_DEFAULT_PACKET_SIZE = 64`.
- `tools/smt_equiv.cc` (255 lines): `smt_ebpf_equiv --old --new --map --desc`. `configure_smt()` sets `enable_z3server=false`, multi map/mem tables, addr_off.
  Calls `init_raw_program_pair_from_files`, `convert_bpf_pgm_to_smt_pgm` (folds LDDW halves), `validator vld(old)`, `vld.is_equal_to(...)`.
  1 → PASS `smt_equivalent`, 0 → FAIL `smt_counterexample`, else UNKNOWN; exceptions (strings) → UNKNOWN with the message.
  `--version` prints `origin_commit: f50ee1f` and Z3 version.
- `lib/ebpf_smt/` — extracted from K2 (`smartnic/superopt`); `LICENSE.origin` MIT "Copyright (c) 2019 Srinivas Narayana".
  Origin commit `f50ee1f375329dbba105ecf72570ce75ae023812` in smartnic/superopt, 2021-09-16, "Revert "bugfix: a typo"" (gh api).
  - `src/raw_program_loader.cc` (637, project-owned): reads raw 8-byte insns, `.maps` lines `{ type = .., key_size = .., ... }`, `.desc`
    `{ pgm_input_type = N, }` `{ max_pkt_sz = N, }`; `validate_bounded_memory_helpers` does a simple constant propagation and throws
    `"unsupported ..."` strings for helper arguments outside the model; counts symbolic u32 slots per helper.
  - `src/verify/cfg.cc`: basic blocks; DFS throws `"illegal input: loop from node ..."` for back edges.
  - `src/verify/smt_prog.cc`: per-block SSA, path conditions, `implies(path_con, f_iv && f_bl)`, topological order.
  - `src/verify/validator.cc`: `smt_pre` constrains `input` to [-1024, 1024] ("TODO: set input limit, need to be generalized"), sets r1=input,
    r10=stack bottom; `safety_check` (`implies(pre && pl, p_sc)`), then `implies(same_input && pre_old && pre_new && pl_old && pl_new, post)`;
    `is_smt_valid`: tactic "bv", `s.add(!smt)`, unsat → 1, sat → 0 (model), unknown → -1. Has a program-equality cache (disabled by smt_equiv).
  - `src/isa/ebpf/inst.cc`: `smt_inst` switch over opcodes; `smt_inst_jmp` handles JEQ/JGT/JGE/JNE/JSGT (K/X) and JEQ32/JNE32 only;
    `smt_inst_end` writes `ret_val` or tail-call args; `smt_set_pre`.
  - `src/isa/ebpf/inst_codegen.{h,cc}`: predicates (`ADD_EXPR` etc. via macros), memory tables (write table "wt" and "urt" read table), map
    lookups/updates/deletes, helpers, `smt_pgm_eq_chk`, `smt_pgm_set_same_input`.
  - `src/isa/ebpf/inst_var.cc`: variable naming `r_<prog>_<block>_<reg>_<version>`; `rand_u32_<i>` shared by name across both programs.
  - `src/isa/ebpf/inst_codegen_test.cc`: 190 checks (all print SUCCESS) comparing `compute_*` interpreter vs `predicate_*` SMT.
- `tests/`: `cli_smoke.sh`, `smt_equiv_smoke.sh`, `smt_cli_integration.sh`, `real_app_corpus.sh` + `tests/real_apps/*.c` (≈130 C files; 62 cases in the table: 58 PASS, 1 FAIL, 3 UNKNOWN).
- `scripts/run-smt-xdp-example.sh`, `examples/smt-xdp/README.md`: old `r0 = 1; exit` vs new `r0 = 0; r0 += 1; exit`, patched into a clang XDP object.
- `docs/`: backend-contract, backend-dev, mvp-architecture, support-matrix, test-plan, heimdall-notes, reproduction-notes, dependency-policy.
- CI `.github/workflows/ci.yml`: Ubuntu 24.04, `make test`; job `upstream-z3`: `make test-smt-z3-release` (Z3 4.16.0, sha256 pinned in Makefile).

## Supported opcode set (from `opcode_2_idx`, inst.cc)

ALU64: ADD K/X, SUB X, MUL K, DIV K, OR K/X, AND K/X, LSH K/X, RSH K/X, NEG, XOR K/X, MOV K/X, ARSH K/X.
ALU32: ADD, OR, AND, LSH, RSH, MOV, ARSH (K/X). LE/BE. LDDW (+ map fd). LDX/STX/ST B/H/W/DW. XADD32/64. LDABSH, LDINDH.
JMP: JA, JEQ, JGT, JGE, JNE, JSGT (K/X); JMP32: JEQ, JNE (K/X). CALL, EXIT.
Missing (per RFC 9669): SUB K, MUL X, DIV X, MOD, SDIV/SMOD, MOVSX, LDSX, BSWAP, SUB32/MUL32/DIV32/XOR32/NEG32, JSET, JSGE, JLT, JLE, JSLT, JSLE,
all other JMP32 compares, atomics other than add, BPF-to-BPF calls, kfunc calls.

## Build and tests (run in the orb)

- Debian 12 orb; packages already present: clang 14.0.6, cmake 3.25.1, libz3-dev 4.8.12, llvm 14.
- `cmake -S . -B build && cmake --build build -j2` → builds all three targets, ~2 min.
- `ctest --test-dir build --output-on-failure` → 5/5 passed, total 52.88 s (real_app_corpus 49.66 s, codegen 2.47 s).
- `scripts/run-smt-xdp-example.sh` → JSON `result: PASS`, stage reasons `legacy_maps_not_found`, `btf_section_not_found`, `map_relocations_not_found`,
  `generated_smt_environment`, `section_extracted`, `smt_equivalence_pass`; stderr shows `program input type set as 1`, `maximum packet size set as 64 bytes`.
- `smt_ebpf_equiv --version` → Z3 `4.8.12.0`, `origin_commit f50ee1f`, `z3server: false`.
- `ebpf-tv doctor --smt-equiv build/smt_ebpf_equiv --output text` → PASS, `doctor_ebpf_tv ... 0.1.0`.

## My experiments (scratch in /tmp, deleted afterwards). Raw .ins + `constant` desc, empty maps.

| old | new | tool says | truth (RFC 9669 semantics) | cause |
|---|---|---|---|---|
| `r0=0; if r1 s> 2000 goto +1; exit; r0=1; exit` | `r0=0; exit` | PASS | differ for r1 > 2000 | `input` ∈ [-1024,1024] in `validator::smt_pre` |
| same with 500 | `r0=0; exit` | FAIL | differ | in range |
| `r0=0; if r1 < 5 goto +1 (JLT 0xa5) ...` | `r0=0; exit` | PASS | differ at r1=0 | `smt_inst_jmp` default `false` → never taken |
| `r0=r1; r0 /= 2` | `r0=r1; r0 >>= 1` | FAIL | equal (unsigned div) | DIV modeled with z3++ `operator/` = `Z3_mk_bvsdiv` (signed) |
| `r0=r1; r0 /= 2` | `r0=r1; r2=r1; r2>>=63; r0+=r2; r0 s>>=1` | PASS | differ at r1=-2 | same (signed div) |
| `r0=r1; r0 /= r2` (0x3f) | `r0=r1; exit` | PASS | differ | unmodeled ALU op treated as no-op |
| `r0=r1; r0 -= 5` (0x17) | `r0=r1; exit` | PASS | differ | same |

clang-compiled C (via `ebpf-tv check --equiv-backend smt`):
- `signed char first=*(signed char*)ctx; if (first >= 5) return XDP_DROP; return XDP_PASS;` vs `return XDP_PASS;`
  - `-mcpu=v1` / `v2`: FAIL (correct; code uses 64-bit JSGT 0x65). `-mcpu=v3`: **PASS** (wrong; code uses `if w1 s> 4` = JSGT32 0x66).
- `return p[0] * p[1];` vs `return p[1];` (default mcpu, clang 14): **PASS** (wrong; `r0 *= r2` = MUL64 X 0x2f dropped).
- `struct xdp_md` data/data_end program: `--smt-input-type auto` → UNKNOWN; `pkt-ptrs` → PASS for the rewrite (clang produced identical bytecode), FAIL for a real change.
- LLVM default BPF CPU is v3 since LLVM 20 (kernel docs bpf_devel_QA, llvm-project PR #107008). CI's Ubuntu 24.04 clang 18 still defaults to v1.

Formula dump: scratch driver = `tools/smt_equiv.cc` + a `std::cerr << vld._pl_orig / _store_post / _store_f` line, linked against
`build/CMakeFiles/smt_ebpf_equiv.dir/**/*.o`. Output for the XDP example (r0=1 vs r0=0; r0+=1) recorded in the chapter.
Shows `bvsge input #xfffffffffffffc00`, `bvsle input #x0000000000000400`, `r_0_0_1_0 = input`, `r_0_0_10_0 = stack_start + 0x200`, SSA names.

## Citations verified (web, 2026-11-06)

- K2: Xu, Wong, Wagle, Narayana, Sivaraman. "Synthesizing Safe and Efficient Kernel Extensions for Packet Processing", ACM SIGCOMM 2021.
  https://doi.org/10.1145/3452296.3472929 ; arXiv https://arxiv.org/abs/2103.00022 ; repo https://github.com/smartnic/superopt.
  Abstract: equivalence-checking accelerated "by 6 orders of magnitude"; 6–26% smaller code; post-processing loads outputs into the kernel checker.
- Merlin: Mao, Ding, Zhai, Ma. "Merlin: Multi-tier Optimization of eBPF Code for Performance and Compactness", ASPLOS 2024.
  https://doi.org/10.1145/3620666.3651387 ; code https://github.com/4ar0nma0/Merlin. LLVM passes + bytecode rewriting; instruction merging, strength reduction.
- EPSO: Zhu, Liu, Zhu, Liu, Bu. "EPSO: A Caching-Based Efficient Superoptimizer for BPF Bytecode", ASE 2025. arXiv https://arxiv.org/abs/2511.15589.
  Offline superoptimization → cached rewrite rules (795 in arXiv version).
- Jitterbug: Nelson, Van Geffen, Torlak, Wang. "Specification and verification in the field: Applying formal methods to BPF just-in-time compilers in the Linux kernel", OSDI 2020.
  https://www.usenix.org/conference/osdi20/presentation/nelson ; https://github.com/uw-unsat/jitterbug.
- Heimdall: Dasu, Santra, Rashid, Kumar, Tizpaz-Niari, Tan. "Heimdall: Formally Verified Automated Migration of Legacy eBPF Programs to Rust", arXiv 2605.25411 (2026).
  angr-based eBPF symbolic execution + Z3 equivalence. Cited in repo docs/heimdall-notes.md.
- Translation validation: Pnueli, Siegel, Singerman, TACAS 1998, https://doi.org/10.1007/BFb0054170 ;
  Necula, "Translation validation for an optimizing compiler", PLDI 2000, https://doi.org/10.1145/358438.349314 ;
  Lopes et al., "Alive2: Bounded Translation Validation for LLVM", PLDI 2021, https://doi.org/10.1145/3453483.3454030.
- PREVAIL: Gershuni et al., "Simple and Precise Static Analysis of Untrusted Linux Kernel Extensions", PLDI 2019 (covered in chapter 03).
- RFC 9669 (BPF ISA): DIV unsigned, SDIV offset 1, jump table incl. JLT/JSGE/JSET, JMP32 class. https://www.rfc-editor.org/rfc/rfc9669.html
- Kernel docs: https://docs.kernel.org/bpf/bpf_devel_QA.html ("Since llvm 20, the default processor target has changed to instruction set v3").

## Chapter 19 relation

bpf-benchmark (chapter 19) is an agent loop that proposes eBPF optimizations and returns verifier/JIT/perf feedback (README).
It contains no reference to ebpf-tv. Relation in chapter is conceptual: ebpf-tv is the kind of semantic gate such a loop lacks; verifier
acceptance + benchmarks do not show that behaviour is preserved.

## Not verified

- Whether upstream K2 has the same gaps (signed div, ignored opcodes) — not checked against smartnic/superopt source.
- Throughput/latency of the checker on large programs — not measured beyond the corpus run time.
- `make test-smt-z3-release` (downloads Z3 4.16.0) — not run.

## Worked example used in the chapter (run 2026-11-06)

- `r0 = r1; r0 *= 8; exit` (0x27 imm 8) vs `r0 = r1; r0 <<= 3; exit` (0x67 imm 3): `smt_ebpf_equiv` → PASS `smt_equivalent`.
- Same vs `r0 <<= 2`: FAIL `smt_counterexample`.
- Hand-written SMT-LIB query (illustrative, not repo code), run with the `z3-solver` Python package via `uv run --with z3-solver`:
  `(assert (not (= (bvmul r1 #x..08) (bvshl r1 #x..03))))` → `unsat`; with shift 2 → `sat`, model `r1 = 2305843009213693952` (2^61).
