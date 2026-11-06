# Research notes — Chapter 27: Actime and Akeep

Studied 2026-11-06. Clones (`--depth 1`) in `/home/user/workspace/src/`.

| Repo | Commit studied | Date | Language / version |
|---|---|---|---|
| https://github.com/eunomia-bpf/actime | `9c03598117af522c70e33695ca83dd4b38c12ff8` | 2026-10-13 | Rust workspace, v0.1.0, MSRV 1.85, MIT |
| https://github.com/eunomia-bpf/akeep | `7d690362f19d9341b78f99d610a09488c2d020c1` | 2026-10-13 | Rust 2024, v0.2.0, MIT |
| https://github.com/eunomia-bpf/backup-client-sdk | `2774aa0b3e9d840fe9e6532089f95297cb48fcea` | 2026-08-02 | Rust 2024, v0.1.0 (unpublished), MIT/Apache-2.0 |
| https://github.com/eunomia-bpf/agentqos | README only (gh api) | pushed 2026-06-15 | Rust |

## Big correction to the task brief

- GitHub repo description of actime still says "Unified runtime for AI coding agents:
  sandbox isolation, kernel-enforced policy, system evidence, and session history in one
  command". **The code no longer does sandbox isolation.** Commit `3f29370`
  (2026-08-05, "Remove sandbox management; attach to user process trees") deleted the
  `actime-sandbox` crate (`backend.rs`, `bwrap.rs`, `docker.rs`, `host.rs`, `spec.rs`),
  `sandbox/Dockerfile`, demo agent. The removed `bwrap.rs` header (at `af77a87`) said:
  bubblewrap namespace backend, read-only binds of /usr,/lib,/lib64,/bin,/sbin,/etc,
  `--proc /proc`, `--dev /dev`, `--tmpfs /tmp`, `--die-with-parent`, `--unshare-net`
  when network deny.
- Current README: "Actime does **not** manage sandboxes. Bring your own sandbox, or none
  at all." DESIGN §5: "Exactly three planes. There is no isolation plane." No Landlock,
  no seccomp, no namespaces in current code (rg for landlock/seccomp/bwrap: hits only
  in doctor.rs/run.rs/main.rs for container detection / docs).
- Actime does **not** build its own eBPF programs (DESIGN §2 non-goals). It orchestrates
  `actplane` and `agentsight` binaries as subprocesses.
- Akeep uses **no eBPF**. It is a userspace backup tool. Its only link to eBPF is that it
  backs up AgentSight's monitor SQLite DBs.
- backup-client-sdk uses **no eBPF**; it is an HTTP client SDK. akeep (0.2.0) does not
  depend on it (no reference in akeep src/docs). The SDK `repository` field in Cargo.toml
  points to `github.com/agent-sight/backup-client-sdk`.

## Actime

### What it is
"The effect plane for AI coding agents: kernel-enforced policy, system observability,
and session backup, attached to the agent you already run." Three planes:
- Policy — ActPlane (eBPF) — what is the agent allowed to do?
- Observability — AgentSight (eBPF) — what did it actually do?
- Backup — Akeep (not eBPF) — what did it decide, can we replay it?
Slogan: "The sandbox contains. Actime accounts."
README also says: "The eBPF instrumentation underneath comes from bpftime." (unverified
detail — ActPlane/AgentSight chapters say what they use; AgentSight uses libbpf.)
Requires `actplane` ≥ 0.1.8, `agentsight` ≥ 0.2.60, `akeep` ≥ 0.2.0.

### Layout
```
crates/actime-core/src/  components.rs config.rs doctor.rs enforceability.rs lib.rs
                         observations.rs report.rs run.rs        (~4.4k lines)
crates/actime-cli/src/   commands.rs embedded.rs main.rs planes.rs run.rs ui.rs (~4.4k lines)
crates/actime-cli/tests/ cli.rs policy_packs.rs
policies/                coding-agent-baseline.dsl information-flow.dsl no-vcs-write.dsl
profiles/                observe.yaml balanced.yaml strict.yaml
docs/                    DESIGN.md configuration.md deployment.md faq.md observability.md policies.md quickstart.md
scripts/install.sh
```
Packs and profiles `include_str!`d by `crates/actime-cli/src/embedded.rs`.

### CLI (DESIGN §10, confirmed by built binary --help)
init, run, attach (--pid|--comm|--container|--pod), status, runs, report, policy
(list|show|check|explain), keep (commit|log|restore), doctor. Global --config, --profile, -q.
`run` flags: --policy MODE, --no-observability, --no-backup, --fail-on-violation (exit 3),
--timeout D.

### Run orchestration (DESIGN §7, planes.rs)
1. resolve config (--config, ./actime.yaml walking to git root, ~/.config/actime, builtin balanced)
2. RunStore::create → ~/.local/share/actime/runs/<id> (ACTIME_HOME override)
3. compose policy (`embedded.rs::compose_policy`, `${WORKSPACE}` substitution)
4. enforceability check: `actplane --rule <dsl> compile --json` + hardcoded feature budget
   (`enforceability.rs`: `ENGINE_SUPPORTED_0_1_8 = 0x3f0`; missing path contains/suffix,
   open rules, write rules). enforce → fail closed and finalize refusal record.
5. policy plane: wrap argv `[sudo -n -E] actplane --policy <run>/policy.yaml run -- <agent>`
   (`planes.rs::wrap_argv`). confirm_install_from_log demotes Active→Disabled on engine error.
6. observability: `agentsight record --no-server --db <db> (--pid N | --binary-path docker://…)`
   via `privileged()` (sudo prefix when not root).
7. wait, wall-clock limit, natural exit → SIGTERM grace → SIGKILL.
8. harvest ActPlane scoped `actplane/runs/run-<pid>-<ts>/events.jsonl` into violations.jsonl
   after engine exit; collect observations from AgentSight SQLite (schema introspected);
   `akeep init` then `akeep commit -m <msg>` (bounded by AKEEP_TIMEOUT); render report.md.

### Deployment positions (docs/deployment.md)
A outside sandbox (host attach, strongest tamper story); B inside sandbox (needs
`--cap-add BPF --cap-add PERFMON`; root inside can interfere); C no sandbox.
doctor detects container via /.dockerenv, /run/.containerenv, /proc/1/cgroup markers,
CapEff from /proc/self/status.

### Degradation
root/CAP_BPF missing → policy+observability disabled; actplane missing → disabled in observe,
hard fail in enforce; agentsight missing → observability disabled; akeep missing → backup
disabled; kernel < 5.10 → policy disabled. Requirements: kernel 5.10+ with BTF; 6.1+ recommended.

### Policy packs
- coding-agent-baseline: destructive-vcs (kill exec git --force/--hard/clean if AGENT),
  mass-deletion (kill exec rm -rf if AGENT). AGENT = exec "**/claude", codex, gemini,
  opencode, openclaw, aider, cursor-agent, actime-demo-agent.
- no-vcs-write: no-publish, no-branch-churn, gated-commit (`unless after write ... since exec`).
- information-flow: system-fence, run-record-integrity, credential-access (notify),
  no-secret-egress (kill connect endpoint "*" if AGENT and SECRET), declassify by actime-redact.
  Not enforceable on ActPlane 0.1.8 (README, policies.md).

### Built and ran (this orb)
`cargo build --release -j2 --locked` → finished in 1m 12s (rustc 1.99.1).
Ran without actplane/agentsight/akeep installed, not root:
- `actime doctor`: deployment host A/C ok, kernel 6.1.189+ ok, btf present ok, cap_bpf warn,
  actplane/agentsight/akeep warn "not found", run_store ok, config profile=balanced policy=enforce.
- `actime run --policy off --no-backup -- /bin/echo hi`: prints hi, report, planes all Disabled
  (observability: "agentsight is not installed").
- `actime run -- /bin/echo hi` (balanced = enforce): exit 1, "error: policy.mode is `enforce`
  but the policy plane could not start: actplane is not installed..." Fails closed;
  manifest has note "refused before agent launch".
- `actime policy check` without actplane: "warning: actplane is not installed, so the policy
  could only be composed, not compiled ... Composed 44 lines of policy from: coding-agent-baseline".
- Run dir after these runs contained: actime.yaml, actplane/, manifest.json, report.md.

### Commits (gh api, newest first)
Initial commit af77a87 2026-08-05 "Initial commit: Actime, a unified runtime for AI coding agents";
3f29370 remove sandbox management; 2224eca per-rule enforceability; 3145726 docs state what
policy enforces today; a8b984a integration suite; 990d76c MSRV 1.85; 206b6cb fail-closed
refusal record; 268ffa5 rename evidence→observability, history→backup. Since then
(2026-08-09 → 2026-10-13) only Dependabot bumps (libc, thiserror, clap, rusqlite 0.40, actions).

## Akeep

### What it is
Privacy-first Git-like backup for AI agent session history. Commands: init, config, status,
commit, log, fsck, checkout, diff, clone, schedule (install/status/uninstall), handoff.
Backends: filesystem, S3 (incl. R2 via --s3-endpoint-url; invokes AWS CLI v2 without shell),
Git remote (git CLI, dedicated branch `akeep`). Optional age encryption (X25519).

### Archive format v1 (docs/archive-format.md)
```
vault.json
objects/<2 hex>/<62 hex>.zst[.age]
manifests/<snapshot-id>.json[.age]
refs/latest
```
Fixed 4 MiB chunks, object id = BLAKE3 of uncompressed chunk, zstd per chunk, then age
encrypt. Existing objects never overwritten; stored size compared. Manifest published
last (after all objects verified). Snapshot id = `%Y%m%dT%H%M%S%.3fZ-<8 hex>`.
`HEAD`, `HEAD~N` via parent links. In age mode the manifest is fully encrypted; object
IDs are visible in key names.
Code: `src/vault.rs::store_chunk`, `src/archive.rs::archive_file`, `backup`, `src/manifest.rs`.
SQLite sources are snapshot with online backup API (`src/source.rs::snapshot_sqlite`),
then `PRAGMA integrity_check`.

### Providers (src/providers.rs, docs/providers.md)
AgentSight (`~/.agentsight/monitor/monitor-*.db`), Claude Code (`~/.claude`: projects,
sessions, file-history, plans, commands, tasks, todos, shell-snapshots, session-env,
backups, history.jsonl), Codex CLI (`~/.codex`), Grok CLI, Kimi Code, OpenCode.
ADAPTER_VERSION = 1. Preserves native files; no normalization. Env overrides
CLAUDE_CONFIG_DIR, CODEX_HOME, AGENTSIGHT_HOME etc.
AgentSight activity-summary.json (schema 2) excludes paths/cmdlines/hosts.

### Other
- handoff: Claude Code ↔ Codex Markdown bundle (docs/portable-history.md).
- schedule: systemd user timer, randomized 6h delay.
- README: own installation protects >50 GB; bounded pipeline reduced peak memory 23.6 GiB →
  ~243 MiB (project's own claim, not verified here).

### Commits
2026-08-01 batch: simplify install, remove search/export commands, Release 0.1.0, 37be499
Git backend; 843754f (2026-08-06) back up AgentSight monitor DBs with activity summary;
then Dependabot bumps (zstd 0.14, toml 1.1.x, blake3, uuid, clap, rusqlite 0.40) through
2026-10-13; e7c5d59 CI compat fix.

## backup-client-sdk
Crate `akeep-backup-client-sdk` 0.1.0, pre-release, not published. "Public Rust boundary
between a Backup Client and the Akeep Control Plane". Device pairing, account/quota,
single + multipart uploads (fixed 64 MiB parts), metadata, download, delete.
Object bodies go directly to private Cloudflare R2 via short-lived signed URLs; the Worker
never proxies bodies. SDK does not encrypt/decrypt; caller supplies `CredentialStore`.
Single PUT requires server-signed Content-Length, Content-MD5, If-None-Match: *.
OpenAPI 3.1 contract `contract/akeep-api-v1.json` ("Akeep Backup Client API" 1.0.0),
paths: /api/v1/device-authorizations[/{code}[/exchange]], /me, /objects[/{id}[/download-url]],
/uploads[/{id}[/abort|/complete|/parts/{n}/url]], /usage. Generated modules private.
API: `AkeepClient::builder().base_url().credential_store().build()`, `.auth()`
(start_device_pairing, wait_for_approval, credential_status, sign_out), `.account()`
(identity, usage), `.objects()` (upload_encrypted_file, list, get, download_encrypted_file, delete).
Example `examples/backup_client_e2e.rs`: tar → ChaCha20Poly1305 → upload → download → decrypt → untar → delete.
Commits: e940ad9 init, 2774aa0 actions runtimes (2026-08-02).

## agentqos (README via gh api)
"AgentQoS CLI for AI-agent QoS checks". `agentqos check --latency-ms ... --latency-budget-ms
... --error-rate ... --max-error-rate ... --input-tokens ... --output-tokens ...
--token-budget ... --strict`, `--json`. Turns budgets into pass/fail and 0–100 score.
"release-surface and supply-chain name". No eBPF mentioned.

## Chapter verification notes
- Built actime (1m12s) and akeep (1m59s) release with -j2 in /tmp/ch27 (deleted afterward).
- akeep scripts/demo.sh passed all PASS lines; hand-made age vault produced
  objects/e4/<62hex>.zst.age, manifests/<id>.json.age, refs/latest, vault.json.
- Observed: `akeep checkout --provider agentsight` rejected; clap ValueEnum accepts
  `agent-sight` / `open-code`; status --json shows "provider": "agent-sight".
- Not run: actime with root + engines; backup-client-sdk (needs private control plane).
