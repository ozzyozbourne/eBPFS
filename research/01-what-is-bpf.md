# Research notes — Chapter 01: What is BPF?

Date: 2026-11-05. Environment for captured output: Amp orb, Linux 6.1.189+ x86_64,
Debian 12 packages tcpdump 4.99.3 / libpcap 1.10.3, bpftrace 0.17.0, bpftool v7.1.0
(libbpf 1.1), clang 14.0.6.

## Sources read (all fetched and checked)

| Source | URL | Used for |
|---|---|---|
| McCanne & Jacobson, "The BSD Packet Filter: A New Architecture for User-level Packet Capture", USENIX Winter 1993 (preprint dated 19 Dec 1992; conference Jan 25–29 1993, San Diego) | https://www.tcpdump.org/papers/bpf-usenix93.pdf | origin, design constraints, accumulator+index machine, instruction format, numbers |
| LWN, "BPF: the universal in-kernel virtual machine" (Corbet, 2014) | https://lwn.net/Articles/599755/ | Jay Schulist, 3.0 JIT, 3.15 split classic/internal, 2→10 regs, 64-bit |
| LWN, "A JIT for packet filters" (2011) | https://lwn.net/Articles/437981/ | Eric Dumazet JIT, x86-64 only |
| LWN, "Yet another new approach to seccomp" (Jan 2012) | https://lwn.net/Articles/475043/ | Will Drewry reuses BPF for seccomp |
| LWN, "Extending extended BPF" (Corbet, 2 Jul 2014) | https://lwn.net/Articles/603983/ | eBPF exposed to user space, verifier, maps |
| LWN, "The BPF system call API, version 14" (Corbet, 24 Sep 2014) | https://lwn.net/Articles/612878/ | bpf(int cmd, union bpf_attr*, size); maps; merged to net-next 26 Sep 2014, aimed at 3.18 |
| LWN, "A thorough introduction to eBPF" (Matt Fleming, 2 Dec 2017) | https://lwn.net/Articles/740157/ | verifier overview, program types, "up to four times faster" claim for 3.15 |
| Kernel commit bd4cf0ed331a "net: filter: rework/optimize internal BPF interpreter's instruction set" (Alexei Starovoitov; "Joint work with Daniel Borkmann") | https://github.com/torvalds/linux/commit/bd4cf0ed331a275e9bf5a49e6d0fd55dffc551b8 | list of ISA changes (2→10 regs, 32→64 bit, jt/fall-through, 512 B stack, bpf_call, XADD, mov replaces tax/txa) |
| bcc docs/kernel-versions.md | https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md | feature → kernel version table |
| docs.kernel.org networking/filter | https://docs.kernel.org/networking/filter.html | LSF, struct sock_filter, SO_ATTACH_FILTER, bpf_asm, seccomp asm example, "cBPF translated to eBPF internally" |
| docs.kernel.org seccomp_filter | https://docs.kernel.org/userspace-api/seccomp_filter.html | prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, prog), no_new_privs, return values |
| docs.kernel.org BPF Design Q&A | https://docs.kernel.org/bpf/bpf_design_QA.html | "Is BPF a generic VM? NO", stable ABI, kprobes/tracepoints not ABI, kfuncs not stable, 512 B stack, 1M insn complexity limit |
| docs.kernel.org sysctl/kernel | https://docs.kernel.org/admin-guide/sysctl/kernel.html | unprivileged_bpf_disabled 0/1/2, BPF_UNPRIV_DEFAULT_OFF |
| ebpf.io What is eBPF | https://ebpf.io/what-is-ebpf/ | definition, "eBPF no longer an acronym", JavaScript analogy (safety, continuous delivery, performance), kernel module drawbacks |
| Brendan Gregg, "Learn eBPF Tracing: Tutorial and Examples" (1 Jan 2019) | https://www.brendangregg.com/blog/2019-01-01/learn-ebpf-tracing.html | the "eBPF does to Linux what JavaScript does to HTML. (Sort of.)" quote and "more like the v8 VM" caveat |
| Brendan Gregg, "BPF: A New Type of Software" (2 Dec 2019) | https://www.brendangregg.com/blog/2019-12-02/bpf-a-new-type-of-software.html | Netflix 15 / Facebook 40 BPF programs by default; "generic kernel execution engine" |
| kernelnewbies Linux 3.5 | https://kernelnewbies.org/Linux_3.5 | seccomp filtering in 3.5, released 21 Jul 2012; Chromium uses it |
| kernelnewbies Linux 6.12 | https://kernelnewbies.org/Linux_6.12 | sched_ext in 6.12, released 17 Nov 2024 |
| RFC 9669 "BPF Instruction Set Architecture (ISA)" | https://www.rfc-editor.org/rfc/rfc9669.html | IETF Standards Track, Oct 2024, D. Thaler ed. |
| Wikipedia, Berkeley Packet Filter | https://en.wikipedia.org/wiki/Berkeley_Packet_Filter | cross-check only (3.18 eBPF VM, 3.19 sockets, 4.1 tc; 5.3 bounded loops); not cited as primary |
| libbpf-bootstrap @ 820a1bd8b4f4cb4b78b442ae4eb3994738651f12 | https://github.com/libbpf/libbpf-bootstrap | examples/c/minimal.bpf.c, examples/c/minimal.c, README build commands |
| Linux samples/seccomp/dropper.c (master) | https://github.com/torvalds/linux/blob/master/samples/seccomp/dropper.c | real seccomp-bpf code by Will Drewry |

## Facts from the 1993 paper

- Abstract: register-based filter evaluator "up to 20 times faster than the original design"
  (CSPF, stack-based); overall "up to 100 times faster than Sun's NIT".
- Intro: "10 to 150 times faster than Sun's NIT and 1.5 to 20 times faster than CSPF".
- Two architectural improvements: register-based filter machine; non-shared buffer model.
- Filter model: CFG (first used by NNStat) vs CSPF's boolean expression tree.
- Design constraints (verbatim list): protocol independent; general; minimise packet data
  references; decoding = single C switch; abstract registers in physical registers.
- Machine: accumulator, index register x, scratch memory store, implicit PC.
- Instruction: opcode:16 jt:8 jf:8 k:32. Jumps are forward offsets from next insn
  (8-bit, so max 256); `jmp` uses 32-bit k.
- Out-of-bounds packet reference terminates filter with 0. Division by zero terminates.
- Header parsing example: `ldx 4*([14]&0xf)` / `ldh [x+16]` — exactly what tcpdump emits today.
- Measurements: BPF tap ~6 µs vs NIT 89 µs per packet (accept all); 148 ns/byte vs 216 ns/byte.
- Filter optimizer lives in tcpdump's BPF compiler (later split out as libpcap).
- Footnote: CSPF authors said its filter language was "not a result of careful analysis
  but rather embodies several accidents of history".

## Linux history (verified versions)

- Linux Socket Filter: LWN 599755 says "Support for BPF in Linux was added by Jay Schulist
  for the 2.5 development kernel". Other secondary sources say 2.1.x/2.2. **Exact version
  unverified** → chapter says "late 1990s / early 2000s, credited to Jay Schulist" without a number.
- 3.0 (2011): Eric Dumazet's cBPF JIT, x86-64 only (LWN 437981, 599755).
- 3.5 (released 21 Jul 2012): seccomp-bpf (Will Drewry) — kernelnewbies 3.5.
  NB: LWN 599755 says "In the 3.4 kernel" — conflicts; kernelnewbies 3.5 + release notes win.
- 3.15: commit bd4cf0ed331a, internal eBPF interpreter; cBPF translated (bcc table).
- 3.16: x86-64 JIT for eBPF (bcc table, commit 622582786c9e).
- 3.18: bpf() syscall + maps (99c55f7d47c0). Release 7 Dec 2014 (kernelnewbies via Wikipedia).
- 3.19: socket attach (BPF_PROG_TYPE_SOCKET_FILTER), hash & array maps.
- 4.1: kprobes, tc cls_bpf/act_bpf. 4.2 tail calls. 4.4 bpffs pinning, non-root socket progs.
- 4.7 tracepoints; 4.8 XDP; 4.9 perf events; 4.10 cgroup skb/sock; 4.15 bpftool in tree;
  4.16 bpf2bpf calls; 4.18 BTF, AF_XDP; 5.2 1M insn limit; 5.3 bounded loops;
  5.5 BPF trampoline (fentry/fexit, BPF_PROG_TYPE_TRACING); 5.6 struct_ops;
  5.7 LSM; 5.8 ring buffer, iterators; 5.10 sleepable programs; 6.12 sched_ext.
- RFC 9669 (Oct 2024) standardises the ISA.

## What changed classic → extended (commit bd4cf0ed331a message)

- registers 2 → 10 (plus read-only frame pointer R10); 32-bit → 64-bit
- jt/jf → jt/fall-through; signed > and >=; arithmetic right shift, endianness conversion
- 16 × 4-byte scratch slots → up to 512 bytes of stack
- bpf_call instruction + register passing convention (R1–R5 args, R0 return)
- atomic add (XADD); tax/txa → mov
- cBPF still accepted; kernel converts to the new format.

## Captured output in this orb (used verbatim in chapter)

- `tcpdump -d -y EN10MB 'ip and tcp dst port 22'` (11 insns) and `-dd` hex.
- `sudo bpftrace -e 'BEGIN { printf("hello, world\n"); exit(); }'` → "Attaching 1 probe...", "hello, world".
- `sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'` worked;
  `tracepoint:syscalls:*` and kprobes were not available in this orb's kernel config, so
  the chapter notes that.
- `clang -g -O2 -target bpf -c minimal.bpf.c` → "ELF 64-bit LSB relocatable, eBPF";
  `llvm-objdump -d` disassembly; section list (license, .bss, .rodata, .BTF, .BTF.ext, tp/syscalls/sys_enter_write).
  Needed `-I/usr/include/x86_64-linux-gnu` on Debian for asm/types.h.
- `bpftool prog load minimal.bpf.o /sys/fs/bpf/minimal` + `prog show` + `prog dump xlated`;
  the orb's kernel reported "not jited" (JIT not enabled here) — chapter mentions this.
- A deliberately broken program (missing NULL check after bpf_map_lookup_elem) rejected:
  "R0 invalid mem access 'map_value_or_null'". Illustrative code, labelled as such.
  Scratch files were in /tmp/ch01 and removed.

## Kernel tree map (paths checked on GitHub master)

kernel/bpf/{verifier.c,syscall.c,core.c}, net/core/filter.c, arch/x86/net/bpf_jit_comp.c,
include/uapi/linux/{bpf.h,filter.h}, kernel/seccomp.c, tools/lib/bpf, tools/bpf/bpftool,
samples/bpf, samples/seccomp, tools/testing/selftests/bpf, Documentation/bpf.

## Not verified / left out

- Exact kernel version of the first Linux Socket Filter (2.1.x vs 2.2 vs 2.5 disagreement).
- Daniel Borkmann's exact role beyond "Joint work with Daniel Borkmann" in commit bd4cf0ed331a
  and co-maintainership (not separately checked here — chapter says co-developer only).
- Performance claims beyond what the commit/LWN/paper state.
- Default value of unprivileged_bpf_disabled on particular distros.
- Bylines of LWN 437981, 475043, 599755 could not be extracted from the fetched pages; references list them without an author.
- ebpf.io kernel-patch wording verified verbatim: "Change kernel source code and convince the Linux kernel community that the change is required. Wait several years for the new kernel version to become a commodity."
