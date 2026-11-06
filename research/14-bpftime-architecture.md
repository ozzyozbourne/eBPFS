# Research notes — Chapter 14: bpftime architecture

## Source studied

- Repo: https://github.com/eunomia-bpf/bpftime
- Clone: `git clone --depth 1 --filter=blob:limit=2m` into `/home/user/workspace/src/bpftime` (no submodules; not built)
- Commit: `25e250d651ad1d2a2608bbbaeaf7b9ee90cca401` (2026-11-03, "refactor: use argparse for bpftimetool commands (#719)")
- Submodules NOT fetched (so not read): `vm/llvm-jit` (= eunomia-bpf/llvmbpf), `third_party/ubpf`, `bpftime-verifier/ebpf-verifier` (= vbpf/ebpf-verifier, PREVAIL), `third_party/bpftool`, spdlog, argparse, Catch2.

## Papers (verified on publisher pages 2026-11-06)

1. Y. Zheng, T. Yu, Y. Yang, Y. Hu, X. Lai, D. Williams, A. Quinn. "Extending Applications Safely and Efficiently". 19th USENIX OSDI '25, Boston, July 7–9 2025, pp. 557–574. ISBN 978-1-939133-47-2.
   - Page: https://www.usenix.org/conference/osdi25/presentation/zheng-yusheng
   - PDF: https://www.usenix.org/system/files/osdi25-zheng-yusheng.pdf
   - Affiliations: UC Santa Cruz (Zheng, Yang, Quinn), eunomia-bpf Community (Yu), ShanghaiTech (Hu), SCUT (Lai), Virginia Tech (Williams). Note: USENIX page lists "Andi Quinn"; repo BibTeX also uses "Quinn, Andi".
2. Y. Zheng, T. Yu, Y. Yang, Y. Hu, X. Lai, A. Quinn. "bpftime: userspace eBPF Runtime for Uprobe, Syscall and Kernel-User Interactions". arXiv:2311.07923 [cs.OS], v1 14 Nov 2023, v2 8 Dec 2023. https://arxiv.org/abs/2311.07923 (arXiv lists "Andrew Quinn"; journal-ref field says "OSDI 2025"). Abstract claims "userspace uprobes achieve a 10x speed enhancement compared to their kernel counterparts".
3. LPC 2023 talk: "bpftime: Fast uprobes with user space BPF runtime", Yusheng Zheng (PLCT Lab), co-authors Tong Yu, Yiwei Yang; Nov 14 2023. https://lpc.events/event/17/contributions/1639/
4. zpoline: K. Yasukata, H. Tazaki, P.-L. Aublin, K. Ishiguro, "zpoline: a system call hook mechanism based on binary rewriting", USENIX ATC '23, pp. 293–300. https://www.usenix.org/conference/atc23/presentation/yasukata. zpoline README: replaces `syscall`/`sysenter` with `callq *%rax`, trampoline at VA 0; requires `echo 0 > /proc/sys/vm/mmap_min_addr`.
5. Related cited by the OSDI paper: ERIM (USENIX Security '19), RLBox (USENIX Security '20), Jia et al. "Fast (trapless) kernel probes everywhere" (USENIX ATC '24), PREVAIL = Gershuni et al. PLDI 2019 "Simple and precise static analysis of untrusted Linux kernel extensions", KFlex = Dwivedi et al. SOSP '24 "Fast, flexible, and practical kernel extensions".

## Paper facts used (quoted from the OSDI PDF)

EIM (§3):
- "EIM's key idea is to represent the extension features that might be necessary for interconnectedness or restricted for safety as a resource ... EIM models the ability to use a resource as a capability."
- Two parts: development-time spec (application developer) and deployment-time spec (extension manager).
- Development-time: State_Capability (read(var)/write(var)), Function_Capability (name, prototype, constraints = pre/post conditions), Extension_Entry (name, host function, prototype). Figure 2 example: readPid = read(ngx_pid); nginxTime: (void)->time_t, constraints {rtn > 0}; entries processBegin = ngx_http_process_request, updateResponseContent = ngx_http_content_phase.
- Deployment-time: Extension_Class (name, extension_entry, allowed = {...}). Resource capabilities: instructions and memory. Figure 3: observeProcessBegin allowed = {instructions<inf, nginxTime, readPid, read(r)}; updateResponse allowed = {instructions<inf, read(r), write(r)}.
- §4: dev-time via annotations "based upon eBPF's kfunc annotations"; deployment-time via "a YAML configuration language"; built-in classes "observability" and "customizability"; auto-generated uprobe/uretprobe/sysenter/sysexit entries.
- Verifier: converts EIM into constraints; uses DWARF→BTF; function capabilities → "mock new eBPF kfunc"; constraints → assertions; uses the eBPF verifier.
- Rewriter: "uses ptrace to pause the host application and load the bpftime user runtime"; "instruments ... using Frida and libcapstone"; uprobes: "replaces the instructions that were originally at the hook point with a call into a preamble ... places the overwritten instructions at the end of its preamble"; syscalls: zpoline "uses the zero page to accommodate two-byte call instructions"; "only supports a single extension per entry point".
- Isolation: ERIM-style MPK; WRPKRU before extensions; extension pages non-writable; "currently susceptible to the syscall-based attacks on ERIM". "Our current implementation only supports isolation on Intel x86".
- Maps: three sharing modes: local process, shared across processes, shared across processes and kernel.
- TCB: kernel eBPF verifier, binary rewriter, OS, hardware memory protection. "We implemented bpftime in 13,000 lines of code".
- Threat model: trusted-but-fallible app and extension developers; trusted infallible extension manager; untrusted users; assumes CFI-like integrity of control flow.

Evaluation numbers (§6, exact):
- Servers: A = dual Xeon Gold 5418Y (24 cores, 2.00 GHz, 45 MB LLC), 256 GB DDR5; B = dual Xeon E5-2697-v2 (48 cores, 2.7 GHz, 30 MB LLC), 256 GB DDR3.
- Intro summary: microservice profiling throughput ×1.5 vs eBPF; Redis durability config loses orders of magnitude less data, ~10% throughput drop; FUSE caching orders of magnitude; Nginx 2% overhead, "up to 5× lower" than Wasm, Lua, ERIM, RLBox; SSL monitoring overhead reduced ×3.79 vs eBPF.
- Nginx (wrk 8 threads, 64 conns, 30 s, 20 runs): bpftime 2%; Lua 11% and Wasm 12% → "5.5× and 6× lower overhead"; ERIM 11%, RLBox 9% → "5.5× and 4.5×". Figure 6 RPS values: Native 4536, Baseline C 4559, bpftime 4461, RLBox 4148, ERIM 4024, WebAssembly 4007, Lua 3982 (figure bar labels; ordering assumed to match legend order).
- DeepFlow: native 250,000 req/s small, 47,000 large; eBPF DeepFlow throughput drops up to 54%; port changed 10 of 5,000 lines of eBPF.
- sslsniff: eBPF up to 28.06% drop; bpftime worst case 7.41% (unit cut off in extraction; presumably %).
- FUSE table: Passthrough fstat 3.65 s → .176 s; LoggedFS fstat 7.40 → .184; LoggedFS openat 17.0 → 0.074; Passthrough find 5.1 → 1.6.
- Table 3 (ns, eBPF vs bpftime): Uprobe 2561.57 / 190.02; Uretprobe 3019.45 / 187.10; Syscall tracepoint 151 / 232; user mem read 23.3 / 1.5; user mem write 23.9 / 1.4; hash_map_update 50.8 / 23.8; hash_map_delete 19.5 / 10.1; hash_map_lookup 9.8 / 22.0. "more than an order of magnitude faster ... for uprobe and uretprobe, but about 1.5x slower for syscall tracepoint".
- Engine: ×1.53 vs ubpf and ×1.72 vs rbpf average latency over 8 microbenchmarks.
- Load latency: 48 ms into running process vs 30 ms with LD_PRELOAD.
- Cost breakdown: 190 ns with trampoline, 106 ns without trampoline but with engine, 1.35 ns without both; trampoline adds 84 ns; MPK on/off no measurable difference.
- Compatibility: 17 BCC and bpftrace tools without code changes; bpf-conformance: bpftime fails 1 test, ubpf 22, rbpf 23.
- Figure 10 (syscount + nginx) RPS labels: 19705, 17676, 17817, 19042, 19803 (legend Native/Untargeted/Targeted × Kernel/bpftime; exact mapping not recoverable from text extraction → NOT used in chapter).

## Code facts (paths relative to repo root, commit above)

Directory map (top level): `attach/`, `runtime/`, `vm/`, `bpftime-verifier/`, `daemon/`, `tools/{cli,bpftimetool,aot}`, `example/`, `benchmark/`, `third_party/`, `cmake/`.

Loader / syscall-server — `runtime/syscall-server/`:
- `syscall_server_main.cpp`: exports `syscall`, `mmap`, `mmap64`, `munmap`, `ioctl`, `epoll_create1/ctl/wait`, `close`, `open`, `openat`, `read`, `fopen`, `fopen64`, `_IO_new_fopen`. Next symbols via `dlsym(RTLD_NEXT, ...)`. In `syscall()`: dispatch `__NR_bpf` → `handle_sysbpf`, `__NR_perf_event_open` → `handle_perfevent`, also `dup3`, `memfd_create`. Exceptions fall back to the original call.
- `syscall_context.hpp`: `init_original_functions()` then `unsetenv("LD_PRELOAD")` so children are not polluted. MOCKED_UPROBE_TYPE_VALUE = 9, MOCKED_KPROBE_TYPE_VALUE = 8.
- `syscall_context.cpp`: env `BPFTIME_RUN_WITH_KERNEL`, `BPFTIME_NOT_LOAD_PATTERN`. `handle_sysbpf` cases: MAP_CREATE, MAP_LOOKUP/UPDATE/DELETE/LOOKUP_AND_DELETE/GET_NEXT_KEY, PROG_LOAD, LINK_CREATE, MAP_FREEZE (no-op), OBJ_GET_INFO_BY_FD, PROG_ATTACH; default → real syscall.
  - PROG_LOAD: verifier only when compiled with ENABLE_BPFTIME_VERIFIER and prog_type is TRACEPOINT ("tracepoint") or SOCKET_FILTER ("uprobe"); modes STRICT/WARNING/NO_VERIFY via `BPFTIME_VERIFIER_LEVEL`. Then `bpftime_progs_create`.
  - run_with_kernel: `create_kernel_bpf_prog_in_userspace` — real `bpf(BPF_PROG_LOAD)` (kernel verifier), optionally replaced by trivial `r0=0; exit` when name matches `BPFTIME_NOT_LOAD_PATTERN`; then copies insns, rewrites `LDDW` map fd imms to kernel map IDs, stores in shm.
  - MAP_CREATE with kernel: creates kernel map and a shm map of type `attr->map_type + KERNEL_USER_MAP_OFFSET` (1000).
  - `handle_perfevent`: uprobe type (from `/sys/bus/event_source/devices/uprobe/type`, mocked to 9 if absent) → `bpftime_uprobe_create(pid, name=config1, offset=config2, retprobe, ref_ctr_off)`; kprobe; tracepoint → `bpftime_tracepoint_create`; software; BPF_TYPE_UREPLACE; BPF_TYPE_UPROBE_OVERRIDE.
- `syscall_server_utils.cpp`: `start_up()` (call_once): shm create-only/open, `begin_new_session()`, verifier helper set, `setenv("BPFTIME_USED","1",0)`; mocked sysfs files.

Shared memory — `runtime/src/`:
- `handler/handler_manager.hpp`: `DEFAULT_GLOBAL_SHM_NAME = "bpftime_maps_shm"` (override env `BPFTIME_GLOBAL_SHM_NAME`); `handler_variant = std::variant<unused_handler, bpf_map_handler, bpf_link_handler, bpf_prog_handler, bpf_perf_event_handler, epoll_handler, memfd_handler>`; vector of handlers in shm, index = fake fd.
- `bpftime_shm_internal.cpp` ctor: `managed_shared_memory(open_only, name)` for agent (SHM_OPEN_ONLY), `create_only`/`open_or_create` with `memory_size << 20` for server; named objects `bpftime_handler`, `bpftime_syscall_pid_set`, `bpftime_runtime_config`, `bpftime_alive_agent_pids`, `bpftime_alive_syscall_server_pids`, `bpftime_pid_set_lock`, `bpftime_global_epoch_state`. Epoch seqlock (odd = updating).
- Config: `runtime/include/bpftime_config.hpp` — shm 50 MB default (`BPFTIME_SHM_MEMORY_MB`), max fd 6144 (`BPFTIME_MAX_FD_COUNT`), default VM "llvm" (or "ubpf" if built without LLVM JIT; `BPFTIME_VM_NAME`), verifier mode default WARNING, log `~/.bpftime/runtime.log`.
- Maps: `bpf_map/userspace/` (array, hash fix/var, per-cpu, LRU, LPM, bloom, queue, stack, ringbuf, perf_event_array, prog_array, stack_trace, map-in-maps); `bpf_map/shared/` (kernel-user hash/array/percpu_array/perf_event_array); `bpf_map/gpu*`. `var_hash_map.hpp`: `boost::unordered_map<bytes_vec, bytes_vec, ..., allocator<..., segment_manager>>`. Default hash impl `fix_size_hash_map_impl` unless `BPFTIME_USE_VAR_HASH_MAP`. Kernel-user hash map calls `bpf_map_lookup_elem` (libbpf → syscall); kernel-user array map `mmap`s the kernel map.
- Locking: `map_handler.cpp` — `pthread_spin_lock` guard when `impl->should_lock`.
- MPK: `BPFTIME_ENABLE_MPK` (default OFF): `pkey_alloc(0, PKEY_DISABLE_WRITE)`, `pkey_mprotect` over the whole shm segment; `bpftime_prog_exec` calls `bpftime_protect_disable()` before and `bpftime_protect_enable()` after. Protects the shm (maps) from writes by host code outside program execution. Differs in detail from paper's WRPKRU-in-extension description.
- Probe read/write: `bpf_helper.cpp` — default build (`ENABLE_PROBE_READ_CHECK`/`WRITE_CHECK` ON) uses `process_vm_readv/writev` on own pid; otherwise plain `memcpy`.

Agent — `runtime/agent/agent.cpp`:
- LD_PRELOAD path: overrides `__libc_start_main`, wraps main with `bpftime_hooked_main` which calls `bpftime_agent_main("")`.
- Injection path: Frida calls exported `bpftime_agent_main(data, stay_resident)`.
- `bpftime_agent_main`: retry shm open (60 × 50 ms), `SHM_OPEN_ONLY`; register attach impls: syscall_trace (ATTACH_SYSCALL_TRACE) if libbpf build; uprobe: trap backend if `BPFTIME_HAVE_TRAP_UPROBE_ATTACH` (riscv64 only) else frida (`ATTACH_UPROBE, ATTACH_URETPROBE, ATTACH_UPROBE_OVERRIDE, ATTACH_UREPLACE`); CUDA if enabled; then `init_attach_ctx_from_handlers`. Agent IPC server (unix socket), `force_reinit`, `auto_refresh_ms`, detach via SIGUSR1/IPC.
- `_bpftime__setup_syscall_trace_callback(hooker)` swaps the transformer's hook pointer for `syscall_callback` → `syscall_trace_attach_impl::dispatch_syscall`.

CLI — `tools/cli/main.cpp`: subcommands `load`, `start [-s]`, `attach [-s] PID`, `detach`, `trace --pid/--pidof/--auto-refresh-ms`. `load` = fork+exec with `LD_PRELOAD=libbpftime-syscall-server.so`; `start` = LD_PRELOAD agent (or transformer + `AGENT_SO`); `attach` = `frida_injector_inject_library_file_sync(injector, pid, path, "bpftime_agent_main", arg, ...)`. CLI only built if `BPFTIME_ENABLE_FRIDA` (tools/CMakeLists.txt). usage.md: "The command line tool is a wrapper of LD_PRELOAD and can work with ptrace to inject".

Attach — `attach/`:
- `base_attach_impl/base_attach_impl.hpp`: `detach_by_id`, `create_attach_with_ebpf_callback(ebpf_run_callback&&, const attach_private_data&, int attach_type)`, `register_custom_helpers`, `call_attach_specific_function`; `bpftime_set_retval`, `bpftime_override_return`.
- `frida_uprobe_attach_impl/src/frida_internal_attach_entry.cpp`: `gum_make_probe_listener` (uprobe) / `gum_make_call_listener(nullptr, on_leave)` (uretprobe), `gum_interceptor_attach` within begin/end_transaction; override → `gum_interceptor_replace(..., __bpftime_frida_attach_manager__override_handler)`; listeners convert `GumCpuContext` → `pt_regs`.
- `trap_uprobe_attach_impl/`: riscv64-only ebreak + SIGTRAP backend; selected at compile time when `BPFTIME_ENABLE_TRAP_UPROBE` (forced ON on riscv, OFF elsewhere, `cmake/StandardSettings.cmake`). README perf table (2026-09-05): x86_64 Xeon 8259CL kernel uprobe 4706 ns, frida 1346 ns; riscv64 SG2042 trap 5654 ns (different machines).
- `text_segment_transformer/text_segment_transformer.cpp`: zpoline-style. mmap page 0 RWX, 512 × `0x90` nops, then `push %rax; movabs $syscall_hooker_asm,%rax; jmp *%rax`; mprotect page 0 to PROT_EXEC only. Parse `/proc/self/maps`, skip `[stack]`/`[vsyscall]`/page 0, disassemble each executable mapping with capstone (`cs_disasm_iter`), replace `syscall`/`sysenter` with `ff d0` (`call *%rax`), except its own `syscall_addr`. `syscall_hooker_asm` handles rt_sigreturn (15), clone (56), clone3 (435) specially. x86-64 only (aarch64 TODO). Errors call `exit(1)` (contrary to AGENTS.md host contract — observation).
- `agent-transformer.cpp`: needs `AGENT_SO`; `setup_syscall_tracer()` then `dlmopen(LM_ID_NEWLM, agent_so, RTLD_NOW|RTLD_LOCAL)` (fresh libc copy in a new link-map namespace, loaded after rewriting so its syscalls are not rewritten — inference), then `_bpftime__setup_syscall_trace_callback`.
- `nv_attach_impl/`: CUDA (owned by chapter 15/20).

Attach context — `runtime/src/attach/bpf_attach_ctx.cpp`: `init_attach_ctx_from_handlers` scans every allocated handler with epoch check; prog handler → `bpftime_prog` (VM) + helpers; link handler → finds attach impl by perf event's attach type → `create_attach_with_ebpf_callback(lambda: set cookie; prog->bpftime_prog_exec(mem, size, ret))`. Failure to attach is not an error ("agent might be attach to a unrelated process").

VM — `vm/`: `vm-core/include/ebpf-vm.h` C API (`ebpf_create(vm_name)`, `ebpf_register`, `ebpf_load`, `ebpf_exec`, `ebpf_compile`); `compat/include/bpftime_vm_compat.hpp` `bpftime_vm_impl` virtual interface; `compat/llvm-vm` registers "llvm", `compat/ubpf-vm` registers "ubpf" via constructor. `bpftime_prog_exec`: JIT fn or `ebpf_exec`. EBPF_STACK_SIZE 512, MAX_EXT_FUNCS 8192.

Verifier — `bpftime-verifier/src/bpftime-verifier.cpp`: wraps PREVAIL (`unmarshal`, `ebpf_verify_program`) with options check_termination=true etc.; platform only accepts sections starting with uprobe/uretprobe/tracepoint. Build option `ENABLE_EBPF_VERIFIER` default OFF (installation.md + cmake/StandardSettings.cmake:95). Observation (not run): libbpf loads SEC("uprobe") as BPF_PROG_TYPE_KPROBE; syscall-server only maps TRACEPOINT and SOCKET_FILTER to a section, so a KPROBE-typed program would skip PREVAIL — unverified by execution.

Daemon — `daemon/`:
- `kernel/bpf_tracer.bpf.c`: tracepoints on sys_enter/exit of open, openat, bpf, perf_event_open, close, ioctl; sched_process_exec/exit. On `BPF_PROG_LOAD`: copies insns into a map; if `enable_replace_prog` (default false) rewrites insns to trivial `r0=0; exit` via `bpf_probe_write_user`. On uprobe `perf_event_open`: if `enable_replace_uprobe` (default true) and offset allowed, overwrite `probe_offset=0` and uprobe path with `new_uprobe_path` ("/a", set in `user/bpf_tracer.cpp:202`), so the kernel uprobe is not created on the real target; on exit restores the user buffers and sends event to daemon.
- `user/bpftime_driver.cpp`: gets kernel prog by id, reads `xlated_prog_insns` (post-verifier), relocates, `bpftime_progs_create(kernel_id, ...)`; maps mirrored as kernel-user maps via `bpf_map_get_fd_by_id`; `SHM_REMOVE_AND_CREATE`.
- `user/daemon_config.hpp` defaults listed above.

Example — `example/malloc/malloc.bpf.c`: `SEC("uprobe/libc.so.6:malloc")`, hash map `libc_malloc_calls_total`, `bpf_printk`.

Build commands (installation.md / Makefile): `make release JOBS=$(nproc)`; `make release-with-llvm-jit`; `cmake -Bbuild -DCMAKE_BUILD_TYPE=Release -DBPFTIME_LLVM_JIT=YES`; `cmake -DENABLE_EBPF_VERIFIER=YES ...`; deps `libelf-dev libssl-dev zlib1g-dev make cmake git libboost-all-dev ...`.
Run commands (README/usage.md): `bpftime load ./example/malloc/malloc`; `bpftime start ./example/malloc/victim`; `sudo bpftime attach <pid>`; `bpftime start -s example/opensnoop/victim`; `LD_PRELOAD=.../libbpftime-syscall-server.so ...`; `BPFTIME_RUN_WITH_KERNEL=true`; `sudo build/daemon/bpftime_daemon`.

## Discrepancies / caveats noted for the chapter

- Paper's EIM YAML + annotation toolchain: no "EIM"/"Extension_Class"/YAML code found in this repo (`grep` over the tree except third_party). Treat EIM as paper design; not shipped in master at this commit.
- Paper's MPK description (WRPKRU around extension, extension memory non-readable) vs code (pkey over shm segment, off by default).
- Paper: Frida + capstone + zpoline; code matches (frida-gum interceptor; capstone in transformer). Paper says rewriter uses ptrace; code uses `frida_injector_*` (frida-core), and usage.md says ptrace.
- README claims "up to 10x speedup"; paper Table 3 shows 2561.57 vs 190.02 ns (≈13.5×, my arithmetic).
- Not verified: frida-gum internal trampoline byte layout; behaviour of the PREVAIL submodule code; whether uprobe programs reach PREVAIL in practice.
