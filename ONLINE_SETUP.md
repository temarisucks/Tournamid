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

- type it into the Online Friend Room screen, or
- edit `js/online-config.js` and set `window.TOURNAMID_WS_URL`.

## Current Netcode Scope

This first pass is a friend-room online foundation:

- room create/join
- character select sync
- host-selected stage sync
- input relay
- host-owned timer/round/game outcomes
- host snapshots for correction

It is not full tournament-grade rollback yet. The next step is converting the game simulation to a fixed tick with saved state rewind/replay.
