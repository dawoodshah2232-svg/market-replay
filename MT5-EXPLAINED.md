# MT5 & Market Replay — what is possible, honestly

## Your question

> "If it requires MT5 Manager access or another setup, please explain what is possible."

## Short answer

**You do NOT need MT5 Manager access. Replay does not need it, and as a retail trader you cannot get it anyway. MT5 on your phone cannot do replay at all — so I built you a standalone phone app instead (this repo).**

## 1. MT5 mobile (iOS / Android) — no replay

- MetaTrader 5 mobile has **no built-in market replay / chart replay feature**. There is no rewind, no Play button, no "hide future candles" in the app.
- You cannot install indicators, EAs or scripts in MT5 mobile. The mobile app only runs what the broker server sends it.
- Source: MetaTrader 5 itself "lacks many features including the Chart Replay Feature" — Udemy/MQL5 articles on building replay for MT5 all target desktop.

## 2. MT5 desktop (Windows) — replay exists, but only on desktop

- MT5 desktop has a **Strategy Tester** with visual mode — it can replay an EA, but it is not a manual "press Play and trade by hand" replay, and it does not run on a phone.
- Paid tools on the MQL5 Market (e.g. "MT5 Chart Replay", QFT Replay Simulator, Soft4FX-style tools for MT5) do manual candle-by-candle replay with simulated trading — **desktop Windows only**. They work by creating a custom symbol and feeding it historical bars, or by running inside the tester.
- If you want that route later, it needs: a Windows PC/VPS with MT5 desktop + the broker's historical data + a purchased MQL5 utility. It still will not appear inside the MT5 phone app.

## 3. MT5 Manager API — broker-only, not for this

- The **MT5 Manager / Server API** is a C++/.NET library MetaQuotes licences to the company that operates an MT5 trade server. With a manager login it can create accounts, adjust balances, and read every position on that one broker's server.
- **Who can get it:** brokers only. "If you do not own the trade server, the Manager API is not an option" (metatraderapi.net). A broker will not give an outside trader manager rights over its clients, and a manager login at Broker A sees nothing at Broker B.
- **Do you need it for replay? No.** Replay is a client-side simulation: take historical candles, hide the future ones, reveal them one by one, and simulate fills. No server, no broker, no account, no manager login is involved. Asking a broker for Manager access for a practice tool would be refused — and it would not help even if granted.

## 4. What I built instead (this repo)

A mobile-first web app (PWA) that does exactly what you described, on your phone, with no broker:

- Real historical candles (Kraken for BTC/ETH, Yahoo Finance for gold/FX), bundled in `data/`
- Choose start by candles-ago / date / random → future hidden → Play / pause / step / speed
- Simulated BUY/SELL, SL/TP, pending orders, risk-% lot sizing, live P/L, trade history, win rate, profit factor, drawdown, CSV export, challenge mode
- Add to Home Screen → works like an app, offline

## 5. If you later want it *inside* MT5

That is a separate desktop project: an MQL5 Expert Advisor / custom-symbol replay tool for MT5 Windows, plus a VPS so it runs 24/7. It will never run inside the MT5 phone app itself — MetaQuotes does not allow that. The web app above is the only way to get this exact experience on your phone today.
