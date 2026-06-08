import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const rooms = new Map();

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function send(ws, type, data = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, ...data }));
}

function broadcast(room, type, data = {}, except = null) {
  for (const client of room.clients) {
    if (client && client !== except) send(client, type, data);
  }
}

function cleanup(ws) {
  const code = ws.roomCode;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  const idx = room.clients.indexOf(ws);
  if (idx >= 0) room.clients[idx] = null;
  broadcast(room, 'peer-left', { slot: idx });
  if (!room.clients[0] && !room.clients[1]) rooms.delete(code);
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'create') {
      const code = roomCode();
      const room = { code, clients: [ws, null], createdAt: Date.now() };
      rooms.set(code, room);
      ws.roomCode = code;
      ws.slot = 0;
      send(ws, 'created', { code, slot: 0 });
      return;
    }

    if (msg.type === 'join') {
      const code = String(msg.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, 'error', { message: 'Room not found.' });
      if (room.clients[1]) return send(ws, 'error', { message: 'Room is full.' });
      room.clients[1] = ws;
      ws.roomCode = code;
      ws.slot = 1;
      send(ws, 'joined', { code, slot: 1 });
      broadcast(room, 'peer-joined', { slot: 1 }, ws);
      return;
    }

    const code = ws.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    if (msg.type === 'start') {
      if (ws.slot !== 0) return;
      const seed = Number.isFinite(msg.seed) ? msg.seed : Math.floor(Math.random() * 0xFFFFFFFF);
      const payload = { ...msg, seed, slot: ws.slot };
      setTimeout(() => broadcast(room, 'start', payload), 900);
      return;
    }

    const relayTypes = new Set(['select', 'stage', 'input', 'sync', 'round-result', 'next-round', 'game-over', 'ping-game']);
    if (relayTypes.has(msg.type)) {
      broadcast(room, msg.type, { ...msg, slot: ws.slot }, ws);
    }
  });

  ws.on('close', () => cleanup(ws));
  ws.on('error', () => cleanup(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      cleanup(ws);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

console.log(`Tournamid relay listening on :${PORT}`);
