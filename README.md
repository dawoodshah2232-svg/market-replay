# ReplayTrader — Market Replay & Practice Trading (phone-first)

Rewind any chart, hide the future, press Play, and practise trading on **real historical candles** — exactly like rewinding a video of the market.

**Live app:** https://dawoodshah2232-svg.github.io/market-replay/  *(after GitHub Pages is enabled — see below)*
**No broker. No login. No MT5 Manager access. Simulated money only.**

## How it works — your 5 requirements

1. **Pick a start point** — choose a symbol (XAUUSD, BTCUSD, ETHUSD, EURUSD, GBPUSD), a timeframe (M15, M30, H1, H4, Daily, Weekly), then:
   - *Candles ago* — 5 / 10 / 20 / 50 / 100 / 200, or type any number
   - *Pick a date* — date & time picker, replay starts at the first candle on/after it
   - *🎲 Random* — blind practice, start date hidden
2. **Future is hidden** — only candles up to the start point are drawn. The rest exist in the data file but are not shown.
3. **Press Play** — candles replay forward. Speeds: 1 candle per 4s → 1 per 0.06s. Step forward/back one candle, restart, or jump to end. Tick mode animates *inside* each candle (open → high/low → close in 10 steps) so price moves smoothly.
4. **Trade during replay** — big BUY / SELL buttons, lot size (+/−), Stop Loss & Take Profit in points, RR 1:1 / 1:2 / 1:3 quick buttons, risk-% auto lot sizing, pending orders (Buy/Sell Limit & Stop), modify SL to breakeven, close / close-all. SL/TP trigger mid-candle in tick mode. Open positions show entry / SL / TP lines on the chart, with live floating P/L.
5. **Timeframes** — M15, M30 (derived from M15), H1, H4 (derived from H1), Daily, Weekly (derived from Daily). Example from the request: Daily chart, rewind 4 candles — set "Candles ago = 4", Daily, Play.

## Results & stats

- Balance / Equity / Floating P/L, live
- Trade history table, win rate, profit factor, total P/L, max drawdown, expectancy
- Session notes (journal), Save session (localStorage), Export trades as CSV
- Optional prop-firm challenge: +10% target, fail below −5% equity — PASS/FAIL live
- SMA 20/50 overlay toggle, zoom in/out, touch-drag crosshair to inspect any revealed candle

## Data — real, not made up

Bundled in `data/` (updated 2026-11-06, refresh with `scripts/fetch_data.py` — see below):

| Symbol | Source | D1 | H1 | M15 |
|---|---|---|---|---|
| XAUUSD | Yahoo Finance GC=F (gold futures, spot proxy) | 504 | 1,200 | 1,200 |
| BTCUSD | Kraken OHLC | 720 | 721 | 721 |
| ETHUSD | Kraken OHLC | 720 | 721 | 721 |
| EURUSD | Yahoo Finance EURUSD=X | 518 | 1,200 | 1,200 |
| GBPUSD | Yahoo Finance GBPUSD=X | 518 | 1,200 | 1,200 |

H4 is aggregated from H1 (4×), M30 from M15 (2×), Weekly from Daily (5×). The app loads only the selected symbol's file, so it stays fast on a phone. It works offline once installed (service worker caches the app + data).

Contract specs used for P/L: XAUUSD 1.00 lot = 100 oz ($100 per $1 move), BTC/ETH 1.00 lot = 1 coin, EUR/GBP 1.00 lot = 100,000 units. 1 point = $0.10 XAUUSD, $1 BTC/ETH, 0.0001 FX. Spread is simulated (default 2 points, change in Settings).

## Use it on your phone

1. Open the live link in Chrome/Safari on your phone.
2. Browser menu → **Add to Home Screen**. It opens full-screen like an app.
3. Pick symbol → timeframe → candles ago → **Set start & hide future** → **▶ Play** → BUY/SELL.

No install from an app store, no account, nothing to log in to.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Refresh the data

```bash
python3 scripts/fetch_data.py   # Kraken + Yahoo, no API key needed
```

## MT5 — what is / isn't possible

See **MT5-EXPLAINED.md**. Short version: MT5 mobile has no replay. MT5 Manager API is broker-only and replay doesn't need it. Desktop-only paid MQL5 replay tools exist, but they don't run on a phone. This app is the phone solution.

## Disclaimer

Simulated practice only. Not financial advice, not a broker, no real trades are placed. Past replay results do not predict live results.
