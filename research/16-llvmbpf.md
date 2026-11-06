# Research notes — Chapter 16: llvmbpf

## Sources studied

- Repo: https://github.com/eunomia-bpf/llvmbpf — `main` at
  `7e384dbb1c8af0b78e8ae58d2bfb304580ff1e27` (2026-10-25, "Support LLVM 24 and ROCm builds
  without NVPTX (#54)"). Cloned to `/home/user/workspace/src/llvmbpf` (then unshallowed: 56
  commits on main, first commit 2024-08-10 "Init project from bpftime").
- GitHub API (2026-11-06): 149 stars, MIT, description "Userspace/GPU eBPF VM with llvm JIT/AOT
  compiler", pushed_at 2026-10-28.
- https://github.com/eunomia-bpf/llvmbpf-nvptx — description "This branch has been merged into
  https://github.com/eunomia-bpf/llvmbpf"; last push 2025-05-24; newest commit 042c690
  (2025-05-24, "Update README.md"); its history is the llvmbpf history up to d2c42be
  (2025-04-10). PTX landed on llvmbpf main as 118919d "feat: support generating PTX (#28)"
  (2025-05-21, Officeyutong; +3117/-96 in 20 files, added trampoline and `demo/ptx_test.cpp`).
- bpftime: `/home/user/workspace/src/bpftime` at `25e250d6` (2026-11-03). `vm/llvm-jit` is a git
  submodule pointing at llvmbpf commit `87bac39` (2026-09-21) — two commits behind llvmbpf main.

## Code layout (llvmbpf @ 7e384db)

| path | lines | role |
|---|---|---|
| include/llvmbpf.hpp | 170 | public C++ API (`bpftime::llvmbpf_vm`) |
| src/vm.cpp | 359 | API implementation; lazily creates JIT |
| src/compiler.cpp | 1756 | `llvm_bpf_jit_context::generateModule()` — the lifter |
| src/compiler_utils.{hpp,cpp} | 118/403 | emit helpers (ALU, load/store, jumps, helper calls, atomics) |
| src/llvm_jit_context.{hpp,cpp} | 78/1107 | ORC LLJIT, optimisation pipeline, AOT, PTX, SPIR-V |
| src/ebpf_inst.h | 256 | instruction struct + opcodes (from ubpf, Apache-2.0 header "Copyright (c) 2015 Big Switch Networks") |
| cli/main.cpp | 414 | `bpftime-vm` CLI: `build` (libbpf open + AOT) and `run` |
| example/ | | basic.cpp, maps.cpp, standalone/, inline/, load-llvm-ir/, ptx/, spirv/, array_map_inline_bench.cpp |
| test/ | | unit-test (Catch2), bpf_conformance_runner, test_framework (pytest, from ubpf) + 132 `.data` cases |
| .github/workflows | | unit-test, test-vm, test-aot-cli, bpf_conformance, test-spirv-opencl, codeql |

## Key facts from the code

- `llvmbpf_vm` API: `register_external_function(index,name,fn)`, `register_array_map`,
  `load_code`, `unload_code`, `exec`, `do_aot_compile(print_ir)`, `load_aot_object`, `compile`,
  `set_optimization_level(0..3)` (default 3), `set_target_cpu`, `set_target_features`,
  `set_disabled_passes`, `set_log_passes`, `set_kernel_compatible_mode`, `load_line_info`,
  `get_compiled_code`, `set_lddw_helpers(map_by_fd,map_by_idx,map_val,var_addr,code_addr)`,
  `generate_ptx(target_cpu="sm_60")`, `generate_spirv(target_env="")`.
- `precompiled_ebpf_function = uint64_t (*)(void *mem, size_t mem_len)`. MAX_EXT_FUNCS 8192.
- `load_code` only checks `code_len % 8 == 0`. No verifier, no memory bounds checks anywhere
  in the lifter: `emitLoadX`/`emitStore` GEP on the raw pointer in the register.
- `exec()` compiles on first call (no interpreter in llvmbpf).
- Lifter (`generateModule`, compiler.cpp):
  1. declares lddw helper functions and ext helpers `_bpf_helper_ext_%04d` all with type
     `i64(i64,i64,i64,i64,i64)` (`ext_func_sym`, compiler_utils.hpp:39);
  2. marks block starts (pc 0, after any jump, jump targets) — "Split the blocks" L312;
  3. function `bpf_main(ptr, i64)` (GPU: returns void, address space 1); `setupBlock` allocas
     r0..r10, stack `alloca i64 x (STACK_SIZE*MAX_LOCAL_FUNC_DEPTH+10)` = 64*32+10 = 2058 i64
     (16 KiB + 80 B), r10 = stackBegin+2048 i64; call stack `alloca ptr x 320`; r1=mem, r2=len;
  4. one `BasicBlock` `bb_inst_<pc>` per block start; `exitBlock` returns r0;
     `localFuncReturnBlock` pops (retaddr, r6..r9) from call stack and `indirectbr`s;
  5. main loop L586 `for (pc...) switch (inst.opcode)`; ALU via `emitALUWithDstAndSrc`
     (load dst/src as i32 or i64, op, zext for 32-bit); DIV/MOD guard divide-by-zero with
     `select`; shifts masked with `urem 64/32`; LDDW src 0..6 handled (map_by_fd resolved at
     compile time; map_val at compile time in JIT, via `__lddw_helper_map_val` call in AOT);
     CALL src=1 → push return BlockAddress + r6..r9 and `r10 -= STACK_SIZE` (512 B frame);
     CALL helper → `emitExtFuncCall` passes r1..r5, stores r0; helper 12 (tail call) jumps to
     exit; EXIT → `exitBlock` if call depth 0 else `localFuncReturnBlock`;
     atomics → `atomicrmw`/`cmpxchg` monotonic;
  6. adds fallthrough `br` to blocks without terminator; `verifyModule` (not for GPU).
- Optimisation: LLVM ≥17 new PassManager `buildPerModuleDefaultPipeline(O0..O3)`, older legacy
  `PassManagerBuilder`. Registers as allocas → SROA/mem2reg turns them into SSA.
- JIT: `do_jit_compile` → `create_and_initialize_lljit_instance` (LLJITBuilder with host
  JITTargetMachineBuilder; `DynamicLibrarySearchGenerator::GetForCurrentProcess`; helpers
  defined as `absoluteSymbols` named `_bpf_helper_ext_NNNN`; only `__lddw_helper_map_val`
  defined) → `generateModule(..., patch_map_val_at_compile_time=true)` → optimise → optional
  array-map inlining → `addIRModule` → `lookup("bpf_main")`.
- AOT: `generateModule(..., false)`, optimise, host TargetMachine, `addPassesToEmitFile(...
  ObjectFile)` into memory → bytes of a relocatable ELF. `load_aot_object` → new LLJIT, same
  helper symbols, `addObjectFile`, `lookup("bpf_main")`.
- PTX: `createNVPTXTargetMachine` triple `nvptx64-nvidia-cuda`, default cpu `sm_60`,
  `generateModule(..., is_gpu=true)`, emits `AssemblyFile`. Example and bpftime patch `.func` →
  `.entry`, rename helpers, prepend trampoline PTX. SPIR-V target `spirv64-unknown-unknown`.
- Kernel-compatible mode (1bfb0fd, 2026-03-30): pseudo map fds/values become external symbols
  `__llvmbpf_pseudo_map_fd_XXXXXXXX`, BPF-to-BPF calls become calls to
  `__llvmbpf_pseudo_call_pc_XXXXXXXX`, stack sized exactly; branch name
  `codex/bpfopt-llvm-roundtrip-20260515` suggests use for lifting → optimise → re-lowering (not
  verified beyond the branch name).
- Array-map inline (7f19854): replaces `_bpf_helper_ext_0001(const_handle, key)` with
  bounds-checked address arithmetic when `register_array_map` described the map.
- #52 (87bac39, 2026-09-21): link only host backend + NVPTX; commit message reports
  libbpftime-agent.so 140 MB → 79 MB (LLVM 17, x86-64) — numbers quoted from commit message,
  not reproduced.

## bpftime integration (bpftime @ 25e250d6)

- `vm/compat/llvm-vm/compat_llvm.cpp`: `bpftime_llvm_vm` wraps `llvmbpf_vm`; registered with
  `register_vm_factory("llvm", ...)` from a `__attribute__((constructor(0)))`.
- `runtime/include/bpftime_config.hpp:17`: `DEFAULT_VM_NAME "llvm"`; env `BPFTIME_VM_NAME`
  (`runtime/src/bpftime_config.cpp:130`) selects `ubpf` instead.
- `runtime/src/bpftime_prog.cpp`: `ebpf_set_lddw_helpers(vm, map_ptr_by_fd, nullptr, map_val,
  nullptr, nullptr)`; `bpftime_prog_load` calls `ebpf_compile`; on failure "falling back to
  interpreter".
- GPU: `attach/nv_attach_impl/pass/ptxpass_core/src/core.cpp` `compile_ebpf_to_ptx_from_words`
  registers helpers 1,2,3,6,14,25,501–511 with dummy pointers and calls `ctx.generate_ptx`.
- `tools/aot` = `bpftime-aot` (build/compile/load/run), README links llvmbpf.

## Build and run in the orb (2026-11-06)

- Debian 12, `sudo apt-get install llvm-15-dev libzstd-dev libelf-dev` (LLVM 15.0.6).
- `LLVM_DIR=/usr/lib/llvm-15/cmake cmake -S llvmbpf -B llvmbpf-build -DCMAKE_BUILD_TYPE=Release
  -DBUILD_LLVM_AOT_CLI=1 && cmake --build llvmbpf-build -j2` → success in a few minutes. Static
  LLVM: `bpftime-vm` 49,859,448 bytes; `vm-llvm-example` 48,620,296 bytes.
- Quirk: `libllvmbpf_vm.a` goes to the parent of the build dir (`ARCHIVE_OUTPUT_DIRECTORY
  "${CMAKE_CURRENT_BINARY_DIR}/../"`).
- Quirk: `vm-llvm-example` prints nothing in Release: every call in `main()` of
  example/basic.cpp is inside `assert()` which `-DNDEBUG` removes. Rebuilt with asserts →
  prints `res = 3433728102`, `res = 2`, `hello`, `res = 0`.
- `maps-example` output: map_by_fd 5 / map_by_fd 6 / map_val 6 / cntrs_array[0] = 0 /
  bpf_map_lookup_elem 5 / return value = 1 / cntrs_array[0] = 1 / ... / return value = 2.
- CLI: `bpftime-vm build .github/assets/sum.bpf.o -emit-llvm` → 2182-line IR (1000 helper
  declarations: the CLI registers 1000 placeholder helpers); `opt-15 -O3` → same loop as README.
  `bpftime-vm build sum.bpf.o` → `test.o` 544 bytes, ELF64 relocatable x86-64, `bpf_main`
  is 31 bytes / 11 x86 instructions. `bpftime-vm run test.o test.bin` (input 3,1,2,3) →
  "Return value: 6". Linking `test.o` with a C `main` gives a standalone binary (returned 100
  for {4,10,20,30,40}). `bpftime-vm build` wall time 0.02 s, ~36 MB max RSS (3 runs, /usr/bin/time).
- Scratch driver (not in repo): JIT 32 insns → 31 bytes; exec = 6; AOT 544-byte object
  round-trip = 6; `generate_ptx("sm_60")` → 434-byte PTX in which the summation is gone
  (GPU entry returns void, r0 is dead; only the loop counter remains).
- Finding (BPF-to-BPF call frames): in the default (non-kernel-compatible) lift, a local call
  does `r10 = r10 - STACK_SIZE` with `STACK_SIZE = (EBPF_STACK_SIZE+7)/8 = 64` used as a byte
  count (compiler.cpp, CALL src=1 branch and `localFuncReturnBlock`). So a callee frame starts
  only 64 bytes below the caller's r10, not 512. Repro (hand-assembled, 8 insns): caller stores 7
  at r10-128, calls a subprogram that stores 99 at its r10-64, then reads r10-128 → JIT returns
  **99** (spec semantics: 7). Control: callee stores at r10-520 → returns 7. Kernel-compatible
  mode lowers local calls to external pseudo-call symbols, so it is not affected. Not reported
  upstream by me.
- Unit tests: `-DBPFTIME_ENABLE_UNIT_TESTING=1`, `llvm_jit_tests` → "All tests passed (92
  assertions in 15 test cases)".
- Not run: bpf_conformance (needs separate repo + boost), PTX on a GPU (no CUDA/GPU), SPIR-V
  (needs LLVM ≥ 18/20 + OpenCL), bpftime integration.
- `.github/assets/bpf_conformance_test.txt` (last changed 2024-08-29, f6a726c): "Passed 168 out
  of 172 tests"; FAIL le16-high, le32-high, lock_xchg, lock_xchg32; many SKIP (sdiv/smod/movsx/
  swap/ja32/callx). Stale: later commits added the v4 instructions (7728f5a, 2025-03-09) and
  fixed XCHG (18ae036, 2026-02-12). CI workflow passes `--cpu_version v4 --exclude_regex
  "lock_xchg+"` against bpf_conformance pinned at bb9f745e, then again against bpf_conformance
  `main`. Live result https://eunomia-bpf.github.io/llvmbpf/bpf_conformance_results.txt (fetched
  2026-11-06) ends "Passed 313 out of 313 tests" (includes rfc9669_* cases, sdiv/smod/movsx,
  lock_xchg, callx); the file carries no date or commit.
- Note: `case EBPF_OP_CALL | 0x8` (= 0x8d, CALLX) is lifted like a helper call using `imm`,
  with the comment "Work around for clang producing instructions that we don't support".

## Activity

Commits on main in 2026: Feb 10/11/12, Mar 6 ×3, Mar 7, Mar 11, Mar 12, Mar 30, May 25,
Sep 5, Sep 13, Sep 14, Sep 21, Oct 6, Oct 25. Authors include Officeyutong (Tong Yu),
yunwei37 (Yusheng Zheng), Sy03, LinuxDev9002, clair, 4ar0nma0, S. Reimers, Copilot.

## Papers (verified 2026-11-06)

- Y. Zheng, T. Yu, Y. Yang, Y. Hu, X. Lai, D. Williams, A. Quinn. "Extending Applications Safely
  and Efficiently". OSDI '25. https://www.usenix.org/conference/osdi25/presentation/zheng-yusheng
  (PDF https://www.usenix.org/system/files/osdi25-zheng-yusheng.pdf).
- Y. Zheng, T. Yu, Y. Yang, Y. Hu, X. Lai, A. Quinn. "bpftime: userspace eBPF Runtime for Uprobe,
  Syscall and Kernel-User Interactions". arXiv:2311.07923 (2023). https://arxiv.org/abs/2311.07923
- Y. Yang et al. "eGPU: Extending eBPF Programmability and Observability to GPUs". HCDS '25
  (4th Workshop on Heterogeneous Composable and Disaggregated Systems), ACM.
  https://doi.org/10.1145/3723851.3726984 — compiles eBPF to PTX at runtime. Full author list
  not checked beyond first author.
- gpu_ext: "Extensible OS Policies for GPUs via eBPF", arXiv:2512.12615 — mentions an LLVM-based
  backend (~1 KLOC) translating eBPF to PTX, built on bpftime. (Chapter 20.)
- No paper specific to llvmbpf was found.

## Comparison sources

- ubpf README (https://github.com/iovisor/ubpf): Apache-2.0, C; interpreter on all platforms,
  JIT for x86-64 and Arm64; new "Safe" profile is interpreter-only.
- rbpf README (https://github.com/qmonnet/rbpf): Rust, interpreter + x86_64 JIT + disassembler,
  based on uBPF; very simple verifier; memory checks only in interpreter; JIT "will crash" on
  bad accesses.
- Kernel JITs: see chapter 02 (per-arch, `arch/*/net/`, single pass emitters after verifier).

## bpftime verifier default (checked 2026-11-06, bpftime @ 25e250d6)

`runtime/include/bpftime_config.hpp`: `BPFTIME_VERIFIER_WARNING = 0` is "(default)" — "Program
loading continues even if verification fails"; `BPFTIME_VERIFIER_STRICT = 1`; `BPFTIME_NO_VERIFY
= 2`. Selected by env `BPFTIME_VERIFIER_LEVEL=STRICT|WARNING|NO_VERIFY`
(`runtime/src/bpftime_config.cpp:137`). So llvmbpf code is not guaranteed verified by default.
