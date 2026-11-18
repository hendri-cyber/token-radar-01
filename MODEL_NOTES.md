# Token Radar — Model Notes (radar-2, empirical)

Snapshot: 758 protocols, as_of 2026-11-14, floor $50M, watchlist 40 slugs.
Live-token sample for the multiples: 128 protocols with mcap > 0 and TVL > 0
(one protocol records mcap −1 and sixteen record mcap 0; both are excluded).

## Measured medians (mcap / TVL, live protocols only)

Overall median: **0.213803**. Live distribution: p25 0.0477, p75 1.0566
(the p75 is pulled up by a few extreme ratios; the median is the robust centre).

Per-category medians, only where n >= 3 live samples (clamped to [0.05, 1.5]):

| Category | n | Median (multiple used) |
|---|---:|---:|
| Lending | 15 | 0.132395 |
| Dexs | 11 | 0.342435 |
| Yield | 9 | 0.191414 |
| Liquid Staking | 9 | 0.040593 -> 0.050000 (clamped) |
| CEX | 9 | 0.074831 |
| RWA | 9 | 0.274780 |
| Canonical Bridge | 8 | 0.746393 |
| Basis Trading | 7 | 0.654418 |
| Bridge | 6 | 0.556731 |
| Cross Chain Bridge | 4 | 1.220462 |
| Yield Aggregator | 4 | 0.150959 |
| Indexes | 3 | 0.147678 |
| CDP | 3 | 0.168701 |
| Privacy | 3 | 0.969129 |

All other categories (n < 3, e.g. Risk Curators n=1, Onchain Capital
Allocator n=2, Collateral Markets n=1) fall back to the overall 0.213803.
That is deliberate: a 1–2 sample median is noise, not a market.

## Formula

```
base_multiple = category median above, else overall median 0.213803
growth        = clamp(change_7d, -60, 120); growthMult = 1 + (growth/100) * 0.5
maturity      = 0.6 + min(age_days, 1095) / 1095 * 0.4   (unknown age: 365)
chainMult     = 1 + 0.03 * min(max(chains-1, 0), 3)      (max 1.09)
implied       = max(1, round(TVL * base_multiple * growthMult * maturity * chainMult))
```

Rankable = pre-token (mcap, gecko_id, symbol all null) and category not in
{CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked
BTC}, name not version-marked, no whole word wrapped/staked/staking, and not
starting with an exchange name. Watchlist rows are always included; early
rows are rankable pre-token protocols below the $50M floor, by TVL desc.

## Board size: 178, not 240

The task asked for 40 watchlist + 200 early rows, but only **138** rankable
pre-token protocols exist below the floor on this snapshot (210 pre-token
below the floor minus 72 excluded by the rule above). The board therefore
carries all 138 rather than padding with protocols the rule excludes:
40 + 138 = **178 rows**. This still clears the gate (min 100 rows, full
watchlist coverage). Farm plan: 8 steps per row, derived from category /
chains / TVL band ($250 / $150 / $100 / $50) / age (hold 60 / 45 / 30 days).

## Worked example — rank 1, steakhouse-financial

Risk Curators has only 1 live sample, so base = overall 0.213803.
TVL $2,753,981,495; change_7d −2.1935% -> growthMult 0.9890325;
listed 2025-05-20 -> age 543 days -> maturity 0.6 + 543/1095*0.4 = 0.798356;
11 chains -> chainMult 1.09.
implied = round(2,753,981,495 * 0.213803 * 0.9890325 * 0.798356 * 1.09)
        = **$506,767,268**.

## Top 10 vs starter (flat 0.25, radar-1)

| Rank | radar-2 (this model) | Starter rank |
|---:|---|---:|
| 1 | steakhouse-financial — $506,767,268 | 1 |
| 2 | gauntlet — $301,818,293 | 2 |
| 3 | veda — $290,176,166 | 3 |
| 4 | usdd — $153,238,977 | 4 |
| 5 | upshift — $104,105,309 | 5 |
| 6 | bittensor-dtao — $77,272,653 | 8 |
| 7 | nonce-capital — $66,350,426 | 6 |
| 8 | onre — $66,090,726 | 7 |
| 9 | opentrade — $59,901,365 | 10 |
| 10 | plume-vaults — $54,497,157 | — (starter: symbiotic 9th) |

Same top 5, re-ordered below: Dexs (0.342) and RWA (0.275) multiples lift
bittensor-dtao, onre, opentrade and plume-vaults above the flat 0.25, while
symbiotic (Collateral Markets, n=1 -> fallback 0.2138) drops out of the top
10. Board implied/TVL: median 0.1624, range 0.0869–0.607 — all 178 rows sit
inside the live market's interquartile range (0.0477–1.0566), so no implied
value is far outside what live tokens actually trade at.

## Verification (re-run after revision)

178 rows; watchlist 40/40; ranks 1..178; implied non-increasing; every row
8 farm steps of 124–208 chars; deterministic — identical board.json/data.js
sha256 across runs. `main.ts` exits 1 only because dashboard/screenshots
are not built yet (0 screenshots); board.json + data.js are written first.
