# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this repo is

The **Wavvon clients** — one pnpm + Cargo workspace holding the web client, the
desktop client, and everything they share. Wavvon is a self-hosted, federated
voice+text community platform. This repo is self-contained: you can clone, build
and run the clients from it alone (you need a hub to talk to — see below).

```
apps/web/           Vite + React 19. THE delivery target and source of truth.
apps/desktop/       Tauri 2 + React 19, multi-account. src-tauri/ is the Rust shell.
packages/ui/        ~110 shared components + the single canonical styles.css.
packages/core/      Platform-agnostic TS: wire types + signing, .wavvon-backup, crypto.
packages/platform/  TS interface contract hiding Tauri/HTTP/WebSocket differences.
packages/i18n/      i18next catalogs (en/it/es/de).
crates/voice/       Rust audio pipeline used by the desktop shell.
```

Sibling repos (you don't need them checked out):

| Repo | Contents |
|---|---|
| [Wavvon-server](https://github.com/Wavvon/Wavvon-server) | Hub server, farm, the `identity` wire-format crate |
| [Wavvon-discovery](https://github.com/Wavvon/Wavvon-discovery) | Optional public hub directory site |
| [Wavvon-docs](https://github.com/Wavvon/Wavvon-docs) | Architecture wiki (70+ docs) + `openapi.yaml` |

**Read the wiki before grepping.** Start at
[docs/README.md](https://github.com/Wavvon/Wavvon-docs/blob/main/docs/README.md)
for the reading order. Wiki links below point at that repo; clone it alongside
this one if you want them offline.

Commit to **`develop`**. See `CONTRIBUTING.md`.

> A Tauri 2 Android client (`apps/android`) was removed 2026-07-12 — too far
> behind to maintain; slated for a clean-slate rewrite when mobile is
> prioritized. Build/native learnings are preserved in the wiki's
> `android-rewrite-notes.md`. Don't re-add Android without that being the
> explicit task.

---

## Commands

From the repo root:

```bash
pnpm build          # build all packages + apps
pnpm typecheck      # tsc --noEmit across every project — run this before declaring done
```

Shared package suites:

```bash
cd packages/core && pnpm test    # incl. wire-format + backup test vectors
cd packages/ui && pnpm test      # component/util suites
```

Web app (`apps/web`):

```bash
npm run dev
npm run build        # tsc && vite build
npm run typecheck
npm run test
npm run check-i18n   # translation coverage
```

Desktop app (`apps/desktop`):

```bash
npm run dev          # Tauri dev with live-reload (opens the window)
npm run dev:web      # frontend only (Vite on 1420, no Tauri shell)
npm run build        # tsc + vite build + Tauri binary
npm run typecheck
npm run test
```

Desktop Rust shell only:

```bash
cd apps/desktop/src-tauri && cargo check && cargo test
```

To actually run and drive the web client, use the **`run-web`** skill in
`.claude/skills/`; for two-client voice testing, **`voice-e2e`**. You need a hub:
either point at one you run yourself (see the
[Wavvon-server](https://github.com/Wavvon/Wavvon-server) repo) or at any hub you
have an invite to.

---

## Architecture

### Shared packages

- **`core`** — platform-agnostic TypeScript. Wire types + signing (a byte-for-byte mirror of the server's `identity` crate, incl. recovery envelopes), the cross-platform `.wavvon-backup` format (Argon2id + AES-256-GCM, one account per file, shared test vector with the Rust implementations), invite/URL parsing, reconnect backoff, crypto (`@noble/*`, `@scure/bip39`). No React. Has a vitest suite.
- **`ui`** — THE component home: shared React 19 components (message stream, composer, sidebars, `ContentArea`, `HubAdminPage` + admin sections, `ChannelSettingsModal`, `SettingsShell` + tabs, events/polls/forum, recovery, backup), the single canonical `styles.css`, and shared utils/workers. Has a vitest suite.
- **`platform`** — TypeScript interface contract hiding Tauri/HTTP/WebSocket differences. Desktop provides `invoke()` -> Tauri; web provides HTTP/WebSocket adapters.
- **`i18n`** — i18next + i18next-icu, shared catalogs (en/it/es/de).

### Apps

**`apps/web`** — Vite + React 19, no Tauri. Multi-account identities in IndexedDB
plus `wavvon:acct:<pubkey>:*` localStorage namespaces. `src/platform/` provides
the HTTP/WebSocket adapter. **Web is the delivery target and source of truth.**

**`apps/desktop`** — Tauri 2 + React 19, multi-account: a `~/.wavvon/accounts.json`
registry plus one directory per account (identity, pairing, home hubs, DM ratchet
state, per-account local store); `AccountRoot.tsx` remounts
`<App key={activeAccountId}>` on switch with a voice guard. Rust side in
`src-tauri/src/` — notable modules: `accounts.rs` (registry + purge-on-remove),
`backup.rs` (.wavvon-backup, must match the core test vector), `identity.rs`
(wire mirror), `soundboard.rs`, `local_store.rs` (per-account vs device-global
split), plus one file per command domain.

### `crates/voice` — Rust audio pipeline

Used by the desktop shell. Chain: cpal (capture/playback) -> nnnoiseless
(RNNoise denoise) -> soundboard clip mixing (`soundboard.rs`: Ogg-Opus demux +
decode, summed post-denoise so RNNoise can't eat the clip) -> audiopus (Opus
encode/decode) -> ringbuf (bridges the real-time audio thread and tokio async)
-> UDP transport -> hub relay.

---

## The sharing model

This is the part most likely to trip you up.

- **Web is the source of truth.** New components ship straight into `packages/ui`.
- Components in `packages/ui` are **prop-only**: no closures over App state, no `@wavvon/platform` imports, no app imports. Data access travels in through callback / actions-object props (`ForumActions`, `MessageRowActions`, ...). Platform-bound features are optional props an app may omit.
- Parity work on an existing component means **hoisting the web copy into `packages/ui`** and adapting desktop — not hand-porting into desktop's own copy.
- When the two clients diverge on a feature, converge on the **union**. No shipped capability gets dropped.
- Only `App.tsx` (the real state orchestrator), the `PinnedMessages` pair, and per-app action-wiring wrappers stay app-local.
- `packages/ui/src/hooks/` holds shared hooks, but only **network-free** ones — UI state machines. Anything that fetches stays in the app.

**Platform adapter contract.** Desktop calls
`invoke<T>('command_name', { argName: value })` from `@tauri-apps/api/core`
(camelCase args; Tauri translates to snake_case) and subscribes with
`listen<T>('event_name', handler)`, storing the unlisten for cleanup. Web has no
Tauri runtime — `apps/web/src/platform/` provides HTTP/WebSocket equivalents.
When a shared component gains a new platform dependency, **wire both sides**: a
web `platform/commands/` wrapper and a desktop Tauri command — or an optional
prop plus a precise gap note in the wiki's `client-parity.md`.

---

## Non-obvious constraints

**Wire-format changes are cross-repo operations.** The signing bytes in
`packages/core/src/identity/wire.ts` and `apps/desktop/src-tauri/src/identity.rs`
must match the server's `identity` crate **byte-for-byte**, pinned by shared test
vectors. Same discipline for the `.wavvon-backup` format (core TS + desktop
`backup.rs` assert one fixed vector). Use the **`wire-format-change`** skill.

**Recovery/attestation envelopes are signed with the roster identity key** — the
key the hub knows the user by — NOT the derived multi-device master key. The
master signs only multi-device material (subkey certs, etc.). Getting this
backwards was a real bug on both clients.

**Tauri command shape**: `#[tauri::command]`, return `Result<T, String>`, never
unwrap inside. JS calls use camelCase. **Omitted-vs-null trap**: Tauri collapses
"arg omitted" and "arg explicitly null" into the same Rust `None` — for hub PATCH
routes with tri-state semantics, build the JSON body inserting only `Some`
fields, or unrelated updates will wipe fields (this bit twice: role color/icon,
banner sources).

**Desktop file storage**: per-account JSON files under
`~/.wavvon/accounts/<pubkey>/` via the `accounts.rs` path helpers (the old flat
`~/.wavvon/*.json` layout is legacy and ignored); device-global files
(voice/appearance) stay at the root — match the split in `local_store.rs`.

**Never branch on the hub's `version`.** `GET /info` carries `capabilities`, a
list of feature strings; ask `hubSupports(hubId, cap)` /
`activeHubSupports(cap)` (web `platform/session.ts`) and treat unknown as false.
Each hub serves its own baked-in copy of the web client and that copy is
multi-hub — the client served by hub A talks to hubs B and C, so there is no
"client and server update together".

**Paginated endpoints need a client that pages.** The hub's list dialect is an
array plus `limit` and a keyset cursor. Walk to exhaustion rather than trusting
one page — that is why `fetchAllUsers` (web) and `list_users` (desktop) loop.

**Silent fallthroughs are the bug class to watch for here.** Desktop's WebSocket
event enum matched unknown types as `Other => {}`, so four hub features were
simply absent with no symptom, for months. When you add a catch-all arm, make the
unknown case say something.

**Two-axis state model.** Community-axis state (channels, messages, roles) lives
on community hubs. Personal-axis state (prefs, DM history, block/mute/ignore,
home hub list, custom themes, drafts) lives on the user's home hub(s). Don't mix
them.

**Identity is a keypair, not an account.** No email, password, or username.
Identity = Ed25519 public key (hex). Multi-device via BIP39 master phrase +
signed subkey certs (QR pairing). Recovery = phrase import (canonical),
`.wavvon-backup` file (secondary, works cross-client), or per-hub recovery
contacts (vouch -> admin decides). Both clients are multi-account; account lists
are device-local and never synced to a hub.

---

## Tests

vitest suites in `packages/core`, `packages/ui`, `apps/web`, `apps/desktop`. The
desktop Rust shell has `cargo test` under `apps/desktop/src-tauri`.

**Unit suites are not enough for cross-client flows.** A set of recovery bugs in
July 2026 passed every suite and was caught only by driving the real apps. Use
the `run-web` skill; say plainly when you could not verify something visually.

---

## Conventions

- Code comments in **English**, and only when the WHY is non-obvious — a hidden constraint, a workaround, surprising behavior. Don't explain WHAT.
- No comments in GitHub Actions workflow files — explain the choice in the commit message or the docs.
- **Reuse existing CSS classes** in `packages/ui/src/styles.css` before inventing new ones.
- Type-only imports for interfaces. One component per file, keep them small.
- Prefer one fixed home per UI control — avoid context-dependent relocation.
- Any user-visible string goes through i18n; run `npm run check-i18n` from `apps/web` if you touched catalogs.
- Design decisions go in the wiki's `decisions.md` (newest entry at the top). Mark superseded entries; don't delete them.
- Competitor references are allowed — factual, no logos, no disparagement.
