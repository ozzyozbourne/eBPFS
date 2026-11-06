# Potential bugs found in eunomia-bpf repositories, and how to verify them

While writing and reviewing this curriculum (November 2026), agents found possible bugs in several upstream
eunomia-bpf repositories. The orb used to write the curriculum could not run much of the code (Linux 6.1
x86-64, no BPF JIT, no GPU/CUDA, no patched kernels, no Kubernetes), so many findings are from reading the
code. This report hands them off so a later agent, or a person with the right machine, can confirm or refute
each one.

None of these has been reported upstream by us. Every cited file was byte-identical on the repository's
default branch when this was written (2026-11-06), so none had been fixed yet.

## How to use this report

1. Pick an entry from the summary table. Its **Status** says how strong the evidence is:
   - **Reproduced in orb**: we ran it and saw the bug. Re-running confirms it still holds on your setup.
   - **Code reading only**: inferred from source; nobody has run it. This is where verification matters most.
   - **Observed, cause unknown**: we saw a symptom but did not find why.
   - **Already reported upstream**: an issue or PR exists; just check its state.
2. Check the entry's **Environment needed** first. Many need a JIT-enabled kernel, a GPU, a patched kernel,
   or a specific arch.
3. Check whether it is still present: compare the cited file on the current default branch (each entry gives
   the `gh api` command), and search upstream issues with the keywords given.
4. Follow the **Verify** steps. Each entry states the result to expect if the bug is real and if it is not.
   Repro programs are written inline; most were hand-written and are marked when they have not been compiled.
5. Record the outcome. Update the entry's status here (and the chapter callout that mentions it) to
   **Confirmed on <env, date>** or **Refuted on <env, date>**, with the output. If confirmed and not yet
   reported, open an upstream issue and link it here.

## Summary

| ID | Repo | Finding | Status | Needs to verify | Chapter |
|----|------|---------|--------|-----------------|---------|
| A1 | llvmbpf | BPF-to-BPF call frames overlap (`STACK_SIZE` used as bytes) | Reproduced in orb (earlier) | LLVM 15+ dev, build llvmbpf | 16 |
| A2 | llvmbpf | Runtime div/mod by zero and `INT64_MIN / -1` kill the host with SIGFPE | Reproduced in orb (earlier) | LLVM 15+ dev, x86-64 | 16 |
| A3 | bpftime | PREVAIL skips libbpf uprobe programs (KPROBE type) even at `STRICT` | Code reading only | bpftime built with `ENABLE_EBPF_VERIFIER` | 14, 15 |
| A4 | bpftime | PID given to `perf_event_open` is ignored when attaching a uprobe | Code reading only | bpftime build, two target processes | 14 |
| A5 | bpftime | zpoline page 0 is readable without PKU, so NULL reads don't fault | Reproduced in orb (kernel/CPU behaviour) | x86-64 without `pku`; optional bpftime run | 14 |
| A6 | ebpf-correctness-verifier | Unknown opcodes dropped (false PASS), signed DIV, inputs bounded to ±1024 | Reproduced in orb | Z3, repo build | 18 |
| A7 | nccl-eBPF | Rank-agreement checker accepts `agreed_map` lookups with rank-local keys | Reproduced (checker only) | g++ C++20; NCCL + GPUs for end-to-end | 21 |
| A8 | bpf-compatible / bpf-loader-rs | Archive checked before kernel BTF; weak-symbol length; `aarch64`/`8.4` key mismatch; README names | Code reading + small checks | arm64 or RHEL host, kernel not in archive | 13 |
| A9 | wasm-bpf | SDK `map_operate` i64 vs i32 ABI; Rust runtime keeps last record per poll; swapped `Config::default()` names | Code reading only | Rust toolchain, wasmtime runtime build | 12 |
| A10 | ActPlane | `doctor` misses missing JIT; `kill` documented as pre-op deny but LSM path only evaluates `block` | A10a reproduced, A10b code reading | Kernel with BPF LSM and JIT | 24 |
| B1 | agentcgroup | Wrapper move into `session_high` fails (EBUSY), `tool_*` cgroups leak; memcg filter never matches children; `PGFAULT = 23` wrong on some kernels; PR #11 parser | B1a reproduced, B1b code reading, B1c checked, B1d already reported | cgroup v2 host; patched memcg kernel for B1b | 25 |
| B2 | namei_ext | HIDE does not cover unlink/rmdir/mkdir/rename | Code reading only | Patched kernel in the repo's KVM VM | 28 |
| B3 | xpu-perf | GPU time counted twice; leaf-only CPU stacks on 6.1; stale `-gpu-only` docs | B3a code reading, B3b observed, B3c reproduced | NVIDIA GPU + CUDA; newer kernel | 22 |
| B4 | libbpf-starter-template, libbpf-rs-starter-template | Header edits don't rebuild; `make` not `$(MAKE)`; bad digest step id; pid/tid swapped; missing `make install` | Mostly reproduced | clang, libbpf; Rust for B4d | 11 |
| B5 | eunomia-bpf (ecc/ecli) | ecc v1.0.38 glibc failure; webui packages rejected; README mismatches; 404 example URLs | Mostly reproduced; B5b not reproduced | Any Linux x86-64 | 10 |
| B6 | schedcp, GPTtrace | Two sudo password variables; 3 ms comment on a 30 ms value; `gpttrace -c` argparse | B6c reproduced, others code reading | sched_ext kernel for B6a/B6b | 30 |
| B7 | akeep | `--provider` rejects `agentsight` (the README spelling) | Observed earlier; confirmed in source | Rust toolchain | 27 |
| B8 | bpf-developer-tutorial | Lesson 44 uses pre-6.13 sched_ext kfunc names; CI job broken | Code reading + kernel source; CI already reported (PR #236) | Kernel ≥ 6.17 with sched_ext | 09 |
| B9 | qwen3-ebpf | `make test` fails to compile against libbpf 1.1 | Reproduced in orb | libbpf 1.1 vs ≥ 1.2 | 29 |

The detailed entries follow, in three parts. Each part starts with the environment it was written in.

## Upstream bug hand-off, part A1 (A1–A5: llvmbpf and bpftime)

Written 2026-11-06 from an Amp orb: Linux 6.1.189+ x86-64, Debian 12 userland, clang/LLVM 14.0.6 installed.
llvmbpf is **not** built in this orb now (no `src/llvmbpf/build`), so A1/A2 were not re-run while writing this.
The "reproduced" results below come from the earlier ch16 work and the part-3 review (`eBPFS/reviews/part3.md`
L21, L120, L136–137). Both used LLVM 15.0.6 on x86-64 with scratch drivers that were deleted afterwards.

Conventions:
- Paths are relative to the clone under `/home/user/workspace/src/<repo>` unless they start with a URL.
- "Upstream default branch" was checked with `gh api repos/eunomia-bpf/<repo>/contents/<path> --jq .sha` and
  compared with `git rev-parse HEAD:<path>` in the clone. "Same blob" means the file is byte-identical upstream today.
- Issue/PR searches used `gh issue list` / `gh pr list -R <repo> --search <kw> --state all`. "None found" means no
  relevant hit for the keywords listed.
- Status values: **Reproduced in orb**, **Code reading only**.

Commits studied:

| Repo | Commit (clone HEAD) | Default branch HEAD today |
|---|---|---|
| eunomia-bpf/llvmbpf | `7e384dbb1c8a` | `main` = same (`7e384dbb…`, 2026-10-25) |
| eunomia-bpf/bpftime | `25e250d651ad` | see A3–A5 |

Shared llvmbpf driver for A1/A2 (illustrative, not from the repo). It uses the public API in
`include/llvmbpf.hpp` (`load_code` L74, `exec` L83, namespace `bpftime`). `r1` is the `mem` pointer.

```cpp
// /tmp/drv.cpp : ./drv <hex-program> [u64 a] [u64 b]
#include "llvmbpf.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
using namespace bpftime;
int main(int argc, char **argv) {
  std::vector<unsigned char> code;
  for (const char *p = argv[1]; p[0] && p[1]; p += 2) { char b[3] = {p[0], p[1], 0}; code.push_back(strtoul(b, 0, 16)); }
  uint64_t mem[2] = { argc > 2 ? strtoull(argv[2], 0, 0) : 0, argc > 3 ? strtoull(argv[3], 0, 0) : 0 };
  llvmbpf_vm vm;
  if (vm.load_code(code.data(), code.size())) { puts("load failed"); return 2; }
  uint64_t ret = 0;
  if (vm.exec(mem, sizeof(mem), ret)) { puts("exec failed"); return 3; }
  printf("ret=%lld\n", (long long)ret);
}
```

Build (needs LLVM 15+ dev packages, e.g. `llvm-15-dev`; any recent LLVM that llvmbpf's CMake accepts):

```bash
cd /home/user/workspace/src/llvmbpf
cmake -B build -DCMAKE_BUILD_TYPE=Release   # add -DLLVM_DIR=/usr/lib/llvm-15/lib/cmake/llvm if needed
cmake --build build --target llvmbpf_vm -j"$(nproc)"
# static lib lands at build/libllvmbpf_vm.a (CMakeLists.txt:46); find any spdlog/LLVM link deps it needs:
g++ -std=c++17 -Iinclude /tmp/drv.cpp build/libllvmbpf_vm.a $(llvm-config-15 --ldflags --libs --system-libs) -o /tmp/drv
# If the link line is awkward, add drv.cpp as a target next to vm-llvm-example in example/CMakeLists.txt instead.
```

---

### A1. llvmbpf: BPF-to-BPF call frames overlap, because `STACK_SIZE` (64 slots) is subtracted from `r10` as bytes

Curriculum sources: `eBPFS/chapters/16-llvmbpf.html` L224–225 (constants), L501–510 ("Observed bug" callout);
`eBPFS/reviews/part3.md` L21.

Repo: eunomia-bpf/llvmbpf @ `7e384dbb1c8af0b78e8ae58d2bfb304580ff1e27`.

- **Code:**
  - `src/compiler.cpp:42` is `const int STACK_SIZE = (EBPF_STACK_SIZE + 7) / 8;`, which is 64 (`EBPF_STACK_SIZE` is
    512, `src/llvm_jit_context.hpp:33`). This is a count of 8-byte slots.
  - `src/compiler.cpp:399–405`: in the default (non-kernel-compatible, non-GPU) mode the stack is
    `alloca i64 × (STACK_SIZE * MAX_LOCAL_FUNC_DEPTH + 10)`, and `:413–417` puts `stackEnd` at i64 index
    `STACK_SIZE * MAX_LOCAL_FUNC_DEPTH`. So the buffer is sized as 32 frames of 512 bytes.
  - `src/compiler.cpp:1451–1457` (local call, "r10 -= stackSize") does `r10 = r10 - getInt64(STACK_SIZE)`, a
    **byte** subtraction of 64. `:543–550` in `localFuncReturnBlock` (created at `:509`) adds 64 back.
- **Status: Reproduced in orb** earlier (ch16 work, and again during the part-3 review with LLVM 15.0.6). It was
  not re-run while writing this hand-off, because llvmbpf is not built now.
- **Claim:** a callee's `r10` is only 64 bytes below the caller's. Any callee access deeper than `r10-0..-64`
  overwrites the caller's frame. In the eBPF spec (and the kernel), each BPF-to-BPF frame owns its own 512 bytes.
  Kernel-compatible mode is not affected, because it lowers local calls to external symbols (ch16).
- **Why it matters:** clang emits BPF-to-BPF calls for any non-inlined `static __noinline` function. A
  subprogram with more than 64 bytes of locals then silently corrupts its caller's locals. The bug is silent
  memory corruption, not a crash. bpf_conformance's `call_local` / `rfc9669_call_local` tests do not touch the
  stack, so they pass.
- **Environment:** any x86-64 or arm64 Linux with LLVM 15+ dev packages to build llvmbpf. No kernel features or
  root needed.
- **Verification:** build the shared driver above, then run this 8-instruction program:
  ```
  0: b7 01 00 00 07 00 00 00   mov r1, 7
  1: 7b 1a 80 ff 00 00 00 00   stxdw [r10-128], r1
  2: 85 10 00 00 02 00 00 00   call local +2      (src=1 pseudo-call -> insn 5)
  3: 79 a0 80 ff 00 00 00 00   ldxdw r0, [r10-128]
  4: 95 00 00 00 00 00 00 00   exit
  5: b7 01 00 00 63 00 00 00   mov r1, 99
  6: 7b 1a c0 ff 00 00 00 00   stxdw [r10-64], r1  (callee's own frame)
  7: 95 00 00 00 00 00 00 00   exit
  ```
  ```bash
  P=b7010000070000007b1a80ff00000000851000000200000079a080ff00000000
  P=${P}9500000000000000b7010000630000007b1ac0ff000000009500000000000000
  /tmp/drv $P                      # bug: ret=99   spec: ret=7
  # control: callee stores at r10-520 (insn 6 = 7b 1a f8 fd ...): returns 7 with the bug present
  /tmp/drv ${P/7b1ac0ff/7b1af8fd}
  ```
  As a regression test, the same bytes can go into a `test/unit-test/vm_test.cpp` case (expect 7), or into a
  `test/test-cases/*.data` file in bpf_conformance format (`-- asm` / `-- result 0x7`).
- **Result earlier:** 99 for the main program and 7 for the `r10-520` control, at `7e384db` (LLVM 15.0.6).
- **If real:** `ret=99`. **If not real:** `ret=7`.
- **Minimal fix (suggestion):** subtract and add bytes at both sites: `builder.getInt64(STACK_SIZE * 8)` at
  `src/compiler.cpp:1456` and `:549` (or use `EBPF_STACK_SIZE` there). The alloca at `:399–405` already reserves
  `STACK_SIZE * MAX_LOCAL_FUNC_DEPTH` i64s = 32 × 512 bytes, so no resizing is needed. Separately, check that call
  depth is bounded by `MAX_LOCAL_FUNC_DEPTH`; after the fix, overflowing that depth would run off the alloca.
- **Upstream today:** `src/compiler.cpp` is the same blob on `main` (`a82c28a5…`); the default-branch HEAD is
  the studied commit. **Issue/PR:** none found (searched stack, "local call", frame, r10, STACK_SIZE; #51
  matched "local call" but is about `LLVM_DEFINITIONS` in CMake).

### A2. llvmbpf: run-time divide/modulo by zero and `INT64_MIN / -1` kill the host with SIGFPE

Curriculum sources: `eBPFS/chapters/16-llvmbpf.html` L423–432 ("Observed bug (found in review)"), L1325;
`eBPFS/reviews/part3.md` L120 (finding 16.1), L136–137.

Repo: eunomia-bpf/llvmbpf @ `7e384dbb1c8af0b78e8ae58d2bfb304580ff1e27`.

- **Code:**
  - DIV: `src/compiler.cpp:667–670` (`EBPF_OP_DIV*`). For signed overflow, `:714–720` is
    `CreateSelect(overflow_cond, INT64_MIN, CreateSDiv(dst, src))`, and `:723` and `:748–753` emit
    `CreateUDiv`/`CreateSDiv` unconditionally. The zero guard at `:759–760` is
    `CreateSelect(src_is_zero, zero, result)`, applied after the division has been emitted.
  - MOD: `src/compiler.cpp:841–844` (`EBPF_OP_MOD*`). `:850–870` is
    `CreateSelect(src == 0, dst_val, is_smod ? CreateSRem(...) : CreateURem(dst_val, src_val))`.
- **Status: Reproduced in orb** earlier (part-3 review, LLVM 15.0.6, x86-64, at `-O3` default and `-O0`). It
  was not re-run while writing this hand-off, because llvmbpf is not built now.
- **Claim:** a `select` does not short-circuit, because both operands are computed. `udiv`/`sdiv`/`urem`/`srem`
  with a zero divisor, or `sdiv`/`srem` of `INT64_MIN` by -1, is immediate UB in LLVM IR, and x86-64
  `div`/`idiv` raises #DE → `SIGFPE`. The eBPF spec defines these cases (div by 0 → 0, mod by 0 → dst unchanged,
  `INT64_MIN / -1` → `INT64_MIN`). When the divisor is a compile-time constant 0 (`mov r1, 0; div r0, r1`), LLVM
  folds the expression and returns 0, so bpf_conformance's `*-by-zero-reg` tests pass.
- **Why it matters:** a single eBPF program whose divisor comes from runtime data (packet, ctx, map) crashes the
  host process. Inside bpftime that is the traced application. The kernel verifier does not reject run-time zero
  divisors, because the kernel defines the result, so verified programs are affected too.
- **Environment:** x86-64 Linux with LLVM 15+ dev packages to build llvmbpf. On arm64, `udiv`/`sdiv` by 0
  return 0 in hardware, so the symptom differs (not tested). It may still be miscompiled, because the
  optimiser may exploit the UB.
- **Verification:** build the shared driver above. Programs read `a` from `[r1+0]` and `b` from `[r1+8]`:
  ```
  0: 79 10 00 00 00 00 00 00   ldxdw r0, [r1+0]
  1: 79 12 08 00 00 00 00 00   ldxdw r2, [r1+8]
  2: OP 20 OFF 00 00 00 00 00  div64/mod64 r0, r2   (OP: 3f = div64 reg, 9f = mod64 reg; OFF 01 = signed)
  3: 95 00 00 00 00 00 00 00   exit
  ```
  ```bash
  H=79100000000000007912080000000000; X=9500000000000000
  /tmp/drv ${H}3f20000000000000$X 10 0;  echo "udiv/0 rc=$?"     # bug: SIGFPE (rc 136)  spec: ret=0
  /tmp/drv ${H}9f20000000000000$X 10 0;  echo "umod/0 rc=$?"     # bug: SIGFPE           spec: ret=10
  /tmp/drv ${H}3f20010000000000$X 10 0;  echo "sdiv/0 rc=$?"     # bug: SIGFPE           spec: ret=0
  /tmp/drv ${H}3f20010000000000$X 0x8000000000000000 0xffffffffffffffff; echo "INT64_MIN/-1 rc=$?"
                                                                  # bug: SIGFPE           spec: ret=INT64_MIN
  /tmp/drv ${H}3f20000000000000$X 10 3;  echo "control rc=$?"    # ret=3 either way
  ```
  Also try the 32-bit forms (`3c`/`9c`). They were not tested earlier.
- **Result earlier:** 64-bit udiv/0, umod/0, sdiv/0 and `INT64_MIN / -1` all killed the process with SIGFPE at
  `-O3` and `-O0`. Non-zero divisors returned correct results. A constant-zero divisor returned 0.
- **If real:** the process dies with SIGFPE (shell rc 136). **If not real:** it prints the spec values above.
- **Minimal fix (suggestion):** make the divisor safe before dividing, e.g. `safe = select(src == 0, 1, src)`,
  and for signed ops also `select(dst == INT64_MIN && src == -1, 1, safe)`. Then keep the existing outer
  `select`s for the result. The alternative is real branches (`CreateCondBr`) around the division. Apply it to
  both the DIV (`:667–764`) and MOD (`:841–870`) cases and to the 32-bit variants. Add `*-by-zero` tests
  whose divisor comes from memory.
- **Upstream today:** `src/compiler.cpp` is the same blob on `main` (`a82c28a5…`). **Issue/PR:** none found
  (searched division, div, "divide by zero", zero, SIGFPE).

### A3. bpftime: PREVAIL verification skips libbpf uprobe programs (loaded as `BPF_PROG_TYPE_KPROBE`), even at `STRICT`

Curriculum sources: `eBPFS/chapters/14-bpftime-architecture.html` L1226–1267 ("Userspace: PREVAIL" tab, third
caveat); `eBPFS/reviews/part3.md` L103 (15.2), L122 (16.3), L135.

Repo: eunomia-bpf/bpftime @ `25e250d651ad1d2a2608bbbaeaf7b9ee90cca401`. libbpf checked at `src/libbpf` @
`872299d` (bpftime's `third_party/libbpf` submodule is not checked out in this clone).

- **Code:**
  - `runtime/syscall-server/syscall_context.cpp:641–649` (BPF_PROG_LOAD handler): the comment says
    "uprobe/uretprobe -> BPF_PROG_TYPE_SOCKET_FILTER". `simple_section_name` is set only for
    `BPF_PROG_TYPE_TRACEPOINT` (`:644`) and `BPF_PROG_TYPE_SOCKET_FILTER` (`:646–648`).
  - `:650–658`: under `#ifdef ENABLE_BPFTIME_VERIFIER`, `verify_ebpf_program()` runs only if
    `simple_section_name.has_value()`. `:670–678` is the STRICT reject path (`errno = EINVAL; return -1`). This
    is the only call site of `verify_ebpf_program` outside the verifier itself and its README
    (`rg -n verify_ebpf_program`).
  - libbpf `src/libbpf.c:10845` is `SEC_DEF("uprobe+", KPROBE, 0, SEC_NONE, attach_uprobe)`, so a libbpf program
    with `SEC("uprobe/...")` reaches BPF_PROG_LOAD with `prog_type = BPF_PROG_TYPE_KPROBE` (6). `uretprobe+` is
    also KPROBE in the same table.
  - `bpftime-verifier/src/platform-impl.cpp:18–26`: the platform only knows `uprobe`/`uretprobe`/`tracepoint`
    sections and throws "Unsupported section by bpftime" otherwise.
  - Verifier build switch: `cmake/StandardSettings.cmake:95` `ENABLE_EBPF_VERIFIER` defaults to OFF.
    `runtime/syscall-server/CMakeLists.txt:60` defines `ENABLE_BPFTIME_VERIFIER` when it is ON.
- **Status: Code reading only.** bpftime was not built (too large for the orb; `reviews/part3.md` L135).
- **Claim:** with a verifier-enabled build and `BPFTIME_VERIFIER_LEVEL=STRICT`, a normal libbpf uprobe or
  uretprobe program (`prog_type` KPROBE) is never passed to PREVAIL and loads even if it is unsafe. Only programs
  loaded as TRACEPOINT or SOCKET_FILTER are verified.
- **Why it matters:** uprobes are bpftime's main use case. Docs and ch15 tell users to set `STRICT` for safety,
  but that setting does nothing for the common program type. The unverified program runs inside the traced
  process.
- **Environment:** an x86-64 Linux host that can build bpftime with `-DENABLE_EBPF_VERIFIER=ON` (submodules
  `third_party/libbpf`, `bpftool`, `bpftime-verifier/ebpf-verifier` checked out; several GB RAM; clang/LLVM dev
  packages per `installation.md`). Root, or the usual bpftime setup, is needed to load programs.
- **Verification:**
  ```bash
  cd bpftime && git submodule update --init --recursive
  cmake -B build -DCMAKE_BUILD_TYPE=Release -DENABLE_EBPF_VERIFIER=ON -DBUILD_BPFTIME_DAEMON=OFF
  cmake --build build --target install -j"$(nproc)"        # installs to ~/.bpftime
  nm -D ~/.bpftime/libbpftime-syscall-server.so | grep -i verify   # must show verifier symbols
  ```
  Make an unsafe uprobe program by copying `example/malloc` and changing the BPF side, e.g.:
  ```c
  SEC("uprobe/libc.so.6:malloc")
  int BPF_UPROBE(do_count, size_t size) {
      return *(volatile long *)(long)0xdeadbeef;   // PREVAIL rejects this (non-ctx, non-stack pointer deref)
  }
  ```
  ```bash
  # 1) as libbpf loads it (prog_type KPROBE)
  sudo SPDLOG_LEVEL=debug BPFTIME_VERIFIER_LEVEL=STRICT ~/.bpftime/bpftime load ./malloc 2>&1 | tee /tmp/a3.log
  grep -E 'Verifying program|Failed to verify' /tmp/a3.log    # bug: no hits, and the loader proceeds to attach
  # 2) control: force SOCKET_FILTER so the check fires. Before bpf_object__load(), add
  #    bpf_program__set_type(skel->progs.do_count, BPF_PROG_TYPE_SOCKET_FILTER); rebuild and rerun the same command.
  #    Expect "Failed to verify program `do_count`" and a load failure with EINVAL.
  ```
  If `SPDLOG_LEVEL` is not honoured, check the log setup in `runtime/src/bpftime_config.cpp` (L137 reads
  `BPFTIME_VERIFIER_LEVEL`, L158 reads `BPFTIME_LOG_OUTPUT`). A load that succeeds in (1) already proves the claim.
- **If real:** (1) loads with no "Verifying program" line, and (2) is rejected. **If not real:** (1) is rejected
  with "Failed to verify program".
- **Minimal fix (suggestion):** in `syscall_context.cpp:644–649`, also map `BPF_PROG_TYPE_KPROBE` to `"uprobe"`
  (bpftime has no real kprobes in user space; a ret-probe flag is not visible at load time, but the uprobe and
  uretprobe contexts are the same `pt_regs`). Better still, verify every program type that bpftime can run, and
  in STRICT mode reject types the verifier cannot describe instead of silently skipping them.
- **Upstream today:** `runtime/syscall-server/syscall_context.cpp` is the same blob on `master` (`efc67a1b…`);
  the default-branch HEAD is the studied commit. **Issue/PR:** related, open **#699** "[FEATURE] kprobe probes
  bypass the verifier on load — no memory-safety validation" (2026-10-09). It names the same trigger at
  `syscall_context.cpp` and the platform-impl limitation, but frames it around kprobe/GPU probes. It does not say
  that ordinary libbpf `SEC("uprobe")` programs are KPROBE-typed and also skip verification, so add that as a
  comment there rather than opening a new issue. #313 (open) asks why the code assumes uprobe → SOCKET_FILTER.
  Searched verifier, PREVAIL, BPF_PROG_TYPE_KPROBE, "KPROBE verifier".

### A4. bpftime: the PID passed to `perf_event_open` is stored but not used when an agent attaches a uprobe

Curriculum sources: `eBPFS/chapters/14-bpftime-architecture.html` L713–720 ("In my reading, the PID that
libbpf passed to `perf_event_open()` is stored in the handler but not used here"); `eBPFS/reviews/part3.md` L55.

Repo: eunomia-bpf/bpftime @ `25e250d651ad1d2a2608bbbaeaf7b9ee90cca401`.

- **Code:**
  - `runtime/syscall-server/syscall_context.cpp:806` `handle_perfevent(perf_event_attr *attr, pid_t pid, ...)`.
    It forwards `pid` to `bpftime_uprobe_create(...)` at `:837` and to `bpftime_add_ureplace_or_override(...)` at
    `:915` / `:925`.
  - `runtime/src/bpftime_shm_internal.cpp:349` `add_uprobe(int fd, int pid, ...)` stores it.
    `runtime/src/handler/perf_event_handler.cpp:160–170` and `:177–189` put it in
    `uprobe_perf_event_data{.offset, .pid, ._module_name}` (struct at `runtime/src/handler/perf_event_handler.hpp:161–166`).
  - Agent side: `runtime/src/attach/bpf_attach_ctx.cpp:420` `instantiate_perf_event_handler_at()`, `:441–452`.
    For UPROBE/URETPROBE/UPROBE_OVERRIDE/UREPLACE it builds `arg_str = _module_name + ':' + offset` and passes only
    that to `private_data_gen`. `uprobe_data.pid` is not read. `rg -n 'uprobe_data\.pid|\.pid\b' runtime/src/attach
    attach` finds no hits. The only `pid` checks in `attach/frida_uprobe_attach_impl/src/frida_attach_utils.cpp`
    (`:31`, `:72–79`) compare `/proc/<pid>/map_files/...` paths against `getpid()` and are about path resolution,
    not filtering.
- **Status: Code reading only.**
- **Claim:** a uprobe attached with a specific PID (`bpf_program__attach_uprobe_opts(prog, PID, ...)`) fires in
  **every** process that runs the bpftime agent and maps the module. The handler table is in global shared
  memory (ch14 L713–716), so every agent instantiates every link. Kernel semantics restrict the probe to that
  process (pid ≥ 0) or allow all (pid = -1).
- **Why it matters:** a tool that scopes a probe to one PID (most libbpf tools have `-p PID`) silently traces,
  and with `UPROBE_OVERRIDE`/`UREPLACE` *modifies*, other agent-injected processes. That is a correctness and
  isolation problem.
- **Environment:** x86-64 Linux that can build bpftime (default options are enough; the verifier is not
  needed). Run as root or with the usual bpftime shm permissions.
- **Verification:** use `example/malloc` (its BPF side already counts per caller PID in
  `libc_malloc_calls_total`, `malloc.bpf.c:32–36`):
  ```bash
  cd bpftime && git submodule update --init --recursive
  cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j"$(nproc)"
  make -C example/malloc
  # point the link at a PID that is NOT the victim (malloc.c:103-104 passes -1 today):
  sed -i 's/skel->progs.do_count, -1,/skel->progs.do_count, atoi(getenv("TARGET_PID")),/' example/malloc/malloc.c
  make -C example/malloc        # add #include <stdlib.h> to malloc.c if needed
  # README order (L63 then L69): loader first, then the victim under the agent
  sudo TARGET_PID=1 LD_PRELOAD=build/runtime/syscall-server/libbpftime-syscall-server.so example/malloc/malloc &
  sleep 2
  sudo LD_PRELOAD=build/runtime/agent/libbpftime-agent.so example/malloc/victim & V=$!
  sleep 5; pgrep -f example/malloc/victim   # victim PID(s); compare with the loader's per-PID lines
  # control: rerun with TARGET_PID set to the victim's PID (start the victim with a known PID via a wrapper
  # that execs after printing $$), or with -1. Counts should appear in both cases.
  ```
- **If real:** the loader prints `pid=<victim>` counts even though the link targets another PID (or PID 1).
  **If not real:** no counts appear for PIDs other than `TARGET_PID`.
- **Minimal fix (suggestion):** in `instantiate_perf_event_handler_at()` (`bpf_attach_ctx.cpp:441–452`), skip
  the handler when `uprobe_data.pid >= 0 && uprobe_data.pid != getpid()` (return 0, the same "not an error"
  path used for unmapped modules). Pay attention to the TGID vs TID distinction: perf's pid is a TID-or-TGID.
  Compare with the process TGID for the common libbpf case, as PR #651 did for the daemon.
- **Upstream today:** `runtime/src/attach/bpf_attach_ctx.cpp` (`6e18114b…`) and
  `runtime/src/handler/perf_event_handler.cpp` (`033c4e9c…`) are the same blobs on `master`. **Issue/PR:** none
  found (searched "pid filter", "perf_event_open pid", "uprobe pid", "attach all processes"). Merged PR #651
  "Fix daemon PID filtering to use TGID" concerns the kernel-mode daemon, not the agent path.

### A5. bpftime: zpoline page 0 is "execute-only", but on x86-64 without PKU it is still readable, so NULL reads don't fault

Curriculum sources: `eBPFS/chapters/14-bpftime-architecture.html` L993 (figure label "page 0 (PROT_EXEC only)"),
L1066–1077 (quoted code), L1088–1096 (limitation bullet), L1725.

Repo: eunomia-bpf/bpftime @ `25e250d651ad1d2a2608bbbaeaf7b9ee90cca401`.

- **Code:** `attach/text_segment_transformer/text_segment_transformer.cpp:237–239` maps
  `mmap(0x0, 0x1000, PROT_EXEC | PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_FIXED | MAP_ANONYMOUS, -1, 0)` and
  fills it with the nop sled and trampoline (`:274–276` copies the jump code to `0 + NR_syscalls`). `:277–279`:
  "Set the page to execute-only. Keep normal behavior of dereferencing null-pointers", then
  `mprotect(0, 0x1000, PROT_EXEC)`.
- **Status: Reproduced in orb** (re-run 2026-11-06 while writing this). Linux 6.1.189+, "Intel(R) Xeon(R)
  Processor @ 2.60GHz" with no `pku`/`ospke` flag in `/proc/cpuinfo`. This tests the kernel/CPU behaviour that
  bpftime relies on with a standalone program, not bpftime itself.
- **Claim:** on x86-64, `PROT_EXEC` without `PROT_READ` only becomes execute-only when the kernel can back it with
  a protection key (CPU `pku` + `ospke`). Otherwise x86 page tables have no "executable but not readable" state,
  so the page stays readable. In a bpftime-injected process, a NULL (or small-offset, < 4096) **read** then returns
  sled bytes (`0x90`) instead of raising SIGSEGV. Writes still fault.
- **Why it matters:** the source comment promises normal NULL-deref behaviour. Without PKU, NULL-pointer reads
  in the traced application turn silently into garbage values, which hides bugs and changes crash behaviour.
  This is partly inherent to zpoline, but the comment and docs overstate the guarantee.
- **Environment:** x86-64 Linux, root to set `vm.mmap_min_addr=0`. Use one CPU **without** PKU (most VMs, older
  Intel, many AMD before Zen 3) and, as a control, one **with** `pku` and `ospke` in `/proc/cpuinfo` (Skylake-SP+
  servers, Zen 3+) where the kernel supports execute-only pkeys.
- **Verification:**
  ```c
  // a5.c
  #include <stdio.h>
  #include <stdlib.h>
  #include <string.h>
  #include <signal.h>
  #include <setjmp.h>
  #include <sys/mman.h>
  static sigjmp_buf jb;
  static void h(int s) { siglongjmp(jb, s); }
  int main(int argc, char **argv) {
    unsigned long a = argc > 1 ? strtoul(argv[1], 0, 0) : 0;
    void *p = mmap((void *)a, 0x1000, PROT_READ | PROT_WRITE | PROT_EXEC,
                   MAP_PRIVATE | MAP_FIXED | MAP_ANONYMOUS, -1, 0);   // as bpftime :237-239
    if (p == MAP_FAILED) { perror("mmap"); return 1; }
    memset(p, 0x90, 0x1000);                                            // nop sled
    if (mprotect(p, 0x1000, PROT_EXEC)) { perror("mprotect"); return 1; } // as bpftime :279
    signal(SIGSEGV, h);
    if (!sigsetjmp(jb, 1)) printf("read  %#lx -> 0x%02x (no fault)\n", a, *(volatile unsigned char *)p);
    else printf("read  %#lx -> SIGSEGV\n", a);
    if (!sigsetjmp(jb, 1)) { *(volatile unsigned char *)p = 1; printf("write %#lx -> no fault\n", a); }
    else printf("write %#lx -> SIGSEGV\n", a);
  }
  ```
  ```bash
  grep -o -w -m1 -e pku -e ospke /proc/cpuinfo | sort -u     # record whether PKU is present
  gcc -O1 -o a5 a5.c
  ./a5 0x10000                                    # same semantics at a non-zero address, no sysctl needed
  old=$(cat /proc/sys/vm/mmap_min_addr); sudo sysctl -q vm.mmap_min_addr=0; ./a5 0; sudo sysctl -q vm.mmap_min_addr=$old
  ```
  End-to-end (optional, needs a bpftime build with the syscall-trace/zpoline attach): run a target that does
  `volatile char *n = 0; printf("%d\n", n[0x10]);` under `bpftime start -s` and check whether it prints `-112`
  (0x90 as signed char) instead of segfaulting.
- **Result here:** `read 0x10000 -> 0x90 (no fault)`, `write 0x10000 -> SIGSEGV`, `read 0 -> 0x90 (no fault)`,
  `write 0 -> SIGSEGV`. `vm.mmap_min_addr` was restored to 4096 afterwards.
- **If real (no PKU):** the read succeeds with `0x90` and the write faults. **On a PKU host:** both fault, so the
  bug only exists on non-PKU hardware. If a PKU host also reads successfully, the "execute-only" path is not being
  used at all.
- **Minimal fix (suggestion):** this cannot be fully fixed in page tables on non-PKU x86. At least: fix the source
  comment and docs to say NULL reads only fault with PKU, and log a warning at setup when
  `pkey_alloc(0, PKEY_DISABLE_ACCESS)` fails or `/proc/cpuinfo` lacks `ospke`. Optionally use an explicit
  `pkey_mprotect(0, 0x1000, PROT_EXEC, pkey)` with an access-disabled pkey, so the intent does not depend on the
  kernel's implicit execute-only pkey.
- **Upstream today:** `attach/text_segment_transformer/text_segment_transformer.cpp` is the same blob on
  `master` (`cf12a62c…`). **Issue/PR:** none found (searched execute-only, mmap_min_addr, "null pointer",
  "page 0", PROT_EXEC, zpoline).

## Upstream bug hand-off, part A2 (A6–A10)

Written 2026-11-06 from an Amp orb: Linux 6.1.189+ x86-64, no BPF JIT, no GPU/CUDA, Debian 12 userland
(clang 14, Z3 4.8.12 per reviews/part4.md).

Conventions (same as part B):
- Paths are relative to the clone under `/home/user/workspace/src/<repo>` unless they start with a URL.
- "Upstream default branch" was checked with `gh api repos/<owner>/<repo>/contents/<path> --jq .sha`, compared
  with `git rev-parse HEAD:<path>` in the clone. "Same blob" means the file is byte-identical upstream today.
- Issue searches used `gh issue list -R <repo> --search <kw> --state all`. "None found" means no relevant hit for
  the keywords listed.
- Status values: **Reproduced in orb**, **Code reading only**, **Observed, cause unknown**,
  **Already reported upstream**.

---

### A6. ebpf-correctness-verifier: unmodelled opcodes are silently dropped (false PASS), DIV is signed, input bounded to ±1024

Curriculum sources: `eBPFS/chapters/18-ebpf-correctness-verifier.html` ("Limitations, measured" table and the
unsound-cases callout); `eBPFS/reviews/part4.md` L19–22, L52–53, L88, L95–96.

Repo: eunomia-bpf/ebpf-correctness-verifier @ `59ca4247632688aaeb5a048750c32bc9c7963061` (`main` HEAD today = same).

- **Code:**
  - `lib/ebpf_smt/src/isa/ebpf/inst.cc:906` `opcode_2_idx()`; `:979` `default: ... return 0;` — index 0 is
    `IDX_NOP` (`inst.h:285`), whose `opcode_type` is `OP_NOP` (`inst.h:509`).
  - The switch (`inst.cc:907–978`) has no case for `SUB64XC`, `MUL64XY`, `DIV64XY`, `JLT*`, `JLE*`, `JSLT*`,
    `JSGE*`, `JSLE*`, `JSET*`, or any JMP32 op except `JEQ32*`/`JNE32*`. Only `DIV64XC` exists for division.
  - `lib/ebpf_smt/src/verify/smt_prog.cc:46` `smt_block()`; `:50–57` only calls `smt_inst()` for
    `OP_OTHERS/OP_LD/OP_ST/OP_CALL`, so an `OP_NOP`-typed instruction contributes no constraint.
  - `lib/ebpf_smt/src/raw_program_loader.cc:546` uses `inst::is_valid_opcode()` (`inst.cc:983`) only to decide
    `clear_dst`; it does not reject the program.
  - `lib/ebpf_smt/src/isa/ebpf/inst_codegen.h:274` `#define DIV_EXPR(in1, in2, out) (out EQ in1 / in2)` —
    z3++ `operator/` on bit-vectors is `Z3_mk_bvsdiv` (signed). eBPF `BPF_DIV` (off=0) is unsigned.
  - `lib/ebpf_smt/src/verify/validator.cc:135` `expr p = (input >= -1024) && (input <= 1024);` (with a TODO).
- **Status: Reproduced in orb** with the prebuilt `build/smt_ebpf_equiv` in the clone.
- **Claim:**
  1. Any opcode missing from `opcode_2_idx()` is treated as a NOP by the SMT encoder, so two programs that
     differ only in such an instruction are reported `PASS / smt_equivalent`. For a conditional jump, the
     branch condition is dropped too. clang `-mcpu=v3` output (JMP32 signed compares) and `r0 *= r2` from C
     hit this (reviews/part4.md L21–22).
  2. `DIV64XC` is encoded as signed division: `r0 /= 2` vs `r0 >>= 1` gives FAIL (they are equal for unsigned
     division), and vs a signed-halving idiom gives PASS. The interpreter-vs-SMT test cannot catch it because
     `compute_div` uses the same macro.
  3. The input register is constrained to `[-1024, 1024]`, so differences that need `r1 > 1024` are missed.
- **Why it matters:** the tool's selling point is "PASS means equivalent". All three give wrong verdicts; (1)
  and (3) are false PASS, which is unsound for an optimizer-validation tool.
- **Environment:** any Linux with the repo built (`cmake --build build --target ebpf-tv smt_ebpf_equiv`, needs
  Z3 dev). No kernel BPF needed. This orb works.
- **Verification (as run here):**
  ```bash
  B=/path/to/ebpf-correctness-verifier/build/smt_ebpf_equiv
  mkdir -p /tmp/a6 && cd /tmp/a6
  printf '{ pgm_input_type = 0, }\n{ max_pkt_sz = 64, }\n' > c.desc; : > e.maps   # constant input in r1
  MOV='\xbf\x10\x00\x00\x00\x00\x00\x00'; EX='\x95\x00\x00\x00\x00\x00\x00\x00'   # r0=r1 ; exit
  printf "$MOV$EX" > id.ins
  printf "$MOV\x17\x00\x00\x00\x05\x00\x00\x00$EX" > sub5.ins                          # r0 -= 5   (SUB imm 0x17)
  printf "$MOV\x07\x00\x00\x00\xfb\xff\xff\xff$EX" > addm5.ins                         # r0 += -5  (control)
  printf "$MOV\x37\x00\x00\x00\x02\x00\x00\x00$EX" > div2.ins                          # r0 /= 2
  printf "$MOV\x77\x00\x00\x00\x01\x00\x00\x00$EX" > rsh1.ins                          # r0 >>= 1
  printf '\xb7\x00\x00\x00\x01\x00\x00\x00'"$EX" > one.ins                             # r0=1
  printf '\xb7\x00\x00\x00\x00\x00\x00\x00'"$EX" > zero.ins                            # r0=0
  # r0=0; if r1 <  5 goto +1 (JLT 0xa5); r0=1; exit
  printf '\xb7\x00\x00\x00\x00\x00\x00\x00\xa5\x01\x01\x00\x05\x00\x00\x00\xb7\x00\x00\x00\x01\x00\x00\x00'"$EX" > jlt.ins
  # same with JGT 0x25 r1 > 5 (control, modelled)
  printf '\xb7\x00\x00\x00\x00\x00\x00\x00\x25\x01\x01\x00\x05\x00\x00\x00\xb7\x00\x00\x00\x01\x00\x00\x00'"$EX" > jgt.ins
  # r0=0; if r1 s> 2000 goto +1; exit; r0=1; exit
  printf '\xb7\x00\x00\x00\x00\x00\x00\x00\x65\x01\x01\x00\xd0\x07\x00\x00'"$EX"'\xb7\x00\x00\x00\x01\x00\x00\x00'"$EX" > sgt2000.ins
  r(){ echo "$1 vs $2: $($B --old $1.ins --new $2.ins --map e.maps --desc c.desc 2>&1 | grep -o '"result": "[A-Z]*"')"; }
  r sub5 id; r addm5 id; r div2 rsh1; r jlt one; r jgt one; r sgt2000 zero
  ```
  Output in this orb:
  ```
  sub5 vs id: "result": "PASS"      <- bug (programs differ for every input)
  addm5 vs id: "result": "FAIL"     <- control
  div2 vs rsh1: "result": "FAIL"    <- bug (equal under unsigned BPF_DIV)
  jlt vs one: "result": "PASS"      <- bug (differ for r1 < 5)
  jgt vs one: "result": "FAIL"      <- control
  sgt2000 vs zero: "result": "PASS" <- bug (differ for r1 > 2000, excluded by ±1024 bound)
  ```
  For the C/`-mcpu=v3` variant, follow reviews/part4.md L21–22 with `build/ebpf-tv check old.o new.o --section xdp
  --equiv-backend smt --smt-equiv build/smt_ebpf_equiv`.
- **Expected if real:** the PASS/FAIL pattern above. **If fixed:** `sub5`, `jlt`, `sgt2000` give FAIL (or an
  explicit "unsupported opcode" error), `div2 vs rsh1` gives PASS.
- **Minimal fix:** in `raw_program_loader.cc` (and the ELF path), reject any instruction where
  `!inst::is_valid_opcode()` with an `unsupported_opcode` result instead of continuing; change `DIV_EXPR` (and
  MOD, if present) to `z3::udiv`/`z3::urem` and the matching `compute_div` to unsigned; drop or widen the
  `validator.cc:135` input bound (or report it as an assumption in the JSON output).
- **Upstream default branch:** same blob for `inst.cc`, `smt_prog.cc`, `validator.cc`, `inst_codegen.h`.
- **Existing upstream issue:** none found (`opcode`, `unsigned`, `DIV`, `JLT`, `1024`).

---

### A7. NCCLbpf: the rank-agreement checker accepts an `agreed_map` lookup whose key is rank-local

Curriculum sources: `eBPFS/chapters/21-nccl-ebpf.html` L782 ("Gap found in review" callout);
`eBPFS/reviews/part5.md` L43, L76 (finding 21.1).

Repo: eunomia-bpf/nccl-eBPF @ `9a6006e2fd21835ff614e854b8ba858edf595312` (`master` HEAD today = same).

- **Code (`src/nccl-policy-plugin/rank_agreement_verifier.h`):**
  - `:83` `load_memory()`; `:86` `if (base.kind == Kind::agreed_value) return scalar();` — any load through a
    lookup result is `shared`.
  - `:192–194` `BPF_FUNC_map_lookup_elem` with `r1` of kind `agreed_map` sets `r0 = agreed_value`. The kind of
    `r2` (the key pointer) and of the stack bytes it points to are never inspected.
  - `:221–228` a non-shared compare is exempt from `local_control` when it is `BPF_JMP|BPF_K`, `imm == 0`,
    `JEQ/JNE`, and the register is `context` or `agreed_value` — i.e. the NULL check on the lookup.
  - Called from `src/nccl-policy-plugin/plugin.cpp:1320` (`rank_agreement::check(spec.insns, agreed_fds, ...)`),
    only on the experimental distributed path (`NCCL_POLICY_EXPERIMENTAL_DIST_MAP`, `plugin.cpp:1271`).
  - Context: `src/ebpf-policies/policy_context.h:28` `last_latency_ns` is at offset 8, which
    `shared_context_access()` (`rank_agreement_verifier.h:73–78`) classes as rank-local.
- **Status: Reproduced in orb** against the checker header only (CPU, g++ 12 `-std=c++20`; the header does not
  build with C++17). Not run inside NCCL. reviews/part5.md L76 also reports ACCEPT for a clang-14-compiled C policy
  and a `call_count`-keyed variant.
- **Claim:** with `key = ctx->last_latency_ns & 1` stored to the stack and passed to `bpf_map_lookup_elem(&agreed_map,
  &key)`, the result is treated as agreed. On a 1-entry ARRAY `agreed_map` (as in
  `distributed_max_latency.bpf.c:20–25`), key 1 returns NULL, key 0 returns the value, so ranks whose latency
  parity differs take different branches (`return 0` vs `return 4 channels`). The checker ACCEPTs it. A policy
  that branches directly on the same local value is REJECTed, so the gap is specific to key provenance.
- **Why it matters:** the checker is the safety net that is supposed to guarantee all ranks pick the same
  algorithm/channels; divergent tuning across ranks of one collective can hang or corrupt NCCL. The docs
  (`docs/cross-rank-agreement.md`) and the chapter present the checker as closing this class.
- **Environment:** any Linux with g++ ≥ 10 and kernel headers (`linux/bpf.h`). For the end-to-end case: ≥2 GPUs,
  NCCL built with the plugin, `NCCL_POLICY_EXPERIMENTAL_DIST_MAP` opt-in with all three maps and `dist_merge`.
- **Verification (header-only, as run here):**
  ```bash
  R=/path/to/nccl-eBPF/src/nccl-policy-plugin
  g++ -std=c++20 $R/test/test_rank_agreement_verifier.cpp -o /tmp/t && /tmp/t   # sanity: "rank agreement verifier tests passed"
  mkdir -p /tmp/a7 && cat > /tmp/a7/repro.cpp <<'CPP'
  #include "rank_agreement_verifier.h"
  #include <cstdio>
  #include <linux/bpf.h>
  #include <string>
  #include <vector>
  static bpf_insn I(uint8_t c, uint8_t d=0, uint8_t s=0, int16_t o=0, int32_t imm=0){bpf_insn i{};i.code=c;i.dst_reg=d;i.src_reg=s;i.off=o;i.imm=imm;return i;}
  int main(){
    std::vector<bpf_insn> p = {
      I(BPF_LDX|BPF_MEM|BPF_DW, 6, 1, 8),            // r6 = ctx->last_latency_ns (rank-local)
      I(BPF_ALU64|BPF_AND|BPF_K, 6, 0, 0, 1),        // r6 &= 1
      I(BPF_STX|BPF_MEM|BPF_W, 10, 6, -4),           // key = r6
      I(BPF_ALU64|BPF_MOV|BPF_X, 2, 10), I(BPF_ALU64|BPF_ADD|BPF_K, 2, 0, 0, -4),
      I(BPF_LD|BPF_DW|BPF_IMM, 1, BPF_PSEUDO_MAP_FD, 0, 7), I(0),   // r1 = agreed_map (fd 7)
      I(BPF_JMP|BPF_CALL, 0, 0, 0, BPF_FUNC_map_lookup_elem),
      I(BPF_JMP|BPF_JEQ|BPF_K, 0, 0, 2, 0),          // if (!v) return 0
      I(BPF_ALU64|BPF_MOV|BPF_K, 0, 0, 0, 4), I(BPF_JMP|BPF_EXIT),
      I(BPF_ALU64|BPF_MOV|BPF_K, 0, 0, 0, 0), I(BPF_JMP|BPF_EXIT)};
    std::string why; bool ok = rank_agreement::check(p, {7}, &why);
    printf("local-key lookup: %s %s\n", ok?"ACCEPT":"REJECT", why.c_str());
    std::vector<bpf_insn> q = { I(BPF_LDX|BPF_MEM|BPF_DW, 6, 1, 8), I(BPF_JMP|BPF_JEQ|BPF_K, 6, 0, 2, 0),
      I(BPF_ALU64|BPF_MOV|BPF_K, 0, 0, 0, 4), I(BPF_JMP|BPF_EXIT), I(BPF_ALU64|BPF_MOV|BPF_K, 0, 0, 0, 0), I(BPF_JMP|BPF_EXIT)};
    why.clear(); ok = rank_agreement::check(q, {7}, &why);
    printf("control (branch on local): %s %s\n", ok?"ACCEPT":"REJECT", why.c_str());
  }
  CPP
  g++ -std=c++20 -I$R /tmp/a7/repro.cpp -o /tmp/a7/repro && /tmp/a7/repro
  ```
  Output in this orb:
  ```
  local-key lookup: ACCEPT
  control (branch on local): REJECT instruction 3: rank-local control flow
  ```
  C equivalent for the ELF path (as in reviews/part5.md; compile with `clang -O2 -target bpf -c` in
  `src/ebpf-policies/`, then feed the object to whatever loader the plugin uses for the distributed opt-in):
  ```c
  /* same includes and agreed_map definition as distributed_max_latency.bpf.c */
  SEC("uprobe")
  uint64_t bad_key_policy(struct nccl_policy_ctx *ctx) {
    if (!ctx) return 0;
    uint32_t key = ctx->last_latency_ns & 1;          /* rank-local */
    uint64_t *v = bpf_map_lookup_elem(&agreed_map, &key);
    if (!v) return 0;
    return nccl_policy_pack_action(0, 0, 4, 0, NCCL_POLICY_ACTION_SET_CHANNELS);
  }
  ```
- **Expected if real:** `ACCEPT` for the local-key program. **If fixed:** `REJECT` with something like "rank-local
  map key".
- **Minimal fix:** at `rank_agreement_verifier.h:192–194`, when `r1` is `agreed_map`, require `r2` to be a
  `stack` pointer and every byte `stack_bytes[512 + r2.offset + 0 .. key_size-1]` to be `shared` (key size is
  known from the map spec; a conservative 4/8 bytes also works); otherwise `fail(pc, "rank-local map key")`.
  Add the program above as a negative case to `test/test_rank_agreement_verifier.cpp`.
- **Upstream default branch:** same blob for `src/nccl-policy-plugin/rank_agreement_verifier.h`.
- **Existing upstream issue:** none found (`agreement`, `agreed_map`, `soundness`, `verifier`).

---

### A8. bpf-compatible / bpf-loader-rs: BTF selection order, weak-symbol length, archive key mismatches, README names

Curriculum sources: `eBPFS/chapters/13-bpf-compatible.html` L237 (env names), L390–391 (`ID`/`VERSION_ID`),
L551–567 (weak symbols, `clean_core_btf` slip); `eBPFS/reviews/part3.md` L56, L64 (13.1), L72–75.

Repos: eunomia-bpf/bpf-compatible @ `4ed5e6510ff59cc901052bd65b0a77326c21107e` (`main` HEAD today = same);
eunomia-bpf/eunomia-bpf @ `a5408a8c3614bd4e008c1f999bb4ee9738e2fc41` (`master` HEAD today = same).

#### A8a. bpf-loader-rs bails on a missing archive entry before checking `/sys/kernel/btf/vmlinux`

- **Code:** `eunomia-bpf: bpf-loader-rs/bpf-loader-lib/src/skeleton/builder.rs:84–88` — if `btf_archive_path` is
  set, `get_current_system_btf_file()` is computed and `bail!("BTF file not found for current system: …")` fires
  when that file does not exist. `vmlinux_btf_exists` is computed only afterwards (`:96`), and is used at `:110`
  (`path_holder.is_some() && !vmlinux_btf_exists`) and `:123`. (Contrast: bpf-compatible's own
  `bpf-compatible-sys/src/lib.rs:26` returns 0 immediately if `/sys/kernel/btf/vmlinux` exists.)
- **Status: Code reading only** (reviews/part3.md L56 also code reading). Not run: building ecli/bpf-loader-rs
  is a large Rust build.
- **Claim:** a package that carries a btfhub archive (`ecc --btfgen`, run as a `.tar` package) fails on a kernel
  that **has** `/sys/kernel/btf/vmlinux` but whose `ID/VERSION_ID/machine/release` is not in the archive — which is
  the common case (modern distro kernels are not in btfhub because they have BTF).
- **Why it matters:** btfgen packages become *less* portable than plain ones; they fail exactly where CO-RE
  needs no help.
- **Environment:** any BTF-enabled kernel (this orb qualifies: check `ls /sys/kernel/btf/vmlinux`), ecc + ecli
  built from the repo or released binaries, network for the btfhub fetch.
- **Verification:**
  ```bash
  ls -l /sys/kernel/btf/vmlinux                    # must exist
  cd eunomia-bpf/examples/bpftools/bootstrap       # any example
  ecc bootstrap.bpf.c bootstrap.h --btfgen         # packs a btfhub-trimmed archive into a .tar
  ls *.tar                                         # the archive output
  tar tf <output>.tar | grep "$(uname -r)" || echo "running kernel not in archive (expected)"
  sudo ecli run <output>.tar                       # A8a real → "BTF file not found for current system: …/<id>/<ver>/<arch>/<release>.btf"
  sudo ecli run package.json                       # control: runs fine using kernel BTF
  ```
- **Expected if real:** the `.tar` run fails with the `builder.rs:87` message; the `package.json` run succeeds.
  **If not:** both run.
- **Minimal fix:** compute `vmlinux_btf_exists` first and only consult the archive when it is false; treat a
  missing archive entry as "fall through" (to `BTF_FILE_PATH`, then the `:124` error) rather than a hard bail.

#### A8b. Weak `_binary_min_core_btfs_tar_gz_{start,end}` give a bogus length when no archive is linked

- **Code:** `bpf-compatible-sys/btf_helpers.h:30–31` weak one-byte definitions; `bpf-compatible-sys/src/lib.rs:118–127`
  computes `end as usize - start as usize`, casts to `c_int`, and passes it to `ensure_core_btf_with_tar_binary`,
  which does `slice::from_raw_parts(tar_bin, tar_len as usize)` (`lib.rs:29`).
- **Status: Code reading only** for the library path; a toy C link was run in the orb (below). The path is only
  reached when `/sys/kernel/btf/vmlinux` is absent (`lib.rs:26`).
- **Claim:** without `min_core_btfs_tar.o`, the "length" is just the linker's distance between two unrelated
  weak symbols. In the orb (gcc 12, Debian 12) a toy program with the same two definitions printed `len=1` at
  `-O0` and `len=-1` at `-O2`. Length 1 → gunzip fails → `-EINVAL`. A negative distance: the Rust subtraction
  wraps in release (panics in debug), `as c_int` gives -1, then `-1 as usize` makes `from_raw_parts` build a
  slice of `usize::MAX` bytes — undefined behaviour (likely SIGSEGV inside GzDecoder) instead of a clean error.
- **Why it matters:** the header comment says it "allow[s] for not linking the tar binary"; that configuration
  can crash on non-BTF kernels, which are exactly the targets of this library.
- **Environment:** a non-BTF kernel (or a VM with `CONFIG_DEBUG_INFO_BTF=n`), Rust toolchain to build
  `libbpf_compatible.a`, the C example.
- **Verification:**
  ```bash
  # toy layout check (any Linux)
  cat > /tmp/w.c <<'C'
  #include <stdio.h>
  char _binary_min_core_btfs_tar_gz_start __attribute__((weak));
  char _binary_min_core_btfs_tar_gz_end __attribute__((weak));
  int main(){printf("len=%ld\n",(long)(&_binary_min_core_btfs_tar_gz_end-&_binary_min_core_btfs_tar_gz_start));}
  C
  gcc /tmp/w.c -o /tmp/w && /tmp/w; gcc -O2 /tmp/w.c -o /tmp/w && /tmp/w      # orb: len=1, len=-1
  # real check, on a kernel without /sys/kernel/btf/vmlinux:
  cd bpf-compatible/example/c && make        # then relink execsnoop WITHOUT min_core_btfs_tar.o
  sudo ./execsnoop; echo rc=$?               # A8b real → "Failed to decompress" (-EINVAL) or a crash, not "not supported"
  ```
- **Expected if real:** decompress error or crash. **If not:** a clear "no archive linked" error.
- **Minimal fix:** in `ensure_core_btf_with_linked_tar`, if `end <= start + 1` (or a sentinel weak symbol such as
  `_binary_min_core_btfs_tar_gz_size` is 0/absent) return `-ENOENT` before slicing; use `checked_sub`.

#### A8c. Archive key uses `uname.machine` (`aarch64`) and raw `VERSION_ID` (`8.4`), btfhub uses `arm64` and `rhel/8`

- **Code:** `bpf-compatible-rs/src/lib.rs:20–27` builds `"{id}/{version_id}/{uname.machine}/{uname.release}.btf"`;
  no arch or version normalisation anywhere in `bpf-compatible-rs/src` or `bpf-loader-rs` (rg for
  `arm64|aarch64|version_id`).
- **Status: Code reading only**, plus a live check of the btfhub-archive layout:
  `gh api repos/aquasecurity/btfhub-archive/contents/ubuntu/20.04 --jq '.[].name'` → `arm64`, `x86_64`;
  `…/contents/rhel` → `7`, `8`; `…/contents/centos` → `7`, `8`. The chapter marks these limitations as untested.
- **Claim:** on arm64 Linux `uname -m` is `aarch64`, so the key never matches `…/arm64/…`. On RHEL 8.x,
  `/etc/os-release` has `VERSION_ID="8.4"` (etc.), so the key is `rhel/8.4/…` and never matches `rhel/8/…`. (CentOS 8
  has `VERSION_ID="8"`, so it works there; CentOS 7 has `VERSION_ID="7"`.)
- **Why it matters:** the two largest btfhub populations outside x86 Ubuntu silently get "not found".
- **Environment:** an arm64 non-BTF host (e.g. Ubuntu 20.04 arm64 with a 5.4 kernel), and a RHEL 8.x host.
  Containers are enough for the key computation if you only check the path string.
- **Verification:**
  ```bash
  uname -m; . /etc/os-release; echo "$ID/$VERSION_ID/$(uname -m)/$(uname -r).btf"    # what bpf-compatible builds
  # compare with the archive tree:
  ls ~/.cache/eunomia/btfhub/btfhub-archive/$ID/   # after ./script/btfgen fetch
  # full run: build bpf-compatible example/c with a btfgen archive containing this kernel, run on the host
  ```
- **Expected if real:** the computed key contains `aarch64` / `8.4` and the archive has `arm64` / `8`; the
  example prints "Failed to find the btf archive matching the running kernel" (`bpf-compatible-sys/src/lib.rs:93`).
- **Minimal fix:** map `aarch64→arm64` (and keep `x86_64`), and for `rhel`/`ol`/`rocky`/`almalinux` truncate
  `VERSION_ID` to the major version (btfhub's own convention), ideally trying the raw value first.

#### A8d. README names wrong: env vars and cleanup function

- **Code:** `README.md:39` says `BTFHUB_REPO_URL` / `BTFHUB_CACHE_DIR`; `script/btfgen:4–5` reads `BTFHUB_CACHE` /
  `BTFHUB_REPO` (the `_URL`/`_DIR` names are internal variables that get overwritten). `README.md:72` says
  `void clean_core_btf(...)`; `bpf-compatible-sys/btf_helpers.h:25` defines `cleanup_core_btf` (the README's own
  example at `:75` uses `cleanup_core_btf`). `README_zh.md:48` correctly says `$BTFHUB_CACHE`, but `:60`/`:64`
  repeat `clean_core_btf`.
- **Status: Code reading only** (trivially confirmable).
- **Verification:**
  ```bash
  sed -n 4,5p script/btfgen; sed -n 39p README.md; sed -n 72,75p README.md; sed -n 25p bpf-compatible-sys/btf_helpers.h
  BTFHUB_CACHE_DIR=/tmp/x ./script/btfgen fetch   # A8d real → still fetches into ~/.cache/eunomia/btfhub
  ```
- **Minimal fix:** README.md:39 → `BTFHUB_REPO` / `BTFHUB_CACHE`; README.md:72 and README_zh.md:60/64 →
  `cleanup_core_btf`.

**Upstream default branch (all of A8):** same blob for `bpf-compatible-sys/src/lib.rs`, `bpf-compatible-sys/btf_helpers.h`,
`bpf-compatible-rs/src/lib.rs`, `README.md`, `script/btfgen` (bpf-compatible `main`) and
`bpf-loader-rs/bpf-loader-lib/src/skeleton/builder.rs` (eunomia-bpf `master`).

**Existing upstream issue:** bpf-compatible: none found (`aarch64`, `arm64`, `rhel`, `weak`, `BTFHUB`, `vmlinux`).
eunomia-bpf: none for A8a; #335 and #342 (both closed) show the different `:124` "All ways tried" error on
non-BTF kernels, not this one; `aarch64` hits are about release binaries/docker, not the BTF key.

---

### A9. wasm-bpf: guest SDK `map_operate` ABI mismatch, Rust runtime drops ring-buffer records, swapped `Config::default()` names

Curriculum sources: `eBPFS/chapters/12-wasm-bpf.html` L277 (signature letters), L296–300 (C guest import list);
`eBPFS/reviews/part2.md` L35–37, L151–156.

Repos: eunomia-bpf/wasm-bpf @ `01f14194ca6966201ff34d72290be118ed2253a9`; eunomia-bpf/wasm-bpf-guest-sdk-rust @
`7d0b615afefda5f7dd82b38f5be014c9b2d0bda6`; eunomia-bpf/wasm-bpf-guest-sdk-go @
`27b5c515dfd82701f60c83ae5e241bcf569f4246` (all three: `main` HEAD today = same).

All three sub-items: **Status: Code reading only.** No wasm runtime, wasmtime, TinyGo or `wasm32-wasi` build was
run in the orb (building `wasm-bpf-rs` pulls wasmtime; not attempted).

#### A9a. Rust and Go guest SDKs import `wasm_bpf_map_operate` with i64 pointer args; both runtimes export i32

- **Code:**
  - Rust SDK `wasm-bpf-binding/src/binding.rs:10–31`: `fn wit_import(_: i32, _: i32, _: i64, _: i64, _: i64, _: i64) -> i32`
    (key/value/next_key as `u64` → `i64`). Used by `wasm-bpf-libbpf-rs/src/map.rs:25,36,44,89` (`lookup`, `delete`,
    `update`, key iteration).
  - Go SDK `helper.go:4–6`: `//go:wasm-module wasm_bpf` `//export wasm_bpf_map_operate`
    `func WasmBpfMapOperate(int32, int32, int64, int64, int64, int64) int32`.
  - Rust runtime `runtime/wasm-bpf-rs/src/bpf/map_operate.rs:23–30`: `key/value/next_key: WasmPointer`, with
    `pub type WasmPointer = u32;` (`runtime/wasm-bpf-rs/src/bpf/mod.rs:74`), registered at `runtime/wasm-bpf-rs/src/runner.rs:94`.
  - C++ (WAMR) runtime `runtime/cpp/src/wasm-bpf.cpp:717`: `EXPORT_WASM_API_WITH_SIG(wasm_bpf_map_operate, "(ii***I)i")`
    (`*` = i32 pointer). The C SDK (`wasm-bpf/runtime/cpp/test/wasm-apps/api.h:39–40`) matches the hosts.
- **Claim:** a Rust or Go guest that calls any map operation imports `(i32,i32,i64,i64,i64,i64)->i32`, but the
  host provides `(i32,i32,i32,i32,i32,i64)->i32`. Wasmtime should refuse to instantiate ("incompatible import
  type"); WAMR should fail linking/instantiation of that import. None of the in-tree examples hit it:
  `examples/bootstrap-libbpf-rs` and `tcpconnlat-libbpf-rs` only call `obj.map(..)` + poll, and unused imports are
  dropped by the wasm linker.
- **Why it matters:** `Map::lookup/update/delete/keys` in the libbpf-rs-like SDK, and the Go SDK map helper,
  are unusable; this is the main way a guest reads aggregated eBPF state (histograms, counters).
- **Environment:** Linux with BPF (root, BTF kernel), Rust with `wasm32-wasi` (or `wasm32-wasip1`) target, the
  `wasm-bpf` CLI (`runtime/cli`, Rust) and optionally the C++ runtime; TinyGo for the Go half. An x86 VM or a
  JIT-enabled host is fine; this orb lacks the runtime build.
- **Verification:**
  ```bash
  cd wasm-bpf/examples/bootstrap-libbpf-rs
  # add after `let map = obj.map("rb").unwrap();` in src/main.rs:
  #     let es = obj.map("exec_start").unwrap();
  #     let mut v = [0u8; 8];
  #     println!("lookup -> {}", es.lookup(&1i32.to_ne_bytes(), MapFlags::ANY, &mut v));
  #   (import MapFlags from wasm_bpf_libbpf_rs; adjust the path if it lives in a submodule)
  make build                                     # produces bootstrap-libbpf-rs.wasm
  wasm-tools print bootstrap-libbpf-rs.wasm | grep wasm_bpf_map_operate   # shows (param i32 i32 i64 i64 i64 i64)
  sudo ../wasm-bpf bootstrap-libbpf-rs.wasm      # Rust CLI from runtime/cli
  ```
- **Expected if real:** instantiation error naming `wasm_bpf_map_operate` (wasmtime: "incompatible import type");
  with the C++ runtime, a WAMR link/instantiate failure for that import. **If not:** prints `lookup -> false`
  and continues polling.
- **Minimal fix:** change the Rust binding to `fn wit_import(_: i32, _: i32, _: i32, _: i32, _: i32, _: i64) -> i32`
  and pass `key as u32` etc. (pointers are 32-bit on wasm32); change Go to
  `func WasmBpfMapOperate(int32, int32, int32, int32, int32, int64) int32` and its callers.

#### A9b. Rust runtime delivers only the last ring-buffer (and perf) record per `wasm_bpf_buffer_poll`

- **Code:** `runtime/wasm-bpf-rs/src/bpf/poll.rs:64` creates one `Rc<RefCell<Option<Vec<u8>>>>`; the ring-buffer
  callback at `:91–95` (and perf at `:67–71`) does `result_recv.borrow_mut().replace(data.to_vec())`. After
  `ringbuf.poll()` (`:136–143`), which consumes every available record, `:158` takes the single cell, copies it
  into guest memory (`:167`) and calls the guest callback once (`:172ff`). The C++ runtime instead passes a
  per-record callback to `ring_buffer__new(fd, sample_cb, ctx, NULL)` (`runtime/cpp/src/wasm-bpf.cpp:117`).
- **Claim:** with N records ready at poll time, the Rust host calls the guest once with record N; records 1..N-1
  are lost silently.
- **Why it matters:** bursts (e.g. many `exec` events between polls) are under-reported only on the Rust
  runtime, which the CLI uses; the C++ runtime behaves differently.
- **Environment:** as A9a (root, BTF kernel, Rust CLI); no SDK changes needed.
- **Verification:**
  ```bash
  cd wasm-bpf/examples/bootstrap      # C guest, ring buffer "rb"
  make && sudo ../wasm-bpf bootstrap.wasm > /tmp/rs.log &   # Rust runtime
  sleep 2; for i in $(seq 200); do /bin/true; done; sleep 2; sudo kill %1
  grep -c exec /tmp/rs.log                                   # count delivered exec events
  # control: same with the C++ runtime build (runtime/cpp) → count should be ~200
  sudo bpftrace -e 'tracepoint:sched:sched_process_exec { @ = count(); }'   # optional ground truth
  ```
  (Adjust the grep to the example's output format.) For a deterministic check, make the guest's poll timeout
  large (e.g. 1000 ms) so many records queue per poll.
- **Expected if real:** Rust-runtime count well below 200 (roughly one per poll); C++ ~200. **If not:** both ~200.
- **Minimal fix:** make the container a `VecDeque<Vec<u8>>` (push in the callback), then loop: pop each record,
  write it to guest memory, call the guest callback; or return non-zero from the libbpf callback after the
  first record and leave the rest for the next poll (`ring_buffer__consume` semantics).

#### A9c. `Config::default()` swaps the two Go callback names relative to the CLI and the Go SDK

- **Code:** `runtime/wasm-bpf-rs/src/lib.rs:49–53`: `callback_export_name: "callback-wrapper"`,
  `wrapper_module_name: "go-callback"`. The field docs at `lib.rs:33–36` say the opposite (export "go-callback",
  module "callback-wrapper"), and so do the CLI defaults `runtime/cli/src/main.rs:28–31` (`-m` default
  `"callback-wrapper"`, `-c` default `"go-callback"`), applied via `set_callback_values` (`main.rs:69`). The Go SDK
  imports from module `callback-wrapper` (`wasm-bpf-guest-sdk-go/helper.go:8–10`). `runner.rs:75` uses
  `callback_export_name`, `runner.rs:98` uses `wrapper_module_name`. The crate's tests pass the names explicitly
  (`runtime/wasm-bpf-rs/src/tests/mod.rs:97,111,146`), so they do not exercise the default.
- **Claim:** an embedder using `wasm_bpf_rs::run_wasm_bpf_module*` with `Config::default()` registers the
  wrapper under module `go-callback` and looks for export `callback-wrapper`, so Go guests fail to link
  (`callback-wrapper::wasm_bpf_buffer_poll` unresolved). The CLI is unaffected.
- **Environment:** Rust toolchain; any Linux for the link failure (BPF only needed past instantiation).
- **Verification:**
  ```bash
  sed -n 49,54p wasm-bpf/runtime/wasm-bpf-rs/src/lib.rs; sed -n 28,31p wasm-bpf/runtime/cli/src/main.rs
  # behavioural: in runtime/wasm-bpf-rs/src/tests/mod.rs copy a Go-example test (e.g. the one at :97) and
  # replace the explicit names with Config::default(); then
  cd wasm-bpf/runtime/wasm-bpf-rs && sudo -E cargo test <that test>
  ```
- **Expected if real:** the default-config test fails with an unknown import from module `callback-wrapper`;
  the explicit-name test passes. **If not:** both pass.
- **Minimal fix:** swap the two strings in `lib.rs:52–53`.

**Upstream default branch (all of A9):** same blob for `runtime/wasm-bpf-rs/src/bpf/poll.rs`,
`runtime/wasm-bpf-rs/src/bpf/map_operate.rs`, `runtime/wasm-bpf-rs/src/lib.rs`, `runtime/cli/src/main.rs`,
`runtime/cpp/src/wasm-bpf.cpp` (wasm-bpf `main`), `wasm-bpf-binding/src/binding.rs` (rust SDK `main`), `helper.go`
(go SDK `main`).

**Existing upstream issue:** none found. wasm-bpf searched `map_operate`, `i64`, `ringbuf`, `ring buffer`,
`callback-wrapper`, `go-callback`, `Config`; hits #124 (tcpconnlat CI failure, closed), #93 (terminate safety), #101
(missing Config fields) are different problems. Rust SDK has only #1 (feature); Go SDK has no issues.

---

### A10. ActPlane: `doctor` misses a missing BPF JIT; `kill` is documented as pre-op deny under BPF-LSM but LSM hooks only evaluate `block`

Curriculum sources: `eBPFS/chapters/24-actplane.html` L1145–1156 (orb run: `doctor` OK, `run` fails with
"tail_calls are not allowed in non-JITed programs with bpf-to-bpf calls"); `eBPFS/reviews/part5.md` L46.

Repo: eunomia-bpf/ActPlane @ `bb89c77bcb29cfa81ba1fb212b5634c353c7352b` (`master` HEAD today = same).

#### A10a. `actplane doctor` does not check for the BPF JIT; every tracepoint pipeline fails to load without it

- **Code:**
  - `crates/actplane-cli/src/doctor.rs:2293` `doctor()`: host checks are kernel BTF (`:2340`), eBPF privilege
    (`:2347–2352`), BPF-LSM via `/sys/kernel/security/lsm` (`:2357–2368`, reader at `:2551`). No reference to
    `bpf_jit_enable` or JIT anywhere in `crates/` (rg `bpf_jit|jit`).
  - `bpf/process.bpf.c:469` `BPF_MAP_TYPE_PROG_ARRAY` and `bpf_tail_call(ctx, &exec_tail, …)` at `:2683, :2691,
    :2702, :2710`, in programs that also have BPF-to-BPF calls; other programs use callbacks (e.g. `bpf_loop`). The
    kernel verifier rejects both without a JIT.
  - `bpf/build.rs:1–21`: the CLI embeds the committed `bpf/prebuilt/process.bpf.o`.
- **Status: Reproduced in orb** (kernel 6.1.189+, no `/proc/sys/net/core/bpf_jit_enable`; LSM list
  `capability,landlock`). I did not build the `actplane` CLI; instead I loaded the committed prebuilt object with
  a 20-line libbpf (1.1.2) loader, one program at a time. Result: `ok=57 fail=36`; 14 failures are `lsm/*`
  programs (BPF-LSM not active here, `-ESRCH`/`-3`), and nearly every remaining tracepoint program fails with
  `-EINVAL` and a verifier log containing "… not allowed in non-JITed programs" — `handle_fork`, `handle_exec`,
  `exec_tp_rule_complex`, `handle_exit`, `trace_*_flow`, `trace_connect`, `trace_mmap_exit`, `trace_mprotect_exit`,
  `trace_mremap_exit`, `trace_sendfile64_exit`, `trace_copy_file_range_exit`, `trace_splice_exit`. (My log filter
  cut the prefix; `handle_fork`'s full message is "callbacks are not allowed in non-JITed programs"; the chapter's
  `actplane run` saw the "tail_calls … with bpf-to-bpf calls" variant on the exec pipeline.) The chapter's run
  also shows `doctor` printing no JIT problem.
- **Claim:** on a kernel without a BPF JIT (`CONFIG_BPF_JIT=n`, or `bpf_jit_enable=0` without
  `CONFIG_BPF_JIT_ALWAYS_ON`), `doctor` reports a usable setup while `run` cannot load its core programs.
- **Why it matters:** `doctor` is the documented pre-flight; it passes on hosts where nothing can work, and the
  `run` failure is a raw verifier message.
- **Environment:** a no-JIT kernel (this orb; or a VM with `echo 0 | sudo tee /proc/sys/net/core/bpf_jit_enable`
  on a kernel without `BPF_JIT_ALWAYS_ON`), root, libbpf dev headers, Rust to build the CLI for the end-to-end run.
- **Verification:**
  ```bash
  ls /proc/sys/net/core/bpf_jit_enable 2>&1 || echo "no JIT"
  # end-to-end (needs the CLI: cargo build --release -p actplane-cli, or a release binary)
  actplane doctor                 # A10a real → no JIT line; "setup looks usable" if other checks pass
  sudo -E actplane run -- true    # A10a real → load fails, "... not allowed in non-JITed programs ..."
  # CLI-free check of the same embedded object (what was run here):
  cat > /tmp/each.c <<'C'
  #include <bpf/libbpf.h>
  #include <stdio.h>
  #include <string.h>
  static char last[256];
  static int pr(enum libbpf_print_level l, const char *f, va_list a){ char b[8192]; vsnprintf(b,sizeof b,f,a); char *s; if ((s=strstr(b,"not allowed"))) snprintf(last,sizeof last,"%.120s",s); return 0; }
  int main(int c, char **v){ libbpf_set_print(pr); int n=0; struct bpf_object *o=bpf_object__open_file(v[1],NULL); struct bpf_program *p; bpf_object__for_each_program(p,o) n++; bpf_object__close(o);
   int ok=0,bad=0; for(int i=0;i<n;i++){ o=bpf_object__open_file(v[1],NULL); int j=0; const char *nm=0,*sec=0;
    bpf_object__for_each_program(p,o){ bpf_program__set_autoload(p,j==i); if(j==i){nm=bpf_program__name(p);sec=bpf_program__section_name(p);} j++; }
    last[0]=0; int e=bpf_object__load(o); if(e){bad++; printf("FAIL %-32s %-34s %d %s\n",nm,sec,e,last);} else ok++; bpf_object__close(o);} printf("ok=%d fail=%d\n",ok,bad); }
  C
  gcc /tmp/each.c -o /tmp/each -lbpf && sudo /tmp/each ActPlane/bpf/prebuilt/process.bpf.o | grep -v ' lsm/'
  ```
- **Expected if real:** `doctor` silent about JIT; the loader shows tracepoint programs failing with "not allowed
  in non-JITed programs". **If not / on a JIT host:** those programs load (`FAIL` only for `lsm/*` when BPF-LSM is
  off, plus the `-13` ones noted below).
- **Note (unrelated, not investigated):** `trace_rename_exit`, `trace_renameat_exit`, `trace_renameat2_exit`,
  `cap_drain_tick` and `handle_exec_args`/`exec_tp_*` failed with `-13`/`-22` without a "not allowed" line when
  loaded in isolation; that is likely an artefact of loading one program at a time (tail-call/prog-array setup)
  and should be re-checked with the real loader on a JIT host.
- **Minimal fix:** in `doctor()`, read `/proc/sys/net/core/bpf_jit_enable` (missing or `0` → `✗ BPF JIT: not
  enabled; run/watch cannot load (tail calls + bpf-to-bpf calls require JIT)` and `problems += 1`); optionally map
  the verifier string to the same hint in `run`.

#### A10b. Docs say `kill` denies the operation under BPF-LSM; the LSM path never selects `kill` rules

- **Code:**
  - `docs/rule-language.md:101`: "`kill`: send `SIGKILL` … With BPF-LSM active, the hook also denies the triggering
    operation when the rule is evaluated before commit".
  - `bpf/process.bpf.c:1310–1315` `te_supported_effects(TE_MODE_BLOCK)` returns only `1U << TEFFECT_BLOCK`;
    otherwise `NOTIFY|KILL`. That mask is set as `eval->effect_mask` (`:1463, :1706, :1720, :1758, :1831`) and filters
    the rule scan in `bpf/taint_engine.bpf.h:2123–2127` (and the matching blocks at `:2189`, `:2245`): a rule whose
    effect bit is not in the mask returns `-1` (no match).
  - All 14 `SEC("lsm/…")` programs in `bpf/process.bpf.c` (first at `:2418–2422`, `te_handle_exec(…, TE_MODE_BLOCK)`)
    pass `TE_MODE_BLOCK`; tracepoints use `te_tracepoint_mode()` = `TE_MODE_NOTIFY` (`:1294–1297`).
  - Hence the `(action == TE_MODE_KILL && s->mode == TE_MODE_BLOCK)` deny branches at `:1482`, `:1777`, `:1874` are
    unreachable.
- **Status: Code reading only** (reviews/part5.md L46, re-checked here). Needs a BPF-LSM + JIT host to run.
- **Claim:** under BPF-LSM, a `kill` rule is evaluated only by the tracepoint after the operation, so the
  operation completes and the task is then killed; it is not denied pre-op as documented.
- **Why it matters:** users choosing `kill` for, e.g., `connect` or file writes on LSM hosts expect the
  operation to be stopped; the side effect (bytes sent, file written) still happens.
- **Environment:** kernel with JIT and `bpf` in `/sys/kernel/security/lsm` (e.g. boot with `lsm=…,bpf`), root,
  `actplane` CLI.
- **Verification:**
  ```bash
  grep -o bpf /sys/kernel/security/lsm && ls /proc/sys/net/core/bpf_jit_enable
  mkdir -p /tmp/a10b && cd /tmp/a10b
  # policy: one kill rule on a write to a canary file (adapt syntax to docs/rule-language.md)
  #   kill write file "/tmp/a10b/canary"
  actplane compile --explain        # note what it says for the kill clause under BPF-LSM
  sudo -E actplane run -- sh -c 'echo SECRET > /tmp/a10b/canary; echo after'
  ls -l /tmp/a10b/canary; cat /tmp/a10b/canary
  # control: same with `block` instead of `kill` → write denied (EPERM), canary absent/empty
  ```
- **Expected if real:** the shell is SIGKILLed but `/tmp/a10b/canary` exists and contains `SECRET` (operation
  completed); no `EPERM`. **If docs are right:** the write fails with `EPERM` and the file is empty/absent.
- **Minimal fix:** either (docs) change `rule-language.md:101` to say `kill` is always post-event termination,
  or (code) make `te_supported_effects(TE_MODE_BLOCK)` return `BLOCK|KILL` so the LSM hook denies and
  `exec_pipe_finish`/the file/connect paths send SIGKILL as the existing `:1482/:1777/:1874` branches intend.

**Upstream default branch (A10):** same blob for `crates/actplane-cli/src/doctor.rs`, `bpf/process.bpf.c`,
`bpf/taint_engine.bpf.h`, `docs/rule-language.md`, `bpf/prebuilt/process.bpf.o`.

**Existing upstream issue:** none for either. Searched `JIT`, `non-JITed`, `tail_call`, `doctor`, `kill LSM`,
`kill`. Hits: #9 "Always crash on `run`" (closed; reporter's kernel has `CONFIG_BPF_JIT=y`, so a different cause);
#43 (open feature) asks `doctor`/`compile --explain` to report effective enforcement modes — related to both A10a
and A10b, a natural place to comment.

## Upstream bug hand-off, part B (B1–B9)

Written 2026-11-06 from an Amp orb: Linux 6.1.189+ x86-64, no BPF JIT
(`/proc/sys/net/core/bpf_jit_enable` absent), no GPU/CUDA, Debian 12 userland (glibc 2.36, clang 14.0.6,
libbpf 1.1.2). One correction to the brief: cgroup v2 at `/sys/fs/cgroup` **is** writable with `sudo` in this
orb (`memory` and `cpu` delegated), so B1's cgroup claims were run live.

Conventions:
- Paths are relative to the clone under `/home/user/workspace/src/<repo>` unless they start with a URL.
- "Upstream default branch" was checked with `gh api repos/<owner>/<repo>/contents/<path> --jq .sha`, compared
  with `git rev-parse HEAD:<path>` in the clone. "Same blob" means the file is byte-identical upstream today.
- Issue/PR searches used `gh issue list` / `gh pr list -R <repo> --search <kw> --state all`. "None found" means no
  relevant hit for the keywords listed.
- Status values: **Reproduced in orb**, **Code reading only**, **Observed, cause unknown**,
  **Already reported upstream**.

Commits studied:

| Repo | Commit (clone HEAD) | Default branch HEAD today |
|---|---|---|
| eunomia-bpf/agentcgroup | `551ca1689b7d` | `main` = same |
| eunomia-bpf/namei_ext | `3f67fcbd663a` (submodule `kernel` → kernel_nameiext `b07117a3cb41`) | `main` = same; kernel_nameiext `master` = `b07117a3cb41` |
| eunomia-bpf/xpu-perf | `b4fcc885875a` (submodule otel fork `e19d3e80f7f7`) | `master` = same |
| eunomia-bpf/libbpf-starter-template | `6e572b6d53ce` | `master` = same |
| eunomia-bpf/libbpf-rs-starter-template | `8927eea171db` | `master` = same |
| libbpf/libbpf-rs | `9680ea7054dc` | not re-checked beyond the one file below |
| eunomia-bpf/eunomia-bpf | `a5408a8c3614` | `master` = same |
| eunomia-bpf/ecli-webui | `6816d61b0319` | `main` = same |
| eunomia-bpf/schedcp | `730e258987d3` | `master` = same |
| eunomia-bpf/GPTtrace | `a1f83c7bf87c` | `main` = same |
| eunomia-bpf/akeep | `7d690362f19d` | `main` = same |
| eunomia-bpf/bpf-developer-tutorial | `110b91f87320` | `main` = same |
| eunomia-bpf/qwen3-ebpf | `3999b887d5af` | `main` = same |

---

### B1. AgentCgroup: the per-tool-call cgroup design conflicts with cgroup v2 rules, and the memcg trigger never fires

Curriculum sources: `eBPFS/chapters/25-agentcgroup.html` L186–218 (Figure 25.1), L292–296 (PR #11), L513–524
(clean-up callout), L704 and L829–835 (PGFAULT/filter), L1171; `eBPFS/reviews/part6.md` L47–48, L61, L172;
`eBPFS/research/25-agentcgroup.md` L87–90, L99.

Repo: eunomia-bpf/agentcgroup @ `551ca1689b7d2d30db6b8a8613414750103cc68b`.

#### B1a. Moving back into `session_high` fails with EBUSY, and `tool_*` cgroups leak

- **Code:**
  - `agentcg/agentcgroupd.py:75` writes `+memory +cpu` to the root's `cgroup.subtree_control`.
    `agentcg/agentcgroupd.py:78` writes `+memory +cpu` to `session_high/cgroup.subtree_control`.
  - `agentcg/bash_wrapper.sh:19` defaults `CGROUP_ROOT` to `/sys/fs/cgroup/agentcg/session_high`.
    `:34` sets `TOOL_CG=$CGROUP_ROOT/tool_$$_<ns>`, `:60` creates it, and `:66` moves `$$` into it.
  - `agentcg/bash_wrapper.sh:117` runs `echo $$ > "$CGROUP_ROOT/cgroup.procs" 2>/dev/null`, then `:118` runs
    `rmdir "$TOOL_CG" 2>/dev/null`. Both errors are thrown away.
- **Status: Reproduced in orb** (kernel 6.1.189+). I ran both the raw cgroup sequence and the real wrapper,
  using `setup_cgroup_hierarchy()` imported from `agentcgroupd.py`.
- **Claim:** cgroup v2's no-internal-process rule means a non-root cgroup with a domain controller in
  `subtree_control` cannot hold processes. The kernel enforces this in `cgroup_migrate_vet_dst()` and returns
  `-EBUSY`. So the move back at L117 fails, the wrapper is still inside `tool_*` when L118 runs, and the `rmdir`
  also fails with EBUSY. Each `bash -c` therefore leaves one empty `tool_*` directory behind. It also means
  nothing can run directly in `session_high`, including the agent framework.
- **Why it matters:** each tool call leaks one cgroup, and long agent sessions accumulate thousands of them. Any
  design or figure that puts the agent process in `session_high` is impossible as configured.
- **Environment:** any cgroup v2 host with root, where `memory` is available in the parent's
  `cgroup.controllers`. The patched kernel is not needed. This orb works.
- **Verification (as run here; adjust the base path if `/sys/fs/cgroup` is not the delegated root):**
  ```bash
  sudo bash -c '
  R=/sys/fs/cgroup/bugcheck_b1; H=$R/session_high; T=$H/tool_test
  mkdir -p $T
  echo "+memory +cpu" > $R/cgroup.subtree_control
  echo "+memory +cpu" > $H/cgroup.subtree_control      # what agentcgroupd.py:78 does
  sleep 300 & P=$!
  echo $P > $T/cgroup.procs;  echo "into tool rc=$?"
  echo $P > $H/cgroup.procs;  echo "back to session_high rc=$?"   # bash_wrapper.sh:117
  cat /proc/$P/cgroup
  rmdir $T;                   echo "rmdir tool rc=$?"             # bash_wrapper.sh:118
  kill $P; wait $P 2>/dev/null; sleep 0.5; rmdir $T; echo "rmdir after exit rc=$?"
  # control: same steps without controllers on session_high
  echo "-memory -cpu" > $H/cgroup.subtree_control; mkdir $T
  sleep 300 & P=$!; echo $P > $T/cgroup.procs; echo $P > $H/cgroup.procs; echo "control back rc=$?"
  rmdir $T; echo "control rmdir rc=$?"; kill $P; wait $P 2>/dev/null; sleep 0.5
  rmdir $H $R'
  ```
  End-to-end with the real scripts (`REAL_BASH` repointed to `/bin/bash` in a scratch copy):
  ```bash
  cd agentcg && sudo python3 -c "import agentcgroupd as d; print(d.setup_cgroup_hierarchy('/sys/fs/cgroup/bugcheck_agentcg'))"
  sed 's#^REAL_BASH=.*#REAL_BASH="/bin/bash"#; 1s#.*#\#!/bin/bash#' bash_wrapper.sh > /tmp/w.sh
  sudo env AGENTCG_ROOT=/sys/fs/cgroup/bugcheck_agentcg/session_high AGENTCG_LOG=/tmp/w.jsonl \
       bash /tmp/w.sh -c 'cat /proc/self/cgroup; echo hi'
  ls -d /sys/fs/cgroup/bugcheck_agentcg/session_high/tool_*     # leaked dir if bug is real
  # cleanup: sudo rmdir .../session_high/tool_* .../session_high .../session_low /sys/fs/cgroup/bugcheck_agentcg
  ```
- **Result here:** the move back printed `write error: Device or resource busy` (rc=1), and the process stayed
  in `/bugcheck_b1/session_high/tool_test`. `rmdir` failed with `Device or resource busy` and only succeeded
  after the process exited. In the control run (no controllers on `session_high`) both steps returned 0. The real
  wrapper ran the command (exit 0, JSONL line written), and `tool_<pid>_<ns>` was still present afterwards.
- **If real:** EBUSY on the move back, EBUSY on `rmdir`, and a leftover `tool_*` after each call. **If not
  real:** both return 0 and no `tool_*` remains.
- **Minimal fix (suggestion):** don't move back at all. Have the wrapper exit or exec from inside the tool
  cgroup, and let a reaper clean up, either the daemon watching `cgroup.events` `populated 0` or a final step run
  after the child exits. Another option is to run the wrapper's own bookkeeping in a sibling leaf
  (`session_high/agent`) and move back into that leaf, never into `session_high` itself. Also stop discarding
  stderr at L117–118.
- **Upstream today:** `agentcg/bash_wrapper.sh` and `agentcg/agentcgroupd.py` are the same blob on `main`
  (`490496a9…`, `6b943b2b…`). **Issue/PR:** none found (searched EBUSY, cgroup.procs, rmdir).

#### B1b. The memcg tracepoint filter only matches `session_high`'s own id

- **Code:** `agentcg/memcg/memcg_priority.bpf.c:66` is `SEC("tp/memcg/count_memcg_events")`, and `:75` is
  `if (ctx->id != local_config.high_cgroup_id || ctx->item != 23) return 0;`. `agentcg/memcg/memcg_priority.c:74`
  sets the id to `st_ino` of the cgroup directory, and `:227` sets `high_cgroup_id` from `--high` (the daemon
  passes `session_high`).
- **Status: Code reading only.** The `memcg:count_memcg_events` tracepoint does not exist on this 6.1 kernel
  (`/sys/kernel/tracing/events/memcg/count_memcg_events` is absent). Mainline
  `include/trace/events/memcg.h` (master, fetched today) has `DEFINE_EVENT(memcg_rstat_events,
  count_memcg_events, …)` with `__entry->id = cgroup_id(memcg->css.cgroup)`.
- **Claim:** page-fault events are charged to the faulting task's own memcg (`count_memcg_event_mm()` →
  `mem_cgroup_from_task()`). After B1a, every agent process lives in a `tool_*` leaf, so no event carries
  `session_high`'s id. `trigger_ts` is never set, and `below_low` / `get_high_delay_ms` never act in the
  daemon + wrapper configuration. (The paper's experiments ran workloads directly in HIGH/LOW cgroups, so they are
  not counter-evidence.)
- **Why it matters:** the headline BPF memcg priority mechanism would do nothing in the shipped
  configuration.
- **Environment:** for the event-id part, any kernel that has the `memcg:count_memcg_events` tracepoint (mainline
  master has it), plus bpftrace and a writable cgroup v2. The full end-to-end check also needs the memcg
  struct_ops RFC series (`agentcg/memcg/patches.mbox`, "[RFC PATCH bpf-next v6 00/12]"), which is not in
  mainline.
- **Verification:**
  ```bash
  # 1) Event ids without the patched kernel
  sudo bpftrace -l 'tracepoint:memcg:count_memcg_events'          # must exist
  sudo mkdir -p /sys/fs/cgroup/b1b/session_high/tool_x
  echo "+memory" | sudo tee /sys/fs/cgroup/b1b/cgroup.subtree_control /sys/fs/cgroup/b1b/session_high/cgroup.subtree_control
  stat -c %i /sys/fs/cgroup/b1b/session_high /sys/fs/cgroup/b1b/session_high/tool_x
  sudo bpftrace -e 'tracepoint:memcg:count_memcg_events { @[args->id, args->item] = count(); }' &
  sudo bash -c 'echo $$ > /sys/fs/cgroup/b1b/session_high/tool_x/cgroup.procs; python3 -c "b=bytearray(200<<20)"'
  # stop bpftrace, then look up the session_high inode among the ids
  # 2) Full path on the patched kernel: start agentcgroupd.py, run a memory-heavy `bash -c` through the wrapper,
  #    then dump the BPF stats map: sudo bpftool map dump name stats ; and name trigger_ts_map
  ```
- **If real:** only the `tool_x` inode appears with PGFAULT items. The `session_high` inode never appears, and
  `trigger_ts_map` stays 0 with the `STAT_*_ACTIVE` counters at 0. **If not real:** events with `session_high`'s
  inode appear (hierarchical attribution), and protection triggers.
- **Minimal fix:** in BPF, test ancestry instead of equality. For example, resolve `ctx->id` to a cgroup with
  `bpf_cgroup_from_id()` and check `bpf_cgroup_ancestor(cg, level) == high` (both are kfuncs). Alternatively,
  keep a map of `tool_*` ids that the wrapper or daemon fills in.
- **Upstream today:** `memcg_priority.bpf.c` is the same blob on `main` (`ddc83113…`). **Issue/PR:** none found
  (searched PGFAULT, tracepoint).

#### B1c. `PGFAULT = 23` is hard-coded

- **Code:** `agentcg/memcg/memcg_priority.bpf.c:74–75` (comment "PGFAULT = 23 in the kernel enum").
- **Status: Reproduced in orb (partly).** On this orb's 6.1 kernel, `bpftool btf dump file /sys/kernel/btf/vmlinux
  format c` gives `PGFAULT = 20` and `PGREFILL = 23`. The config has `CONFIG_ZONE_DMA=y`, `CONFIG_ZONE_DMA32=y`,
  and `# CONFIG_ZONE_DEVICE is not set`. In mainline `include/linux/vm_event_item.h`, `PGFAULT` follows three
  `FOR_ALL_ZONES()` expansions, so its value is `8 + 3 × (number of zones)`. With DMA, DMA32, NORMAL, MOVABLE and
  DEVICE that is 23. Without ZONE_DEVICE it is 20, and HIGHMEM shifts it again. Whether 23 is right for the
  authors' patched kernel was not checked (no such kernel here).
- **Why it matters:** on a kernel built without `CONFIG_ZONE_DEVICE`, the program counts PGREFILL instead of
  page faults. It still loads silently.
- **Environment:** the patched kernel used by the authors, or any kernel with BTF.
- **Verification:** `sudo bpftool btf dump file /sys/kernel/btf/vmlinux format c | awk '/^enum vm_event_item \{/,/^\};/' | grep -n ' PGFAULT '`,
  run on the target kernel.
- **If real:** the value differs from 23 on some supported configs. **If not real:** it is 23 on every kernel the
  project supports, which is still fragile.
- **Minimal fix:** use the CO-RE enum value: `bpf_core_enum_value(enum vm_event_item, PGFAULT)` (libbpf
  `bpf_core_read.h`), with `vmlinux.h` enums.
- **Upstream today:** same blob. **Issue/PR:** none found.

#### B1d. PR #11: the Podman memory parser drops digits ("193MB" → 19 MB)

- **Code:** `analysis/analyze_new_insights.py:63–77` (`_parse_mem_usage`). Every unit branch strips 3 characters
  (`val_part[:-3]`), including the two-letter units `GB`, `MB`, `KB`.
- **Status: Already reported upstream** (issue #10 and PR #11, both OPEN, 2026-10-28). It was also **reproduced in
  orb** by executing the function as written: `'193MB / 1GB'` → 19.0, `'1.5GB / 2GB'` → 1024.0 (should be 1536),
  `'512kB / 1GB'` → 0.0498 (should be 0.5). `'195.7MiB / …'` → 195.7 (correct).
- **Why it matters:** the PR body says the paper's affected §3.3/§4 numbers may need correction.
- **Verification:** `python3 -c "from analysis.analyze_new_insights import _parse_mem_usage as f; print(f('193MB / 1GB'))"`
  from the repo root (or extract the function, as was done here). The bug gives 19.0; the fixed code gives 193.0.
  After PR #11 merges, re-run the §3.3/§4 analysis scripts and diff the tables.
- **Upstream today:** still unfixed on `main` (PR #11 open).

---

### B2. namei_ext: HIDE does not cover unlink, rmdir, mkdir or rename on the last component

Curriculum sources: `eBPFS/chapters/28-namei-ext.html` L108–114, L1225–1231 (Limitations bullet);
`eBPFS/reviews/part6.md` L53, L114 (finding 28.2), L169.

Repos: eunomia-bpf/namei_ext @ `3f67fcbd663a`. Kernel fork eunomia-bpf/kernel_nameiext @ `b07117a3cb41`
(the `kernel` submodule pin, and also `master` HEAD today; base `062871f1371b`, 7.1-rc7 era). Line numbers below
are in `https://raw.githubusercontent.com/eunomia-bpf/kernel_nameiext/b07117a3cb41/fs/namei.c` (6654 lines).

- **Code:**
  - Hooks: `walk_component()` dispatches to `walk_component_namei_ext()` at L2426–2428 (body L2360ff), and
    `open_last_lookups()` dispatches to `open_last_lookups_namei_ext()` at L4863–4865 (body L4799ff). readdir is
    hooked in `iterate_dir()` (fs/readdir.c, not re-located here).
  - Not hooked: `path_parentat()` L2997 runs only `link_path_walk()` + `complete_walk()`, so the last component is
    never walked. `filename_parentat()` is at L3039. `__start_dirop()` L3046 → `lookup_one_qstr_excl()` L3061
    (defined at L1865), and `start_dirop()` is at L3080.
  - Callers: `filename_rmdir()` L5611 → `start_dirop()` L5641. `filename_unlinkat()` L5753 → `start_dirop()` L5776.
    `filename_mkdirat()` L5505 → `filename_create()` L5514 → `start_dirop()` L5167. `filename_renameat2()` L6320
    → `filename_parentat()` ×2, then `lookup_one_qstr_excl()` at L4029/L4035/L4131. Linkat/symlinkat/mknodat also
    go through `filename_create()` (L5385, L5889, L6053).
  - Policy: `bpf/policies/hide_secret.bpf.c` returns HIDE for name `secret` on `BPF_NAMEI_EXT_LOOKUP` and
    `BPF_NAMEI_EXT_READDIR` only.
- **Status: Code reading only.** It needs the patched kernel in KVM; this orb has neither.
- **Claim:** with HIDE attached for `secret`, `stat`/`open`/`access` return ENOENT, and the name is missing from
  `readdir`. But `unlink("secret")` succeeds and `rename("secret", …)` succeeds. `mkdir("secret")` /
  `link(x, "secret")` return EEXIST and `rmdir("secret")` returns ENOTDIR, which reveals the hidden name. So HIDE
  neither protects the object from removal nor hides its existence from directory-modifying calls.
- **Why it matters:** policies such as agent workspace views and secret hiding assume a hidden name is
  untouchable. The repo's docs don't mention this gap.
- **Environment:** a host with KVM and virtme-ng, the repo's kernel build (`make kernel`, CONFIG_NAMEI_EXT), and
  the repo's Phase-1 flow (`mk/kvm.mk` `kvm-functional`, L239–253). The repo's `AGENTS.md` requires Phase 1 to
  run in KVM.
- **Verification:**
  1. `git clone --recursive https://github.com/eunomia-bpf/namei_ext && cd namei_ext && make kernel bpf functional`,
     then confirm `make kvm-functional` passes unmodified (the baseline includes the `hide_secret_*` cases).
  2. Add probe cases to `tests/functional/namei_ext_functional.c` inside the `if (hide_obj_path) { … }` block,
     right after `hide_backing_stat` (L1738) and before the detach at ~L1775. Use non-destructive probes first
     so the later `secret_after_hide_detach` check still holds:
     ```c
     /* expect HIDE to apply → ENOENT; bug → these see the real file */
     errno = 0; int r1 = rename(secret, secret);              /* same-name rename: 0 if found */
     emit_case(out, "hide_secret_rename_self", r1 != 0 && errno == ENOENT, errno, "rename(secret,secret)");
     errno = 0; int r2 = mkdir(secret, 0755);                 /* EEXIST leaks existence */
     emit_case(out, "hide_secret_mkdir", r2 != 0 && errno == ENOENT, errno, "mkdir(secret)");
     errno = 0; int r3 = rmdir(secret);                       /* ENOTDIR leaks existence */
     emit_case(out, "hide_secret_rmdir", r3 != 0 && errno == ENOENT, errno, "rmdir(secret)");
     errno = 0; int r4 = link(native, secret);                /* EEXIST leaks existence */
     emit_case(out, "hide_secret_link", r4 != 0 && errno == ENOENT, errno, "link(native,secret)");
     ```
     For the destructive case, create a second file named `secret` in another directory before the policy is
     attached (for example `<dir>/sub/secret`; the policy matches by name in any managed parent). While attached,
     call `unlink()` on it, then check that `stat()` fails, either while attached or after detach. Don't add these
     to `fails` unless you want the run to go red. Read the emitted JSONL instead.
  3. `make kvm-functional`, then `jq 'select(.case|test("hide_secret_(rename|mkdir|rmdir|link|unlink)"))' results/phase1/<run>/functional.jsonl`.
- **If real:** `rename` returns 0, `mkdir`/`link` give EEXIST, `rmdir` gives ENOTDIR, and `unlink` returns 0 and
  the file is gone after detach. **If not real:** all of them give ENOENT and the file survives `unlink`.
- **Minimal fix:** call the namei_ext lookup in `__start_dirop()` (and the rename variant around L4029–4131)
  with an event such as `BPF_NAMEI_EXT_LOOKUP` plus a "dirop" flag, after `filename_parentat()` returns the parent.
  Map HIDE to `-ENOENT` there. The simplest option is to reject SELECT/REDIRECT on dirops with `-EOPNOTSUPP`, as
  is already done for `LOOKUP_CREATE`. Or document the limitation in `docs/design.md`.
- **Upstream today:** the submodule pin and the fork's `master` are both `b07117a3cb41`, so it is unchanged.
  **Issue/PR:** none found in eunomia-bpf/namei_ext (searched unlink, rmdir, rename, parentat, dirop). The fork has
  no issues searched.

---

### B3. xpu-perf: GPU time likely counted twice, CPU mode gives leaf-only stacks on 6.1, and stale `-gpu-only` docs

Curriculum sources: `eBPFS/chapters/22-xpu-perf.html` L966, L1053, L1081–1082, L1159–1166;
`eBPFS/reviews/part5.md` L45, L98, L160; `eBPFS/research/22-xpu-perf.md` L54–56, L79, L100–115.

Repo: eunomia-bpf/xpu-perf @ `b4fcc885875aacfc7c4605ee5458cea49e9e6672` (submodule
`profiler/opentelemetry-ebpf-profiler` = eunomia-bpf/opentelemetry-ebpf-profiler `e19d3e80f7f7`).

#### B3a. Each GPU kernel's duration is added twice (CUPTI API entry and exit)

- **Code:**
  - `cupti_trace/cupti_trace.cpp:191` defines `XpuPerfGetCorrelationId`. `:214` calls it on every callback, before
    any `callbackSite` test. `:219`/`:226` show the handler itself distinguishes `CUPTI_API_ENTER`, so both ENTER
    and EXIT arrive with the same `correlationId`.
  - `:313–316`: with `CUPTI_ENABLE_CORRELATION_UPROBE=1`, the whole `CUPTI_CB_DOMAIN_RUNTIME_API` domain is
    enabled.
  - `profiler/ebpf/correlation_uprobe.ebpf.c:34` is the uprobe. `profiler/simple_reporter.go:99` →
    `profiler/correlation.go:75` `AddCPUTraceWithCorrelation` appends every hit with no dedup.
  - `profiler/correlation.go:157–205` `correlateByCorrelationID` adds `kernel duration × samplesPerSec` to
    `mergedStacks[stack]` once per CPU trace whose id matches.
- **Status: Code reading only** (no GPU or CUDA in the orb).
- **Claim:** two uprobe hits per runtime API call → two CPU traces with the same correlation id → the kernel's
  duration is added twice, so GPU time in `gpu`/`merge` folded output is about 2× too high. Exact 2× needs both
  hits to yield a stack; the two stacks are normally identical, so they fold to the same line.
- **Why it matters:** the GPU/CPU proportions in the flame graphs are wrong. The chapter's worked example
  (318 samples ≈ 6.4 s) would really be 3.2 s.
- **Environment:** Linux with an NVIDIA GPU, a CUDA toolkit with CUPTI (`nvcc`), Go ≥ 1.24, clang, root; build
  with `cd profiler && make`.
- **Verification:**
  ```bash
  cd profiler && make build test-apps            # builds xpu-perf and the test app (Makefile:7 TEST_APP=$(TEST_DIR)/mock-app/vectorAdd)
  # (1) count uprobe hits per correlation id while the app runs
  # The embedded lib is extracted to $TMPDIR/xpu-perf/libcupti_trace_injection_<pid>.so (profiler/embedded_resources.go:22-37)
  # with a per-run name (whether it is deleted afterwards was not checked), so it is simpler to build cupti_trace/ yourself and probe that copy:
  LIB=$PWD/../cupti_trace/libcupti_trace_injection.so      # adjust to the cupti_trace build output
  sudo bpftrace -e "uprobe:$LIB:XpuPerfGetCorrelationId { @hits[arg0] = count(); }" &   # see documents/test_correlation_uprobe.bt
  sudo ./xpu-perf gpu -cupti-lib $LIB -o /tmp/g.folded $TEST_APP   # flag name per README; check `./xpu-perf gpu -h`
  # (2) compare totals: sum of [GPU_Kernel] samples / 50 Hz vs ground truth
  sudo ./xpu-perf gpu -o /tmp/g.folded $TEST_APP
  awk '/\[GPU_Kernel\]/{s+=$NF} END{print s/50 " s"}' /tmp/g.folded
  nsys profile --stats=true $TEST_APP   # or ncu / CUPTI activity total kernel time
  ```
- **If real:** `@hits[id]` is 2 for each id, and the folded GPU total ≈ 2 × the nsys kernel total. **If not
  real:** 1 hit per id, or the totals agree within sampling error.
- **Minimal fix:** call `XpuPerfGetCorrelationId` only when `callbackSite == CUPTI_API_ENTER` (move the call into
  the RUNTIME_API case under the ENTER branch). Alternatively, dedupe by `CorrelationID` in
  `correlateByCorrelationID`, keeping the first trace per id.
- **Upstream today:** `cupti_trace/cupti_trace.cpp` and `profiler/correlation.go` are the same blob on `master`.
  **Issue/PR:** none found (the repo has no issues, and its only PR is #1, a README fix).

#### B3b. CPU mode on Linux 6.1: leaf-only stacks and 785 "Outer map update failure" warnings

- **Code:** the warning comes from `opentelemetry-ebpf-profiler/processmanager/ebpf/asyncupdate.go:119`
  (fork `e19d3e80`). The worker does `Outer.Update(fileID, innerFD, UpdateNoExist)` at L112–113, or
  `Outer.Delete` at L110, for the stack-delta map-in-map.
- **Status: Observed, cause unknown.** In an earlier session in this orb, `sudo ./xpu-perf cpu -o cpu.folded ./burn`
  wrote "6 unique stacks (2787 total samples)" in ~55 s. Every stack was only the leaf frame, and the run logged 785
  warnings `Outer map update failure: update: invalid argument` / `delete: key does not exist`. Not re-run
  today. The binary `profiler/xpu-perf` (27.5 MB) is still in the clone.
- **Hypothesis (untested):** the native unwinder needs per-executable stack deltas in those inner maps. If the outer
  map update fails with EINVAL (for example, the inner map's attributes don't match the outer map's template), no
  unwind info is loaded, so unwinding stops after the leaf. The `delete: key does not exist` warnings fit inserts
  that never happened. A kernel quirk on 6.1 or the interpreter-only orb (no JIT) may also play a role.
- **Environment:** a normal Linux 6.1 host with JIT enabled, plus a newer kernel (6.8+) for comparison.
- **Verification:**
  ```bash
  cat > /tmp/burn.c <<'EOF'
  __attribute__((noinline)) void leaf_a(void){ for(volatile long i=0;i<200000000;i++); }
  __attribute__((noinline)) void work(void){ for(;;) leaf_a(); }
  int main(void){ work(); }
  EOF
  cc -O1 -fno-omit-frame-pointer -o /tmp/burn /tmp/burn.c
  cd profiler && sudo ./xpu-perf cpu -o /tmp/cpu.folded /tmp/burn 2>&1 | tee /tmp/cpu.log &   # stop after ~20 s
  grep -c 'Outer map update failure' /tmp/cpu.log; cat /tmp/cpu.folded
  sudo bpftool map show | grep -i -E 'stack_delta|exe_id'      # inspect outer/inner map params
  # repeat on a 6.8+ kernel, and with upstream open-telemetry/opentelemetry-ebpf-profiler on the same 6.1 host
  ```
- **If it is an xpu-perf/fork bug:** it reproduces on a normal 6.1 host with JIT, and not with upstream otel
  profiler on the same host. **If it is environmental:** stacks show `main;work;leaf_a` and there are 0 warnings
  on a normal host.
- **Upstream today:** the same submodule pin on `master`. **Issue/PR:** none found ("Outer map", "leaf").

#### B3c. `profiler/README.md` and the Makefile `test` target use the removed `-gpu-only` flag

- **Code:** `profiler/README.md:59` (`sudo ./profile -gpu-only …`), `:62` (`-cpu-only`), and `:86`/`:89` (options
  list). `profiler/Makefile:53` (`./$(BINARY_NAME) --gpu-only -o test.folded $(TEST_APP)`). The binary dispatches
  on `os.Args[1]` in `profiler/main.go:409–426` (`cpu`/`gpu`/`merge`, otherwise "Unknown command").
- **Status: Reproduced in orb.** `sudo ./xpu-perf --gpu-only -o /tmp/x.folded /bin/true` →
  `Error: Unknown command '--gpu-only'`. `-gpu-only` gives `Error: Unknown command '-gpu-only'`.
- **Why it matters:** `make test` cannot pass, and README users get a usage error.
- **Verification:** `cd profiler && sudo ./xpu-perf --gpu-only -o /tmp/x.folded /bin/true` (no GPU needed).
  **If real:** "Unknown command". **If not real:** it profiles.
- **Minimal fix:** `Makefile:53` → `./$(BINARY_NAME) gpu -o test.folded $(TEST_APP)`. Rewrite the README usage as
  `xpu-perf merge|gpu|cpu …`, and replace the `./profile` name with `xpu-perf`.
- **Upstream today:** `profiler/Makefile` and `profiler/README.md` are the same blob on `master`. **Issue/PR:**
  none found.

---

### B4. libbpf-starter-template and libbpf-rs-starter-template build/CI defects

Curriculum sources: `eBPFS/chapters/11-starter-templates.html` L178, L226/L239, L386, L602–611, L767–768,
L1015–1017, L1060–1061, L1097; `eBPFS/reviews/part2.md` L37–38, L124, L127–134.

Repos: eunomia-bpf/libbpf-starter-template @ `6e572b6d53ce`; eunomia-bpf/libbpf-rs-starter-template @
`8927eea171db`; libbpf/libbpf-rs @ `9680ea7054dc`.

#### B4a. C template: `$(wildcard %.h)` never matches, so header edits don't rebuild

- **Code:** `src/Makefile:84` (`$(OUTPUT)/%.bpf.o: %.bpf.c $(LIBBPF_OBJ) $(wildcard %.h) $(VMLINUX)`) and
  `src/Makefile:97` (`$(OUTPUT)/%.o: %.c $(wildcard %.h)`). `wildcard` is expanded when make reads the file, so
  `%` is literal and matches nothing.
- **Status: Reproduced in orb.** I built a copy of the real template (`make -j4` in `src/`, 8 s, rc=0), ran
  `touch bootstrap.h`, then `make` → "Nothing to be done for 'all'" and `make -n` → 0 commands. Control:
  `touch bootstrap.bpf.c` → `make -n` lists 4 commands. A two-rule scratch Makefile showed the same, and
  `make -p` prints the rule as `out/%.o: %.c | out` (the wildcard expanded to empty).
- **Why it matters:** if you change `struct event` in `bootstrap.h`, you silently get stale `.bpf.o`/`.o` with
  mismatched layouts.
- **Verification:** `cp -a libbpf-starter-template /tmp/t && cd /tmp/t/src && make && touch bootstrap.h && make -n | wc -l`.
  **If real:** 0. **If not real:** greater than 0.
- **Minimal fix:** use `%.h` directly when every source has one, or use `-MMD -MP` plus `-include $(wildcard
  $(OUTPUT)/*.d)` as libbpf-bootstrap does. Simplest for this template: `$(OUTPUT)/%.bpf.o: %.bpf.c %.h …` and
  `$(OUTPUT)/%.o: %.c %.h …` (both sources have `bootstrap.h`; a generic template would need the `-MMD` route).

#### B4b. C template: the top-level Makefile calls `make` instead of `$(MAKE)`

- **Code:** `Makefile:2` (`make -C src`) and `Makefile:5` (`make -C src clean`).
- **Status: Reproduced in orb.** Top-level `make -j2` → `make[1]: warning: jobserver unavailable: using -j1.  Add
  '+' to parent make rule.`
- **Why it matters:** `-j`, `-n`, `-k` and command-line variables don't propagate. Parallel builds silently become
  serial.
- **Verification:** `cd /tmp/t && make clean && make -j4 2>&1 | grep jobserver`. **If real:** the warning
  appears. **If fixed:** no warning.
- **Minimal fix:** `$(MAKE) -C src` and `$(MAKE) -C src clean`.

#### B4c. C template: the `docker.yml` digest step references a missing step id

- **Code:** `.github/workflows/docker.yml:52–53` echoes `${{ steps.docker_build.outputs.digest }}`. The only `id:`
  in the file is `buildx` (L30). The build step "Build image and push…" (L40ff) has no `id`.
- **Status: Code reading only** (it needs a GitHub Actions run, and it is cosmetic: it prints an empty line).
- **Verification:** open the latest "docker" workflow run (`gh run list -R eunomia-bpf/libbpf-starter-template
  --workflow docker.yml`, then `gh run view <id> --log | grep -A2 'Image digest'`). **If real:** the echo prints
  an empty line. **If not:** it prints `sha256:…`.
- **Minimal fix:** add `id: docker_build` to the build-push step.

#### B4d. Rust template, and upstream libbpf-rs: `--pid`/`--tid` filters swapped

- **Code:** `src/main.rs:90–91` (`targ_pid = opts.pid; targ_tgid = opts.tid;`, CLI fields at `:26`/`:29`
  documented as "Process PID" and "Thread TID"). `src/bpf/runqslower.bpf.c:43–45` compares `targ_tgid` with
  `tgid` (the kernel's process id) and `targ_pid` with `pid` (the kernel's thread id). Upstream libbpf-rs
  `examples/runqslower/src/main.rs:91–92` has the same assignment (the clone at `9680ea7` and the GitHub default
  branch today both show it).
- **Status: Code reading only** (no cargo build or run here, though `~/.cargo/bin/cargo` exists).
- **Claim:** `runqslower <lat> <PID>` filters on the *thread* id. For a multithreaded process it then shows only
  the main thread. `<tid>` filters on the *process*, so it shows all threads.
- **Environment:** any Linux ≥ 5.x with BTF, Rust, clang, root.
- **Verification:**
  ```bash
  cargo build --release
  # multithreaded load: 4 busy threads plus a CPU hog to create run-queue latency
  python3 -c "import threading; [threading.Thread(target=lambda: [0 for _ in iter(int,1)]).start() for _ in range(4)]" & P=$!
  stress-ng --cpu $(nproc) --timeout 30 &
  ls /proc/$P/task                                   # thread ids
  sudo ./target/release/runqslower 1000 $P 0 | head  # filter by "PID"
  ```
  **If real:** with `pid=$P` only the TID==PID thread appears, and passing `0 $P` (as tid) shows all threads.
  **If fixed:** `pid=$P` shows all of the process's threads.
- **Minimal fix:** `targ_tgid = opts.pid; targ_pid = opts.tid;`, in both the template and upstream libbpf-rs.

#### B4e. Rust template: the README says `make install`, but there is no such target

- **Code:** `README.md:104` ("On Ubuntu, you may run `make install`"). `Makefile` only has `build`/`clean`.
- **Status: Reproduced in orb:** `make -n install` → `make: *** No rule to make target 'install'.  Stop.` (rc=2).
- **Minimal fix:** add an `install:` target that copies the C template's apt-get recipe, or drop the sentence.

#### B4f. Rust template: the release step is gated on `repository_owner == 'eunomia-bpf'`

- **Code:** `.github/workflows/publish.yml:70` (`if: github.event_name == 'push' && github.ref ==
  'refs/heads/master' && github.repository_owner == 'eunomia-bpf'`).
- **Status: Code reading only.** This is a deliberate design choice, not a bug: repos created from the template
  never publish releases until the guard is edited. Verify by pushing to a template-generated repo, where the
  "Publish" step is shown as skipped.
- **Fix if wanted:** document it in the README, or gate on a repository variable instead.

- **Upstream today (all of B4):** `Makefile`, `src/Makefile` and `.github/workflows/docker.yml` (C template), and
  `src/main.rs`, `Makefile`, `README.md` and `.github/workflows/publish.yml` (Rust template), are all the same blob
  on `master`. **Issue/PR:** none relevant (searched wildcard, header, MAKE, digest, tgid, "make install", owner;
  the hits were unrelated build-break issues #1/#2/#4/#7/#10). libbpf/libbpf-rs: none found for `targ_pid`/`tgid`.
  PR #1421 (merged 2026-07-02) refactored runqslower to a ring buffer and left the swap.

---

### B5. eunomia-bpf ecc/ecli: release, packaging and docs problems

Curriculum sources: `eBPFS/chapters/10-eunomia-bpf-ecc-ecli.html` L258–260, L1023, L1049–1053, L1056
(relative-path callout), L1186–1187; `eBPFS/reviews/part2.md` L102, L113, L185, L194;
`eBPFS/research/10-eunomia-bpf-ecc-ecli.md` L74–76, L124–128, L141–149, L152–170.

Repos: eunomia-bpf/eunomia-bpf @ `a5408a8c3614` (release v1.0.38, 2026-03-08); eunomia-bpf/ecli-webui @
`6816d61b0319`.

#### B5a. The ecc v1.0.38 AppImage cannot load the host libclang (GLIBC_2.36)

- **Status: Reproduced in orb, and already reported upstream** (fix PR #394 "Fix ecc AppImage host libclang
  loading" was CLOSED without merge on 2026-03-08; related issue #381 is open). Today
  `gh release download v1.0.38 -p ecc`, then `ecc bootstrap.bpf.c bootstrap.h`, gave:
  `Failed to load libclang dynamically at runtime: the libclang shared library at
  /usr/lib/x86_64-linux-gnu/libclang-14.so.14.0.6 could not be opened:
  /tmp/.mount_ecc…/lib/x86_64-linux-gnu/libc.so.6: version GLIBC_2.36 not found (required by
  /lib/x86_64-linux-gnu/libLLVM-14.so.1)`. `--appimage-extract` shows the bundled `libc.so.6` tops out at
  `GLIBC_2.35`, and the `AppRun` is a cargo-appimage static-pie runner. Host glibc is 2.36 (Debian 12).
  Note: GitHub marks **v1.0.37** as "Latest", so `releases/latest/download/ecc` gets 1.0.37, which bundles
  libclang and worked in an earlier session.
- **Why it matters:** anyone who picks v1.0.38 explicitly, on any host whose libLLVM needs a newer glibc than 2.35,
  cannot compile.
- **Environment:** an x86-64 host with glibc > 2.35 and a host libclang (Debian 12, Ubuntu 24.04, Fedora).
- **Verification:** `gh release download v1.0.38 -R eunomia-bpf/eunomia-bpf -p ecc && chmod +x ecc && ./ecc
  examples/bpftools/bootstrap/bootstrap.bpf.c examples/bpftools/bootstrap/bootstrap.h`. **If real:** the GLIBC
  error above. **If fixed (new release):** package.json is generated.
- **Minimal fix:** what PR #394 proposed: don't bundle host runtime libs or the loader into the ecc AppImage, and
  use a plain AppRun. Then publish v1.0.39.

#### B5b. Relative paths under `sudo` sometimes treated as OCI registry refs

- **Code:** `ecli/ecli-lib/src/runner/helper.rs:24–64` (`try_load_program_buf_and_guess_type`). If
  `PathBuf::from(url).exists() && is_file()` is false, it tries `url::Url::parse`, and otherwise falls through to
  an OCI pull.
- **Status: Observed, cause unknown. Not reproduced today.** An earlier session saw intermittent
  `Not authorized: url https://registry-1.docker.io/v2/library/package.json/manifests/latest` or `invalid
  reference format` for `sudo ecli run package.json` with an existing relative file. Today, 6 runs from `/tmp/…`
  and 5 from a `/home/user/…` dir all took the local-file path (an error parsing the dummy `{}`, not an OCI error).
  What does reproduce: when the relative file is missing or unreadable, the error is a confusing docker.io "Not
  authorized" message (`sudo ecli run nosuch.json`). Related history: issue #264 (closed 2023) had the same symptom
  ("relative URL without a base"). PR #394's description says the ecc AppRun needed to "return to `OWD`",
  which suggests the cargo-appimage runner may not preserve the working directory reliably.
- **Environment:** a normal Linux host with sudo (not gVisor); run the ecli v1.0.38 AppImage and the
  `ecli-x86_64-unknown-linux-gnu.tar.gz` non-AppImage build side by side.
- **Verification:** `cd /some/dir && cp …/package.json . && for i in $(seq 50); do sudo ./ecli run package.json
  2>&1 | grep -q 'registry-1.docker.io\|invalid reference' && echo FAIL; done | sort | uniq -c`. Repeat with
  `sudo -E` and with `cd` into a dir under `$HOME` (mode 0700). Print `sudo ./ecli` with `RUST_LOG=debug` to see
  the "Read from local file" line. **If real:** non-zero FAIL count. **If not:** 0.
- **Minimal fix:** if the argument has a `.json`/`.wasm`/`.tar` suffix, or contains `/`, and the file is missing,
  report "file not found" instead of falling through to OCI. Resolve relative paths against `$OWD` when running
  as an AppImage.

#### B5c. ecli-webui's downloaded packages are rejected by current ecli

- **Code:** `ecli-webui/src/views/MainView.vue:420–447`: `bpf_object = btoa(raw ELF)` with no zlib, and
  `meta.bpf_skel = {data_sections:[], maps:[], progs:[]}` with no `obj_name`. `program_type: "wasm"` is set at
  L446, and the download at L363–376 decodes once and saves `package.json`. The loader requires
  `obj_name` (`eunomia-bpf/bpf-loader-rs/bpf-loader-lib/src/meta/mod.rs:406`) and inflates zlib
  (`mod.rs:508`, "Malformed compressed data").
- **Status: Reproduced in orb** with a replica: the same JSON shape built in Python around a trivial clang-built
  tracepoint `.bpf.o`, run with ecli v1.0.38 under sudo. Result: `Invalid param: Failed to deserialize package to
  object: Malformed json provided: missing field obj_name`. With `obj_name` added: `Malformed compressed data:
  unknown ZLIB method CM=0xf` (0x7f is the first ELF byte). The web app itself was not run in a browser.
- **Environment:** a browser for the real app (`npm i && npm run dev` in ecli-webui), plus ecli ≥ 1.0.x on Linux
  with root.
- **Verification:** compile the default example in the web UI, click download, then `sudo ecli run
  /abs/path/package.json`. **If real:** the `missing field obj_name` error. **If fixed:** the program loads.
- **Minimal fix:** in MainView.vue, zlib-deflate the ELF before base64 (pako `deflate`, zlib wrapper), and set
  `bpf_skel.obj_name` (for example `"main_bpf"`). It is better to generate `bpf_skel` with real maps/progs (for
  example, run bpftool-wasm as the sibling `eunomia-bpftool-wasm` repo does). Also note that the "wasm" program
  type label is wrong for a JSON package.

#### B5d. README `/// @export` and `ecli push package.json` don't match the code

- **Code:** `compiler/README.md:156–159`, `:254`, `:376`, `:515`, `:523` describe a `/// @export` annotation. The
  compiler instead picks every `struct X {` in the header passed to ecc, using a regex
  (`compiler/cmd/src/export_types.rs:20`, dummy pointers at `:50`). `compiler/README.md:463` shows
  `ecli push package.json ghcr.io/yourorg/tool:v1.0`, but `ecli push` takes `--module app.wasm` (default) and an
  image (`ecli/client/src/main.rs:148`, `ecli/README.md:71–83`).
- **Status: Code reading only** (push was not tested: no registry credentials).
- **Verification:** (1) Remove `/// @export` from a header struct, compile, and see whether it is still in
  `export_types` (`jq '.meta.export_types[].name' package.json`). **If the doc is wrong:** it is still exported.
  (2) `ecli push package.json ghcr.io/<you>/t:1` with credentials. **If the doc is wrong:** the positional is not
  accepted as a module, or it pushes `app.wasm`.
- **Fix:** fix the README text. Open issue #386 (2026-08-09) plans to replace regex export extraction, which is
  related but not the doc fix.

#### B5e. Documented example URLs return 404

- **Code/docs:** `eunomia-sdks/eunomia-otel/README.md:11` links
  `https://eunomia-bpf.github.io/eunomia-bpf/opensnoop/package.json`, and `internal-docs/POSITIONING.md:557` shows
  `…/sigsnoop/package.json`. The sigsnoop and bootstrap URLs come from the docs per the research notes
  (exact doc page not re-located in this clone).
- **Status: Reproduced in orb** (today, `curl -L -w %{http_code}`): `…/bootstrap/package.json` 404,
  `…/sigsnoop/package.json` 404, `…/opensnoop/app.wasm` 404, `…/opensnoop/package.json` 404.
- **Verification:** the same curl commands. **If fixed:** 200 and valid JSON.
- **Fix:** re-run `.github/workflows/example-publlish.yml` (gh-pages deploy), or remove the URLs. Open issue #404
  ("Release surface: audit official installation channels") is related.

- **Upstream today (B5):** `ecli/ecli-lib/src/runner/helper.rs`, `compiler/README.md`,
  `bpf-loader-rs/bpf-loader-lib/src/meta/mod.rs` and `eunomia-sdks/eunomia-otel/README.md` are the same blob on
  `master`. `src/views/MainView.vue` is the same blob on ecli-webui `main`. No release newer than v1.0.38.
  **Issue/PR:** #394 (closed unmerged) and #381 (open) for B5a; #264 (closed 2023) similar to B5b; #386 and #404
  (open) related to B5d/B5e. None for ecli-webui (its PRs #3–#7 are from 2023).

---

### B6. schedcp and GPTtrace: config and CLI mismatches

Curriculum sources: `eBPFS/chapters/30-llm-kernel-tooling.html` L790–791, L899, L907–909, L1302, L1310, L1376;
`eBPFS/reviews/part7.md` L57; `eBPFS/research/30-llm-kernel-tooling.md` L48–49, L60, L118.

Repos: eunomia-bpf/schedcp @ `730e258987d3`; eunomia-bpf/GPTtrace @ `a1f83c7bf87c`.

#### B6a. schedcp reads `SUDO_PASSWORD` in one place and `SCHEDCP_SUDO_PASSWORD` in others

- **Code:** `mcp/src/main.rs:316–325` (MCP server startup) reads `SUDO_PASSWORD`, and otherwise tries passwordless
  sudo. `mcp/src/cli.rs:88` and `:112` read `SCHEDCP_SUDO_PASSWORD`, and so does
  `mcp/src/scheduler_generator.rs:350` (`spawn_with_sudo`, used by create_and_verify). The docs only tell users to
  set `SCHEDCP_SUDO_PASSWORD` (`README.md:116`, `:129`, `document/USAGE_GUIDE.md:86`, `:107`, `CLAUDE.md:249`).
- **Status: Code reading only** (no sched_ext kernel here).
- **Claim:** a user who follows the README runs the MCP server with only `SCHEDCP_SUDO_PASSWORD` set. On a host
  without passwordless sudo, the server's own scheduler runs get an empty password ("Schedulers will run without
  sudo"), while the generator path works. This gives inconsistent permission failures.
- **Environment:** a sched_ext kernel (≥ 6.12), a schedcp build (`cd mcp && cargo build --release`), and a user
  whose sudo requires a password.
- **Verification:** `export SCHEDCP_SUDO_PASSWORD=<pw>; unset SUDO_PASSWORD; RUST_LOG=info ./target/release/schedcp`
  (`mcp/Cargo.toml` defines bins `schedcp` = `src/main.rs`, the MCP server, and `schedcp-cli` = `src/cli.rs`),
  then check the log. **If real:** "No SUDO_PASSWORD environment
  variable set and passwordless sudo not available", and running a scheduler through the MCP tool fails with
  permission errors. Then set `SUDO_PASSWORD` too, and it works. **If not real:** the first configuration works.
- **Minimal fix:** in `main.rs:316`, read `SCHEDCP_SUDO_PASSWORD` first and fall back to `SUDO_PASSWORD`.

#### B6b. The template comment says 3 ms, but `SHORT_SLICE_NS` is 30 ms

- **Code:** `mcp/new_sched/example.bpf.c:70` is `#define SHORT_SLICE_NS  30000000ULL   /* 3ms for short tasks */`.
  `:71` is `LONG_SLICE_NS 15000000ULL /* 15ms */`. So "short" tasks currently get a *longer* slice (30 ms) than
  long tasks (15 ms), which is the opposite of what the comments intend. `:77` selects between the two.
- **Status: Code reading only** (arithmetic: 30,000,000 ns = 30 ms).
- **Why it matters:** this file is the example the LLM agent copies when generating new schedulers, so the error
  spreads into generated code.
- **Verification:** none needed beyond reading. To show the behavioural effect, load it on a sched_ext kernel and
  run `schbench` with and without the fix.
- **Minimal fix:** `3000000ULL`, or fix the comment if 30 ms was intended (then revisit the long/short ordering).

#### B6c. GPTtrace `-c CMD_NAME QUERY` alone fails: argparse still requires `input_string`

- **Code:** `gpttrace/GPTtrace.py:19–23` (`-c/--cmd`, `nargs=2`) and `:32`
  (`parser.add_argument('input_string', …)`, a required positional). `:39–40` dispatches to `cmd()`. The README
  usage block at `README.md:83–94` advertises `[-c CMD_NAME QUERY]`.
- **Status: Reproduced in orb**, by executing `main()` from the file with `cmd`/`execute` stubbed out and
  `OPENAI_API_KEY=dummy`. `['-c','opensnoop','trace open files']` gives `error: the following arguments are
  required: input_string` and exits 2. `['-c','opensnoop','trace open files','extra']` reaches `cmd()`.
  `['some query']` reaches `execute()`.
- **Environment:** Python 3 (`pip install -e .` in GPTtrace). An API key is only needed past argument parsing.
- **Verification:** `OPENAI_API_KEY=x python3 -m gpttrace -c opensnoop "trace open files"; echo $?`. **If real:**
  the argparse error and exit code 2. **If fixed:** it proceeds to the bcc-tool path.
- **Minimal fix:** `parser.add_argument('input_string', nargs='?', …)`. The existing `else: parser.print_help()`
  branch then handles the no-argument case.

- **Upstream today (B6):** the four schedcp files and `gpttrace/GPTtrace.py` are the same blob on the default
  branch. **Issue/PR:** none found (schedcp: SUDO_PASSWORD, password, slice; GPTtrace: -c, cmd, input_string,
  argparse).

---

### B7. akeep: `--provider` accepts `agent-sight` but rejects `agentsight` (the README/archive spelling)

Curriculum sources: `eBPFS/chapters/27-actime-and-akeep.html` L1230–1237 ("Small inconsistency observed"
callout); `eBPFS/research/27-actime-and-akeep.md` L193–195.

Repo: eunomia-bpf/akeep @ `7d690362f19d9341b78f99d610a09488c2d020c1`.

- **Code:** `src/providers.rs:16–24`: `#[serde(rename_all = "kebab-case")]` plus `#[value(rename_all = "kebab-case")]`
  on `enum Provider { AgentSight, ClaudeCode, Codex, Grok, KimiCode, OpenCode }`. With kebab-case, the clap values
  and serde names become `agent-sight`, `claude-code`, `codex`, `grok`, `kimi-code`, `open-code`. But `Provider::id()`
  (`src/providers.rs:39–46`) returns `agentsight` and `opencode`, which are the archive prefixes and the spelling
  in `docs/providers.md:12,17`, `docs/configuration.md:122,127–128` and `PROVIDER-REPORT.md:11`. The flag is
  defined at `src/cli.rs:192–193` (`#[arg(long, value_enum)] pub provider: Option<Provider>`).
- **Status: Observed in an earlier session in this orb, and confirmed by code reading today.** An earlier session
  built akeep release, saw `akeep checkout --provider agentsight` rejected with "invalid value", and saw `status
  --json` report `"provider": "agent-sight"`. That binary was deleted, and no built binary exists now (no
  `target/`), so it was not re-run today.
- **Why it matters:** users who type the documented id get an error. Two spellings also leak into JSON output and
  manifests: `src/manifest.rs:44` and `:65` serialize `Provider` with serde, so manifests store `agent-sight`
  while archive paths use `agentsight/`.
- **Environment:** Rust stable (`~/.cargo/bin/cargo` exists in this orb; the earlier build took 1m59s with `-j2`).
- **Verification:**
  ```bash
  cargo build --release -j2
  ./target/release/akeep checkout HEAD --provider agentsight --to /tmp/x; echo rc=$?
  ./target/release/akeep checkout HEAD --provider agent-sight --to /tmp/x; echo rc=$?   # needs a vault; arg parsing is what matters
  ./target/release/akeep checkout --help | grep -A3 -- --provider                     # lists possible values
  ```
  **If real:** the first command fails with `error: invalid value 'agentsight' for '--provider <PROVIDER>'`
  (possible values: agent-sight, claude-code, codex, grok, kimi-code, open-code). **If fixed:** both spellings
  are accepted.
- **Minimal fix:** on the clap side only, add
  `#[value(name = "agentsight", alias = "agent-sight")]` on `AgentSight` and
  `#[value(name = "opencode", alias = "open-code")]` on `OpenCode`. Do **not** change the serde names without a
  migration, because existing manifests contain `agent-sight`/`open-code`. A `#[serde(alias = …)]` would make
  both readable.
- **Upstream today:** `src/providers.rs` is the same blob on `main` (`f0088e9d…`). **Issue/PR:** none found
  (provider, agentsight, kebab).

---

### B8. bpf-developer-tutorial: lesson 44 uses pre-6.13 sched_ext kfunc names, and the eunomia CI job is broken

Curriculum sources: `eBPFS/chapters/09-bpf-developer-tutorial.html` L1014–1017, L1109–1125 ("Version drift"
callout), L1336–1337, L1393.

Repo: eunomia-bpf/bpf-developer-tutorial @ `110b91f87320a952c4c55dba1d6e8e3f814a789c`.

#### B8a. Lesson 44 (scx_simple) likely fails to load on Linux ≥ 6.17

- **Code:** `src/44-scx-simple/scx_simple.bpf.c:68`, `:79` (`scx_bpf_dispatch`), `:90` (`scx_bpf_dispatch_vtime`)
  and `:97` (`scx_bpf_consume`). These are declared as strong (non-`__weak`) `__ksym` in
  `src/44-scx-simple/include/scx/common.bpf.h:39–43`. Only the `*_from_dsq` variants at `:46–47` are `__weak`.
- **Status: Code reading only, plus a kernel-source check.** Today, `kernel/sched/ext.c` at v6.16 has
  `BTF_ID_FLAGS(func, scx_bpf_dispatch, KF_RCU)` (L6423) and `BTF_ID_FLAGS(func, scx_bpf_consume)` (L6738). The
  same file at v6.17 has zero matches for `scx_bpf_dispatch`/`scx_bpf_dispatch_vtime`/`scx_bpf_consume`, and 17
  for `scx_bpf_dsq_insert`. Not loaded anywhere: this orb has no sched_ext. The repo's CI only builds the lesson
  (`.github/workflows/test-libbpf.yml:129`, `make -C src/44-scx-simple`).
- **Claim:** libbpf cannot resolve strong kfunc externs that are missing from vmlinux BTF, so `scx_simple` fails
  at load with an error like `extern (func ksym) 'scx_bpf_dispatch': not found in kernel or module BTFs`.
- **Environment:** a Linux ≥ 6.17 host or VM with `CONFIG_SCHED_CLASS_EXT=y` and BTF. For a control, use a
  6.12–6.16 kernel.
- **Verification:**
  ```bash
  git clone --recursive https://github.com/eunomia-bpf/bpf-developer-tutorial && cd bpf-developer-tutorial
  make -C src/44-scx-simple
  sudo bpftool btf dump file /sys/kernel/btf/vmlinux | grep -E "FUNC 'scx_bpf_(dispatch|consume|dsq_insert)"
  sudo ./src/44-scx-simple/scx_simple; echo rc=$?
  ```
  **If real:** on 6.17+, BTF lists only `scx_bpf_dsq_insert*`, and scx_simple fails with the "not found in kernel
  or module BTFs" error. On 6.16 it loads and prints `local=… global=…`. **If not real:** it loads on 6.17+.
- **Minimal fix:** port to the new names (`scx_bpf_dsq_insert`, `scx_bpf_dsq_insert_vtime`,
  `scx_bpf_dsq_move_to_local`), or refresh `include/scx/*` and `scx_simple.bpf.c` from the kernel's current
  `tools/sched_ext/`, which uses `compat.bpf.h` wrappers. Also fix the README build instructions (they point to
  the kernel's `tools/sched_ext/`).
- **Issue/PR:** none found (scx_simple, sched_ext, scx_bpf_dispatch, 6.17; PR #212 is an unrelated compatibility
  matrix).

#### B8b. The eunomia CI job fails on `ubuntu-latest`: `llvm-14-dev` is gone

- **Code:** `.github/workflows/test-eunomia.yaml:16` (`runs-on: ubuntu-latest`) and `:26`
  (`sudo apt install clang llvm-14-dev llvm`).
- **Status: Already reported upstream.** PR #236, "ci: pin eunomia example tests to Ubuntu 22.04 for LLVM 14",
  opened 2026-11-04, is OPEN, and its CI run 41886433396 succeeded. Confirmed in CI logs today: scheduled runs
  41256561216 (2026-11-01) and 40147118821 (2026-10-25) failed. The 11-01 log shows `Image: ubuntu-26.04` …
  `Error: Unable to locate package llvm-14-dev` … `exit code 100`.
- **Verification:** `gh run list -R eunomia-bpf/bpf-developer-tutorial --workflow test-eunomia.yaml --limit 5`.
  After #236 merges, the next scheduled `main` run should succeed.
- **Minimal fix:** PR #236 (pin `ubuntu-22.04`). Longer term, drop the `llvm-14-dev` pin (ecc ≥ 1.0.37 bundles
  libclang).

- **Upstream today (B8):** `main` HEAD is still `110b91f8` (2026-09-05), so both are unchanged.

---

### B9. qwen3-ebpf: `make test` does not compile against libbpf 1.1 (`bpf_map_get_info_by_fd`)

Curriculum sources: `eBPFS/chapters/29-qwen3-ebpf.html` L1285, L1310, L1316–1319;
`eBPFS/research/29-qwen3-ebpf.md` L83–86.

Repo: eunomia-bpf/qwen3-ebpf @ `3999b887d5af5656f81ce09156501eccf091efeb`.

- **Code:** `tests/batch-smoke.c:32` calls `bpf_map_get_info_by_fd(map_fd, &info, &info_len)`. `Makefile:3` has
  `CFLAGS ?= -O2 -Wall -Wextra -Werror`. `Makefile:59–60` builds `build/%-smoke` with that CFLAGS and links
  `-lbpf`. `Makefile:92` (`test:`) depends on `$(SMOKE_BINS)`. libbpf added the symbol in `LIBBPF_1.2.0`
  (`libbpf/src/libbpf.map:384–389` in the local libbpf clone).
- **Status: Reproduced in orb** (libbpf 1.1.2 from Debian 12 via pkg-config). `cc -O2 -Wall -Wextra -Iinclude -c
  tests/batch-smoke.c` gives `warning: implicit declaration of function 'bpf_map_get_info_by_fd'; did you mean
  'bpf_obj_get_info_by_fd'?`. With the Makefile's `-Werror` that is a hard error, and linking would also fail
  (the symbol does not exist in libbpf 1.1). I did not run `make test` in the clone today, to avoid touching its
  `build/`. An earlier session did, and it failed the same way.
- **Why it matters:** this is a portability and documentation gap, not a logic bug. `docs/usage.md:10–21`
  targets Ubuntu 24.04, whose libbpf-dev is 1.3, but states no minimum libbpf version. Debian 12 (1.1) and
  Ubuntu 22.04 (0.5) cannot build the tests.
- **Environment:** any host with libbpf < 1.2 headers and library (Debian 12 works; this orb works).
- **Verification:** `pkg-config --modversion libbpf && make build/batch-smoke`. **If real (libbpf < 1.2):** an
  `implicit declaration of function 'bpf_map_get_info_by_fd'` error. **With ≥ 1.2:** it builds. Workaround used
  earlier: `make test CFLAGS="-O2 -Wall -Wextra -Dbpf_map_get_info_by_fd=bpf_obj_get_info_by_fd"`.
- **Minimal fix:** call `bpf_obj_get_info_by_fd()`, which exists since libbpf 0.x and has the same arguments for
  map fds. Alternatively, document "libbpf ≥ 1.2" in `docs/usage.md`.
- **Upstream today:** `tests/batch-smoke.c` is the same blob on `main` (`50e59953…`). **Issue/PR:** none (the repo
  has no issues or PRs).

---

## Clean-up done in the orb

Removed all scratch state: the cgroups `/sys/fs/cgroup/bugcheck_b1` and `/sys/fs/cgroup/bugcheck_agentcg`
(including the leaked `tool_*`), plus `/tmp/b1scratch`, `/tmp/b2dl`, `/tmp/b4mk`, `/tmp/b4tpl`, `/tmp/b5bin`,
`/tmp/b5work`, `/tmp/b6`, `/tmp/b9` and `/home/user/b5rel`. No repository clone or curriculum file was modified,
and nothing was committed or pushed.

