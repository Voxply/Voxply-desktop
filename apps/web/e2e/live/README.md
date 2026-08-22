# Live e2e tests

> **Where it points is configurable.** `WAVVON_E2E_HUB_URL` overrides the hub
> (default `http://localhost:3000`) and `WAVVON_E2E_APP_URL` the app origin
> (default `http://localhost:1421`). Both were consts until 2026-08-22, which
> is the entire reason this suite only ever ran on a laptop where someone had
> started a hub by hand. `.github/workflows/e2e-live.yml` uses them to run the
> suite against a hub it builds and starts itself, and the same override points
> the suite at a farm-hosted `/hub/<slug>`.
>
> Two things to know if you drive a **genuinely fresh** hub, because neither is
> visible on a dev box that already has state. Run the hub API-only with
> `WAVVON_WEB_CLIENT_DIR=` (empty) so Playwright serves the client under test
> rather than whatever the hub baked in — that needs a hub built after
> 2026-08-22, when an empty value started meaning "unset" instead of "a
> directory called `''`". And a hub with no channels greets its owner with the
> first-boot template picker, whose overlay swallows every click behind it;
> `onboardWithSeed` dismisses it, so the flag lands in the saved owner session.

Unlike the mock-API specs in `e2e/*.spec.ts`, everything under `e2e/live/`
runs against a **real hub** on `http://localhost:3000`. The `live-setup`
project onboards a deterministic owner identity once and saves the session
to `e2e/.auth/owner.json`; the `live` project reuses it.

## Launch recipe

```powershell
# 1. Postgres (from server/)
docker compose -f docker-compose.dev.yml up -d
docker exec server-postgres-1 psql -U postgres -c "CREATE DATABASE wavvon_e2e"

# 2. Migrate + run the hub (note: `migrate` reads unprefixed DATABASE_URL)
$env:DATABASE_URL='postgres://postgres:postgres@localhost:5432/wavvon_e2e'
.\target\debug\wavvon-hub.exe migrate
$env:WAVVON_DATABASE_URL='postgres://postgres:postgres@localhost:5432/wavvon_e2e'
$env:WAVVON_OWNER_PUBKEY='03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8'
.\target\debug\wavvon-hub.exe

# 3. Run the tests (from clients/apps/web/) — vite is started by Playwright
npm run test:e2e:live
```

The owner pubkey above is derived from the fixed seed in
`helpers/live.ts` (`000102…1e1f`); seeding it as `WAVVON_OWNER_PUBKEY`
makes the recovered identity the hub owner, which the admin-surface
tests (roles, permissions, soundboard) require.

Tests create uniquely-named channels/roles per run, but **a persistent
`wavvon_e2e` database is not actually fine** — this used to say it was. Unique
names stop collisions, they do not stop accumulation: a third run against a
database two runs had already filled failed four specs that had nothing to do
with each other and everything to do with a hub carrying hundreds of channels,
roles and members. Drop and recreate between runs. On a clean database the
suite is 85 passed, 1 skipped, 0 failed (2026-08-22).

The skip is `54-ttt-game`, which needs `TTT_BOT_PUBKEY` and a running
`server/crates/ttt-bot`. It skips silently, so a run reporting green has
covered 85 of 86 — the CI job included.

Run with `--workers=1` (the `test:e2e:live` script does) — specs share one hub
and are not isolated from each other.
