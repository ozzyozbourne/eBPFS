# Research notes — Chapter 07: eBPF in the networking stack (XDP, AF_XDP, tc/TCX, socket programs)

Survey date: 2026-11-05.

## Sources cloned (outside the repo, `/home/user/workspace/src/`)

| Repo | Commit studied | Date |
|------|----------------|------|
| https://github.com/xdp-project/xdp-tutorial | `4e2bf5658434e8ae12f281b9b182bb188766a319` | 2026-05-08 |
| https://github.com/eunomia-bpf/bpf-developer-tutorial | `110b91f87320a952c4c55dba1d6e8e3f814a789c` | 2026-09-05 |

Kernel sources read on GitHub (torvalds/linux master, fetched 2026-11-05), not cloned:
`include/uapi/linux/bpf.h`, `include/uapi/linux/if_link.h`, `include/uapi/linux/pkt_cls.h`,
`Documentation/networking/af_xdp.rst`, `Documentation/bpf/redirect.rst`,
`Documentation/bpf/map_{devmap,cpumap,xskmap,sockmap}.rst`, `Documentation/bpf/prog_sk_lookup.rst`,
`tools/bpf/bpftool/Documentation/bpftool-net.rst`. iproute2 `man/man8/ip-link.8.in`.

## Code samples used (file paths in the cloned repos)

xdp-tutorial:
- `basic01-xdp-pass/xdp_pass_kern.c` — minimal `XDP_PASS`. README: `sudo ip link set dev lo xdpgeneric obj xdp_pass_kern.o sec xdp`; `ip link set dev lo xdpgeneric off`; `xdp-loader load -m skb lo xdp_pass_kern.o`; `xdp-loader status lo`; `xdp-loader unload -a lo`; inspect with `ip link list dev lo`, `bpftool net list dev lo`, `xdp-loader status lo`. README notes `ip` does not implement the libxdp multi-dispatch protocol.
- `basic02-prog-by-name/xdp_prog_kern.c` — `xdp_pass_func`, `xdp_drop_func` (`return XDP_DROP;`), comment listing `enum xdp_action`. Loader: `sudo ./xdp_loader --dev veth-basic02 --progname xdp_drop_func`. Testenv: `sudo ../testenv/testenv.sh setup --name veth-basic02`, `eval $(../testenv/testenv.sh alias)` → `t`.
- `basic02-prog-by-name/xdp_offload_nfp.org` — Netronome nfp offload needs BPF firmware.
- `basic03-map-counter/xdp_prog_kern.c` — returns `XDP_ABORTED` when map lookup fails (verifier-mandated NULL check).
- `common/parsing_helpers.h` — `struct hdr_cursor`, `parse_ethhdr_vlan`, `parse_iphdr` (ihl*4, variable-length), `parse_ip6hdr`, `parse_tcphdr` (doff*4), `parse_udphdr`. "pointer + 1 > data_end" style.
- `packet01-parsing/xdp_prog_kern.c` — contains an intentional bounds bug (`nh->pos + 1 > data_end`) as Assignment 1; solution in parsing_helpers.h. Good teaching point.
- `packet02-rewriting/xdp_prog_kern.c` — `xdp_parser_func` solution of packet01: drops ICMP/ICMPv6 echo requests with even sequence number (`XDP_DROP`).
- `packet03-redirecting/xdp_prog_kern.c` — `BPF_MAP_TYPE_DEVMAP tx_port`, `xdp_redirect_map_func` uses `bpf_redirect_map(&tx_port, 0, 0)`.
- `packet-solutions/xdp_prog_kern_03.c` — `xdp_router_func` with `bpf_fib_lookup` and `bpf_redirect`.
- `packet-solutions/tc_reply_kern_02.c` — `SEC("tc") _fix_port_egress(struct __sk_buff *skb)`; README.org commands: `tc qdisc add dev eth0 clsact`, `tc filter add dev eth0 egress bpf da obj tc_reply_kern_02.o sec tc`, `tc filter show dev eth0 egress`, `tc qdisc del dev eth0 clsact`.
- `advanced03-AF_XDP/af_xdp_kern.c` — XSKMAP keyed by `ctx->rx_queue_index`, `bpf_redirect_map(&xsks_map, index, 0)`.
- `advanced03-AF_XDP/af_xdp_user.c` — uses `<xdp/xsk.h>`/libxdp: `xsk_umem__create`, `xsk_socket__create`, fill ring reserve/submit, `xsk_ring_cons__peek` on RX. Options `--copy` / `--zero-copy`, `--skb-mode` / `--native-mode`, `--queue`. README: copy mode works for any driver with XDP_REDIRECT; zero-copy needs driver UMEM support; XDP_PASS in zero-copy mode is costly (alloc + copy).

bpf-developer-tutorial:
- `src/20-tc/tc.bpf.c` — `SEC("tc") tc_ingress(struct __sk_buff *ctx)`, bounds checks, `bpf_printk`, returns `TC_ACT_OK`. Built with `ecc tc.bpf.c`, run `sudo ecli run ./package.json` (chapter 10 covers ecc/ecli).
- `src/21-xdp/xdp.bpf.c` — prints packet size, `XDP_PASS`.
- `src/50-tcx/tcx_demo.bpf.c` + `tcx_demo.c` — two `SEC("tcx/ingress")` programs, `TCX_NEXT`/`TCX_PASS`, `bpf_program__attach_tcx`, `bpf_prog_query_opts(ifindex, BPF_TCX_INGRESS, ...)`; run `sudo ./tcx_demo -i lo`.
- `src/29-sockops/bpf_contrack.bpf.c` (sockops → `bpf_sock_hash_update`), `bpf_redirect.bpf.c` (sk_msg → `bpf_msg_redirect_hash(..., BPF_F_INGRESS)`), `bpf_sockmap.h` (SOCKHASH), `load.sh` (bpftool prog load / cgroup attach sock_ops / prog attach msg_verdict).
- `src/42-xdp-loadbalancer/xdp_lb.bpf.c` — XDP L4 LB demo; README: veth needs a stub XDP program on the peer (`ip l set dev veth7 xdp obj ./stub.bpf.o sec .xdp`).

## Verified facts

- `enum xdp_action { XDP_ABORTED = 0, XDP_DROP, XDP_PASS, XDP_TX, XDP_REDIRECT }` (uapi bpf.h).
- `struct xdp_md { __u32 data, data_end, data_meta, ingress_ifindex, rx_queue_index, egress_ifindex; }`; `XDP_PACKET_HEADROOM 256`.
- `enum tcx_action_base { TCX_NEXT = -1, TCX_PASS = 0, TCX_DROP = 2, TCX_REDIRECT = 7 }`; `TC_ACT_UNSPEC -1, TC_ACT_OK 0, TC_ACT_SHOT 2, TC_ACT_PIPE 3, TC_ACT_REDIRECT 7` (pkt_cls.h).
- `XDP_FLAGS_SKB_MODE (1<<1)`, `XDP_FLAGS_DRV_MODE (1<<2)`, `XDP_FLAGS_HW_MODE (1<<3)`, `XDP_FLAGS_UPDATE_IF_NOEXIST`, `XDP_FLAGS_REPLACE` (if_link.h).
- bpftool net attach types: `xdp` (native, fallback generic), `xdpgeneric`, `xdpdrv`, `xdpoffload`, `tcx_ingress`, `tcx_egress`; `overwrite` for XDP, `prepend` for tcx.
- ip-link: `xdp | xdpgeneric | xdpdrv | xdpoffload { off | object FILE [section NAME] | pinned FILE }`; xdpdrv disables fallback.
- Version facts (bcc docs/kernel-versions.md): socket filter 3.19; cls_bpf 4.1; tc direct-action 4.4; clsact qdisc 4.5; direct packet access 4.7; XDP 4.8; generic XDP 4.12; XDP redirect action 4.14; `bpf_redirect_map` 4.14; sock_ops 4.13; sk_skb 4.14; sk_msg 4.17; AF_XDP 4.18; sk_lookup 5.9; `bpf_redirect_peer`/`bpf_redirect_neigh` 5.10.
- Map docs: DEVMAP 4.14, DEVMAP_HASH 5.4, CPUMAP 4.15 (second XDP prog on remote CPU from 5.9), XSKMAP 4.18, SOCKMAP 4.14, SOCKHASH 4.18.
- XDP multi-buffer / frags (`BPF_F_XDP_HAS_FRAGS`, `SEC("xdp.frags")`): Linux 5.18 (libxdp protocol.org; docs.ebpf.io).
- TCX: Linux 6.6 (kernelnewbies Linux_6.6, commit e420bed0250); libbpf sections `tcx/ingress`, `tcx/egress` (and `tc/ingress` alias); bpftool tcx link show.
- netkit: Linux 6.7 (kernelnewbies 6.7; Borkmann LSF/MM/BPF 2024 slides). Cilium docs: netkit mode for kernel 6.8+; with netkit Cilium uses tcx for other devices. Borkmann slides: Cilium 1.16 uses tcx by default on 6.6+.
- AF_XDP (docs.kernel.org/networking/af_xdp.html): UMEM of equal-sized frames registered with `XDP_UMEM_REG`; four rings FILL, COMPLETION, RX, TX; bind to netdev+queue; kernel tries zero-copy first then falls back; `XDP_COPY`/`XDP_ZEROCOPY` force; `XDP_SHARED_UMEM`; `XDP_USE_NEED_WAKEUP`.
- redirect.rst: XDP_REDIRECT works with DEVMAP, DEVMAP_HASH, CPUMAP, XSKMAP; tracepoints `xdp:xdp_exception`, `xdp:xdp_redirect*`, debug with bpftrace `tracepoint:xdp:*`.
- sk_lookup: `BPF_PROG_TYPE_SK_LOOKUP`, attached to netns via BPF_LINK_CREATE with `BPF_SK_LOOKUP`; runs when finding listening TCP / unconnected UDP socket; `SK_PASS`/`SK_DROP`; `bpf_sk_assign()`.
- XDP paper: Høiland-Jørgensen, Brouer, Borkmann, Fastabend, Herbert, Ahern, Miller. CoNEXT '18, pp. 54–66, DOI 10.1145/3281411.3281443 (open access). Abstract: up to 24 Mpps single core; three use cases: L3 routing, inline DDoS protection, L4 load balancing. Paper text: DPDK 43.5 Mpps on same core, XDP 24 Mpps (41.6 ns/packet).
- Katran: Meta blog 2018-05-22 "Open-sourcing Katran, a scalable network load balancer"; README: C++ library + BPF program; XDP; DSR only; IP-in-IP encap; no fragmentation, no IP options; scales with RX queues; supports generic XDP at a cost.
- Cloudflare: "L4Drop: XDP DDoS Mitigations" (2018-11-28, Arthur Fabre); "How to drop 10 million packets per second" (Marek Majkowski, 2018) uses `ip link set dev ext0 xdp obj xdp-drop-ebpf.o`; "A deep-dive into Cloudflare's autonomous edge DDoS protection" (L4Drop → Unimog → iptables).
- Cilium docs (eBPF datapath intro): XDP, tc ingress/egress, socket ops, socket send/recv hooks; host-side veth tc ingress for policy; XDP acceleration for NodePort/LoadBalancer via `loadBalancer.acceleration=native` (since Cilium 1.8). Cilium `bpf/` dir: `bpf_xdp.c`, `bpf_lxc.c`, `bpf_host.c`, `bpf_overlay.c`, `bpf_sock.c`.

## eunomia-bpf userspace XDP

- https://github.com/userspace-xdp/userspace-xdp (moved from eunomia-bpf/XDP-eBPF-in-DPDK): "XDP Deployments in Userspace eBPF". Research prototype; runs unmodified XDP programs in userspace on bpftime with DPDK or AF_XDP as I/O; llvmbpf or uBPF JIT/AOT; currently supports l2fwd (mainly XDP_DROP / XDP_TX). Last push 2025-07-23.
- https://github.com/eunomia-bpf/XDP-on-GPU: "eBPF XDP on GPU", README says WIP and "does not work now"; design: DPDK PMD → batch → GPU kernel (CUDA/OpenCL) → XDP actions. Last push 2025-10-05. Its README table of throughput numbers is aspirational; not quoted.

## Not verified / left out

- No benchmark numbers beyond the XDP paper's own 24 Mpps / 43.5 Mpps DPDK.
- Exact position of generic XDP relative to taps (tcpdump) — described qualitatively only.
- No LWN URL for TCX cited (could not confirm a specific article ID); kernelnewbies + commit used instead.
