// ============================ HOST-AUTHORITATIVE NETCODE ============================
// The HOST (slot 0) runs the one true simulation — the exact same code path as offline
// play — and streams compact state snapshots to the guest ~20x/sec. The GUEST (slot 1)
// never simulates gameplay: it sends its inputs every change, renders the host's
// snapshots, and dead-reckons entities between them.
//
// Why: the previous rollback/lockstep netcode demanded perfect determinism from every
// new mechanic (RNG, timers, snapshot completeness). One simulation = desyncs are
// impossible by construction; connection quality only affects latency, never correctness.

const ONLINE_REMOTE_BINDINGS = {
    l: 'OnlineRemoteLeft',
    r: 'OnlineRemoteRight',
    u: 'OnlineRemoteUp',
    d: 'OnlineRemoteDown',
    block: 'OnlineRemoteBlock',
    atkL: 'OnlineRemoteLight',
    atkH: 'OnlineRemoteHeavy',
    special: 'OnlineRemoteSpecial',
    ult: 'OnlineRemoteUlt',
    tag: 'OnlineRemoteTag'
};

const ONLINE_ACTIONS = ['l', 'r', 'u', 'd', 'block', 'atkL', 'atkH', 'special', 'ult', 'tag'];
const ONLINE_TAP_ACTIONS = ['u', 'atkL', 'atkH', 'special', 'ult', 'tag']; // edge-triggered — never drop these
const ONLINE_SNAPSHOT_RATE = 1 / 30; // host → guest state, 30x/sec
const ONLINE_TEAM_SNAPSHOT_RATE = 1 / 24; // ranked 2v2 carries more state; prediction fills the gaps
const ONLINE_INPUT_HEARTBEAT = 0.05; // guest → host inputs re-sent at least this often
const ONLINE_PING_RATE = 1.0;
const ONLINE_REMOTE_STALE_MS = 300;  // no traffic for this long → treat remote input as released
const ONLINE_MAX_SYNC_BUFFER = 48 * 1024; // avoid seconds of queued stale snapshots on ranked 2v2

let onlineState = {
    active: false,
    socket: null,
    roomCode: '',
    slot: null,
    connected: false,
    peerConnected: false,
    forcedRelayUrl: null,
    localSelection: null,
    remoteSelection: null,
    remoteUsername: '',
    // host: guest-input queue; guest: input send bookkeeping
    inputQueue: [],
    lastGuestInput: null,
    lastSentInput: null,
    inputHeartbeat: 0,
    // host: snapshot pacing; guest: last received snapshot age
    snapTimer: 0,
    lastSnapAt: 0,
    snapAgeMs: null,
    // shared
    pingTimer: 0,
    pingSeq: 0,
    pendingPings: {},
    pingMs: null,
    lastRemoteInputAt: 0,
    lastRemoteInputMs: null,
    remoteInputStale: false,
    lastHpSig: null,
    lastImpactAt: 0,
    postMatchLocal: null,
    postMatchRemote: null,
    disconnecting: false,
    rankedResult: null,
    droppedSyncs: 0,
    status: ''
};

function onlineBlankInput() {
    return { l: false, r: false, u: false, d: false, block: false, atkL: false, atkH: false, special: false, ult: false };
}

function onlineCloneInput(input) {
    let out = {};
    ONLINE_ACTIONS.forEach(action => { out[action] = !!(input && input[action]); });
    return out;
}

function onlineSameInput(a, b) {
    return ONLINE_ACTIONS.every(action => !!(a && a[action]) === !!(b && b[action]));
}

function onlineDefaultUrl() {
    if (window.TOURNAMID_WS_URL) return window.TOURNAMID_WS_URL;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:8787';
    return '';
}

function onlineSetStatus(text) {
    onlineState.status = text;
    let el = document.getElementById('online-status');
    if (el) el.innerText = text;
}

function onlineResetRuntimeStats() {
    onlineState.inputQueue = [];
    onlineState.lastGuestInput = onlineBlankInput();
    onlineState.lastSentInput = null;
    onlineState.inputHeartbeat = 0;
    onlineState.snapTimer = 0;
    onlineState.lastSnapAt = 0;
    onlineState.snapAgeMs = null;
    onlineState.pingTimer = 0;
    onlineState.pendingPings = {};
    onlineState.pingMs = null;
    onlineState.lastRemoteInputAt = 0;
    onlineState.lastRemoteInputMs = null;
    onlineState.remoteInputStale = false;
    onlineState.lastHpSig = null;
    onlineState.lastImpactAt = 0;
    onlineState.postMatchLocal = null;
    onlineState.postMatchRemote = null;
    onlineState.disconnecting = false;
    onlineState.rankedResult = null;
    onlineState.droppedSyncs = 0;
    onlineRenderRankedResult();
    onlineMarkRemoteTraffic();
    ONLINE_ACTIONS.forEach(action => { keys[ONLINE_REMOTE_BINDINGS[action]] = false; });
}

function onlineGetUrl() {
    return onlineDefaultUrl();
}

// ============================ ACCOUNTS / RANKED / LEADERBOARDS ============================
// The relay is now a real backend: accounts (required for any online play), ranked +
// casual matchmaking, and Infinite Ladder / PvE leaderboards. All of it rides the same
// WebSocket the custom lobby already uses.
let account = null;                 // the logged-in profile {username, mmr, tier, ...} or null
onlineState.matchKind = 'custom';   // 'custom' | 'ranked' | 'casual'
onlineState.opponent = null;        // opponent profile during a ranked/casual match
onlineState.queueMode = null;       // which queue we're sitting in, if any

function rankLabel(p) {
    if (!p) return '';
    return `${p.tier} • ${p.mmr}`;
}

function onlineRankedResultText(result) {
    if (!result || result.mode !== 'ranked') return '';
    let delta = Number(result.delta) || 0;
    let sign = delta > 0 ? '+' : '';
    let outcome = result.won ? 'WIN' : 'LOSS';
    let tier = result.newTier || (account && account.tier) || '';
    let mmr = Number.isFinite(Number(result.newMmr)) ? Number(result.newMmr) : (account && account.mmr);
    let rank = tier && mmr != null ? `${tier} (${mmr})` : (tier || (mmr != null ? String(mmr) : ''));
    return rank
        ? `${outcome} ${sign}${delta} ELO - Current rank: ${rank}`
        : `${outcome} ${sign}${delta} ELO`;
}

function onlineRenderRankedResult() {
    let el = document.getElementById('end-ranked-result');
    if (!el) return;
    if (currentMode !== 'ONLINE' || onlineState.matchKind !== 'ranked') {
        el.innerText = '';
        return;
    }
    el.innerText = onlineState.rankedResult
        ? onlineRankedResultText(onlineState.rankedResult)
        : 'Updating ranked result...';
}

function onlineResolveUrl() {
    return onlineDefaultUrl();
}

function accountStatus(text) {
    let el = document.getElementById('account-status');
    if (el) el.innerText = text || '';
}

let onlinePendingAfterAuth = null; // action to run once a silent re-auth completes

// Connect (if needed), re-authenticate the socket if we're logged in, then run cb.
// Auth is per-connection on the relay, so a fresh socket after a disconnect must
// re-send the token before matchmaking / leaderboard actions will be accepted.
function onlineEnsureConnected(cb, onFail) {
    let url = onlineResolveUrl();
    if (!url) { if (onFail) onFail('Online relay is not configured.'); return; }
    onlineState.forcedRelayUrl = url;
    let run = () => {
        if (account && !onlineState.authed) {
            let saved = null;
            try { saved = JSON.parse(localStorage.getItem('tournamidAuth')); } catch (e) {}
            if (saved && saved.token) { onlinePendingAfterAuth = cb; onlineSend('auth-token', { token: saved.token }); return; }
        }
        cb();
    };
    if (onlineState.socket && onlineState.socket.readyState === WebSocket.OPEN) { run(); return; }
    onlineConnect().then(() => run()).catch(() => { if (onFail) onFail('Could not reach the relay. Check the URL.'); });
}

function startRanked() { startMatchmaking('ranked'); }
function startCasual() { startMatchmaking('casual'); }

// these menu screens must never appear over a live match (a stray click/keypress on a
// lingering, focused menu button could otherwise yank a player out mid-fight)
function onlineInActiveMatch() {
    return gameState === 'PLAYING' || gameState === 'ROUND_END';
}

// --- entry point from the main menu's Online button ---
function showOnlineHub() {
    if (onlineInActiveMatch()) return;
    sfx.init();
    currentMode = 'ONLINE';
    if (account) { showOnlineMenu(); return; }
    // show the account screen; if we have a stored token, try a silent re-login
    showScreen('account-screen');
    gameState = 'ONLINE_LOBBY';
    accountStatus('Log in or create an account to play online.');
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('tournamidAuth')); } catch (e) {}
    if (saved && saved.token) {
        accountStatus('Resuming your session…');
        onlineEnsureConnected(() => onlineSend('auth-token', { token: saved.token }),
            () => accountStatus('Log in or create an account to play online.'));
    }
}

function showOnlineMenu() {
    if (onlineInActiveMatch()) return;
    currentMode = 'ONLINE';
    gameState = 'MODE_SELECT';
    onlineState.matchKind = 'custom';
    showScreen('mode-screen');
    if (typeof setOnlineModesOpen === 'function') setOnlineModesOpen(true);
    refreshAccountUI();
}

function accountRegister() {
    let u = (document.getElementById('account-username').value || '').trim();
    let p = document.getElementById('account-password').value || '';
    accountStatus('Creating account…');
    onlineEnsureConnected(() => onlineSend('register', { username: u, password: p }), accountStatus);
}
function accountLogin() {
    let u = (document.getElementById('account-username').value || '').trim();
    let p = document.getElementById('account-password').value || '';
    accountStatus('Signing in…');
    onlineEnsureConnected(() => onlineSend('login', { username: u, password: p }), accountStatus);
}
function accountLogout() {
    onlineSend('logout');
    account = null;
    try { localStorage.removeItem('tournamidAuth'); } catch (e) {}
    refreshAccountUI();
    showOnlineHub();
}

function applyProfile(p, result) {
    if (result && result.mode === 'ranked') {
        onlineState.rankedResult = result;
    } else if (onlineState.matchKind === 'ranked' && account && p &&
               Number.isFinite(Number(account.mmr)) && Number.isFinite(Number(p.mmr)) &&
               Number(account.mmr) !== Number(p.mmr)) {
        onlineState.rankedResult = {
            mode: 'ranked',
            won: Number(p.mmr) > Number(account.mmr),
            oldMmr: Number(account.mmr),
            newMmr: Number(p.mmr),
            delta: Number(p.mmr) - Number(account.mmr),
            oldTier: account.tier,
            newTier: p.tier
        };
    }
    account = p;
    refreshAccountUI();
    onlineRenderRankedResult();
}

// reflect the current login state across the menus
function refreshAccountUI() {
    let who = document.getElementById('online-menu-user');
    if (who) who.innerText = account ? `${account.username} — ${rankLabel(account)}` : '';
    let rec = document.getElementById('online-menu-record');
    if (rec) rec.innerText = account ? `Ranked ${account.rankWins}-${account.rankLosses}   •   Casual ${account.casualWins}-${account.casualLosses}` : '';
}

// --- matchmaking ---
function startMatchmaking(mode) {
    if (onlineInActiveMatch()) return;
    if (!account) { showOnlineHub(); return; }
    onlineState.queueMode = mode;
    onlineState.matchKind = mode;
    sfx.init();
    onlineEnsureConnected(() => {
        onlineResetRuntimeStats();
        onlineSend('mm-join', { mode });
        let h = document.getElementById('mm-title');
        if (h) h.innerText = `Searching for ${mode === 'ranked' ? 'RANKED' : 'CASUAL'} match…`;
        let s = document.getElementById('mm-status');
        if (s) s.innerText = 'Connecting to the queue…';
        showScreen('matchmaking-screen');
        gameState = 'ONLINE_LOBBY';
    }, msg => { accountStatus(msg); showScreen('account-screen'); });
}

function cancelMatchmaking() {
    onlineSend('mm-leave');
    onlineState.queueMode = null;
    showOnlineMenu();
}

// --- leaderboards ---
let onlineLeaderboardCb = null;
function submitScore(board, score) {
    if (!account) return;
    onlineEnsureConnected(() => onlineSend('score-submit', { board, score }), () => {});
}
function fetchLeaderboard(board, cb) {
    onlineLeaderboardCb = cb;
    onlineEnsureConnected(() => onlineSend('leaderboard-get', { board }),
        () => { if (cb) cb(null); });
}

function showOnlineScreen() {
    if (onlineInActiveMatch()) return; // never surface the lobby over a live match
    sfx.init();
    currentMode = 'ONLINE';
    onlineState.matchKind = 'custom';
    gameState = 'ONLINE_LOBBY';
    let room = document.getElementById('online-room-code');
    if (room) room.value = '';
    onlineSetStatus('Host or join a friend room.');
    showScreen('online-screen');
}

function onlineConnect() {
    return new Promise((resolve, reject) => {
        if (onlineState.socket && onlineState.socket.readyState === WebSocket.OPEN) return resolve(onlineState.socket);
        let url = onlineState.forcedRelayUrl || onlineGetUrl();
        if (!url) {
            onlineSetStatus('Online relay is not configured.');
            return reject(new Error('Missing relay URL'));
        }

        onlineSetStatus('Connecting...');
        let ws = new WebSocket(url);
        onlineState.socket = ws;

        ws.addEventListener('open', () => {
            onlineState.connected = true;
            onlineState.authed = false; // a fresh socket must re-authenticate before matchmaking
            onlineSetStatus('Connected.');
            resolve(ws);
        }, { once: true });
        ws.addEventListener('message', e => onlineHandleMessage(e));
        ws.addEventListener('close', () => {
            onlineState.connected = false;
            onlineState.peerConnected = false;
            if (currentMode === 'ONLINE') onlineSetStatus('Disconnected from relay.');
        });
        ws.addEventListener('error', () => {
            onlineSetStatus('Could not connect to relay.');
            reject(new Error('WebSocket error'));
        }, { once: true });
    });
}

async function onlineHostRoom() {
    currentMode = 'ONLINE';
    onlineState.active = true;
    await onlineConnect().catch(() => null);
    if (!onlineState.socket || onlineState.socket.readyState !== WebSocket.OPEN) return;
    onlineSend('create');
}

async function onlineJoinRoom() {
    currentMode = 'ONLINE';
    onlineState.active = true;
    let code = (document.getElementById('online-room-code').value || '').trim().toUpperCase();
    if (!code) return onlineSetStatus('Enter the room code from the host.');
    await onlineConnect().catch(() => null);
    if (!onlineState.socket || onlineState.socket.readyState !== WebSocket.OPEN) return;
    onlineSend('join', { code });
}

function onlineSend(type, data = {}) {
    let ws = onlineState.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, ...data }));
}

function onlineSnapshotInterval() {
    return teamBattle ? ONLINE_TEAM_SNAPSHOT_RATE : ONLINE_SNAPSHOT_RATE;
}

function onlineSendSnapshot(force = false) {
    let ws = onlineState.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (!force && ws.bufferedAmount > ONLINE_MAX_SYNC_BUFFER) {
        onlineState.droppedSyncs = (onlineState.droppedSyncs || 0) + 1;
        return false;
    }
    onlineSend('sync', { snap: onlineHostCaptureSnapshot() });
    return true;
}

function onlineHandleMessage(event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }

    // ---- accounts / auth ----
    if (msg.type === 'auth-ok') {
        onlineState.authed = true;
        applyProfile(msg.profile);
        try { localStorage.setItem('tournamidAuth', JSON.stringify({ username: msg.profile.username, token: msg.token })); } catch (e) {}
        if (onlinePendingAfterAuth) { let f = onlinePendingAfterAuth; onlinePendingAfterAuth = null; f(); return; }
        // initial login / register / silent resume on the account screen → go to the sub-menu
        let acct = document.getElementById('account-screen');
        if (acct && !acct.classList.contains('hidden')) showOnlineMenu();
        return;
    }
    if (msg.type === 'auth-error') {
        onlineState.authed = false;
        onlinePendingAfterAuth = null;
        account = null;
        try { localStorage.removeItem('tournamidAuth'); } catch (e) {}
        accountStatus(msg.message || 'Could not sign in.');
        if (gameState === 'ONLINE_LOBBY') showScreen('account-screen');
        return;
    }
    if (msg.type === 'rank-update') { applyProfile(msg.profile, msg.result); return; }

    // ---- matchmaking ----
    if (msg.type === 'mm-status') {
        let s = document.getElementById('mm-status');
        if (s) s.innerText = `Searching… ${msg.waited}s   •   ${msg.queued} in queue`;
        return;
    }
    if (msg.type === 'mm-found') {
        onlineState.matchKind = msg.mode;
        onlineState.opponent = msg.opponent || null;
        onlineState.remoteUsername = msg.opponent && msg.opponent.username ? msg.opponent.username : '';
        onlineState.roomCode = msg.code;
        onlineState.slot = Number(msg.slot);
        onlineState.active = true;
        onlineState.peerConnected = true;
        onlineState.queueMode = null;
        onlineState.localSelection = null;
        onlineState.remoteSelection = null;
        onlineResetRuntimeStats();
        currentMode = 'ONLINE';
        let opp = msg.opponent ? `${msg.opponent.username} (${rankLabel(msg.opponent)})` : 'an opponent';
        showNetMessage('MATCH FOUND', `vs ${opp}`);
        setTimeout(() => { hideNetMessage(); goToCharSelect('ONLINE'); }, 1400);
        return;
    }

    // ---- leaderboards ----
    if (msg.type === 'score-ack') {
        if (account && account.best) account.best[msg.board] = msg.best;
        return;
    }
    if (msg.type === 'leaderboard') {
        if (onlineLeaderboardCb) { onlineLeaderboardCb(msg); onlineLeaderboardCb = null; }
        return;
    }

    if (msg.type === 'created' || msg.type === 'joined') {
        onlineState.roomCode = msg.code;
        onlineState.slot = Number(msg.slot);
        onlineState.active = true;
        onlineState.peerConnected = msg.type === 'joined';
        onlineState.localSelection = null;
        onlineState.remoteSelection = null;
        onlineResetRuntimeStats();
        onlineSetStatus(msg.type === 'created'
            ? `Room ${msg.code}. Send this code to your friend.`
            : `Joined room ${msg.code}.`);
        goToCharSelect('ONLINE');
        return;
    }

    if (msg.type === 'peer-joined') {
        onlineState.peerConnected = true;
        onlineSetStatus(`Friend joined room ${onlineState.roomCode}.`);
        if ((onlineState.localPicks || []).length) onlineSend('select', { picks: [...onlineState.localPicks], locked: !!onlineState.localLocked, username: account ? account.username : '' });
        if (gameState === 'STAGE_SELECT') onlineSend('stage', { stageId: selectedStage });
        updateOnlineSelectTitle();
        return;
    }

    if (msg.type === 'peer-left') {
        onlineState.peerConnected = false;
        // If we're in or just finished a match, the opponent vanishing mid-flow needs
        // a visible heads-up, then an automatic exit. In the lobby it's just a status.
        if (currentMode === 'ONLINE' && ['PLAYING', 'ROUND_END', 'END'].includes(gameState)) {
            onlineHandleOpponentDisconnect();
        } else {
            onlineResetRuntimeStats();
            onlineSetStatus('Friend left the room.');
        }
        return;
    }

    if (msg.type === 'error') {
        onlineSetStatus(msg.message || 'Online error.');
        return;
    }

    if (msg.type === 'select') {
        onlineState.peerConnected = true;
        onlineApplyRemoteSelection(msg);
        return;
    }

    if (msg.type === 'stage') {
        onlineState.peerConnected = true;
        selectedStage = msg.stageId || 'dojo';
        document.querySelectorAll('.stage-card').forEach(c => c.classList.toggle('selected', c.dataset.stage === selectedStage));
        return;
    }

    if (msg.type === 'start') {
        selectedStage = msg.stageId || selectedStage;
        // squads (ranked 2v2) — fall back to single picks for casual/custom
        onlineState.p1Picks = Array.isArray(msg.p1Picks) && msg.p1Picks.length ? msg.p1Picks : (msg.p1Selection ? [msg.p1Selection] : (onlineState.p1Picks || []));
        onlineState.p2Picks = Array.isArray(msg.p2Picks) && msg.p2Picks.length ? msg.p2Picks : (msg.p2Selection ? [msg.p2Selection] : (onlineState.p2Picks || []));
        if (msg.p1Username || msg.p2Username) onlineState.remoteUsername = Number(onlineState.slot) === 0 ? (msg.p2Username || onlineState.remoteUsername) : (msg.p1Username || onlineState.remoteUsername);
        onlineState.teamMatch = !!msg.team;
        p1Selection = onlineState.p1Picks[0] || p1Selection;
        p2Selection = onlineState.p2Picks[0] || p2Selection;
        onlineState.entSeed = typeof msg.entSeed === 'number' ? msg.entSeed : 0; // shared entrance-script pick
        onlineState.postMatchLocal = null;
        onlineState.postMatchRemote = null;
        hideNetMessage();
        document.getElementById('end-screen').classList.add('hidden');
        onlineResetRuntimeStats();
        startGame();
        return;
    }

    if (msg.type === 'sync') { // host → guest state snapshot
        onlineMarkRemoteTraffic();
        if (msg.entSkip) { // host skipped the pre-fight ceremony — cut to the fight too
            if (typeof entranceSeq !== 'undefined' && entranceSeq) finishEntranceSeq();
            return;
        }
        onlineGuestApplySnapshot(msg.snap);
        return;
    }

    if (msg.type === 'input') { // guest → host input change
        onlineMarkRemoteTraffic();
        if (msg.entSkip) { // guest skipped the pre-fight ceremony — cut to the fight too
            if (typeof entranceSeq !== 'undefined' && entranceSeq) finishEntranceSeq();
            return;
        }
        if (onlineState.slot === 0) onlineState.inputQueue.push(onlineCloneInput(msg.input));
        return;
    }

    if (msg.type === 'ping-game') {
        onlineHandlePing(msg);
        return;
    }

    if (msg.type === 'post-match') {
        onlineState.postMatchRemote = msg.choice;
        onlineUpdatePostMatchUI();
        onlineResolvePostMatch();
        return;
    }

    if (msg.type === 'round-result' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        if (msg.team) teamRoundEnd(msg.winnerIdx); else endRound(msg.winnerIdx, msg.subtitle || '');
        return;
    }

    if (msg.type === 'next-round' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        if (msg.team) nextTeamRound(); else nextRound();
        return;
    }

    if (msg.type === 'game-over' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        endGame(msg.title || 'MATCH OVER', msg.subtitle || '');
    }
}

// Character select is now a PICK → CONFIRM flow: you choose freely (and can change your
// mind) until you Lock In. Ranked picks a SQUAD of two (2v2 tag); everything else picks one.
function onlineLocalKey() { return Number(onlineState.slot) === 0 ? 'p1' : 'p2'; }
function onlineRemoteKey() { return Number(onlineState.slot) === 0 ? 'p2' : 'p1'; }

function onlineInitCharSelect() {
    if (currentMode !== 'ONLINE') return;
    onlineState.squadSize = onlineState.matchKind === 'ranked' ? 2 : 1;
    onlineState.localPicks = [];
    onlineState.localLocked = false;
    onlineState.remotePicks = [];
    onlineState.remoteLocked = false;
    let bar = document.getElementById('char-confirm-bar');
    if (bar) bar.classList.remove('hidden');
    onlineRenderPicks();
    updateOnlineSelectTitle();
}

function onlineSquadLabel(picks, locked) {
    if (!picks || !picks.length) return '---';
    return picks.map(c => CHARACTERS[c] ? CHARACTERS[c].name.replace('THE ', '') : c).join(' + ') + (locked ? ' ✓' : '');
}

function onlineHudNameForTeam(teamIndex) {
    if (currentMode !== 'ONLINE') return null;
    let localTeam = Number(onlineState.slot);
    if (teamIndex === localTeam) return account && account.username ? account.username : (teamIndex === 0 ? 'Player 1' : 'Player 2');
    let remote = onlineState.remoteUsername || (onlineState.opponent && onlineState.opponent.username);
    return remote || (teamIndex === 0 ? 'Player 1' : 'Player 2');
}

function onlineRenderPicks() {
    let localPicks = onlineState.localPicks || [], remotePicks = onlineState.remotePicks || [];
    let lk = onlineLocalKey(), rk = onlineRemoteKey();
    // preview fighters = each side's first pick
    charSelectPreview[lk] = localPicks[0] || null;
    charSelectPreview[rk] = remotePicks[0] || null;
    let p1l = document.getElementById('p1-select-label'), p2l = document.getElementById('p2-select-label');
    let isHost = Number(onlineState.slot) === 0;
    if (p1l) p1l.innerText = onlineSquadLabel(isHost ? localPicks : remotePicks, isHost ? onlineState.localLocked : onlineState.remoteLocked);
    if (p2l) p2l.innerText = onlineSquadLabel(isHost ? remotePicks : localPicks, isHost ? onlineState.remoteLocked : onlineState.localLocked);
    let cbtn = document.getElementById('char-confirm-btn');
    if (cbtn) {
        cbtn.disabled = onlineState.localLocked || localPicks.length !== onlineState.squadSize;
        cbtn.innerText = onlineState.localLocked ? 'Locked' : 'Lock In';
    }
}

// tentative pick — changeable until you Lock In
function onlinePickCharacter(resolvedType) {
    if (!CHARACTERS[resolvedType] || onlineState.localLocked) return;
    if ((onlineState.localPicks || []).length >= onlineState.squadSize) onlineState.localPicks = [];
    onlineState.localPicks.push(resolvedType);
    playAudio(selectVoices[resolvedType]);
    markRosterSelection(resolvedType, onlineLocalKey());
    charSelectPreview[onlineLocalKey() + 'Burst'] = 1;
    onlineSend('select', { picks: [...onlineState.localPicks], locked: false, username: account ? account.username : '' });
    onlineRenderPicks();
    updateOnlineSelectTitle();
}

// Esc on the online char-select: unlock, then peel back picks one at a time. Returns false
// only when there's nothing left to undo (so the caller knows it may leave the match).
function onlineUndoStep() {
    if (currentMode !== 'ONLINE') return false;
    if (onlineState.localLocked) {
        onlineState.localLocked = false;
        onlineSend('select', { picks: [...(onlineState.localPicks || [])], locked: false, username: account ? account.username : '' });
        onlineRenderPicks();
        updateOnlineSelectTitle();
        return true;
    }
    if ((onlineState.localPicks || []).length > 0) {
        onlineState.localPicks.pop();
        markRosterSelection(onlineState.localPicks[0] || null, onlineLocalKey());
        onlineSend('select', { picks: [...onlineState.localPicks], locked: false, username: account ? account.username : '' });
        onlineRenderPicks();
        updateOnlineSelectTitle();
        return true;
    }
    return false; // nothing selected — caller may back out of the match
}

function onlineResetPicks() {
    onlineState.localPicks = [];
    onlineState.localLocked = false;
    onlineSend('select', { picks: [], locked: false, username: account ? account.username : '' });
    onlineRenderPicks();
    updateOnlineSelectTitle();
}

function onlineConfirmPicks() {
    if (onlineState.localLocked || (onlineState.localPicks || []).length !== onlineState.squadSize) return;
    onlineState.localLocked = true;
    onlineSend('select', { picks: [...onlineState.localPicks], locked: true, username: account ? account.username : '' });
    onlineRenderPicks();
    updateOnlineSelectTitle();
    onlineMaybeAdvanceFromCharacterSelect();
}

function onlineApplyRemoteSelection(data) {
    let picks = Array.isArray(data && data.picks) ? data.picks.filter(c => CHARACTERS[c])
              : (data && CHARACTERS[data.charType] ? [data.charType] : []); // legacy single-char fallback
    onlineState.remotePicks = picks;
    onlineState.remoteLocked = !!(data && data.locked);
    if (data && data.username) onlineState.remoteUsername = data.username;
    onlineState.peerConnected = true;
    onlineRenderPicks();
    updateOnlineSelectTitle();
    onlineMaybeAdvanceFromCharacterSelect();
}

function onlineBothLocked() {
    return onlineState.localLocked && onlineState.remoteLocked &&
        (onlineState.localPicks || []).length === onlineState.squadSize &&
        (onlineState.remotePicks || []).length === onlineState.squadSize;
}

function updateOnlineSelectTitle() {
    if (currentMode !== 'ONLINE') return;
    let title = document.getElementById('char-select-title');
    if (!title) return;
    let sq = onlineState.squadSize === 2 ? 'SQUAD' : 'FIGHTER';
    if (!onlineState.peerConnected) title.innerText = 'WAITING FOR OPPONENT';
    else if (onlineBothLocked()) title.innerText = Number(onlineState.slot) === 0 ? 'STARTING…' : 'WAITING FOR HOST';
    else if (onlineState.localLocked) title.innerText = 'LOCKED IN - WAITING FOR OPPONENT';
    else if ((onlineState.localPicks || []).length === onlineState.squadSize) title.innerText = `CONFIRM YOUR ${sq}`;
    else if (onlineState.squadSize === 2) title.innerText = `PICK YOUR SQUAD (${(onlineState.localPicks || []).length}/2)`;
    else title.innerText = `SELECT YOUR ${sq}`;
}

function onlineMaybeAdvanceFromCharacterSelect(delay = 450) {
    if (currentMode !== 'ONLINE' || Number(onlineState.slot) !== 0 || !onlineBothLocked()) return;
    setTimeout(() => {
        if (currentMode !== 'ONLINE' || Number(onlineState.slot) !== 0 || !onlineBothLocked()) return;
        if (gameState === 'PLAYING' || gameState === 'STAGE_SELECT') return;
        // ranked / casual: random arena + auto-start. custom: the host still picks the stage.
        if (onlineState.matchKind === 'ranked' || onlineState.matchKind === 'casual') {
            let ids = Object.keys(STAGES);
            selectedStage = ids[Math.floor(Math.random() * ids.length)] || 'dojo';
            onlineStartGame();
            return;
        }
        goToStageSelect();
    }, delay);
}

function onlineSelectStage(stageId) {
    if (Number(onlineState.slot) !== 0) {
        onlineSetStatus('Only the host selects the stage.');
        return false;
    }
    onlineSend('stage', { stageId });
    return true;
}

function onlineStartGame() {
    if (Number(onlineState.slot) !== 0) return false;
    onlineSetStatus('Starting online match...');
    // host = P1 (its squad), guest = P2 (remote squad). Ranked = a 2v2 team match.
    let p1Picks = (onlineState.localPicks || []).slice();
    let p2Picks = (onlineState.remotePicks || []).slice();
    onlineSend('start', {
        stageId: selectedStage, p1Picks, p2Picks,
        p1Selection: p1Picks[0], p2Selection: p2Picks[0],
        p1Username: account && account.username ? account.username : '',
        p2Username: onlineState.remoteUsername || (onlineState.opponent && onlineState.opponent.username) || '',
        team: onlineState.matchKind === 'ranked',
        entSeed: Math.floor(Math.random() * 1000)
    });
    return true;
}

// ---------------- NETWORK MESSAGE OVERLAY ----------------
function showNetMessage(title, sub) {
    let el = document.getElementById('net-message');
    if (!el) return;
    let t = document.getElementById('net-message-title');
    let s = document.getElementById('net-message-sub');
    if (t) t.innerText = title || '';
    if (s) s.innerText = sub || '';
    el.classList.remove('hidden');
}

function hideNetMessage() {
    let el = document.getElementById('net-message');
    if (el) el.classList.add('hidden');
}

// ---------------- DISCONNECT HANDLING ----------------
function onlineHandleOpponentDisconnect() {
    if (onlineState.disconnecting) return;
    onlineState.disconnecting = true;
    document.getElementById('end-screen').classList.add('hidden');
    showNetMessage('OPPONENT DISCONNECTED', 'Returning to the main menu…');
    setTimeout(() => {
        hideNetMessage();
        returnToMenu(); // onlineDisconnect() inside resets onlineState, clearing the flag
    }, 3000);
}

// ---------------- POST-MATCH (rematch / change / leave) ----------------
const ONLINE_POSTMATCH_LABELS = { rematch: 'REMATCH', change: 'NEW CHARACTER' };

// Called when the END screen appears in an online match: relabel the three buttons
// to their online meanings and reflect the negotiation state. The choices are NOT
// reset here (that happens at match start) — the two end screens can appear at
// different times, so the opponent may have already sent a choice before ours shows.
function onlineBeginPostMatch() {
    hideNetMessage();
    let r = document.getElementById('end-btn-rematch');
    let c = document.getElementById('end-btn-change');
    let m = document.getElementById('end-btn-menu');
    if (r) r.innerText = 'Rematch';
    if (c) c.innerText = 'Change Character';
    if (m) m.innerText = 'Leave';
    onlineSetEndButtonsDisabled(false);
    onlineRenderRankedResult();
    let status = document.getElementById('end-status');
    if (status) status.innerText = '';
    onlineUpdatePostMatchUI();   // show any choice that already arrived
    onlineResolvePostMatch();    // ...and act if both are somehow already in
}

function onlineSetEndButtonsDisabled(disabled) {
    // Leaving is always allowed; only the two "continue" choices lock after a pick.
    ['end-btn-rematch', 'end-btn-change'].forEach(id => {
        let b = document.getElementById(id);
        if (b) b.disabled = !!disabled;
    });
}

// Wired to the end-screen buttons (via restartMatch / returnToCharacterSelect / returnToMenu).
function onlinePostMatchChoose(choice) {
    if (currentMode !== 'ONLINE') return false;
    if (choice === 'leave') { returnToMenu(); return true; } // disconnects; peer sees the dc overlay
    if (onlineState.postMatchLocal) return true;             // already committed
    onlineState.postMatchLocal = choice;
    onlineSend('post-match', { choice });
    onlineUpdatePostMatchUI();
    onlineResolvePostMatch();
    return true;
}

function onlineUpdatePostMatchUI() {
    let status = document.getElementById('end-status');
    let local = onlineState.postMatchLocal, remote = onlineState.postMatchRemote;
    if (status) {
        if (local && !remote) status.innerText = `You chose ${ONLINE_POSTMATCH_LABELS[local]} — waiting for opponent…`;
        else if (!local && remote) status.innerText = `Opponent chose ${ONLINE_POSTMATCH_LABELS[remote]} — make your choice.`;
        else if (local && remote) status.innerText = 'Both ready!';
        else status.innerText = '';
    }
    if (local) onlineSetEndButtonsDisabled(true);
}

function onlineResolvePostMatch() {
    let local = onlineState.postMatchLocal, remote = onlineState.postMatchRemote;
    if (!local || !remote) return; // still waiting on someone
    // "Change character" takes precedence: if either side wants a new fighter, both re-pick.
    let decision = (local === 'change' || remote === 'change') ? 'change' : 'rematch';
    onlineState.postMatchLocal = null;
    onlineState.postMatchRemote = null;
    document.getElementById('end-screen').classList.add('hidden');
    if (decision === 'change') {
        // Wipe both selections so each player must choose anew; the normal online
        // char-select → stage → start flow then takes over.
        onlineState.localSelection = null;
        onlineState.remoteSelection = null;
        p1Selection = null;
        p2Selection = null;
        goToCharSelect('ONLINE');
    } else {
        // Rematch with the same fighters. The host drives the synchronized start;
        // both peers receive the relayed 'start' and reset together.
        showNetMessage('REMATCH', 'Starting…');
        if (Number(onlineState.slot) === 0) {
            onlineSend('start', {
                stageId: selectedStage, p1Selection, p2Selection,
                p1Picks: onlineState.p1Picks, p2Picks: onlineState.p2Picks, team: !!onlineState.teamMatch,
                entSeed: Math.floor(Math.random() * 1000)
            });
        }
    }
}

// ---------------- INPUT PLUMBING ----------------
function onlineLocalControls() {
    return keyBindings.P1 || DEFAULT_BINDINGS.P1;
}

function onlineReadLocalInput() {
    let c = onlineLocalControls();
    let input = {};
    ONLINE_ACTIONS.forEach(action => { input[action] = !!keys[c[action]]; });
    return input;
}

function onlineApplyRemoteInput(input) {
    ONLINE_ACTIONS.forEach(action => {
        keys[ONLINE_REMOTE_BINDINGS[action]] = !!input[action];
    });
}

// GUEST: send the local input whenever it changes (plus a heartbeat so the host's
// stale-guard never trips during normal play).
function onlineGuestSendInput(dt) {
    let input = onlineReadLocalInput();
    onlineState.inputHeartbeat += dt;
    if (!onlineState.lastSentInput || !onlineSameInput(input, onlineState.lastSentInput) ||
        onlineState.inputHeartbeat >= ONLINE_INPUT_HEARTBEAT) {
        onlineState.inputHeartbeat = 0;
        onlineState.lastSentInput = onlineCloneInput(input);
        onlineSend('input', { input });
    }
}

// HOST: consume queued guest inputs once per sim frame. If several changes arrived in
// one frame (e.g. a quick tap = press+release), drain to the newest but OR the
// edge-triggered actions across the drained entries so the tap still fires.
function onlineHostConsumeGuestInput() {
    let q = onlineState.inputQueue;
    if (q.length) {
        let taps = {};
        while (q.length > 1) {
            let drained = q.shift();
            ONLINE_TAP_ACTIONS.forEach(a => { if (drained[a]) taps[a] = true; });
        }
        let input = onlineCloneInput(q.shift());
        ONLINE_TAP_ACTIONS.forEach(a => { if (taps[a]) input[a] = true; });
        onlineState.lastGuestInput = input;
    }
    onlineApplyRemoteInput(onlineState.remoteInputStale ? onlineBlankInput() : (onlineState.lastGuestInput || onlineBlankInput()));
}

// ---------------- PER-FRAME DRIVERS ----------------
function onlineTick(dt) {
    if (currentMode !== 'ONLINE' || gameState !== 'PLAYING') return;
    onlineState.pingTimer += dt;
    if (onlineState.pingTimer >= ONLINE_PING_RATE) {
        onlineState.pingTimer = 0;
        onlineSendPing();
    }
    onlineGuardRemoteInput();
    if (onlineState.slot === 0) {
        onlineState.snapTimer += dt;
        // no snapshots during the entrance ceremony — each side runs it locally
        if (onlineState.snapTimer >= onlineSnapshotInterval() && !entranceSeq) {
            onlineState.snapTimer = 0;
            onlineSendSnapshot(false);
        }
    } else if (onlineState.lastSnapAt) {
        onlineState.snapAgeMs = performance.now() - onlineState.lastSnapAt;
    }
    onlineUpdateNetHud();
}

function onlineFixedUpdate(realDt) {
    if (currentMode !== 'ONLINE') return updateGameplay(realDt);
    onlineTick(realDt);
    if (onlineState.slot === 0) {
        // HOST — the one true simulation, identical to offline play
        onlineHostConsumeGuestInput();
        updateGameplay(realDt * timeScale);
        // impact-triggered snapshot: the moment any HP changes, ship the state NOW
        // instead of waiting for the next 33ms tick — hits land visibly sooner
        let hpSig = players.map(p => (p ? Math.round(p.hp) : 0)).join(',');
        if (hpSig !== onlineState.lastHpSig) {
            onlineState.lastHpSig = hpSig;
            // ROUND_END / END included: the killing blow flips the state in the SAME frame,
            // and without this final snapshot the guest never saw hp hit 0 or the loser fall.
            // Throttled so a multi-tick DoT / long combo can't flood a marginal uplink with
            // 60 full snapshots/sec (which bloats the send buffer and *adds* latency); the
            // regular 30Hz tick still carries the latest hp within ~33ms. Deaths bypass the
            // throttle so the round always ends crisply.
            let now = performance.now();
            let dying = players.some(p => p && Math.round(p.hp) <= 0);
            if ((gameState === 'PLAYING' || gameState === 'ROUND_END' || gameState === 'END') &&
                (dying || now - (onlineState.lastImpactAt || 0) >= 40)) {
                onlineState.lastImpactAt = now;
                onlineState.snapTimer = 0;
                onlineSendSnapshot(dying);
            }
        }
    } else {
        // GUEST — thin client: report inputs, animate the last snapshot forward
        if (gameState === 'PLAYING') onlineGuestSendInput(realDt);
        if (gameState === 'PLAYING' && entranceSeq) {
            updateGameplay(realDt); // pre-fight ceremony runs locally on both sides
        } else if (gameState === 'PLAYING') {
            onlineGuestAdvance(realDt);
        } else {
            updateGameplay(realDt); // END screen win animations etc. run locally
        }
    }
}

// ---------------- HOST: SNAPSHOT CAPTURE ----------------
const ONLINE_FIGHTER_FIELDS = [
    'x', 'y', 'vx', 'vy', 'dir', 'state', 'stateTimer', 'animTimer',
    'hp', 'maxHp', 'recoverableHp', 'meter', 'meterMax', 'blockHealth', 'blockMax', 'charType',
    'comboHits', 'comboHitTimer', 'invulnTimer', '_thrown',
    'tumbleTimer', '_tumbleAngle', '_tumbleDir',
    'slipCd', 'rewindCd', 'vortexCd', '_skipHide',
    'agilityTimer', '_nineLivesFx', 'ultUnlocked', 'ultSealed',
    'devotion', 'lumActive', 'lumTimer', '_lumFx', 'maskId',
    'symBuff', 'twinOffset',
    'fadeCharge', 'fadeActive', 'fadeCooldown', '_fadeIntangible',
    'beastIndex', 'beastSwapFlash', 'beastMarkedTimer', 'beastAnimTimer',
    'beastRavenGlideTimer', 'beastSnakeSwingTimer',
    'gamblerStance', 'gamblerLuck', 'gamblerSavings', 'gamblerInstall',
    'gamblerTimer', 'gamblerMix', 'gamblerJackpots',
    '_guardBreakFx', 'blockBreakTimer', 'rootTimer', 'yankTimer',
    'overkillRed', '_overkilled'
];

const ONLINE_BENCH_FIELDS = [
    'x', 'y', 'vx', 'vy', 'dir', 'state', 'stateTimer', 'animTimer',
    'hp', 'maxHp', 'recoverableHp', 'meter', 'meterMax', 'blockHealth', 'blockMax',
    'charType', 'invulnTimer', 'switchCooldown', 'ultUnlocked',
    'devotion', 'lumActive', 'lumTimer', 'maskId',
    'symBuff', 'twinOffset',
    'beastIndex', 'gamblerLuck', 'gamblerSavings', 'gamblerInstall',
    'gamblerTimer', 'gamblerMix', 'gamblerJackpots',
    'overkillRed', '_overkilled'
];

function onlineCapturePlain(value) { // tiny deep clone for small plain objects
    return value == null ? null : JSON.parse(JSON.stringify(value, (k, v) => (typeof v === 'function' ? undefined : v)));
}

function onlineHostCaptureFighter(p) {
    let out = {};
    ONLINE_FIGHTER_FIELDS.forEach(k => { out[k] = p[k]; });
    out.atk = p.currentAttack ? onlineCapturePlain(p.currentAttack) : null;
    if (p.ult) {
        out.ult = {};
        Object.keys(p.ult).forEach(k => { if (k !== 'target' && k !== 'proj' && typeof p.ult[k] !== 'object') out.ult[k] = p.ult[k]; });
        out.ult.targetIndex = players.indexOf(p.ult.target);
    } else out.ult = null;
    out.tether = p.tether ? { t: p.tether.t, life: p.tether.life } : null;
    out.puppet = p.puppet ? { x: (p.puppet.hist && p.puppet.hist[0] ? p.puppet.hist[0].x : p.x), fall: p.puppet.fall || 0 } : null;
    out.partner = p.partner ? {
        x: p.partner.x, y: p.partner.y, dir: p.partner.dir, state: p.partner.state,
        stateTimer: p.partner.stateTimer, animTimer: p.partner.animTimer,
        tumbleTimer: p.partner.tumbleTimer, _tumbleAngle: p.partner._tumbleAngle
    } : null;
    return out;
}

function onlineHostCaptureBenchFighter(p) {
    if (!p) return null;
    let out = {};
    ONLINE_BENCH_FIELDS.forEach(k => { out[k] = p[k]; });
    out.partner = p.partner ? {
        x: p.partner.x, y: p.partner.y, dir: p.partner.dir, state: p.partner.state,
        stateTimer: p.partner.stateTimer, animTimer: p.partner.animTimer
    } : null;
    return out;
}

function onlineHostCaptureSnapshot() {
    return {
        mt: matchTimer,
        rw: [...roundWins],
        cr: currentRound,
        ts: timeScale,
        stage: selectedStage,
        cam: ultCamera ? { fx: ultCamera.fx, fy: ultCamera.fy, zoom: ultCamera.zoom } : null,
        banner: ultBanner ? { line: ultBanner.line, t: ultBanner.t, dur: ultBanner.dur, oi: players.indexOf(ultBanner.owner) } : null,
        ultIdx: players.indexOf(ultActive),
        ok: overkillFx ? onlineCapturePlain(overkillFx) : null,
        players: players.map(onlineHostCaptureFighter),
        projs: projectiles.filter(p => p.active).map(p => ({
            x: p.x, y: p.y, vx: p.vx, vy: p.vy, w: p.w, h: p.h,
            st: p.subtype || null, rt: p.runeType || null, oi: players.indexOf(p.owner), oc: p.ownerCharType || (p.owner ? p.owner.charType : null)
        })),
        zones: consecrateZones.map(z => ({ x: z.x, t: z.t, life: z.life, radius: z.radius })),
        traps: cultTraps.map(z => ({ x: z.x, t: z.t, arm: z.arm, life: z.life, triggered: z.triggered, radius: z.radius })),
        lumP: lumPortalFx.map(f => ({ x: f.x, y: f.y, t: f.t, life: f.life })),
        lumB: lumBeastFx.map(f => ({ x: f.x, y: f.y, t: f.t, life: f.life })),
        cult: cultSummons.slice(0, 14).map(c => ({ x: c.x, y: c.y, dir: c.dir, t: c.t, life: c.life, kind: c.kind, mask: c.mask, scale: c.scale, phase: c.phase })),
        // 2v2 (ranked): who is tagged in + the BENCHED fighter of each team (the two active
        // ones already ride in `players`). Lets the guest sync the team HUD + tag swaps.
        ...(function () {
            let ok = teamBattle && teams[0] && teams[0].length === 2 && teams[1] && teams[1].length === 2;
            if (!ok) return { tb: false, ai: null, bench: null };
            return { tb: true, ai: [activeIdx[0], activeIdx[1]],
                bench: [onlineHostCaptureBenchFighter(teams[0][1 - activeIdx[0]]), onlineHostCaptureBenchFighter(teams[1][1 - activeIdx[1]])] };
        })()
    };
}

// ---------------- GUEST: SNAPSHOT APPLY + LOCAL FX ----------------
function onlineGuestApplySnapshot(snap) {
    if (onlineState.slot !== 1 || !snap || !Array.isArray(snap.players)) return;
    if (gameState !== 'PLAYING' && gameState !== 'ROUND_END' && gameState !== 'END') return;
    if (entranceSeq) return; // still mid-ceremony locally — fresh snapshots keep coming at 30Hz
    onlineState.lastSnapAt = performance.now();
    onlineState.snapAgeMs = 0;

    // stage hot-swap (Phantom's Soul Train smash relocates the arena mid-round)
    if (snap.stage && snap.stage !== selectedStage) {
        selectedStage = snap.stage;
        if (typeof initStageActors === 'function') initStageActors();
        if (typeof music !== 'undefined' && music.resetFightPick) { music.resetFightPick(); music.play('fight'); }
        // fresh arena — the old map's blood doesn't travel with you
        bloodStains = [];
        particles = particles.filter(pt => pt.color !== '#ff0033');
    }

    matchTimer = snap.mt;
    let timerEl = document.getElementById('timer');
    if (timerEl) timerEl.innerText = matchTimer;
    if (snap.rw && (snap.rw[0] !== roundWins[0] || snap.rw[1] !== roundWins[1])) { roundWins = [...snap.rw]; renderRoundPips(); }
    currentRound = snap.cr;
    timeScale = snap.ts || 1;
    ultCamera = snap.cam ? { fx: snap.cam.fx, fy: snap.cam.fy, zoom: snap.cam.zoom } : null;

    // overkill detonates exactly once, with the voice + gibs spawned locally
    if (snap.ok && !overkillFx) {
        playOverkillVoice();
        onlineGuestSpawnGibs(snap.ok.x, snap.ok.y);
    }
    overkillFx = snap.ok ? { ...snap.ok } : null;

    // 2v2: adopt the host's tag state — re-point players to each team's active fighter and
    // apply the benched fighters (host-verbatim) so the team HUD + a tag swap stay in sync.
    if (snap.tb && teamBattle && teams && teams[0] && teams[0].length === 2 && teams[1] && teams[1].length === 2) {
        if (Array.isArray(snap.ai)) activeIdx = [snap.ai[0] ? 1 : 0, snap.ai[1] ? 1 : 0];
        players[0] = teams[0][activeIdx[0]];
        players[1] = teams[1][activeIdx[1]];
        if (Array.isArray(snap.bench)) {
            snap.bench.forEach((bf, i) => { let t = teams[i] && teams[i][1 - activeIdx[i]]; if (t && bf) onlineGuestApplyFighter(t, bf, false); });
        }
    }

    for (let i = 0; i < Math.min(players.length, snap.players.length); i++) {
        let p = players[i], src = snap.players[i];
        if (!p || !src) continue;
        onlineGuestApplyFighter(p, src, i === onlineState.slot);
    }

    // banner: adopt the host's (typed by line so the local timer keeps ticking smoothly)
    if (snap.banner) {
        if (!ultBanner || ultBanner.line !== snap.banner.line) {
            ultBanner = { line: snap.banner.line, t: snap.banner.t, dur: snap.banner.dur, owner: players[snap.banner.oi] || null };
        }
    } else if (ultBanner && ultBanner.t > (ultBanner.dur || 1.4)) {
        ultBanner = null;
    }
    ultActive = players[snap.ultIdx] || null;

    // rebuild the render-only projectile list
    projectiles = (snap.projs || []).map(d => {
        let pr = Object.create(Projectile.prototype);
        pr.x = d.x; pr.y = d.y; pr.vx = d.vx; pr.vy = d.vy; pr.w = d.w; pr.h = d.h;
        pr.subtype = d.st; pr.runeType = d.rt;
        pr.active = true; pr.lifeTime = 99; pr.damage = 0; pr.knockback = { x: 0, y: 0 }; pr.stun = 0;
        pr.hasHit = new Set(); pr.customLogic = null;
        pr.owner = players[d.oi] || null;
        pr.ownerCharType = d.oc; pr.ownerTeam = pr.owner ? pr.owner.team : 1; pr.ownerId = pr.owner ? pr.owner.id : '';
        return pr;
    });

    // visual-only world FX
    consecrateZones = snap.zones || [];
    cultTraps = snap.traps || [];
    lumPortalFx = snap.lumP || [];
    lumBeastFx = snap.lumB || [];
    cultSummons = snap.cult || [];

    updateHUD();
}

// States where the host's word is law even for the predicted local fighter
const ONLINE_FORCED_STATES = ['HITSTUN', 'DEAD', 'BLOCKBREAK', 'ULT', 'LEDGE'];

function onlineApplyFighterFields(p, src) {
    ONLINE_FIGHTER_FIELDS.forEach(k => {
        if (Object.prototype.hasOwnProperty.call(src, k)) p[k] = src[k];
    });
}

function onlineGuestApplyFighter(p, src, isOwn) {
    // derive local feedback from the diffs BEFORE overwriting
    let hpDrop = p.hp - src.hp;
    let guardDrop = p.blockHealth - src.blockHealth;
    let wasState = p.state;
    let hadUlt = !!p.ult;

    // the Cult's install morphs the fighter — mirror the transform locally
    if (p.charType !== src.charType) {
        if (src.charType === 'LUMATROSSIA' && p.becomeLumatrossia) p.becomeLumatrossia();
        else if (p.lumActive && src.charType !== 'LUMATROSSIA' && p.revertFromLumatrossia) p.revertFromLumatrossia();
        else { p.charType = src.charType; if (CHARACTERS[src.charType]) p.attacks = CHARACTERS[src.charType].attacks; }
    }

    if (isOwn) {
        // OWN fighter is client-side PREDICTED: the local input drives its movement
        // and poses instantly; the host stays authoritative for combat results.
        let keepX = p.x, keepY = p.y, keepVx = p.vx, keepVy = p.vy, keepDir = p.dir;
        let keepState = p.state, keepTimer = p.stateTimer, keepAtk = p.currentAttack;
        onlineApplyFighterFields(p, src);
        if (ONLINE_FORCED_STATES.includes(src.state) || ONLINE_FORCED_STATES.includes(keepState)) {
            // getting hit / dying / ulting: the host's version wins outright
            p.currentAttack = src.atk || null;
        } else {
            // keep the predicted motion/pose, reconciling position LATENCY-AWARE:
            // the host's view of us is ~one ping old, so during motion it always trails
            // the prediction. Correcting that trail caused constant backward tugging
            // (stutter) and dragged jumps down mid-rise. Grant a velocity-scaled slack
            // and only correct the drift that latency CAN'T explain.
            p.state = keepState; p.stateTimer = keepTimer; p.currentAttack = keepAtk;
            p.vx = keepVx; p.vy = keepVy; p.dir = keepDir;
            let latSec = ((onlineState.pingMs || 120) / 1000) + ONLINE_SNAPSHOT_RATE;
            // X: latency-aware slack + a gentle ease. Use the RECENT peak speed, not the
            // instantaneous one — right after stopping/reversing, velocity reads ~0 but the
            // host's stale view still trails the old motion, and instantaneous slack
            // collapsing caused a tiny backward drag. Walls / non-forced knockback can
            // genuinely diverge, so X is still reconciled.
            let allowX = Math.max(p._predSpdX || 0, Math.abs(keepVx)) * latSec + 30;
            let dx = src.x - keepX;
            let exX = Math.abs(dx) > allowX ? dx - Math.sign(dx) * allowX : 0;
            p.x = Math.abs(exX) > 140 ? src.x : keepX + exX * 0.3;
            // Y: your own jump + gravity is fully deterministic — the local prediction
            // already traces the exact arc the host computes, just time-shifted. Easing
            // toward the host's ping-stale Y every snapshot is what made jumps stutter
            // instead of rising cleanly. Trust the predicted height; only hard-snap on a
            // real desync (forced states like HITSTUN/LEDGE already take the host's Y above).
            p.y = Math.abs(src.y - keepY) > 200 ? src.y : keepY;
            // if the host has us mid-attack and we predicted none (lost packet), adopt it
            if ((p.state === 'IDLE' || p.state === 'WALK') && src.state === 'ATTACK' && src.atk) {
                p.state = 'ATTACK'; p.stateTimer = src.stateTimer; p.currentAttack = src.atk;
            }
        }
    } else {
        onlineApplyFighterFields(p, src);
        if (Object.prototype.hasOwnProperty.call(src, 'atk')) p.currentAttack = src.atk || null;
    }
    if (Object.prototype.hasOwnProperty.call(src, 'ult')) p.ult = src.ult ? { ...src.ult, target: players[src.ult.targetIndex] || null } : null;
    if (Object.prototype.hasOwnProperty.call(src, 'tether')) p.tether = src.tether ? { ...src.tether } : null;
    if (Object.prototype.hasOwnProperty.call(src, 'puppet')) {
        p.puppet = src.puppet
            ? { hist: [{ x: src.puppet.x, dir: p.dir, state: 'IDLE', atk: null, st: 0, anim: 0, y: stageGroundYAt(src.puppet.x, GROUND_Y) }], t: 0, delay: 13, fall: src.puppet.fall }
            : null;
    }
    if (p.partner && src.partner) {
        Object.assign(p.partner, src.partner);
        p.partner.hp = p.hp; p.partner.maxHp = p.maxHp; p.partner.team = p.team; p.partner.symBuff = p.symBuff;
        p.partner.currentAttack = p.currentAttack;
    }

    // Consistency: never leave any body in ATTACK without attack data (the pose
    // chain reads atk.startup) — settle to idle instead of crashing the renderer.
    if (p.state === 'ATTACK' && !p.currentAttack) p.state = p.y < stageGroundYAt(p.x, GROUND_Y) ? 'FALL' : 'IDLE';
    if (p.partner && p.partner.state === 'ATTACK' && !p.partner.currentAttack) p.partner.state = p.state;

    // local hit feedback (sounds + sparks the guest sim would otherwise never produce)
    if (hpDrop >= 1 && src.state !== 'DEAD') {
        spawnParticles(p.x, p.y - 40, Math.min(20, hpDrop * 2), '#ff0033');
        sfx.playHit();
    } else if (guardDrop >= 1 && hpDrop < 1) {
        playAudio(attackSfx.block);
    }
    if (src.state === 'DEAD' && wasState !== 'DEAD') sfx.playDeath();
    if (src.state === 'BLOCKBREAK' && wasState !== 'BLOCKBREAK') sfx.playDeath();
    if (!hadUlt && p.ult) { // the cinematic just started — voice + stinger
        playUltVoice(p.charType);
        if (p.charType === 'PHANTOM') playAudio(attackSfx.soulTrain);
        try { sfx.playDeath(); } catch (e) {}
    }
}

// Between snapshots the guest animates what it has: the OWN fighter is fully predicted
// from local input (instant response), the remote fighter is dead-reckoned, and the
// purely-cosmetic systems (particles, gibs, trails) run locally.
function onlineGuestAdvance(realDt) {
    let dt = realDt * (timeScale || 1);
    for (let i = 0; i < players.length; i++) {
        let p = players[i];
        if (!p) continue;
        p.animTimer += realDt;
        if (i === onlineState.slot) {
            onlineGuestPredictOwn(p, realDt, dt); // local input drives this one
        } else {
            if (p.state === 'ATTACK' || p.state === 'ULT' || p.state === 'WIN') p.stateTimer += dt;
            else if (p.state === 'HITSTUN') p.stateTimer -= dt;
            if (p.ult) p.ult.t = (p.ult.t || 0) + dt;
            if (p.state !== 'DEAD') {
                p.x += p.vx * dt;
                let drGy = stageGroundYAt(p.x, GROUND_Y);
                if (p.y < drGy || p.vy < 0) { p.vy += 1500 * dt; p.y = Math.min(drGy, p.y + p.vy * dt); }
                p.x = Math.max(p.width / 2, Math.min(WIDTH - p.width / 2, p.x));
            }
        }
        if (p.tumbleTimer > 0) { p.tumbleTimer -= dt; p._tumbleAngle += Math.abs(p.vx) * dt * 0.04 * (p._tumbleDir || 1); }
        if (p._guardBreakFx > 0) p._guardBreakFx -= dt;
        if (p._comboPop > 0) p._comboPop -= realDt;
        if (p.partner) p.partner.animTimer += realDt;
        // the Traveler's afterimages are recorded locally from observed movement
        if (p.charType === 'TRAVELER') {
            p._trailTick = (p._trailTick || 0) - realDt;
            let moving = Math.abs(p.vx) > 60 || p.y < stageGroundYAt(p.x, GROUND_Y) || p.state === 'ATTACK' || p.state === 'ULT';
            if (moving && p._trailTick <= 0) { p._trailTick = 0.05; (p._trail = p._trail || []).push({ x: p.x, y: p.y, dir: p.dir, age: 0 }); }
            if (p._trail) { p._trail.forEach(g => g.age += realDt); p._trail = p._trail.filter(g => g.age < 0.24); }
        }
    }
    for (let pr of projectiles) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    particles.forEach(p => p.update(realDt));
    particles = particles.filter(p => p.life > 0);
    bodyParts.forEach(p => p.update(realDt));
    bodyParts = bodyParts.filter(p => p.life > 0);
    Object.assign(previousKeys, keys);
}

// CLIENT-SIDE PREDICTION: the guest's own fighter moves, jumps, crouches, blocks and
// STARTS attack animations the instant the button is pressed. The host still owns all
// outcomes (hits, damage, knockback) — snapshots gently reconcile any drift, and
// disadvantage states (hitstun/ults/death) are taken from the host verbatim.
function onlineGuestPredictOwn(p, realDt, dt) {
    if (introSequence && !introSequence.done) return; // frozen until FIGHT
    if (ONLINE_FORCED_STATES.includes(p.state)) {
        // host-driven state: just play it out (knockback slide, stun countdown, ult clock)
        if (p.state === 'HITSTUN') p.stateTimer -= dt;
        else if (p.state === 'ULT') p.stateTimer += dt;
        if (p.ult) p.ult.t = (p.ult.t || 0) + dt;
        if (p.state !== 'DEAD') {
            p.x += p.vx * dt;
            let fsGy = stageGroundYAt(p.x, GROUND_Y);
            if (p.y < fsGy || p.vy < 0) { p.vy += 1500 * dt; p.y = Math.min(fsGy, p.y + p.vy * dt); }
            p.x = Math.max(p.width / 2, Math.min(WIDTH - p.width / 2, p.x));
        }
        return;
    }
    let c = onlineLocalControls();
    let foe = players[1 - onlineState.slot];

    if (p.state === 'ATTACK') {
        // tick the predicted swing; the real hitbox happens on the host
        p.stateTimer += dt;
        let a = p.currentAttack;
        if (!a || p.stateTimer >= a.startup + a.active + a.recovery) {
            p.currentAttack = null;
            p.state = p.y < GROUND_Y ? 'FALL' : 'IDLE';
        }
        p.x += p.vx * dt;
        if (p.y >= GROUND_Y) p.vx *= 0.9;
    } else {
        let grounded = p.y >= GROUND_Y;
        let crouching = keys[c.d] && grounded;
        let blocking = keys[c.block] && grounded && !p.lumActive;
        let spd = p.speed;
        p.vx = 0;
        if (!crouching && !blocking) {
            if (keys[c.l]) p.vx = -spd;
            if (keys[c.r]) p.vx = spd;
        }
        if (blocking) p.state = 'BLOCK';
        else if (crouching) p.state = 'CROUCH';
        else if (grounded && keyPressed(c.u)) { p.vy = p.jumpForce; p.state = 'JUMP'; }
        else if (grounded && p.state !== 'JUMP' && p.state !== 'FALL') p.state = Math.abs(p.vx) > 1 ? 'WALK' : 'IDLE';
        // start the attack ANIMATION immediately — the host resolves the actual hit
        if (!blocking && !crouching) {
            let name = null;
            if (keyPressed(c.atkL)) name = p.y < GROUND_Y ? 'airLight' : 'light';
            else if (keyPressed(c.atkH)) name = p.y < GROUND_Y ? 'airHeavy' : 'heavy';
            else if (keyPressed(c.special)) {
                name = keys[c.u] ? 'specUp' : keys[c.d] ? 'specDown' : (keys[c.l] || keys[c.r]) ? 'specSide' : 'specNeutral';
            }
            if (name) {
                let atk = (p.attacks && p.attacks[name]) || (typeof createAttackVariant === 'function' ? createAttackVariant(p, name) : null);
                if (atk) { p.currentAttack = { ...atk, name }; p.state = 'ATTACK'; p.stateTimer = 0; p.hasSpawnedHitbox = true; }
            }
        }
        p.x += p.vx * dt;
    }
    // shared physics
    if (p.y < GROUND_Y || p.vy < 0) {
        p.vy += 1500 * dt;
        p.y = Math.min(GROUND_Y, p.y + p.vy * dt);
        if (p.y >= GROUND_Y) { p.vy = 0; if (p.state === 'JUMP' || p.state === 'FALL') p.state = 'IDLE'; }
        else if (p.state !== 'ATTACK') p.state = p.vy < 0 ? 'JUMP' : 'FALL';
    }
    p.x = Math.max(p.width / 2, Math.min(WIDTH - p.width / 2, p.x));
    if (foe && p.state !== 'ATTACK') p.dir = foe.x > p.x ? 1 : -1;
    // recent peak speed, decaying over ~0.25s — feeds the reconciliation slack so a
    // fresh stop/turn isn't "corrected" while the host is still catching up
    p._predSpdX = Math.max(Math.abs(p.vx), (p._predSpdX || 0) - 1400 * realDt);
    p._predSpdY = Math.max(Math.abs(p.vy), (p._predSpdY || 0) - 2400 * realDt);
}

// Overkill gore spawned locally on the guest when the host's overkill fires
function onlineGuestSpawnGibs(x, y) {
    if (!settings.blood) return;
    ['head', 'torso', 'arm', 'arm', 'leg', 'leg'].forEach((kind, i) => {
        let spread = (i - 2.5) * 95 + (Math.random() - 0.5) * 120;
        bodyParts.push(new BodyPart(x, y, spread, -420 - Math.random() * 520,
            kind === 'head' ? 9 : kind === 'torso' ? 12 : 10, kind, (Math.random() - 0.5) * 12));
    });
    spawnParticles(x, y, 40, '#ff0033');
}

// ---------------- LEGACY SHIMS (called from gameplay code) ----------------
// The host's sim is the only sim, so gameplay RNG is just RNG again.
function onlineDeterministicRandom(label, fighter = null, tick = null) { return Math.random(); }
function onlineEventRandom(label, fighter = null) { return Math.random(); }
// Ult state now travels inside the regular snapshots.
function onlineSendUltSync(fighter, event) {}

// ---------------- PING / HEALTH ----------------
function onlineSendPing() {
    const id = ++onlineState.pingSeq;
    onlineState.pendingPings[id] = performance.now();
    onlineSend('ping-game', { mode: 'ping', id });
}

function onlineHandlePing(msg) {
    if (msg.mode === 'ping') {
        onlineSend('ping-game', { mode: 'pong', id: msg.id });
        return;
    }
    if (msg.mode !== 'pong') return;
    let startedAt = onlineState.pendingPings[msg.id];
    if (!startedAt) return;
    delete onlineState.pendingPings[msg.id];
    let sample = performance.now() - startedAt;
    onlineState.pingMs = onlineState.pingMs == null ? sample : onlineState.pingMs * 0.75 + sample * 0.25;
}

function onlineGuardRemoteInput() {
    if (!onlineState.lastRemoteInputAt) return;
    onlineState.lastRemoteInputMs = performance.now() - onlineState.lastRemoteInputAt;
    if (onlineState.lastRemoteInputMs < ONLINE_REMOTE_STALE_MS || onlineState.remoteInputStale) return;
    onlineState.remoteInputStale = true;
    ONLINE_ACTIONS.forEach(action => { keys[ONLINE_REMOTE_BINDINGS[action]] = false; });
}

function onlineMarkRemoteTraffic() {
    onlineState.lastRemoteInputAt = performance.now();
    onlineState.lastRemoteInputMs = 0;
    onlineState.remoteInputStale = false;
}

function onlineUpdateNetHud() {
    let panel = document.getElementById('online-net-panel');
    if (!panel) return;
    panel.classList.remove('hidden', 'good', 'warn', 'bad');
    let ping = onlineState.pingMs == null ? null : Math.round(onlineState.pingMs);
    let isHost = onlineState.slot === 0;
    let age = isHost
        ? (onlineState.lastRemoteInputMs == null ? null : Math.round(onlineState.lastRemoteInputMs))
        : (onlineState.snapAgeMs == null ? null : Math.round(onlineState.snapAgeMs));
    let pingEl = document.getElementById('online-net-ping');
    let ageEl = document.getElementById('online-net-age');
    let rbEl = document.getElementById('online-net-rollback');
    if (pingEl) pingEl.innerText = ping == null ? 'PING --' : `PING ${ping}`;
    if (ageEl) ageEl.innerText = age == null ? (isHost ? 'INPUT --' : 'SYNC --') : `${isHost ? 'INPUT' : 'SYNC'} ${age}`;
    if (rbEl) rbEl.innerText = isHost ? 'HOST' : 'GUEST';
    let level = 'good';
    if ((ping != null && ping > 130) || (age != null && age > 140)) level = 'warn';
    if ((ping != null && ping > 220) || (age != null && age > ONLINE_REMOTE_STALE_MS)) level = 'bad';
    panel.classList.add(level);
}

function onlineDisconnect() {
    if (onlineState.socket) {
        try { onlineState.socket.close(); } catch (e) {}
    }
    onlineState = {
        active: false,
        socket: null,
        roomCode: '',
        slot: null,
        connected: false,
        peerConnected: false,
        forcedRelayUrl: null,
        localSelection: null,
        remoteSelection: null,
        remoteUsername: '',
        inputQueue: [],
        lastGuestInput: null,
        lastSentInput: null,
        inputHeartbeat: 0,
        snapTimer: 0,
        lastSnapAt: 0,
        snapAgeMs: null,
        pingTimer: 0,
        pingSeq: 0,
        pendingPings: {},
        pingMs: null,
        lastRemoteInputAt: 0,
        lastRemoteInputMs: null,
        remoteInputStale: false,
        lastHpSig: null,
        lastImpactAt: 0,
        postMatchLocal: null,
        postMatchRemote: null,
        disconnecting: false,
        rankedResult: null,
        droppedSyncs: 0,
        status: ''
    };
    ONLINE_ACTIONS.forEach(action => { keys[ONLINE_REMOTE_BINDINGS[action]] = false; });
    let panel = document.getElementById('online-net-panel');
    if (panel) panel.classList.add('hidden');
}
