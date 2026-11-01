# Meme Desk (paper trading viewer)

Installable phone app (PWA) that shows the Grok Bot memecoin **paper-trading** desk. No wallet, no real money, no secrets.
The desk publishes a small JSON snapshot to a public ntfy.sh topic (see `config.js`); this page polls it and shows balance,
today's change, open positions, recent trades, win rate and stage heartbeats, with a "Not live" banner when the snapshot is old.

Open on Android in Chrome, then menu ⋮ → **Add to Home screen / Install app**.
