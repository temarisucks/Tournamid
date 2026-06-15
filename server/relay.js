import { WebSocketServer } from 'ws';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const rooms = new Map();

// ============================ PERSISTENT STORE ============================
// Accounts + leaderboards live in a JSON file. The path is configurable so the
// host can point it at a persistent disk/volume (free-tier filesystems are
// ephemeral and would otherwise wipe on every redeploy/restart).
const DATA_FILE = process.env.DATA_FILE || './data/tournamid-data.json';
let store = { accounts: {} };

function loadStore() {
  try {
    if (existsSync(DATA_FILE)) {
      store = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      if (!store.accounts) store.accounts = {};
      console.log(`Loaded ${Object.keys(store.accounts).length} account(s) from ${DATA_FILE}`);
    } else {
      console.log(`No data file at ${DATA_FILE} yet — starting fresh.`);
    }
  } catch (e) {
    console.error('Failed to load data file, starting fresh:', e.message);
    store = { accounts: {} };
  }
}

let saveTimer = null;
let savePending = false;
function saveStore() {
  // debounced write so frequent updates (every match result) don't thrash the disk
  savePending = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!savePending) return;
    savePending = false;
    try {
      const dir = dirname(DATA_FILE);
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(store));
    } catch (e) {
      console.error('Failed to save data file:', e.message);
    }
  }, 1000);
}
loadStore();

// ============================ ACCOUNTS / AUTH ============================
function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}
function makeToken() { return randomBytes(24).toString('hex'); }

function tierFromMmr(mmr) {
  if (mmr >= 2000) return 'Grandmaster';
  if (mmr >= 1800) return 'Master';
  if (mmr >= 1600) return 'Diamond';
  if (mmr >= 1400) return 'Platinum';
  if (mmr >= 1200) return 'Gold';
  if (mmr >= 1000) return 'Silver';
  return 'Bronze';
}

// the public, password-free view of an account
function publicProfile(acc) {
  return {
    username: acc.username,
    mmr: acc.mmr,
    tier: tierFromMmr(acc.mmr),
    rankWins: acc.rankWins, rankLosses: acc.rankLosses,
    casualWins: acc.casualWins, casualLosses: acc.casualLosses,
    best: acc.best
  };
}

function findByToken(token) {
  if (!token) return null;
  for (const key in store.accounts) {
    if (store.accounts[key].token === token) return store.accounts[key];
  }
  return null;
}

const USERNAME_RE = /^[A-Za-z0-9_-]{3,16}$/;

function doRegister(ws, msg) {
  const username = String(msg.username || '').trim();
  const password = String(msg.password || '');
  if (!USERNAME_RE.test(username)) return send(ws, 'auth-error', { message: 'Username must be 3-16 letters, numbers, _ or -.' });
  if (password.length < 4) return send(ws, 'auth-error', { message: 'Password must be at least 4 characters.' });
  const key = username.toLowerCase();
  if (store.accounts[key]) return send(ws, 'auth-error', { message: 'That username is taken.' });
  const salt = randomBytes(16).toString('hex');
  const acc = {
    username, salt, hash: hashPassword(password, salt), token: makeToken(),
    createdAt: Date.now(), mmr: 1000,
    rankWins: 0, rankLosses: 0, casualWins: 0, casualLosses: 0,
    best: { infiniteLadder: 0, pveWave: 0 }
  };
  store.accounts[key] = acc;
  saveStore();
  ws.username = key;
  send(ws, 'auth-ok', { profile: publicProfile(acc), token: acc.token });
}

function doLogin(ws, msg) {
  const username = String(msg.username || '').trim();
  const password = String(msg.password || '');
  const acc = store.accounts[username.toLowerCase()];
  if (!acc) return send(ws, 'auth-error', { message: 'No account with that name.' });
  const attempt = hashPassword(password, acc.salt);
  const ok = attempt.length === acc.hash.length &&
    timingSafeEqual(Buffer.from(attempt), Buffer.from(acc.hash));
  if (!ok) return send(ws, 'auth-error', { message: 'Wrong password.' });
  acc.token = makeToken(); // fresh token each login
  saveStore();
  ws.username = acc.username.toLowerCase();
  send(ws, 'auth-ok', { profile: publicProfile(acc), token: acc.token });
}

function doAuthToken(ws, msg) {
  const acc = findByToken(msg.token);
  if (!acc) return send(ws, 'auth-error', { message: 'Session expired. Please log in.' });
  ws.username = acc.username.toLowerCase();
  send(ws, 'auth-ok', { profile: publicProfile(acc), token: acc.token });
}

function authedAccount(ws) {
  return ws && ws.username ? store.accounts[ws.username] : null;
}

// ============================ MATCHMAKING ============================
const mmQueue = { ranked: [], casual: [] };

function leaveAllQueues(ws) {
  for (const mode of ['ranked', 'casual']) {
    const i = mmQueue[mode].findIndex(e => e.ws === ws);
    if (i >= 0) mmQueue[mode].splice(i, 1);
  }
}

function mmJoin(ws, msg) {
  const acc = authedAccount(ws);
  if (!acc) return send(ws, 'auth-error', { message: 'Log in to play online.' });
  const mode = msg.mode === 'ranked' ? 'ranked' : 'casual';
  leaveAllQueues(ws);
  mmQueue[mode].push({ ws, username: acc.username, mmr: acc.mmr, charType: msg.charType || null, joinedAt: Date.now() });
}

function makeMatchRoom(a, b, mode) {
  const code = roomCode();
  const room = { code, clients: [a.ws, b.ws], createdAt: Date.now(), kind: mode };
  rooms.set(code, room);
  a.ws.roomCode = code; a.ws.slot = 0;
  b.ws.roomCode = code; b.ws.slot = 1;
  const aAcc = store.accounts[a.username.toLowerCase()];
  const bAcc = store.accounts[b.username.toLowerCase()];
  send(a.ws, 'mm-found', { code, slot: 0, mode, opponent: publicProfile(bAcc) });
  send(b.ws, 'mm-found', { code, slot: 1, mode, opponent: publicProfile(aAcc) });
}

function matchmakingTick() {
  // Casual: pair the two longest-waiting players.
  while (mmQueue.casual.length >= 2) {
    const a = mmQueue.casual.shift();
    if (a.ws.readyState !== a.ws.OPEN) continue;
    const b = mmQueue.casual.shift();
    if (!b) { mmQueue.casual.unshift(a); break; }
    if (b.ws.readyState !== b.ws.OPEN) { mmQueue.casual.unshift(a); continue; }
    makeMatchRoom(a, b, 'casual');
  }
  // Ranked: expanding skill window — widens with wait time, eventually pairs anyone.
  const rq = mmQueue.ranked.filter(e => e.ws.readyState === e.ws.OPEN);
  rq.sort((x, y) => x.joinedAt - y.joinedAt);
  const used = new Set();
  for (let i = 0; i < rq.length; i++) {
    if (used.has(i)) continue;
    const a = rq[i];
    const waited = (Date.now() - a.joinedAt) / 1000;
    const window = waited >= 25 ? Infinity : 120 + 40 * waited;
    let bestJ = -1, bestDiff = Infinity;
    for (let j = 0; j < rq.length; j++) {
      if (j === i || used.has(j)) continue;
      const diff = Math.abs(rq[j].mmr - a.mmr);
      if (diff <= window && diff < bestDiff) { bestDiff = diff; bestJ = j; }
    }
    if (bestJ >= 0) {
      used.add(i); used.add(bestJ);
      makeMatchRoom(a, rq[bestJ], 'ranked');
    }
  }
  mmQueue.ranked = rq.filter((_, i) => !used.has(i));

  // status pings for everyone still waiting
  for (const mode of ['ranked', 'casual']) {
    const n = mmQueue[mode].length;
    for (const e of mmQueue[mode]) {
      send(e.ws, 'mm-status', { mode, queued: n, waited: Math.floor((Date.now() - e.joinedAt) / 1000) });
    }
  }
}
setInterval(matchmakingTick, 1000);

// ============================ RANK / RESULTS ============================
function applyEloResult(winnerAcc, loserAcc) {
  const K = 32;
  const expW = 1 / (1 + Math.pow(10, (loserAcc.mmr - winnerAcc.mmr) / 400));
  const expL = 1 / (1 + Math.pow(10, (winnerAcc.mmr - loserAcc.mmr) / 400));
  winnerAcc.mmr = Math.max(0, Math.round(winnerAcc.mmr + K * (1 - expW)));
  loserAcc.mmr = Math.max(0, Math.round(loserAcc.mmr + K * (0 - expL)));
}

function handleMatchResult(ws, msg, room) {
  if (ws.slot !== 0) return; // host-trusted
  const mode = room.kind;
  if (mode !== 'ranked' && mode !== 'casual') return;
  if (room._resultApplied) return; // once per match
  room._resultApplied = true;

  const hostAcc = authedAccount(room.clients[0]);
  const guestAcc = authedAccount(room.clients[1]);
  if (!hostAcc || !guestAcc) return;
  const hostWon = Number(msg.winner) === 0; // winner is 0 (host) or 1 (guest)
  const winnerAcc = hostWon ? hostAcc : guestAcc;
  const loserAcc = hostWon ? guestAcc : hostAcc;

  if (mode === 'ranked') {
    applyEloResult(winnerAcc, loserAcc);
    winnerAcc.rankWins++; loserAcc.rankLosses++;
  } else {
    winnerAcc.casualWins++; loserAcc.casualLosses++;
  }
  saveStore();
  if (room.clients[0]) send(room.clients[0], 'rank-update', { profile: publicProfile(hostAcc) });
  if (room.clients[1]) send(room.clients[1], 'rank-update', { profile: publicProfile(guestAcc) });
}

// ============================ LEADERBOARDS ============================
const BOARDS = new Set(['infiniteLadder', 'pveWave']);

function submitScore(ws, msg) {
  const acc = authedAccount(ws);
  if (!acc) return;
  const board = msg.board;
  if (!BOARDS.has(board)) return;
  const score = Math.max(0, Math.floor(Number(msg.score) || 0));
  if (!acc.best) acc.best = { infiniteLadder: 0, pveWave: 0 };
  if (score > (acc.best[board] || 0)) { acc.best[board] = score; saveStore(); }
  send(ws, 'score-ack', { board, best: acc.best[board] });
}

function sendLeaderboard(ws, msg) {
  const board = msg.board;
  if (!BOARDS.has(board)) return;
  const rows = Object.values(store.accounts)
    .map(a => ({ username: a.username, score: (a.best && a.best[board]) || 0 }))
    .filter(r => r.score > 0)
    .sort((x, y) => y.score - x.score);
  const top = rows.slice(0, 25);
  let you = null;
  const acc = authedAccount(ws);
  if (acc) {
    const idx = rows.findIndex(r => r.username.toLowerCase() === acc.username.toLowerCase());
    if (idx >= 0) you = { rank: idx + 1, score: rows[idx].score, total: rows.length };
  }
  send(ws, 'leaderboard', { board, top, you });
}

// ============================ ROOMS / RELAY ============================
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
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, ...data }));
}

function broadcast(room, type, data = {}, except = null) {
  for (const client of room.clients) {
    if (client && client !== except) send(client, type, data);
  }
}

function cleanup(ws) {
  leaveAllQueues(ws);
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

    // ---- account / auth (no room required) ----
    if (msg.type === 'register') return doRegister(ws, msg);
    if (msg.type === 'login') return doLogin(ws, msg);
    if (msg.type === 'auth-token') return doAuthToken(ws, msg);
    if (msg.type === 'logout') { ws.username = null; leaveAllQueues(ws); return; }

    // ---- matchmaking (auth required) ----
    if (msg.type === 'mm-join') return mmJoin(ws, msg);
    if (msg.type === 'mm-leave') { leaveAllQueues(ws); return; }

    // ---- leaderboards ----
    if (msg.type === 'score-submit') return submitScore(ws, msg);
    if (msg.type === 'leaderboard-get') return sendLeaderboard(ws, msg);

    // ---- custom-lobby room create/join ----
    if (msg.type === 'create') {
      const code = roomCode();
      const room = { code, clients: [ws, null], createdAt: Date.now(), kind: 'custom' };
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
      room._resultApplied = false; // a fresh match (rematch/next round) can report again
      setTimeout(() => broadcast(room, 'start', payload), 900);
      return;
    }

    // ranked/casual outcome — relay processes it (updates MMR / records)
    if (msg.type === 'match-result') return handleMatchResult(ws, msg, room);

    const relayTypes = new Set(['select', 'stage', 'input', 'sync', 'ult-sync', 'round-result', 'next-round', 'game-over', 'ping-game', 'post-match']);
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
