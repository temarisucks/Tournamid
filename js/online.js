const ONLINE_REMOTE_BINDINGS = {
    l: 'OnlineRemoteLeft',
    r: 'OnlineRemoteRight',
    u: 'OnlineRemoteUp',
    d: 'OnlineRemoteDown',
    block: 'OnlineRemoteBlock',
    atkL: 'OnlineRemoteLight',
    atkH: 'OnlineRemoteHeavy',
    special: 'OnlineRemoteSpecial',
    ult: 'OnlineRemoteUlt'
};

const ONLINE_ACTIONS = ['l', 'r', 'u', 'd', 'block', 'atkL', 'atkH', 'special', 'ult'];
const ONLINE_FIXED_DT = 1 / 60;
const ONLINE_MAX_ROLLBACK_FRAMES = 10;
const ONLINE_ROLLBACK_COOLDOWN_FRAMES = 3;
const ONLINE_SYNC_RATE = 0.25;
const ONLINE_STATE_BUFFER_FRAMES = 90;
const ONLINE_PING_RATE = 1.0;
const ONLINE_REMOTE_STALE_MS = 240;
let onlineState = {
    active: false,
    socket: null,
    roomCode: '',
    slot: null,
    connected: false,
    peerConnected: false,
    localSelection: null,
    remoteSelection: null,
    waitingStart: false,
    frame: 0,
    accumulator: 0,
    localInputs: new Map(),
    remoteInputs: new Map(),
    predictedRemoteInputs: new Map(),
    stateBuffer: new Map(),
    lastLocalInput: null,
    lastRemoteInput: null,
    rollbackCount: 0,
    rollbackFrames: 0,
    lastRollbackFrame: -999,
    lastRollbackSize: 0,
    syncTimer: 0,
    syncCorrections: 0,
    rngSeed: 0xC0FFEE,
    lastInputSent: 0,
    snapshotTimer: 0,
    lastSnapshotAt: 0,
    pingTimer: 0,
    pingSeq: 0,
    pendingPings: {},
    pingMs: null,
    lastRemoteInputAt: 0,
    lastRemoteInputMs: null,
    remoteInputStale: false,
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
    return localStorage.getItem('tournamidWsUrl') || '';
}

function onlineSetStatus(text) {
    onlineState.status = text;
    let el = document.getElementById('online-status');
    if (el) el.innerText = text;
}

function onlineResetRuntimeStats(seed = 0xC0FFEE) {
    onlineState.frame = 0;
    onlineState.accumulator = 0;
    onlineState.localInputs = new Map();
    onlineState.remoteInputs = new Map();
    onlineState.predictedRemoteInputs = new Map();
    onlineState.stateBuffer = new Map();
    onlineState.lastLocalInput = onlineBlankInput();
    onlineState.lastRemoteInput = onlineBlankInput();
    onlineState.rollbackCount = 0;
    onlineState.rollbackFrames = 0;
    onlineState.lastRollbackFrame = -999;
    onlineState.lastRollbackSize = 0;
    onlineState.syncTimer = 0;
    onlineState.syncCorrections = 0;
    onlineState.rngSeed = seed >>> 0;
    onlineState.lastInputSent = 0;
    onlineState.snapshotTimer = 0;
    onlineState.lastSnapshotAt = 0;
    onlineState.pingTimer = 0;
    onlineState.pendingPings = {};
    onlineState.pingMs = null;
    onlineState.lastRemoteInputAt = 0;
    onlineState.lastRemoteInputMs = null;
    onlineState.remoteInputStale = false;
    onlineState.localInputs.set(0, onlineBlankInput());
    onlineState.remoteInputs.set(0, onlineBlankInput());
    ONLINE_ACTIONS.forEach(action => { keys[ONLINE_REMOTE_BINDINGS[action]] = false; });
}

function onlineGetUrl() {
    let el = document.getElementById('online-relay-url');
    let url = (el && el.value.trim()) || onlineDefaultUrl();
    if (url) localStorage.setItem('tournamidWsUrl', url);
    return url;
}

function showOnlineScreen() {
    sfx.init();
    currentMode = 'ONLINE';
    gameState = 'ONLINE_LOBBY';
    let input = document.getElementById('online-relay-url');
    if (input) input.value = onlineDefaultUrl();
    let room = document.getElementById('online-room-code');
    if (room) room.value = '';
    onlineSetStatus('Enter a relay URL, then host or join a friend room.');
    showScreen('online-screen');
}

function onlineConnect() {
    return new Promise((resolve, reject) => {
        if (onlineState.socket && onlineState.socket.readyState === WebSocket.OPEN) return resolve(onlineState.socket);
        let url = onlineGetUrl();
        if (!url) {
            onlineSetStatus('Relay URL required. Use ws://localhost:8787 for local testing.');
            return reject(new Error('Missing relay URL'));
        }

        onlineSetStatus('Connecting...');
        let ws = new WebSocket(url);
        onlineState.socket = ws;

        ws.addEventListener('open', () => {
            onlineState.connected = true;
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

function onlineHandleMessage(event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }

    if (msg.type === 'created' || msg.type === 'joined') {
        onlineState.roomCode = msg.code;
        onlineState.slot = msg.slot;
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
        if (onlineState.localSelection) onlineSend('select', { charType: onlineState.localSelection });
        if (gameState === 'STAGE_SELECT') onlineSend('stage', { stageId: selectedStage });
        updateOnlineSelectTitle();
        return;
    }

    if (msg.type === 'peer-left') {
        onlineState.peerConnected = false;
        onlineResetRuntimeStats();
        onlineSetStatus('Friend left the room.');
        return;
    }

    if (msg.type === 'error') {
        onlineSetStatus(msg.message || 'Online error.');
        return;
    }

    if (msg.type === 'select') {
        onlineApplyRemoteSelection(msg.charType);
        return;
    }

    if (msg.type === 'stage') {
        selectedStage = msg.stageId || 'dojo';
        document.querySelectorAll('.stage-card').forEach(c => c.classList.toggle('selected', c.dataset.stage === selectedStage));
        return;
    }

    if (msg.type === 'start') {
        selectedStage = msg.stageId || selectedStage;
        p1Selection = msg.p1Selection || p1Selection;
        p2Selection = msg.p2Selection || p2Selection;
        onlineResetRuntimeStats(msg.seed);
        startGame();
        return;
    }

    if (msg.type === 'sync') {
        onlineApplyHostSync(msg);
        return;
    }

    if (msg.type === 'ult-sync') {
        onlineApplyUltSync(msg);
        return;
    }

    if (msg.type === 'input') {
        onlineState.lastRemoteInputAt = performance.now();
        onlineState.lastRemoteInputMs = 0;
        onlineState.remoteInputStale = false;
        let frame = Number(msg.frame);
        if (Number.isFinite(frame)) {
            let input = onlineCloneInput(msg.input);
            onlineState.remoteInputs.set(frame, input);
            onlineState.lastRemoteInput = input;
            onlineMaybeRollback(frame, input);
        } else {
            onlineApplyRemoteInput(msg.input || {});
        }
        return;
    }

    if (msg.type === 'ping-game') {
        onlineHandlePing(msg);
        return;
    }

    if (msg.type === 'round-result' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        endRound(msg.winnerIdx, msg.subtitle || '');
        return;
    }

    if (msg.type === 'next-round' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        nextRound();
        return;
    }

    if (msg.type === 'game-over' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        endGame(msg.title || 'MATCH OVER', msg.subtitle || '');
    }
}

function onlineApplyRemoteSelection(charType) {
    onlineState.remoteSelection = charType;
    if (onlineState.slot === 0) {
        p2Selection = charType;
        charSelectPreview.p2 = charType;
        charSelectPreview.p2Burst = 1;
        markRosterSelection(charType, 'p2');
    } else {
        p1Selection = charType;
        charSelectPreview.p1 = charType;
        charSelectPreview.p1Burst = 1;
        markRosterSelection(charType, 'p1');
    }
    updateSelectionLabels();
    updateOnlineSelectTitle();
    if (onlineBothSelected() && onlineState.slot === 0) {
        setTimeout(() => { if (gameState === 'CHAR_SELECT') goToStageSelect(); }, 450);
    }
}

function onlineBothSelected() {
    return !!(p1Selection && p2Selection);
}

function updateOnlineSelectTitle() {
    if (currentMode !== 'ONLINE') return;
    let title = document.getElementById('char-select-title');
    if (!title) return;
    if (!onlineState.peerConnected) title.innerText = `ROOM ${onlineState.roomCode} - WAITING FOR PLAYER 2`;
    else if (!onlineState.localSelection) title.innerText = `ROOM ${onlineState.roomCode} - SELECT YOUR FIGHTER`;
    else if (!onlineBothSelected()) title.innerText = `ROOM ${onlineState.roomCode} - WAITING FOR OPPONENT`;
    else title.innerText = onlineState.slot === 0 ? 'SELECT STAGE' : 'WAITING FOR HOST';
}

function onlineSelectCharacter(resolvedType) {
    onlineState.localSelection = resolvedType;
    if (onlineState.slot === 0) {
        p1Selection = resolvedType;
        charSelectPreview.p1 = resolvedType;
        charSelectPreview.p1Burst = 1;
        markRosterSelection(resolvedType, 'p1');
    } else {
        p2Selection = resolvedType;
        charSelectPreview.p2 = resolvedType;
        charSelectPreview.p2Burst = 1;
        markRosterSelection(resolvedType, 'p2');
    }
    playAudio(selectVoices[resolvedType]);
    onlineSend('select', { charType: resolvedType });
    updateSelectionLabels();
    updateOnlineSelectTitle();
    if (onlineBothSelected() && onlineState.slot === 0) {
        setTimeout(() => { if (gameState === 'CHAR_SELECT') goToStageSelect(); }, 450);
    }
}

function onlineSelectStage(stageId) {
    if (onlineState.slot !== 0) {
        onlineSetStatus('Only the host selects the stage.');
        return false;
    }
    onlineSend('stage', { stageId });
    return true;
}

function onlineStartGame() {
    if (onlineState.slot !== 0) return false;
    onlineSetStatus('Starting online match...');
    onlineSend('start', { stageId: selectedStage, p1Selection, p2Selection, seed: Math.floor(Math.random() * 0xFFFFFFFF) });
    return true;
}

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

function onlineTick(dt) {
    if (currentMode !== 'ONLINE' || gameState !== 'PLAYING') return;
    onlineState.pingTimer += dt;
    if (onlineState.pingTimer >= ONLINE_PING_RATE) {
        onlineState.pingTimer = 0;
        onlineSendPing();
    }

    onlineGuardRemoteInput();
    onlineSendHostSync(dt);
    onlineUpdateNetHud();
}

function onlineSendHostSync(dt) {
    if (onlineState.slot !== 0 || introSequence && !introSequence.done) return;
    if (onlineInUltimateCinematic()) return;
    onlineState.syncTimer += dt;
    if (onlineState.syncTimer < ONLINE_SYNC_RATE) return;
    onlineState.syncTimer = 0;
    onlineSend('sync', {
        frame: onlineState.frame,
        state: onlineCaptureSyncState()
    });
}

function onlineFixedUpdate(realDt) {
    if (currentMode !== 'ONLINE') return updateGameplay(realDt);
    onlineTick(realDt);
    if (gameState !== 'PLAYING') {
        updateGameplay(realDt);
        return;
    }
    if (introSequence && !introSequence.done) {
        updateGameplay(realDt);
        return;
    }

    onlineState.accumulator += Math.min(0.1, realDt);
    let steps = 0;
    while (onlineState.accumulator >= ONLINE_FIXED_DT && steps < 8) {
        onlinePrepareLocalInput();
        onlineSimulateFrame(onlineState.frame, false);
        onlineState.frame++;
        onlineState.accumulator -= ONLINE_FIXED_DT;
        steps++;
    }
    if (steps >= 8) onlineState.accumulator = 0;
}

function onlinePrepareLocalInput() {
    let frame = onlineState.frame;
    let input = onlineReadLocalInput();
    onlineState.localInputs.set(frame, input);
    onlineState.lastLocalInput = input;
    onlineSend('input', { frame, input });
}

function onlineInputForFrame(map, frame, lastInput, isRemote) {
    if (map.has(frame)) return map.get(frame);
    let predicted = onlineCloneInput(lastInput || onlineBlankInput());
    if (isRemote) onlineState.predictedRemoteInputs.set(frame, predicted);
    return predicted;
}

function onlineApplyFrameInputs(frame) {
    let localSlot = onlineState.slot || 0;
    let remoteSlot = localSlot === 0 ? 1 : 0;
    let localInput = onlineInputForFrame(onlineState.localInputs, frame, onlineState.lastLocalInput, false);
    let remoteInput = onlineInputForFrame(onlineState.remoteInputs, frame, onlineState.lastRemoteInput, true);
    onlineApplyInputToSlot(localSlot, localInput);
    onlineApplyInputToSlot(remoteSlot, remoteInput);
}

function onlineApplyInputToSlot(slot, input) {
    let bindings = slot === onlineState.slot ? onlineLocalControls() : ONLINE_REMOTE_BINDINGS;
    ONLINE_ACTIONS.forEach(action => { keys[bindings[action]] = !!input[action]; });
}

function onlineSimulateFrame(frame, replaying) {
    onlineState.stateBuffer.set(frame, onlineCaptureState());
    onlineTrimRollbackBuffers(frame);
    onlineApplyFrameInputs(frame);
    let oldSuppress = suppressRollbackEffects;
    let oldRandom = Math.random;
    suppressRollbackEffects = oldSuppress || replaying;
    Math.random = onlineRandom;
    frameRealDt = ONLINE_FIXED_DT;
    try {
        updateGameplay(ONLINE_FIXED_DT);
    } finally {
        Math.random = oldRandom;
    }
    suppressRollbackEffects = oldSuppress;
}

function onlineRandom() {
    onlineState.rngSeed = (1664525 * onlineState.rngSeed + 1013904223) >>> 0;
    return onlineState.rngSeed / 4294967296;
}

function onlineMaybeRollback(frame, actualInput) {
    if (onlineState.slot !== 0) return;
    if (onlineInUltimateCinematic()) return;
    if (frame >= onlineState.frame) return;
    if (onlineState.frame - frame > ONLINE_MAX_ROLLBACK_FRAMES) return;
    if (onlineState.frame - onlineState.lastRollbackFrame < ONLINE_ROLLBACK_COOLDOWN_FRAMES) return;
    let predicted = onlineState.predictedRemoteInputs.get(frame);
    if (!predicted || onlineSameInput(predicted, actualInput)) return;
    let state = onlineState.stateBuffer.get(frame);
    if (!state) return;

    let targetFrame = onlineState.frame;
    let rollbackSize = targetFrame - frame;
    onlineRestoreState(state);
    onlineState.rollbackCount++;
    onlineState.rollbackFrames += rollbackSize;
    onlineState.lastRollbackFrame = targetFrame;
    onlineState.lastRollbackSize = rollbackSize;
    let oldSuppress = suppressRollbackEffects;
    suppressRollbackEffects = true;
    for (let f = frame; f < targetFrame && gameState === 'PLAYING'; f++) {
        onlineSimulateFrame(f, true);
    }
    suppressRollbackEffects = oldSuppress;
    onlineState.frame = targetFrame;
    updateHUD();
}

function onlineInUltimateCinematic() {
    return !!(ultActive || players.some(p => p && (p.state === 'ULT' || p.ult)) || timeScale < 0.95);
}

function onlineClonePlain(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(onlineClonePlain);
    if (value instanceof Set) return Array.from(value);
    let out = {};
    Object.keys(value).forEach(k => {
        if (typeof value[k] !== 'function') out[k] = onlineClonePlain(value[k]);
    });
    return out;
}

function onlineFighterIndex(fighter) {
    return players.indexOf(fighter);
}

function onlineCloneWithoutRefs(value, blockedKeys) {
    let out = {};
    Object.keys(value || {}).forEach(k => {
        if (!blockedKeys.includes(k)) out[k] = onlineClonePlain(value[k]);
    });
    return out;
}

function onlineCaptureFighter(p) {
    let out = {};
    Object.keys(p).forEach(k => {
        if (k === 'attacks') return;
        if (k === 'throwHold') {
            out.throwHold = p.throwHold ? { ...onlineCloneWithoutRefs(p.throwHold, ['target']), targetIndex: onlineFighterIndex(p.throwHold.target) } : null;
            return;
        }
        if (k === 'ult') {
            out.ult = p.ult ? { ...onlineCloneWithoutRefs(p.ult, ['target', 'proj']), targetIndex: onlineFighterIndex(p.ult.target), projIndex: projectiles.indexOf(p.ult.proj) } : null;
            return;
        }
        out[k] = onlineClonePlain(p[k]);
    });
    return out;
}

function onlineRestoreFighter(data) {
    let p = Object.create(Fighter.prototype);
    Object.assign(p, onlineClonePlain(data));
    p.attacks = CHARACTERS[p.charType].attacks;
    p.comboInputBuffer = Array.isArray(p.comboInputBuffer) ? p.comboInputBuffer : [];
    p.currentAttack = p.currentAttack ? onlineClonePlain(p.currentAttack) : null;
    return p;
}

function onlineCaptureHitbox(h) {
    let out = {};
    Object.keys(h).forEach(k => {
        if (k === 'owner') out.ownerIndex = onlineFighterIndex(h.owner);
        else if (k === 'grabThrow') out.grabThrowIndex = onlineFighterIndex(h.grabThrow);
        else if (k === 'ultActivator') out.ultActivatorIndex = onlineFighterIndex(h.ultActivator);
        else if (k === 'hasHit') out.hasHit = Array.from(h.hasHit || []);
        else out[k] = onlineClonePlain(h[k]);
    });
    return out;
}

function onlineRestoreHitbox(data) {
    let h = Object.create(Hitbox.prototype);
    Object.assign(h, onlineClonePlain(data));
    h.owner = players[data.ownerIndex] || null;
    h.grabThrow = players[data.grabThrowIndex] || null;
    h.ultActivator = players[data.ultActivatorIndex] || null;
    h.hasHit = new Set(data.hasHit || []);
    return h;
}

function onlineCaptureProjectile(p) {
    let out = {};
    Object.keys(p).forEach(k => {
        if (k === 'owner') out.ownerIndex = onlineFighterIndex(p.owner);
        else if (k === 'ultActivator') out.ultActivatorIndex = onlineFighterIndex(p.ultActivator);
        else if (k === 'hasHit') out.hasHit = Array.from(p.hasHit || []);
        else if (k === 'customLogic') out.customLogicName = p.customLogic === splitLogic ? 'splitLogic' : null;
        else out[k] = onlineClonePlain(p[k]);
    });
    return out;
}

function onlineRestoreProjectile(data) {
    let p = Object.create(Projectile.prototype);
    Object.assign(p, onlineClonePlain(data));
    p.owner = players[data.ownerIndex] || null;
    p.ultActivator = players[data.ultActivatorIndex] || null;
    p.hasHit = new Set(data.hasHit || []);
    p.customLogic = data.customLogicName === 'splitLogic' ? splitLogic : null;
    return p;
}

function onlineCaptureState() {
    return {
        frame: onlineState.frame,
        gameState,
        selectedStage,
        matchTimer,
        matchTimerAccumulator,
        roundWins: [...roundWins],
        currentRound,
        trainingMode,
        infiniteMeter,
        timeScale,
        ultActiveIndex: onlineFighterIndex(ultActive),
        ultBanner: onlineClonePlain(ultBanner),
        ultCamera: onlineClonePlain(ultCamera),
        overkillFx: onlineClonePlain(overkillFx),
        rngSeed: onlineState.rngSeed,
        keys: onlineClonePlain(keys),
        previousKeys: onlineClonePlain(previousKeys),
        players: players.map(onlineCaptureFighter),
        hitboxes: hitboxes.map(onlineCaptureHitbox),
        projectiles: projectiles.map(onlineCaptureProjectile),
        particles: particles.map(p => onlineClonePlain(p)),
        bloodStains: bloodStains.map(onlineClonePlain),
        bodyParts: bodyParts.map(p => onlineClonePlain(p))
    };
}

function onlineCaptureSyncState() {
    let state = onlineCaptureState();
    delete state.keys;
    delete state.previousKeys;
    return state;
}

function onlineApplyHostSync(msg) {
    if (onlineState.slot !== 1 || !msg || !msg.state || gameState !== 'PLAYING') return;
    if (onlineInUltimateCinematic()) return;
    let hostFrame = Number(msg.frame);
    let frameDrift = Number.isFinite(hostFrame) ? Math.abs(hostFrame - onlineState.frame) : 0;
    let state = msg.state;
    let maxPosDrift = 0;
    let hardMismatch = false;

    if (Array.isArray(state.players)) {
        for (let i = 0; i < Math.min(players.length, state.players.length); i++) {
            let local = players[i], remote = state.players[i];
            if (!local || !remote) continue;
            let isLocal = i === onlineState.slot;
            if (!isLocal) {
                maxPosDrift = Math.max(maxPosDrift, Math.hypot((remote.x || 0) - local.x, (remote.y || 0) - local.y));
                if (remote.state !== local.state) hardMismatch = true;
            }
            if (remote.state === 'DEAD' || local.state === 'DEAD') hardMismatch = true;
        }
    }

    if (frameDrift <= 8 && maxPosDrift < 55 && !hardMismatch) return;

    onlineApplyPartialHostSync(state);
    if (Number.isFinite(hostFrame) && frameDrift > 20) onlineState.frame = hostFrame;
    onlineState.syncCorrections++;
    onlineState.lastRollbackSize = frameDrift || Math.round(maxPosDrift);
    updateHUD();
}

function onlineApplyPartialHostSync(state) {
    if (!state || !Array.isArray(state.players)) return;
    matchTimer = state.matchTimer;
    matchTimerAccumulator = state.matchTimerAccumulator;
    roundWins = [...state.roundWins];
    currentRound = state.currentRound;
    timeScale = Math.min(timeScale, state.timeScale || 1);
    let localIndex = onlineState.slot;
    for (let i = 0; i < Math.min(players.length, state.players.length); i++) {
        let p = players[i];
        let src = state.players[i];
        if (!p || !src || p.charType !== src.charType) continue;
        if (i === localIndex) {
            // Keep local controls smooth. Only accept authoritative combat/resource state.
            if (Math.abs(src.hp - p.hp) > 6 || src.hp <= 0 || p.hp <= 0) p.hp = src.hp;
            if (Math.abs(src.meter - p.meter) > 15) p.meter = src.meter;
            p.blockHealth = src.blockHealth;
            if (src.state === 'DEAD' || p.state === 'DEAD') {
                p.x = src.x; p.y = src.y; p.vx = src.vx; p.vy = src.vy;
                p.state = src.state; p.stateTimer = src.stateTimer;
            }
            continue;
        }
        let drift = Math.hypot(src.x - p.x, src.y - p.y);
        let blend = drift > 90 ? 1 : 0.35;
        p.x += (src.x - p.x) * blend;
        p.y += (src.y - p.y) * blend;
        p.vx = src.vx;
        p.vy = src.vy;
        p.hp = src.hp;
        p.meter = src.meter;
        p.dir = src.dir;
        p.blockHealth = src.blockHealth;
        p.state = src.state;
        p.stateTimer = src.stateTimer;
    }
    if (document.getElementById('timer')) document.getElementById('timer').innerText = matchTimer;
    renderRoundPips();
}

function onlineSendUltSync(fighter, event) {
    if (currentMode !== 'ONLINE' || onlineState.slot !== 0 || suppressRollbackEffects) return;
    onlineSend('ult-sync', {
        event,
        fighterIndex: players.indexOf(fighter),
        state: onlineCaptureSyncState(),
        frame: onlineState.frame
    });
}

function onlineApplyUltSync(msg) {
    if (onlineState.slot !== 1 || !msg || !msg.state || gameState !== 'PLAYING') return;
    let localKeys = onlineClonePlain(keys);
    let localPreviousKeys = onlineClonePlain(previousKeys);
    onlineRestoreState({ ...msg.state, keys: localKeys, previousKeys: localPreviousKeys });
    if (Number.isFinite(msg.frame)) onlineState.frame = msg.frame;
    onlineState.accumulator = 0;
    onlineState.syncCorrections++;
    updateHUD();
}

function onlineRestoreState(state) {
    gameState = state.gameState;
    selectedStage = state.selectedStage;
    matchTimer = state.matchTimer;
    matchTimerAccumulator = state.matchTimerAccumulator;
    roundWins = [...state.roundWins];
    currentRound = state.currentRound;
    trainingMode = state.trainingMode;
    infiniteMeter = state.infiniteMeter;
    timeScale = state.timeScale;
    ultBanner = onlineClonePlain(state.ultBanner);
    ultCamera = onlineClonePlain(state.ultCamera);
    overkillFx = onlineClonePlain(state.overkillFx);
    onlineState.rngSeed = state.rngSeed;
    Object.keys(keys).forEach(k => delete keys[k]);
    Object.assign(keys, onlineClonePlain(state.keys || {}));
    Object.keys(previousKeys).forEach(k => delete previousKeys[k]);
    Object.assign(previousKeys, onlineClonePlain(state.previousKeys || {}));
    players = state.players.map(onlineRestoreFighter);
    projectiles = state.projectiles.map(onlineRestoreProjectile);
    hitboxes = state.hitboxes.map(onlineRestoreHitbox);
    particles = state.particles.map(p => Object.assign(Object.create(Particle.prototype), onlineClonePlain(p)));
    bloodStains = state.bloodStains.map(onlineClonePlain);
    bodyParts = state.bodyParts.map(p => Object.assign(Object.create(BodyPart.prototype), onlineClonePlain(p)));
    players.forEach(p => {
        if (p.throwHold && p.throwHold.targetIndex >= 0) p.throwHold.target = players[p.throwHold.targetIndex];
        if (p.ult) {
            if (p.ult.targetIndex >= 0) p.ult.target = players[p.ult.targetIndex];
            if (p.ult.projIndex >= 0) p.ult.proj = projectiles[p.ult.projIndex];
        }
    });
    ultActive = players[state.ultActiveIndex] || null;
    if (document.getElementById('timer')) document.getElementById('timer').innerText = matchTimer;
    renderRoundPips();
}

function onlineTrimRollbackBuffers(frame) {
    let min = frame - ONLINE_STATE_BUFFER_FRAMES;
    for (let key of onlineState.stateBuffer.keys()) if (key < min) onlineState.stateBuffer.delete(key);
    for (let key of onlineState.localInputs.keys()) if (key < min) onlineState.localInputs.delete(key);
    for (let key of onlineState.remoteInputs.keys()) if (key < min) onlineState.remoteInputs.delete(key);
    for (let key of onlineState.predictedRemoteInputs.keys()) if (key < min) onlineState.predictedRemoteInputs.delete(key);
}

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

function onlineUpdateNetHud() {
    let panel = document.getElementById('online-net-panel');
    if (!panel) return;
    panel.classList.remove('hidden', 'good', 'warn', 'bad');
    let ping = onlineState.pingMs == null ? null : Math.round(onlineState.pingMs);
    let age = onlineState.lastRemoteInputMs == null ? null : Math.round(onlineState.lastRemoteInputMs);
    let pingEl = document.getElementById('online-net-ping');
    let ageEl = document.getElementById('online-net-age');
    let rbEl = document.getElementById('online-net-rollback');
    if (pingEl) pingEl.innerText = ping == null ? 'PING --' : `PING ${ping}`;
    if (ageEl) ageEl.innerText = age == null ? 'INPUT --' : `INPUT ${age}`;
    if (rbEl) rbEl.innerText = onlineState.syncCorrections ? `SYNC ${onlineState.syncCorrections}` : `RB ${onlineState.lastRollbackSize}`;
    let level = 'good';
    if ((ping != null && ping > 130) || (age != null && age > 120)) level = 'warn';
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
        localSelection: null,
        remoteSelection: null,
        waitingStart: false,
        frame: 0,
        accumulator: 0,
        localInputs: new Map(),
        remoteInputs: new Map(),
        predictedRemoteInputs: new Map(),
        stateBuffer: new Map(),
        lastLocalInput: null,
        lastRemoteInput: null,
        rollbackCount: 0,
        rollbackFrames: 0,
        lastRollbackFrame: -999,
        lastRollbackSize: 0,
        syncTimer: 0,
        syncCorrections: 0,
        rngSeed: 0xC0FFEE,
        lastInputSent: 0,
        snapshotTimer: 0,
        lastSnapshotAt: 0,
        pingTimer: 0,
        pingSeq: 0,
        pendingPings: {},
        pingMs: null,
        lastRemoteInputAt: 0,
        lastRemoteInputMs: null,
        remoteInputStale: false,
        status: ''
    };
    ONLINE_ACTIONS.forEach(action => { keys[ONLINE_REMOTE_BINDINGS[action]] = false; });
    let panel = document.getElementById('online-net-panel');
    if (panel) panel.classList.add('hidden');
}
