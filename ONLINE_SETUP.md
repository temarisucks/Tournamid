# Tournamid Online Setup

Netlify can keep hosting the game frontend. Online play also needs a separate WebSocket relay because the match needs a long-lived realtime connection.

## Local Testing

1. Install the relay dependency:

   ```bash
   npm install
   ```

2. Start the relay:

   ```bash
   npm run relay
   ```

3. Open the game in two browser windows.

4. In the game, choose `Play` -> `Online Friend Room`.

5. Use this relay URL:

   ```text
   ws://localhost:8787
   ```

6. Host a room in one browser, then join with the room code in the other.

## Deploying The Relay

Deploy this repo or the `server/relay.js` + `package.json` files to a Node host that supports WebSockets, such as Render, Railway, Fly.io, or a VPS.

Set the host to run:

```bash
npm install
npm run relay
```

The relay reads `PORT` from the hosting provider automatically.

After deployment, set the frontend relay URL to the deployed `wss://...` URL. You can either:

- type it into the Account / Custom Lobby screen, or
- edit `js/online-config.js` and set `window.TOURNAMID_WS_URL`.

## Accounts, Ranked/Casual, Leaderboards (v0.27.0)

The relay now stores **accounts**, **ranked MMR / win-loss records**, and the
**Infinite Ladder + PvE leaderboards** in a JSON data file. No new npm dependencies —
password hashing uses Node's built-in `crypto`.

**IMPORTANT — persistent storage:** the data file defaults to `./data/tournamid-data.json`.
Free-tier hosts (Render/Railway) have an **ephemeral filesystem**, so without a persistent
disk every redeploy/restart **wipes all accounts and leaderboards**. To keep data:

- **Render**: add a **Disk** (e.g. mount path `/data`), then set env `DATA_FILE=/data/tournamid-data.json`.
- **Railway**: add a **Volume**, then set `DATA_FILE` to a path on it.
- **VPS / local**: nothing to do — it writes `./data/tournamid-data.json` next to the relay.

Match results in ranked/casual are **host-trusted** (only the host reports the winner) —
fine for a friendly game, not cheat-proof. Passwords are scrypt+salt hashed; there is no
email/password recovery (a lost password means making a new account).

## Current Netcode Scope

This first pass is a friend-room online foundation:

- room create/join
- character select sync
- host-selected stage sync
- input relay
- host-owned timer/round/game outcomes
- host snapshots for correction

It is not full tournament-grade rollback yet. The next step is converting the game simulation to a fixed tick with saved state rewind/replay.
