# 29 — qwen3-ebpf research notes

Repo: https://github.com/eunomia-bpf/qwen3-ebpf
Commit studied: 3999b887d5af5656f81ce09156501eccf091efeb (2026-10-27, "Smooth the bpfllm report prose")
Clone: /home/user/workspace/src/qwen3-ebpf (depth 1). MIT license. ~1 MB (paper PDF is 450 KB).

## Files read (all)
README.md, Makefile, docs/{architecture,usage,experiments}.md, paper/{README.md,bpfllm.tex},
src/infer.c, src/serve_xdp.c, src/safetensors.c, src/qwen3_tokenizer.c,
src/bpf/qwen3_{batch,norm,rope,silu,vector,attention,arena_bf16}.bpf.c,
experiments/qwen3_{matvec,int4,int8,arena_int4}.bpf.c, include/*.h, tests/*.

## Two execution modes
1. Operator mode (default `make` -> build/infer): C loop in src/infer.c schedules
   bounded BPF programs (SEC("socket")) through BPF_PROG_RUN
   (`bpf_prog_test_run_opts`, 64-byte zero packet, repeat=1) — `call_kernel()` in infer.c.
   Never attached to a socket. Weights: BF16 safetensors mmapped read-only in C; active rows
   converted to Q24 int32 in C (lookup table of 65,536 BF16 patterns, safetensors.c
   `safetensors_read_bf16_q24_at`), written into mmapable BPF array map `batch`
   (struct qwen3_batch_work: 128 rows x 3072 cols int32 = ~1.51 MiB).
2. Event mode (build/serve-xdp): src/bpf/qwen3_arena_bf16.bpf.c. Loader copies full BF16
   payload (1.5 GB) into BPF arena pages allocated by a SEC("syscall") program
   (`bpf_arena_alloc_pages`). SEC("xdp") `qwen3_event_xdp` parses UDP/49002 packets with
   magic Q3BP (token+pos, full logits), Q3BF (prefill, no logits), Q3BR (poll). XDP only
   CAS's status READY/DONE->RUNNING and calls bpf_wq_start; the bpf_wq callback
   `event_callback` is a state machine (stages Q,K,V,ATTENTION,O,GATE,UP,DOWN,FINAL_NORM,
   LOGITS) that does one 128-row batch (or one attention position) per callback and
   requeues itself with bpf_wq_start. Result returned by XDP_TX on a later Q3BR poll:
   Q3BA + token(4B BE) + Q16 logit (8B) + counter; Q3BK ack for prefill.
   KV limit 256 positions (QWEN3_EVENT_KV_LIMIT), single global session.
   Arena map_extra 1<<44 on x86 (1<<32 arm64); max_entries = 768Mi/2048+512 pages.

## Number formats (no FP in BPF)
- Activations Q16 int32; matrix weights Q24 int32; RMSNorm weights Q20 (official weights exceed Q24 range);
  RoPE sin/cos Q20; accumulators s64; dot >> 24 -> Q16.
- isqrt64: 24 Newton iterations; eps 1e-6 = 4295 in Q32.
- SiLU / exp(-x): (1 - x/1024)^1024 via 10 squarings in Q32; |x|>=16 saturates.
- Attention: online (streaming) softmax with running max and mass; score scale 1/sqrt(128) = 5793/65536.
- XDP path computes RoPE sin/cos in BPF via Taylor series (6 terms) in Q30, inv freqs table rope_freq_q48 (theta 1e6).
- Default path computes sin/cos in C with libm (`kernel_rope` in infer.c).
- Logits: tied embeddings — vocab projection uses model.embed_tokens.weight (151,936 rows), argmax fused into matrix callback (track_argmax).

## Verifier handling
- Every operator: bpf_loop over rows/tiles/heads with a callback that re-looks-up the single-entry map;
  inner loops `#pragma clang loop unroll(disable)` bounded constant loops.
- Index masking (`row & (ROWS-1)`, `& 4095u`), asm volatile("" : "+r"(index)) to stop clang
  from folding the mask away, power-of-two capacities (vector capacity 4096 for max 3072).
- "An earlier monolithic [RMSNorm] implementation exceeded the verifier's one-million-instruction
  processing budget" -> split into two bpf_loop callbacks.
- BF16->Q24 conversion inside the 3072-col loop failed: "The sequence of 8193 jumps is too complex" -> lookup tables.
- No tail calls used. Program splitting = separate BPF objects per operator (batch, norm, silu, vector, rope, attention).
- Scheduling across invocations: C loop (operator mode) or bpf_wq self-requeue (event mode).

## KV cache
- Operator mode: BPF_MAP_TYPE_ARRAY `kv` in qwen3_attention.bpf.c, value qwen3_kv_pair (128 K + 128 V int32 = 1 KiB),
  slot = (pos*28 + layer)*8 + kv_head; max_entries set by loader = positions*28*8 -> 224 KiB/position
  (8.75 GiB at 40,960). Attention scans history in chunks of 256 positions per invocation.
- GQA: 16 Q heads, 8 KV heads; heads[kv*2], heads[kv*2+1] share one KV lookup.

## Model facts used (Qwen3-0.6B, from repo constants)
28 layers, hidden 1024, 16 Q heads / 8 KV heads, head_dim 128 (Q width 2048), intermediate 3072,
vocab 151,936, context 40,960, RoPE theta 1,000,000, EOS 151645. Model file 1,503,300,328 bytes
(SHA-256 f47f7117...874b per experiments.md).

## Repo-reported numbers (docs/experiments.md; Linux 6.17 arm64, shared host, single runs)
- WikiText-2 excerpts: rows 3–4, 423 tokens: eBPF NLL 1358.512 / ppl 24.819 / 401.580 s vs BF16 CPU 1344.427 / 24.006 / 6.407 s (4 threads).
  Row 1011, 124 tokens: 352.885 / 17.216 / 114.904 s vs 342.837 / 15.876 / 3.674 s.
- First end-to-end: token 0 -> 9, token 1 -> 14582, matching HF BF16; logits MAE 0.052/0.030, RMSE 0.065/0.038; 8.47/8.57 s.
- Tile driver 8.526 s -> batched mmap driver 3.695 s for token 0.
- bpf syscalls per token: 496,730 lseek + 291,467 read + 143,667 bpf (before mmap) -> 143,667 bpf;
  4->16 rows: 50,667; ... 128 rows 16,043; fused argmax 12,482; vector 9,205; RoPE 7,217; SiLU 5,229; QK norm 4,587; attention all heads 4,169.
- Q24 lookup: one-token 1.425/1.576/1.476 s -> 1.154/1.258/1.049 s.
- Resident arena vs default: one-token forward 1.213 s vs 1.089 s; wall incl. load 1.412 vs 2.176 s.
- XDP full model single token: 580.090–580.711 ms (X925 CPU5) vs arena CLI 0.813–0.817 s; A725: 1221.6–1222.5 ms vs 1.858–1.860 s.
- 131-token full projection XDP: 93.170/88.794 s vs one-core BF16 incremental 26.924/19.240 s. Even/odd accumulators: median 93.170 -> 87.149 s (~6.5%).
- 256 prefixes over two excerpts: 251 argmax match; 4 of 5 diffs are BF16 ties.
- INT4 naive: changes tokens (9 -> 284 etc), MAE 1.837/1.396/0.981. INT8 g32: "Hello, world!" -> 20166 vs 1096.
- Q8 one-row: -0.0367 vs Q24 -0.00838 vs BF16 -0.00837.

## Related work (from experiments.md)
qwen3.c (adriancable), qwen3.cu (gigit0000), KernelX (pie-314), bpf-developer-tutorial xpu/flamegraph.

## Hands-on in this orb (2026-11-06; Linux 6.1.189+ x86_64, no BPF JIT, clang 14.0.6, libbpf 1.1)
- `make`: all six BPF objects compile with clang 14. build/infer link needed `sudo apt-get install libjson-c-dev libonig-dev`.
- `sudo make test` with libbpf 1.1 fails to compile tests/batch-smoke.c (bpf_map_get_info_by_fd is libbpf >= 1.2);
  worked around with CFLAGS="... -Dbpf_map_get_info_by_fd=bpf_obj_get_info_by_fd" (no repo edit).
- Results:
  - `./build/safetensors-smoke` -> "BF16 to Q24: all 65,536 bit patterns matched" (pure C)
  - `./build/matvec-smoke build/qwen3_matvec.bpf.o` -> "kernel matvec mode=0: 3072 MACs, sum=-2294, tiles=24 (matches C reference)"
    (loop-only program, no callbacks -> runs in interpreter)
  - batch: "callbacks are not allowed in non-JITed programs" / "processed 52325 insns (limit 1000000) ... peak_states 447"
  - int4: processed 115291 insns; int8: 79983; silu: 22562; vector_add: 1478; rope: 2114; attention_cached: 5480 — all same rejection.
  => verifier analysis succeeds; load is refused at the JIT/fixup stage because the interpreter cannot run bpf_loop callbacks.
- Did NOT download model (1,503,300,328 bytes, slightly above 1.5 GB decimal; and full path cannot load anyway).
- Arena/XDP path not attempted: needs Clang 19, libbpf with arena support, bpf_wq (kernel >= 6.10), arena (>= 6.9).

## Verified references (2026-11-06)
- Qwen3 Technical Report, arXiv:2505.09388 (2025) — confirms GQA, SwiGLU, RoPE, RMSNorm pre-norm, no QKV bias, QK-Norm.
- GQA arXiv:2305.13245 (EMNLP 2023); RoFormer arXiv:2104.09864; online softmax arXiv:1805.02867; I-BERT arXiv:2101.01321.
- LiteFlow SIGCOMM 2022 doi 10.1145/3544216.3544229; LAKE ASPLOS 2023 doi 10.1145/3575693.3575697.
- LWN 877062 (bpf_loop), 961128 (arena patch), 961941 (arena article); docs.ebpf.io bpf_wq_start (v6.10).
- v6.1 verifier.c fixup_call_args(): "callbacks are not allowed in non-JITed programs" and
  "calling kernel functions are not allowed in non-JITed programs".
- Blog https://eunomia.dev/blog/2026/09/24/qwen3-ebpf-in-kernel-inference/ exists ("Can a language model run in Linux eBPF?").

## Chapter notes
- My own call count per token (operator mode, p<256): ~105 runs/layer x 28 + 1,188 head ≈ 4,128 (repo measured 4,169 incl. setup).
- MAC count ≈ 596M/token (matches report); widget = BigInt port of silu_q16; node check max err 0.000649 on [-8,8] step 0.001
  (repo test reports 0.000634 on its own sample points).
