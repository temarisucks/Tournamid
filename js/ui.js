// --- MENU & FLOW CONTROLLERS ---

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (id) document.getElementById(id).classList.remove('hidden');
}

// --- CHARACTER INFO SCREEN ---
const CHAR_INFO = [
    {
        name: "THE BRAWLER", role: "Rushdown / heavy combo bruiser",
        passive: "Passive — Momentum: consecutive hits ramp up your damage.",
        specials: [
            ["Neutral", "Haymaker", "armored charged straight — power through a hit and crush them"],
            ["Side", "Shoulder Rush", "armored dashing tackle; great combo starter"],
            ["Up", "Power Uppercut", "rising launcher that doubles as recovery"],
            ["Down", "Ground Breaker", "ground slam shockwave that hits low on both sides"]
        ]
    },
    {
        name: "THE SWORDSMAN", role: "Agile mid-range duelist",
        passive: "Passive — Duelist's Reflex: a successful parry speeds up your attacks.",
        specials: [
            ["Neutral", "Iai Draw", "fires a long-range vacuum slash projectile"],
            ["Side", "Flash Slash", "dash forward through the foe with a strike"],
            ["Up", "Rising Crescent", "upward arcing slash — anti-air & recovery"],
            ["Down", "Perfect Parry", "counter stance; riposte if timed right"]
        ]
    },
    {
        name: "THE MAGE", role: "RNG zoner / chaos spellcaster",
        passive: "Passive — Wild Magic: spells have a chance to fire twice.",
        specials: [
            ["Neutral", "Chaos Bolt", "random element each cast: fire / spark / frost / homing / split"],
            ["Side", "Arcane Roulette", "random horizontal spell: frost wave, phase-strike, swarm or beam"],
            ["Up", "Blink", "teleport (recovery) with a random kicker: rune, burst or empower"],
            ["Down", "Rune Trap", "plant a random ground rune: explosive, slow, launch or mana font"]
        ]
    },
    {
        name: "THE RANGER", role: "Hybrid all-rounder (guns + knives)",
        passive: "Passive — Tactical Reload: dodging empowers your next gunshot.",
        specials: [
            ["Neutral", "Quickdraw", "rapid burst of forward shots"],
            ["Side", "Knife Rush", "dashing close-range knife flurry"],
            ["Up", "Updraft Shot", "fire downward to launch up; blast hits pursuers"],
            ["Down", "Combat Roll", "evasive roll with i-frames; procs Tactical Reload"]
        ]
    },
    {
        name: "THE DARK RULER", role: "Heavyweight grappler / dark sorcerer",
        passive: "Passive — Soul Siphon: heals a fraction of the damage he deals.",
        specials: [
            ["Neutral", "Dark Bolt", "hurls a void orb of dark energy"],
            ["Side", "Abyssal Grab", "unblockable command grab — seize and hurl them across the arena"],
            ["Up", "Rising Edge", "rising greatsword launcher (anti-air)"],
            ["Down", "Dark Nova", "slam the blade down for a wide dark shockwave"]
        ]
    },
    {
        name: "THE TELEPATH", role: "Mid-range anti-zoner / psychic",
        passive: "Passive — Levitation: tap Up to fly high and glide down (hold Down to drop fast). Getting hit cancels the glide.",
        specials: [
            ["Neutral", "Psi Barrier", "reflects projectiles back, amplified; shoves melee"],
            ["Side", "Mind Grip", "psychic tether that yanks the foe into your range (unblockable)"],
            ["Up", "Psi Lift", "rising psychic burst — anti-air launcher + altitude"],
            ["Down", "Tele Crash", "in air: dive-bomb shockwave; grounded: low psychic sweep"]
        ]
    },
    {
        name: "THE BEAST TAMER", role: "Adaptive stance fighter / monster commander",
        passive: "Passive - Active Beast: neutral special cycles Serpent, Brute, and Raven. Each beast changes every other special.",
        specials: [
            ["Neutral", "Call Beast", "cycle active monster; the companion visibly changes beside you"],
            ["Side", "Command", "Serpent bite, Brute rush, or Raven dive depending on active beast"],
            ["Up", "Command", "Serpent coil recovery, Brute uppercut, or Raven lift"],
            ["Down", "Command", "Venom puddle, Brute stomp, or Raven mark"]
        ]
    }
];

function showCharInfo() {
    let grid = document.getElementById('info-grid');
    grid.innerHTML = CHAR_INFO.map(c => `
        <div class="info-card">
            <h3>${c.name}</h3>
            <div class="role">${c.role}</div>
            <div class="passive">${c.passive}</div>
            <ul>${c.specials.map(s => `<li><span class="dir">${s[0]}</span> <b>${s[1]}</b> — ${s[2]}</li>`).join('')}</ul>
        </div>`).join('');
    document.getElementById('info-controls').innerHTML =
        "Specials = the special key + a held direction. &nbsp; P1: <b>L</b> + W/A·D/S &nbsp;|&nbsp; P2: <b>/</b> + Arrow keys. &nbsp; No direction = Neutral.";
    gameState = 'INFO';
    showScreen('info-screen');
}

function closeCharInfo() {
    gameState = 'MENU';
    showScreen('menu-screen');
}

// --- MENU NAVIGATION ---
function showModeSelect() {
    sfx.init();
    gameState = 'MODE_SELECT';
    showScreen('mode-screen');
}
function backToMainMenu() {
    if (currentMode === 'ONLINE') onlineDisconnect();
    gameState = 'MENU';
    showScreen('menu-screen');
}
// Backing all the way out of character select returns to the right screen
function returnFromSelect() {
    if (currentMode === 'TRAINING') { backToMainMenu(); }
    else { showModeSelect(); }
}

const HOWTO = [
    { h: "Player 1", lines: ["<b>WASD</b> Move / Jump / Crouch", "<b>I</b> Block &nbsp; <b>J</b> Light &nbsp; <b>K</b> Heavy", "<b>L + direction</b> Special", "<b>O</b> Ultimate"] },
    { h: "Player 2", lines: ["<b>Arrows</b> Move / Jump / Crouch", "<b>U</b> Block &nbsp; <b>O</b> Light &nbsp; <b>P</b> Heavy", "<b>/ + direction</b> Special", "<b>.</b> (period) Ultimate"] },
    { h: "Specials", lines: ["Hold a direction + Special for", "Up / Down / Side / Neutral moves.", "Each fighter has four — see Character Info."] },
    { h: "Combos", lines: ["Chain Light & Heavy (e.g. L-L-H)", "for unique combo finishers.", "Land hits to keep pressure."] },
    { h: "Block & Guard Break", lines: ["Hold Block to absorb hits, but every", "blocked hit drains your guard.", "Empty it and your guard SHATTERS — fully open."] },
    { h: "Ultimate Meter", lines: ["Charge by dealing and (more so) taking damage.", "When full, press Ultimate to start a cinematic.", "Land the opener and the ultimate is guaranteed."] },
    { h: "Rounds", lines: ["Versus matches are <b>best of 3</b>.", "First to win two rounds takes the match."] },
    { h: "Stages & Ring Out", lines: ["On Sky Platform you can fall off the map.", "Falling = a loss; grab the ledge to survive,", "press Up to climb or away to drop."] }
];

function showHowTo() {
    let grid = document.getElementById('howto-grid');
    grid.innerHTML = HOWTO.map(c => `
        <div class="howto-card">
            <h3>${c.h}</h3>
            ${c.lines.map(l => `<p>${l}</p>`).join('')}
        </div>`).join('');
    gameState = 'HOWTO';
    showScreen('howto-screen');
}
function closeHowTo() {
    gameState = 'MENU';
    showScreen('menu-screen');
}

// --- SETTINGS ---
const STATE_SCREEN = { MENU: 'menu-screen', MODE_SELECT: 'mode-screen', ONLINE_LOBBY: 'online-screen', CHAR_SELECT: 'char-select-screen', STAGE_SELECT: 'stage-select-screen', INFO: 'info-screen', HOWTO: 'howto-screen', PAUSED: 'pause-screen', END: 'end-screen' };
let settingsReturn = 'MENU';
function openSettings() {
    settingsReturn = STATE_SCREEN[gameState] ? gameState : 'MENU';
    renderSettings();
    gameState = 'SETTINGS';
    showScreen('settings-screen');
}
function closeSettings() {
    saveSettings(); saveBindings();
    if (rebind) { rebind.btn && rebind.btn.classList.remove('listening'); rebind = null; }
    gameState = settingsReturn;
    showScreen(STATE_SCREEN[settingsReturn] || 'menu-screen');
}
function setVolume(cat, val) {
    settings[cat] = Math.max(0, Math.min(1, val / 100));
    applyVolumes(); saveSettings();
    let el = document.getElementById('vol-' + cat + '-val');
    if (el) el.innerText = Math.round(settings[cat] * 100) + '%';
}

const VOL_CATS = [['master', 'Master'], ['music', 'Music'], ['sfx', 'SFX'], ['voice', 'Voicelines']];
const BIND_LABELS = { u: 'Up', d: 'Down', l: 'Left', r: 'Right', block: 'Block', atkL: 'Light', atkH: 'Heavy', special: 'Special', ult: 'Ultimate' };
function keyLabel(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Space: 'Spc', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Quote: "'", Backslash: '\\' };
    return map[code] || code;
}
function renderSettings() {
    document.getElementById('volume-sliders').innerHTML = VOL_CATS.map(([k, label]) =>
        `<div class="vol-row"><label>${label}</label>` +
        `<input type="range" min="0" max="100" value="${Math.round(settings[k] * 100)}" oninput="setVolume('${k}', this.value)">` +
        `<span class="vval" id="vol-${k}-val">${Math.round(settings[k] * 100)}%</span></div>`).join('');
    renderBindings();
}
function renderBindings() {
    let html = '';
    ['P1', 'P2'].forEach(pl => {
        html += `<div class="bind-head"><span>${pl}</span></div>`;
        Object.keys(BIND_LABELS).forEach(act => {
            html += `<div class="bind-row"><span class="bind-act">${BIND_LABELS[act]}</span>` +
                `<button class="bind-key" onclick="startRebind('${pl}','${act}',this)">${keyLabel(keyBindings[pl][act])}</button></div>`;
        });
    });
    document.getElementById('bindings-list').innerHTML = html;
}
let rebind = null;
function startRebind(pl, act, btn) {
    if (rebind && rebind.btn) rebind.btn.classList.remove('listening');
    rebind = { pl, act, btn };
    btn.classList.add('listening');
    btn.innerText = '...';
}
function resetBindings() {
    keyBindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    saveBindings(); renderBindings();
}
// Capture key presses while rebinding (capture phase = before the game's handler)
window.addEventListener('keydown', e => {
    if (!rebind) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') { keyBindings[rebind.pl][rebind.act] = e.code; saveBindings(); }
    rebind.btn.classList.remove('listening');
    rebind = null;
    renderBindings();
}, true);

function handleEscape() {
    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
        togglePause();
    } else if (gameState === 'CHAR_SELECT') {
        backFromCharacterSelect();
    } else if (gameState === 'STAGE_SELECT') {
        backFromStageSelect();
    } else if (gameState === 'INFO') {
        closeCharInfo();
    } else if (gameState === 'HOWTO') {
        closeHowTo();
    } else if (gameState === 'MODE_SELECT') {
        backToMainMenu();
    } else if (gameState === 'ONLINE_LOBBY') {
        backToMainMenu();
    } else if (gameState === 'SETTINGS') {
        closeSettings();
    } else if (gameState === 'END') {
        returnToMenu();
    }
}

function togglePause() {
    if (gameState === 'PLAYING') {
        pausedFromState = gameState;
        gameState = 'PAUSED';
        document.getElementById('pause-screen').classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
        gameState = pausedFromState || 'PLAYING';
        pausedFromState = null;
        document.getElementById('pause-screen').classList.add('hidden');
    }
}

function backFromCharacterSelect() {
    if (currentMode === 'ONLINE') {
        onlineDisconnect();
        showOnlineScreen();
        return;
    }
    if (p1Selection && !p2Selection && currentMode !== 'PVE') {
        p1Selection = null;
        charSelectPreview.p1 = null;
        charSelectPreview.p1Burst = 0;
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('locked', 'selected'));
        document.getElementById('char-select-title').innerText = "Select Player 1";
        updateSelectionLabels();
    } else {
        returnFromSelect();
    }
}

function updateSelectionLabels() {
    document.getElementById('p1-select-label').innerText = p1Selection ? CHARACTERS[p1Selection].name : '---';
    document.getElementById('p2-select-label').innerText = p2Selection ? CHARACTERS[p2Selection].name : '---';
    document.getElementById('p2-select-wrap').style.visibility = (currentMode === 'PVE' || currentMode === 'TRAINING') ? 'hidden' : 'visible';
}

function getRandomCharacter() {
    const roster = ['BRAWLER', 'SWORDSMAN', 'MAGE', 'RANGER', 'DARK_RULER', 'TELEPATH', 'BEAST_TAMER'];
    return roster[Math.floor(Math.random() * roster.length)];
}

function markRosterSelection(charType, slot) {
    document.querySelectorAll('.char-card').forEach(c => {
        if (slot === 'p1') c.classList.remove('locked', 'selected');
        else c.classList.remove('selected');
    });

    let card = document.querySelector(`.char-card[data-char="${charType}"]`);
    if (!card) return;
    card.classList.add(slot === 'p1' ? 'locked' : 'selected');
}

function drawPreviewFighter(previewCtx, charType, x, team, dir, burst) {
    if (!charType) {
        previewCtx.save();
        previewCtx.strokeStyle = 'rgba(255,255,255,0.18)';
        previewCtx.lineWidth = 2;
        previewCtx.setLineDash([6, 8]);
        previewCtx.strokeRect(x - 46, 48, 92, 96);
        previewCtx.restore();
        return;
    }

    let fighter = new Fighter('PREVIEW', x, charType, false, team);
    fighter.y = 148;
    fighter.dir = dir;
    fighter.animTimer = charSelectPreview.timer;

    if (burst > 0) {
        const moveByCharacter = {
            BRAWLER: 'specUp',
            SWORDSMAN: 'heavy',
            MAGE: 'specNeutral',
            RANGER: 'specNeutral',
            DARK_RULER: 'heavy',
            TELEPATH: 'heavy',
            BEAST_TAMER: 'specNeutral'
        };
        let move = moveByCharacter[charType] || 'light';
        fighter.state = 'ATTACK';
        fighter.currentAttack = { ...fighter.attacks[move], name: move };
        fighter.stateTimer = (1 - burst) * (fighter.currentAttack.startup + fighter.currentAttack.active + fighter.currentAttack.recovery);

        previewCtx.save();
        previewCtx.translate(x, 98);
        previewCtx.strokeStyle = `rgba(255, 0, 51, ${burst * 0.75})`;
        previewCtx.lineWidth = 4;
        previewCtx.beginPath();
        previewCtx.arc(0, 0, 18 + (1 - burst) * 62, 0, Math.PI * 2);
        previewCtx.stroke();
        previewCtx.restore();
    }

    fighter.draw(previewCtx);
}

function drawCharacterSelectPreview(dt) {
    if (gameState !== 'CHAR_SELECT') return;

    let previewCanvas = document.getElementById('char-preview-canvas');
    let previewCtx = previewCanvas.getContext('2d');
    charSelectPreview.timer += dt;
    charSelectPreview.p1Burst = Math.max(0, charSelectPreview.p1Burst - dt * 1.8);
    charSelectPreview.p2Burst = Math.max(0, charSelectPreview.p2Burst - dt * 1.8);

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.fillStyle = '#050505';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    previewCtx.strokeStyle = '#333';
    previewCtx.lineWidth = 2;
    previewCtx.beginPath();
    previewCtx.moveTo(0, 150);
    previewCtx.lineTo(previewCanvas.width, 150);
    previewCtx.stroke();

    previewCtx.fillStyle = 'rgba(255, 0, 51, 0.12)';
    previewCtx.font = 'bold 56px Courier New';
    previewCtx.textAlign = 'center';
    previewCtx.fillText('VS', previewCanvas.width / 2, 104);

    drawPreviewFighter(previewCtx, charSelectPreview.p1, 270, 0, 1, charSelectPreview.p1Burst);
    if (currentMode !== 'PVE') drawPreviewFighter(previewCtx, charSelectPreview.p2, 690, 1, -1, charSelectPreview.p2Burst);
}

function goToCharSelect(mode) {
    sfx.init(); // Initialize audio context on first user interaction
    currentMode = mode;
    p1Selection = currentMode === 'ONLINE' && onlineState.slot === 1 ? p1Selection : null;
    p2Selection = currentMode === 'ONLINE' && onlineState.slot === 0 ? p2Selection : null;
    charSelectPreview = { p1: null, p2: null, p1Burst: 0, p2Burst: 0, timer: 0 };
    if (p1Selection) charSelectPreview.p1 = p1Selection;
    if (p2Selection) charSelectPreview.p2 = p2Selection;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('locked', 'selected'));
    document.getElementById('char-select-title').innerText =
        (currentMode === 'ONLINE' || currentMode === 'LADDER' || currentMode === 'PVE' || currentMode === 'TRAINING')
            ? "Select Your Fighter" : "Select Player 1";
    updateSelectionLabels();
    if (currentMode === 'ONLINE') updateOnlineSelectTitle();
    showScreen('char-select-screen');
    gameState = 'CHAR_SELECT';
}

function selectCharacter(charType, cardEl) {
    let resolvedType = charType === 'RANDOM' ? getRandomCharacter() : charType;
    if (currentMode === 'ONLINE') {
        if (!onlineState.peerConnected && onlineState.slot === 0) onlineSetStatus(`Room ${onlineState.roomCode}. Waiting for your friend.`);
        if (onlineState.localSelection) return;
        onlineSelectCharacter(resolvedType);
        return;
    }
    if (!p1Selection) {
        p1Selection = resolvedType;
        playAudio(selectVoices[resolvedType]);
        charSelectPreview.p1 = resolvedType;
        charSelectPreview.p1Burst = 1;
        markRosterSelection(resolvedType, 'p1');
        updateSelectionLabels();
        if (currentMode === 'LADDER') {
            setTimeout(() => {
                if (gameState === 'CHAR_SELECT' && p1Selection === resolvedType) enterLadder();
            }, 650);
        } else if (currentMode === 'PVE' || currentMode === 'TRAINING') {
            setTimeout(() => {
                if (gameState === 'CHAR_SELECT' && p1Selection === resolvedType) goToStageSelect();
            }, 650);
        } else {
            // Needs P2 selection
            document.getElementById('char-select-title').innerText = currentMode === 'CPU' ? "Select CPU Opponent" : "Select Player 2";
        }
    } else if (!p2Selection) {
        p2Selection = resolvedType;
        playAudio(selectVoices[resolvedType]);
        charSelectPreview.p2 = resolvedType;
        charSelectPreview.p2Burst = 1;
        if (cardEl) cardEl.classList.add('selected');
        updateSelectionLabels();
        setTimeout(() => {
            if (gameState === 'CHAR_SELECT' && p2Selection === resolvedType) goToStageSelect();
        }, 650);
    }
}

function goToStageSelect() {
    if (currentMode === 'ONLINE' && Number(onlineState.slot) !== 0) {
        updateOnlineSelectTitle();
        return;
    }
    selectedStage = 'dojo';
    document.querySelectorAll('.stage-card').forEach(c => c.classList.toggle('selected', c.dataset.stage === selectedStage));
    renderStageThumbnails();
    showScreen('stage-select-screen');
    gameState = 'STAGE_SELECT';
}

function backFromStageSelect() {
    if (currentMode === 'ONLINE') {
        showScreen('char-select-screen');
        gameState = 'CHAR_SELECT';
        updateOnlineSelectTitle();
        return;
    }
    let solo = currentMode === 'PVE' || currentMode === 'TRAINING' || currentMode === 'LADDER';
    if (solo) {
        p1Selection = null;
        charSelectPreview.p1 = null;
        charSelectPreview.p1Burst = 0;
    } else {
        p2Selection = null;
        charSelectPreview.p2 = null;
        charSelectPreview.p2Burst = 0;
    }
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    if (solo) document.querySelectorAll('.char-card').forEach(c => c.classList.remove('locked'));
    document.getElementById('char-select-title').innerText = solo ? "Select Your Fighter" : (currentMode === 'CPU' ? "Select CPU Opponent" : "Select Player 2");
    updateSelectionLabels();
    showScreen('char-select-screen');
    gameState = 'CHAR_SELECT';
}

function selectStage(stageId, cardEl) {
    if (currentMode === 'ONLINE' && !onlineSelectStage(stageId)) return;
    selectedStage = stageId;
    document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');
    setTimeout(() => {
        if (gameState === 'STAGE_SELECT' && selectedStage === stageId) {
            if (currentMode === 'ONLINE') {
                onlineStartGame();
                return;
            }
            startGame();
        }
    }, 250);
}

function renderStageThumbnails() {
    document.querySelectorAll('[data-stage-preview]').forEach(canvas => {
        let previewCtx = canvas.getContext('2d');
        drawStage(previewCtx, canvas.dataset.stagePreview, canvas.width, canvas.height, canvas.height - 28);
    });
}

function startGame() {
    showScreen(); // hide menus
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    players = [];
    hitboxes = [];
    projectiles = [];
    particles = [];
    bloodStains = [];
    bodyParts = [];
    overkillFx = null;
    ultActive = null; timeScale = 1; ultBanner = null; ultCamera = null;
    camNow.x = WIDTH / 2; camNow.y = HEIGHT / 2; camNow.zoom = 1;
    initStageActors(); // animated background figures for the chosen stage

    trainingMode = (currentMode === 'TRAINING');
    infiniteMeter = false;
    document.getElementById('training-panel').classList.toggle('hidden', !trainingMode);
    if (trainingMode) {
        let btn = document.getElementById('train-meter-toggle');
        btn.classList.remove('on'); btn.innerText = 'Infinite Meter: OFF';
    }

    players.push(new Fighter('P1', WIDTH/4, p1Selection, false, 0));
    document.getElementById('p1-name').innerText = CHARACTERS[p1Selection].name;

    if (trainingMode) {
        // Standing dummy to practice combos / ultimates on
        let dummy = new Fighter('DUMMY', WIDTH * 0.7, p1Selection, true, 1);
        dummy.isDummy = true;
        players.push(dummy);
        document.getElementById('p2-name').innerText = "DUMMY";
        document.getElementById('timer').classList.add('hidden');
        document.getElementById('wave-counter').classList.add('hidden');
    } else if (currentMode === 'PVE') {
        waveCount = 1;
        document.getElementById('p2-name').innerText = "THE HORDE";
        document.getElementById('timer').classList.add('hidden');
        document.getElementById('wave-counter').classList.remove('hidden');
        startPvEWave();
    } else {
        players.push(new Fighter('P2', WIDTH*0.75, p2Selection, currentMode === 'CPU', 1));
        document.getElementById('p2-name').innerText = currentMode === 'CPU' ? "CPU - " + CHARACTERS[p2Selection].name : "P2 - " + CHARACTERS[p2Selection].name;
        document.getElementById('timer').classList.remove('hidden');
        document.getElementById('wave-counter').classList.add('hidden');
        matchTimer = 99;
        document.getElementById('timer').innerText = matchTimer;
    }

    // Best-of-3 rounds only for versus modes
    let showRounds = (currentMode === 'CPU' || currentMode === 'PVP' || currentMode === 'ONLINE');
    roundWins = [0, 0]; currentRound = 1; roundAnnounce = null;
    document.querySelectorAll('.round-pips').forEach(el => el.classList.toggle('hidden', !showRounds));
    if (showRounds) { renderRoundPips(); roundAnnounce = { text: "ROUND 1", t: 0, dur: 1.4 }; }
    beginIntroSequence('round1');

    updateHUD();
    gameState = 'PLAYING';
    music.play('fight');
    document.getElementById('settings-btn').classList.add('hidden'); // gear hidden in-match (use pause menu)
}

function startPvEWave() {
    document.getElementById('wave-counter').innerText = "WAVE " + waveCount;
    // Clean dead enemies
    players = players.filter(p => p.id === 'P1'); 
    
    let spawnCount = Math.min(1 + Math.floor(waveCount / 2), 5); // Max 5 enemies
    
    let geo = getStageGeo();
    for (let i = 0; i < spawnCount; i++) {
        let x = WIDTH/2 + (Math.random() > 0.5 ? 200 : -200) + (Math.random() * 200 - 100);
        // Keep spawns on solid ground for ring-out stages
        if (geo.ringOut) x = Math.max(geo.main.left + 40, Math.min(geo.main.right - 40, x));
        let enemy = new Fighter('E'+i, x, 'ZOMBIE', true, 1);
        
        // Scale enemy stats slightly based on wave
        let scale = 1 + (waveCount * 0.1);
        enemy.maxHp = Math.floor(enemy.maxHp * scale * 0.5); // reduced base hp for horde mode
        enemy.hp = enemy.maxHp;
        enemy.speed *= 1.0 + (waveCount * 0.05);
        
        players.push(enemy);
    }
    updateHUD();
}

// ---------------- LADDER MODE ----------------
function ladderShuffle(arr) {
    let a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function ladderLevelFor(index, total) {
    if (total <= 1) return 0.6;
    return Math.min(1, 0.3 + (index / (total - 1)) * 0.7); // first rung 0.3 → last 1.0
}

// Enter Ladder mode after the player picks their fighter: build the gauntlet and
// show the climb screen (no stage select — each rung is fought on a random arena).
function enterLadder() {
    ladder.queue = ladderShuffle(['BRAWLER', 'SWORDSMAN', 'MAGE', 'RANGER', 'DARK_RULER', 'TELEPATH', 'BEAST_TAMER']);
    ladder.index = 0; ladder.active = true;
    showLadderScreen(false); // light up rung 1, then drop into the fight
}

// Show the canvas ladder. climb=true animates the player's icon up one rung first.
function showLadderScreen(climb) {
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('settings-btn').classList.remove('hidden');
    showScreen(); // hide all DOM overlays so the canvas ladder is visible
    gameState = 'LADDER_SCREEN';
    if (climb && ladder.index > 0) {
        ladderView = { phase: 'climb', t: 0, fromRung: ladder.index - 1, toRung: ladder.index, playerY: ladderRungY(ladder.index - 1) };
    } else {
        ladderView = { phase: 'lightup', t: 0, toRung: ladder.index, playerY: ladderRungY(ladder.index) };
    }
}

// Start a best-of-3 against the challenger on the given rung (random arena, scaled CPU).
function startLadderBattle(index) {
    ladderView = null;
    showScreen();
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    players = []; hitboxes = []; projectiles = []; particles = []; bloodStains = []; bodyParts = [];
    overkillFx = null;
    // start clean: no lingering ult slow-mo / zoom from the previous fight
    ultActive = null; timeScale = 1; ultBanner = null; ultCamera = null;
    camNow.x = WIDTH / 2; camNow.y = HEIGHT / 2; camNow.zoom = 1;
    selectedStage = ['dojo', 'moonBridge', 'platform', 'pStreet', 'bloodBall'][Math.floor(Math.random() * 5)];
    initStageActors();
    trainingMode = false; infiniteMeter = false;
    document.getElementById('training-panel').classList.add('hidden');

    let geo = getStageGeo();
    let lx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.28 : WIDTH / 4;
    let rx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.72 : WIDTH * 0.75;

    players.push(new Fighter('P1', lx, p1Selection, false, 0));
    document.getElementById('p1-name').innerText = CHARACTERS[p1Selection].name;
    let oppType = ladder.queue[index];
    let opp = new Fighter('P2', rx, oppType, true, 1);
    opp.dir = -1;
    opp.aiLevel = ladderLevelFor(index, ladder.queue.length);
    opp.maxHp = Math.floor(opp.maxHp * (1 + index * 0.05)); opp.hp = opp.maxHp; // mild stat ramp
    players.push(opp);
    document.getElementById('p2-name').innerText = "CPU - " + CHARACTERS[oppType].name;

    document.getElementById('timer').classList.remove('hidden');
    document.getElementById('wave-counter').classList.remove('hidden');
    document.getElementById('wave-counter').innerText = "RUNG " + (index + 1) + "/" + ladder.queue.length;
    matchTimer = 99; document.getElementById('timer').innerText = matchTimer; matchTimerAccumulator = 0;

    roundWins = [0, 0]; currentRound = 1; roundAnnounce = null;
    document.querySelectorAll('.round-pips').forEach(el => el.classList.remove('hidden'));
    renderRoundPips();
    roundAnnounce = { text: "ROUND 1", t: 0, dur: 1.4 };
    beginIntroSequence('round1');
    updateHUD();
    gameState = 'PLAYING';
    music.play('fight');
    document.getElementById('settings-btn').classList.add('hidden');
}

// Called once a rung's best-of-3 is decided (after the win animation).
function ladderResolveMatch() {
    let playerWon = roundWins[0] > roundWins[1];
    if (playerWon) {
        ladder.index++;
        if (ladder.index >= ladder.queue.length) showLadderComplete();
        else showLadderScreen(true); // climb up, then the next challenger
    } else {
        showLadderDefeat();
    }
}

function showLadderComplete() {
    ladder.active = false;
    ladderView = null;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('settings-btn').classList.remove('hidden');
    showScreen('ladder-complete-screen');
    gameState = 'MENU';
    music.play('menu');
}

function showLadderDefeat() {
    ladderView = null;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('settings-btn').classList.remove('hidden');
    let opp = CHARACTERS[ladder.queue[ladder.index]];
    document.getElementById('ladder-defeat-sub').innerText =
        'Fell at rung ' + (ladder.index + 1) + ' of ' + ladder.queue.length + (opp ? ' — ' + opp.name + ' bested you.' : '.');
    showScreen('ladder-defeat-screen');
    gameState = 'MENU';
}

function ladderRetry() {
    startLadderBattle(ladder.index); // same rung, fresh best-of-3
}

function selectRandomStage(cardEl) {
    let ids = Object.keys(STAGES);
    let pick = ids[Math.floor(Math.random() * ids.length)];
    let realCard = document.querySelector(`.stage-card[data-stage="${pick}"]`);
    selectStage(pick, realCard || cardEl); // reveals which stage was rolled, then proceeds
}

function returnToMenu() {
    if (currentMode === 'ONLINE') onlineDisconnect();
    if (typeof hideNetMessage === 'function') hideNetMessage();
    gameState = 'MENU';
    pausedFromState = null;
    trainingMode = false;
    infiniteMeter = false;
    timeScale = 1; ultActive = null; ultBanner = null; ultCamera = null; overkillFx = null; bodyParts = [];
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('training-panel').classList.add('hidden');
    document.getElementById('settings-btn').classList.remove('hidden');
    showScreen('menu-screen');
    music.play('menu');
}

function returnToCharacterSelect() {
    if (currentMode === 'ONLINE') {
        // On the post-match END screen this is the negotiated "Change Character" choice.
        // Anywhere else online (e.g. the pause menu) it still means leave the match.
        if (gameState === 'END') { onlinePostMatchChoose('change'); return; }
        onlineDisconnect();
        returnToMenu();
        return;
    }
    pausedFromState = null;
    trainingMode = false;
    infiniteMeter = false;
    timeScale = 1;
    ultActive = null;
    ultBanner = null;
    ultCamera = null;
    overkillFx = null;
    players = [];
    hitboxes = [];
    projectiles = [];
    particles = [];
    bodyParts = [];
    bloodStains = [];
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('training-panel').classList.add('hidden');
    goToCharSelect(currentMode);
}

function toggleInfiniteMeter() {
    infiniteMeter = !infiniteMeter;
    let btn = document.getElementById('train-meter-toggle');
    btn.classList.toggle('on', infiniteMeter);
    btn.innerText = 'Infinite Meter: ' + (infiniteMeter ? 'ON' : 'OFF');
    if (players[0]) updateHUD();
}

function restartMatch() {
    // In online play the "Rematch" button is a negotiated choice, not an instant restart.
    if (currentMode === 'ONLINE') { onlinePostMatchChoose('rematch'); return; }
    startGame();
}

// Start Engine
