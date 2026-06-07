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
    lastInputSent: 0,
    snapshotTimer: 0,
    lastSnapshotAt: 0,
    status: ''
};

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
        startGame();
        return;
    }

    if (msg.type === 'input') {
        onlineApplyRemoteInput(msg.input || {});
        return;
    }

    if (msg.type === 'snapshot' && onlineState.slot === 1 && currentMode === 'ONLINE') {
        onlineApplySnapshot(msg.snapshot);
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
    onlineSend('start', { stageId: selectedStage, p1Selection, p2Selection });
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
    onlineState.lastInputSent += dt;
    if (onlineState.lastInputSent >= 1 / 30) {
        onlineState.lastInputSent = 0;
        onlineSend('input', { input: onlineReadLocalInput() });
    }

    if (onlineState.slot === 0) {
        onlineState.snapshotTimer += dt;
        if (onlineState.snapshotTimer >= 1 / 10) {
            onlineState.snapshotTimer = 0;
            onlineSend('snapshot', { snapshot: onlineSnapshot() });
        }
    }
}

function onlineSnapshot() {
    return {
        matchTimer,
        currentRound,
        roundWins: [...roundWins],
        players: players.slice(0, 2).map(p => ({
            id: p.id,
            x: p.x, y: p.y, vx: p.vx, vy: p.vy,
            hp: p.hp, meter: p.meter,
            state: p.state, stateTimer: p.stateTimer,
            dir: p.dir, blockHealth: p.blockHealth,
            charType: p.charType
        }))
    };
}

function onlineApplySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.players)) return;
    matchTimer = snapshot.matchTimer;
    currentRound = snapshot.currentRound;
    if (Array.isArray(snapshot.roundWins)) roundWins = snapshot.roundWins;
    for (let i = 0; i < snapshot.players.length; i++) {
        let src = snapshot.players[i];
        let p = players[i];
        if (!p || !src || p.charType !== src.charType) continue;
        const localIndex = onlineState.slot;
        const isLocal = i === localIndex;
        const blend = isLocal ? 0.35 : 1;
        p.x += (src.x - p.x) * blend;
        p.y += (src.y - p.y) * blend;
        p.vx = src.vx;
        p.vy = src.vy;
        p.hp = src.hp;
        p.meter = src.meter;
        p.dir = src.dir;
        p.blockHealth = src.blockHealth;
        if (!isLocal || Math.abs(src.x - p.x) > 80 || p.state === 'DEAD') {
            p.state = src.state;
            p.stateTimer = src.stateTimer;
        }
    }
    if (document.getElementById('timer')) document.getElementById('timer').innerText = matchTimer;
    renderRoundPips();
    updateHUD();
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
        lastInputSent: 0,
        snapshotTimer: 0,
        lastSnapshotAt: 0,
        status: ''
    };
    ONLINE_ACTIONS.forEach(action => { keys[ONLINE_REMOTE_BINDINGS[action]] = false; });
}
