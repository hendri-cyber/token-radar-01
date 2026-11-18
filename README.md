# Token Radar — pre-token protocols ranked by implied value

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/hendri-cyber/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/hendri-cyber/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A program (`main.ts`, Node 22, standard library only) that reads a sealed snapshot of every
protocol DefiLlama tracks, finds the ones that still record no token and are not a wrapped or
staked product of one that trades, ranks them by what their launch would be worth, and writes
a static web dashboard — board, detail view per protocol, farm plan per protocol — that renders
with no network.

## The board

- **178 rows**: all 40 protocols on the snapshot's watchlist, plus 138 pre-token protocols
  below the $50M floor the radar found early. Live-token protocols are set aside with their
  market caps shown, never mixed into the ranking.
- **Top 5 by implied value**: Steakhouse Financial ($506.8M), Gauntlet ($301.8M),
  Veda ($290.2M), USDD ($153.2M), Upshift ($104.1M).

## The model (`radar-2`)

Implied value is computed from the snapshot's own figures only — no protocol name is ever
special-cased:

```
implied = round(TVL x category_multiple x growth_multiplier x maturity_multiplier x chain_multiplier)
```

- `category_multiple`: the **median market-cap/TVL ratio of live-token protocols in the same
  category**, taken from the snapshot itself (overall median 0.2138; e.g. Lending 0.132,
  Dexs 0.342, RWA 0.275), clamped to [0.05, 1.5]. Categories with fewer than 3 live samples
  fall back to the overall median.
- `growth_multiplier = 1 + clamp(change_7d, -60, 120) / 100 x 0.5`
- `maturity_multiplier = 0.6 + min(age_days, 1095) / 1095 x 0.4` (age = time since first
  listed with no token; unknown age uses 365 days)
- `chain_multiplier = 1 + 0.03 x min(chains - 1, 3)`

Every row's implied value recomputes in the dashboard from the figures shown, and the page
says so. An implied value is a model, not a price — and a protocol "records no token", which
is what DefiLlama's record says, never proof it has none.

## Farm plans

Each row carries 8 concrete steps derived from its category, chains, TVL and age: the action,
what it costs, and how long it takes — plus a check-the-points-page step, a never-pay-to-claim
warning, and a farm log. See `MODEL_NOTES.md` for the numbers behind the model.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

This writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and
`out/dossier.json` (via `vendor/makefun-board.ts`). Deterministic: two runs write identical
bytes.

## Layout

- `main.ts` — entrypoint
- `lib/model.ts` — the radar-2 model, board builder, farm plans
- `vendor/makefun-board.ts` — make.fun's dossier library, as shipped in the kit
- `dashboard/` — the static page (index.html, app.css, app.js; no network)
- `screenshots/` — board, detail view, filtered view (1440x900)

Built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01).
MIT licensed.
