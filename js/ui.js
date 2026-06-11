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
    },
    {
        name: "THE PHANTOM", role: "Spectral grappler / soul-dragger",
        passive: "Passive — Fading Veil: hold still and he fades intangible for a moment — attacks and projectiles pass through. Acting snaps him solid (short cooldown).",
        specials: [
            ["Neutral", "Soul Siphon", "long reaching spectral claw that drains the foe's HP to heal him"],
            ["Side", "Grave Drag", "fling a slow mist-chain that yanks the foe into grab range — guard it to deny the pull"],
            ["Up", "Wraith Rise", "rising spectral anti-air grab that doubles as a ghostly recovery"],
            ["Down", "Grave Grasp", "spectral hands erupt from the floor to root the foe (unblockable low)"]
        ]
    },
    {
        name: "THE COPY CAT", role: "Fast-moving mimic / opportunist",
        passive: "Passive — Nine Lives: a lethal ultimate won't kill you. You survive at full HP (the round continues), gain access to your own ult — a COPY of that ultimate — and the enemy's ult is sealed until you use yours.",
        specials: [
            ["Neutral", "Copy", "mimics the LAST special your opponent used — steal their move and fire it back"],
            ["Side", "Cat Dash", "pounce across the arena; on a catch, pin the foe and rake them, then spring off"],
            ["Up", "Piano Drop", "leap and drop a piano on top of your opponent"],
            ["Down", "Agility", "set a brief mark — if struck while marked, auto-leap the attack and kick them away"]
        ]
    },
    {
        name: "THE CULT", role: "Ritual zone/trap controller",
        passive: "Passive — Congregation: landing hits builds Devotion. As it climbs, your rituals grow — more cultists per action, bigger Dark Offering fans and Consecrated Ground, and a faster road to the install.",
        specials: [
            ["Neutral", "Dark Offering", "hurl a hexed bolt — fans into 1-3 bolts as Devotion grows"],
            ["Side", "The Procession", "you hold still while cultists run out and plant a snare-trap ahead"],
            ["Up", "Mimic Puppet", "drop a puppet that echoes your every move on a delay; use again to detonate it — knocks both fighters back but only damages the foe"],
            ["Down", "Consecrated Ground", "plant a ritual zone: chips the foe inside, siphons their meter, and charges your install"]
        ],
        ult: "Ultimate — Summon Lumatrossia (install): become a giant horned demon for as long as the draining bar lasts. New kit — Backhand / Tyrant's Fist / Doomgaze beam, plus Side: blink behind the foe, Up: a beast that rains Mage-fire, Down: a portal that drops them from the sky (cooldown). Armored and grab-immune but cannot block; desummons when the bar empties; win the round as him and you revert next round."
    },
    {
        name: "THE TWINS", role: "Two-body pincer pair",
        passive: "Passive — Two as One: you control a pair that share one HP bar but are separate bodies. A stun/knockback only locks down the twin actually hit — the other keeps fighting. While the foe is centred between them, both gain a damage + speed buff (Symmetry).",
        specials: [
            ["Neutral", "Mirror Volley", "both twins fire a bolt inward — converging fire on a foe caught between them"],
            ["Side", "Crossover", "the twins dash forward, scissoring through together"],
            ["Up", "Fastball / Converge", "together: hurl yourself bodily across the map at the foe — you keep control of the twin that flew over, the other stays put. Apart: both leap at each other, crushing anything between"],
            ["Down", "Tether", "string a taut wire between the two bodies — whoever crosses it is tripped"]
        ],
        ult: "Ultimate — Eclipse: both twins blink to opposite walls and rocket inward, crushing whoever's caught in the middle as they collide."
    },
    {
        name: "THE TRAVELER", role: "Glass-cannon chrono tactician",
        passive: "Passive — Temporal Slip: every ~6s he auto-phases through the first hit that would land (watch the recharge ring over his head). Everything he does leaves afterimages.",
        specials: [
            ["Neutral", "Time Vortex", "a drifting singularity with a violent pull — get dragged to its core and you're churned in hitstun"],
            ["Side", "Tachyon Echo", "a hard-light bolt whose hit repeats itself one second later"],
            ["Up", "Time Skip", "fast-forward out of the timeline — vanish and reappear at the jump's apex (i-frames)"],
            ["Down", "Rewind", "snap back to where you stood 3 seconds ago and undo 60% of the damage taken since (cooldown)"]
        ],
        ult: "Ultimate — SAW THAT COMING: a counter stance. Swing at him and he dodges five strikes in a row, stops time, flurries you from every angle while the world is frozen, slides past, waves his hand — and every stored hit lands at once."
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
            ${c.ult ? `<div class="passive">${c.ult}</div>` : ''}
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
const OFFLINE_MODES = new Set(['PVP', 'CPU', 'CPU_WATCH', 'VS2', 'VS2_PVP', 'VS2_WATCH', 'LADDER', 'LADDER2', 'INFINITE_LADDER', 'PVE']);
function isTeamSelectMode(mode = currentMode) { return mode === 'VS2' || mode === 'VS2_PVP' || mode === 'VS2_WATCH' || mode === 'LADDER2'; }
function isCpuWatchMode(mode = currentMode) { return mode === 'CPU_WATCH' || mode === 'VS2_WATCH'; }
function setOfflineModesOpen(open) {
    let screen = document.getElementById('mode-screen');
    if (!screen) return;
    screen.classList.toggle('offline-open', !!open);
    screen.classList.remove('versus-open', 'solo-versus-open', 'team-versus-open');
}
function showModeSelect(openOffline = false) {
    sfx.init();
    gameState = 'MODE_SELECT';
    showScreen('mode-screen');
    setOfflineModesOpen(openOffline);
}
function showOfflineModes() {
    setOfflineModesOpen(true);
}
function hideOfflineModes() {
    setOfflineModesOpen(false);
}
function showOfflineVersusModes(kind) {
    let screen = document.getElementById('mode-screen');
    if (!screen) return;
    screen.classList.add('offline-open', 'versus-open');
    screen.classList.toggle('solo-versus-open', kind === 'solo');
    screen.classList.toggle('team-versus-open', kind === 'team');
}
function hideOfflineVersusModes() {
    let screen = document.getElementById('mode-screen');
    if (!screen) return;
    screen.classList.remove('versus-open', 'solo-versus-open', 'team-versus-open');
}
function backToMainMenu() {
    if (currentMode === 'ONLINE') onlineDisconnect();
    setOfflineModesOpen(false);
    gameState = 'MENU';
    showScreen('menu-screen');
}
// Backing all the way out of character select returns to the right screen
function returnFromSelect() {
    if (currentMode === 'TRAINING') { backToMainMenu(); }
    else { showModeSelect(OFFLINE_MODES.has(currentMode)); }
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
function toggleSettingsMenu() {
    if (gameState === 'SETTINGS') closeSettings();
    else openSettings();
}
function setVolume(cat, val) {
    settings[cat] = Math.max(0, Math.min(1, val / 100));
    applyVolumes(); saveSettings();
    let el = document.getElementById('vol-' + cat + '-val');
    if (el) el.innerText = Math.round(settings[cat] * 100) + '%';
}

const VOL_CATS = [['master', 'Master'], ['music', 'Music'], ['sfx', 'SFX'], ['voice', 'Voicelines']];
const BIND_LABELS = { u: 'Up', d: 'Down', l: 'Left', r: 'Right', block: 'Block', atkL: 'Light', atkH: 'Heavy', special: 'Special', ult: 'Ultimate', tag: 'Tag (2v2)' };
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
    renderGameplaySettings();
    renderBindings();
}
function renderGameplaySettings() {
    let el = document.getElementById('gameplay-settings');
    if (!el) return;
    el.innerHTML =
        `<div class="settings-toggle"><span>Touch Screen Controls</span><button class="toggle-btn${settings.touchControls ? ' on' : ''}" onclick="toggleSetting('touchControls')">${settings.touchControls ? 'ON' : 'OFF'}</button></div>` +
        `<div class="settings-toggle"><span>Blood</span><button class="toggle-btn${settings.blood ? ' on' : ''}" onclick="toggleSetting('blood')">${settings.blood ? 'ON' : 'OFF'}</button></div>`;
}
function toggleSetting(key) {
    settings[key] = !settings[key];
    if (key === 'blood' && !settings.blood) {
        bloodStains = [];
        bodyParts = [];
    }
    saveSettings();
    renderGameplaySettings();
    updateTouchControlsVisibility();
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

const touchHeld = new Map();
function touchCodeForAction(action) {
    return (keyBindings.P1 || DEFAULT_BINDINGS.P1)[action];
}
function setTouchAction(action, pressed, pointerId = null, btn = null) {
    let code = touchCodeForAction(action);
    if (!code) return;
    keys[code] = !!pressed;
    if (pressed && pointerId != null) touchHeld.set(pointerId, { action, code, btn });
    if (!pressed && pointerId != null) touchHeld.delete(pointerId);
    if (btn) btn.classList.toggle('held', !!pressed);
}
function releaseTouchPointer(pointerId) {
    let held = touchHeld.get(pointerId);
    if (!held) return;
    keys[held.code] = false;
    if (held.btn) held.btn.classList.remove('held');
    touchHeld.delete(pointerId);
}
let touchStickReset = null; // set by initTouchControls; recentres the analog stick
function releaseAllTouchControls() {
    touchHeld.forEach(held => {
        keys[held.code] = false;
        if (held.btn) held.btn.classList.remove('held');
    });
    touchHeld.clear();
    if (touchStickReset) touchStickReset();
}
function initTouchControls() {
    let panel = document.getElementById('touch-controls');
    if (!panel || panel.dataset.ready) return;
    panel.dataset.ready = '1';
    panel.addEventListener('contextmenu', e => e.preventDefault());
    panel.querySelectorAll('[data-touch-action]').forEach(btn => {
        btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            btn.setPointerCapture(e.pointerId);
            setTouchAction(btn.dataset.touchAction, true, e.pointerId, btn);
        });
        btn.addEventListener('pointerup', e => { e.preventDefault(); releaseTouchPointer(e.pointerId); });
        btn.addEventListener('pointercancel', e => { e.preventDefault(); releaseTouchPointer(e.pointerId); });
        btn.addEventListener('lostpointercapture', e => releaseTouchPointer(e.pointerId));
    });

    // ---- Virtual analog stick (movement) ----
    // Tilt maps onto the digital move keys: past the deadzone sideways = walk, flick up = jump,
    // pull down = crouch. Diagonals work (e.g. down-toward for crouch-walking specials).
    let stick = document.getElementById('touch-stick');
    let knob = document.getElementById('touch-stick-knob');
    if (stick && knob) {
        let sid = null;
        const setDir = (action, on) => { let code = touchCodeForAction(action); if (code) keys[code] = !!on; };
        touchStickReset = () => {
            if (sid === null) return; // stick not engaged — never clobber keyboard input
            sid = null;
            ['l', 'r', 'u', 'd'].forEach(a => setDir(a, false));
            knob.style.transform = 'translate(0px, 0px)';
            stick.classList.remove('held');
        };
        const moveStick = e => {
            // bounding rect is in (possibly non-uniformly) scaled screen space — normalise
            let rect = stick.getBoundingClientRect();
            let nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
            let ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
            let len = Math.hypot(nx, ny);
            if (len > 1) { nx /= len; ny /= len; }
            let r = stick.offsetWidth / 2; // unscaled container units for the knob visual
            knob.style.transform = 'translate(' + (nx * r * 0.62) + 'px, ' + (ny * r * 0.62) + 'px)';
            const DEAD = 0.3;
            setDir('l', nx < -DEAD);
            setDir('r', nx > DEAD);
            setDir('u', ny < -DEAD * 1.3); // jump needs a deliberate upward flick
            setDir('d', ny > DEAD * 1.3);  // crouch needs a deliberate downward pull
        };
        stick.addEventListener('pointerdown', e => {
            e.preventDefault();
            sid = e.pointerId;
            stick.setPointerCapture(sid);
            stick.classList.add('held');
            moveStick(e);
        });
        stick.addEventListener('pointermove', e => { if (e.pointerId === sid) { e.preventDefault(); moveStick(e); } });
        stick.addEventListener('pointerup', e => { if (e.pointerId === sid) { e.preventDefault(); touchStickReset(); } });
        stick.addEventListener('pointercancel', e => { if (e.pointerId === sid) touchStickReset(); });
        stick.addEventListener('lostpointercapture', e => { if (e.pointerId === sid) touchStickReset(); });
    }
}
function updateTouchControlsVisibility() {
    let panel = document.getElementById('touch-controls');
    if (!panel) return;
    let show = !!settings.touchControls && gameState === 'PLAYING';
    panel.classList.toggle('hidden', !show);
    let tagBtn = panel.querySelector('.touch-tag');
    if (tagBtn) tagBtn.classList.toggle('hidden', !teamBattle); // TAG only in 2v2
    if (!show) releaseAllTouchControls();
}

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
        let modeScreen = document.getElementById('mode-screen');
        if (modeScreen && modeScreen.classList.contains('versus-open')) hideOfflineVersusModes();
        else if (modeScreen && modeScreen.classList.contains('offline-open')) hideOfflineModes();
        else backToMainMenu();
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
    if (isTeamSelectMode()) {
        playerTeam = [];
        opponentTeam = [];
        returnFromSelect();
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
    const roster = ['BRAWLER', 'SWORDSMAN', 'MAGE', 'RANGER', 'DARK_RULER', 'TELEPATH', 'BEAST_TAMER', 'PHANTOM', 'COPYCAT', 'CULT', 'TWINS', 'TRAVELER'];
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
    fighter.isPreview = true; // lets characters strike a dedicated character-select pose

    if (burst > 0) {
        const moveByCharacter = {
            BRAWLER: 'specUp',
            SWORDSMAN: 'heavy',
            MAGE: 'specNeutral',
            RANGER: 'specNeutral',
            DARK_RULER: 'heavy',
            TELEPATH: 'heavy',
            BEAST_TAMER: 'specNeutral',
            TRAVELER: 'heavy'
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

    // The Twins — show BOTH bodies straddling the slot, mirrored
    if (charType === 'TWINS' && fighter.partner) {
        fighter.x = x - 30 * dir;
        let pn = fighter.partner;
        pn.isPreview = true; pn.y = fighter.y; pn.x = x + 30 * dir; pn.dir = -dir;
        pn.state = fighter.state; pn.stateTimer = fighter.stateTimer; pn.animTimer = fighter.animTimer; pn.currentAttack = fighter.currentAttack;
        fighter.draw(previewCtx);
        pn.draw(previewCtx);
        return;
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
    playerTeam = []; // 2v2 squad picks
    opponentTeam = [];
    p1Selection = currentMode === 'ONLINE' && onlineState.slot === 1 ? p1Selection : null;
    p2Selection = currentMode === 'ONLINE' && onlineState.slot === 0 ? p2Selection : null;
    charSelectPreview = { p1: null, p2: null, p1Burst: 0, p2Burst: 0, timer: 0 };
    if (p1Selection) charSelectPreview.p1 = p1Selection;
    if (p2Selection) charSelectPreview.p2 = p2Selection;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('locked', 'selected'));
    document.getElementById('char-select-title').innerText =
        isTeamSelectMode() ? (isCpuWatchMode() ? "Select CPU Team 1 - Fighter 1" : "Select Fighter 1 of 2")
        : (currentMode === 'ONLINE' || currentMode === 'LADDER' || currentMode === 'PVE' || currentMode === 'TRAINING')
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
    if (isTeamSelectMode()) { selectTeamCharacter(resolvedType, cardEl); return; }
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
            document.getElementById('char-select-title').innerText =
                currentMode === 'CPU' ? "Select CPU Opponent"
                : currentMode === 'CPU_WATCH' ? "Select CPU Fighter 2"
                : "Select Player 2";
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
    if (isTeamSelectMode() && currentMode !== 'LADDER2') { // re-pick the whole squad
        playerTeam = [];
        opponentTeam = [];
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected', 'locked'));
        document.getElementById('char-select-title').innerText = isCpuWatchMode() ? 'Select CPU Team 1 - Fighter 1' : 'Select Fighter 1 of 2';
        let lbl = document.getElementById('p1-select-label'); if (lbl) lbl.innerText = '---';
        let lbl2 = document.getElementById('p2-select-label'); if (lbl2) lbl2.innerText = '---';
        showScreen('char-select-screen');
        gameState = 'CHAR_SELECT';
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
    document.getElementById('char-select-title').innerText = solo ? "Select Your Fighter" : (currentMode === 'CPU' ? "Select CPU Opponent" : currentMode === 'CPU_WATCH' ? "Select CPU Fighter 2" : "Select Player 2");
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

function teamLabel(chars) {
    return chars.map(c => CHARACTERS[c] ? CHARACTERS[c].name.replace('THE ', '') : c).join(' + ');
}

function updateTeamSelectionLabels() {
    let p1 = document.getElementById('p1-select-label');
    let p2 = document.getElementById('p2-select-label');
    if (p1) p1.innerText = playerTeam.length ? teamLabel(playerTeam) : '---';
    if (p2) p2.innerText = opponentTeam.length ? teamLabel(opponentTeam) : '---';
}

// 2v2 char select: collect one or both squads depending on the selected mode.
function selectTeamCharacter(type, cardEl) {
    let pickingOpponent = (currentMode === 'VS2_PVP' || currentMode === 'VS2_WATCH') && playerTeam.length >= 2;
    let targetTeam = pickingOpponent ? opponentTeam : playerTeam;
    if (targetTeam.length >= 2) return;
    targetTeam.push(type);
    playAudio(selectVoices[type]);
    if (pickingOpponent) {
        charSelectPreview.p2 = type; charSelectPreview.p2Burst = 1;
    } else {
        charSelectPreview.p1 = type; charSelectPreview.p1Burst = 1;
    }
    if (cardEl) cardEl.classList.add('locked');
    updateTeamSelectionLabels();

    if (playerTeam.length < 2) {
        document.getElementById('char-select-title').innerText = isCpuWatchMode() ? `Select CPU Team 1 - Fighter ${playerTeam.length + 1}` : `Select Fighter ${playerTeam.length + 1} of 2`;
    } else if ((currentMode === 'VS2_PVP' || currentMode === 'VS2_WATCH') && opponentTeam.length < 2) {
        document.getElementById('char-select-title').innerText = currentMode === 'VS2_WATCH'
            ? `Select CPU Team 2 - Fighter ${opponentTeam.length + 1}`
            : `Select Player 2 Squad - Fighter ${opponentTeam.length + 1}`;
    } else {
        document.getElementById('char-select-title').innerText = currentMode === 'VS2_WATCH' ? 'CPU Squads Ready' : 'Squad Ready';
        setTimeout(() => {
            if (gameState !== 'CHAR_SELECT') return;
            if (currentMode === 'LADDER2') enterLadder();
            else goToStageSelect();
        }, 650);
    }
}

// Build both 2v2 squads (each fighter created off the shared P1/P2 control id).
function buildTeams(p1chars, p2chars, cpuLevel, p1AI = false, p2AI = true) {
    teamBattle = true;
    let geo = getStageGeo();
    let lx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.28 : WIDTH / 4;
    let rx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.72 : WIDTH * 0.75;
    teams = [[], []];
    p1chars.forEach(c => { let f = new Fighter('P1', lx, c, p1AI, 0); f.dir = 1; if (cpuLevel != null && p1AI) f.aiLevel = cpuLevel; teams[0].push(f); });
    p2chars.forEach(c => { let f = new Fighter('P2', rx, c, p2AI, 1); f.dir = -1; if (cpuLevel != null && p2AI) f.aiLevel = cpuLevel; teams[1].push(f); });
    activeIdx = [0, 0];
    pendingTag = [0, 0];
    players = [teams[0][0], teams[1][0]];
    document.getElementById('p1-name').innerText = (p1AI ? "CPU - " : "") + CHARACTERS[p1chars[0]].name;
    document.getElementById('p2-name').innerText = (p2AI ? "CPU - " : "P2 - ") + CHARACTERS[p2chars[0]].name;
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
    teamBattle = (currentMode === 'VS2' || currentMode === 'VS2_PVP' || currentMode === 'VS2_WATCH');
    infiniteMeter = false;
    document.getElementById('training-ui').classList.toggle('hidden', !trainingMode);
    document.getElementById('training-panel').classList.add('hidden'); // panel opens via the button
    if (trainingMode) {
        let btn = document.getElementById('train-meter-toggle');
        btn.classList.remove('on'); btn.innerText = 'Infinite Meter: OFF';
        dummyBehavior = 'idle';
        document.querySelectorAll('#dummy-settings .dummy-btn').forEach(b => b.classList.toggle('on', b.dataset.dummy === 'idle'));
    }

    if (teamBattle) {
        let p2Team = (currentMode === 'VS2_PVP' || currentMode === 'VS2_WATCH') && opponentTeam.length >= 2
            ? opponentTeam.slice(0, 2)
            : [getRandomCharacter(), getRandomCharacter()];
        buildTeams(playerTeam.slice(0, 2), p2Team, null, currentMode === 'VS2_WATCH', currentMode !== 'VS2_PVP');
        document.getElementById('timer').classList.remove('hidden');
        document.getElementById('wave-counter').classList.add('hidden');
        matchTimer = 99;
        document.getElementById('timer').innerText = matchTimer;
    } else {
        players.push(new Fighter('P1', WIDTH/4, p1Selection, currentMode === 'CPU_WATCH', 0));
        document.getElementById('p1-name').innerText = (currentMode === 'CPU_WATCH' ? "CPU - " : "") + CHARACTERS[p1Selection].name;

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
            players.push(new Fighter('P2', WIDTH*0.75, p2Selection, currentMode === 'CPU' || currentMode === 'CPU_WATCH', 1));
            document.getElementById('p2-name').innerText = (currentMode === 'CPU' || currentMode === 'CPU_WATCH') ? "CPU - " + CHARACTERS[p2Selection].name : "P2 - " + CHARACTERS[p2Selection].name;
            document.getElementById('timer').classList.remove('hidden');
            document.getElementById('wave-counter').classList.add('hidden');
            matchTimer = 99;
            document.getElementById('timer').innerText = matchTimer;
        }
    }
    setupTeamHud(teamBattle);

    // Best-of-3 rounds only for 1v1 versus modes
    let showRounds = (currentMode === 'CPU' || currentMode === 'CPU_WATCH' || currentMode === 'PVP' || currentMode === 'ONLINE');
    roundWins = [0, 0]; currentRound = 1; roundAnnounce = null;
    document.querySelectorAll('.round-pips').forEach(el => el.classList.toggle('hidden', !showRounds));
    if (showRounds) { renderRoundPips(); roundAnnounce = { text: "ROUND 1", t: 0, dur: 1.4 }; }
    beginIntroSequence('round1');
    startEntranceSequence(); // walk-ons + banter before the announcer (skippable)

    updateHUD();
    gameState = 'PLAYING';
    music.resetFightPick();
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

const LADDER_ROSTER = ['BRAWLER', 'SWORDSMAN', 'MAGE', 'RANGER', 'DARK_RULER', 'TELEPATH', 'BEAST_TAMER', 'PHANTOM', 'COPYCAT', 'CULT', 'TWINS', 'TRAVELER'];
function randomLadderCharacter(exclude = []) {
    let pool = LADDER_ROSTER.filter(c => !exclude.includes(c));
    return pool[Math.floor(Math.random() * pool.length)] || LADDER_ROSTER[0];
}

// Enter Ladder mode after the player picks their fighter: build the gauntlet and
// show the climb screen (no stage select — each rung is fought on a random arena).
function enterLadder() {
    // Don't put the player's own pick(s) on the ladder, and cap the gauntlet at 9 rungs.
    let picked = (currentMode === 'LADDER2' && playerTeam.length) ? playerTeam.slice() : [p1Selection];
    ladder.queue = ladderShuffle(LADDER_ROSTER.filter(c => !picked.includes(c))).slice(0, 9);
    // Pre-roll each rung's tag partner up front (LADDER2 only) so the climb screen can show BOTH opponents.
    ladder.partners = ladder.queue.map(challenger => {
        let p = getRandomCharacter();
        if (p === challenger) p = getRandomCharacter(); // one re-roll to avoid a mirror pair
        return p;
    });
    ladder.playerQueue = [];
    ladder.index = 0; ladder.active = true; ladder.infinite = false;
    showLadderScreen(false); // light up rung 1, then drop into the fight
}

function enterInfiniteLadder() {
    sfx.init();
    currentMode = 'INFINITE_LADDER';
    playerTeam = [];
    opponentTeam = [];
    ladder.index = 0;
    ladder.active = true;
    ladder.infinite = true;
    let firstPlayer = randomLadderCharacter();
    ladder.playerQueue = [firstPlayer];
    ladder.queue = [randomLadderCharacter([firstPlayer])];
    ladder.partners = [];
    p1Selection = firstPlayer;
    p2Selection = ladder.queue[0];
    showLadderScreen(false);
}

function appendInfiniteLadderRung() {
    let nextPlayer = randomLadderCharacter();
    ladder.playerQueue.push(nextPlayer);
    ladder.queue.push(randomLadderCharacter([nextPlayer]));
    p1Selection = nextPlayer;
    p2Selection = ladder.queue[ladder.index];
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
    players = []; hitboxes = []; projectiles = []; particles = []; bloodStains = []; bodyParts = []; cultSummons = []; consecrateZones = []; cultTraps = []; lumBeastFx = []; lumPortalFx = [];
    overkillFx = null;
    // start clean: no lingering ult slow-mo / zoom from the previous fight
    ultActive = null; timeScale = 1; ultBanner = null; ultCamera = null;
    camNow.x = WIDTH / 2; camNow.y = HEIGHT / 2; camNow.zoom = 1;
    let ladderStages = Object.keys(STAGES);
    selectedStage = ladderStages[Math.floor(Math.random() * ladderStages.length)] || 'dojo';
    initStageActors();
    trainingMode = false; infiniteMeter = false;
    document.getElementById('training-ui').classList.add('hidden');

    let geo = getStageGeo();
    let lx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.28 : WIDTH / 4;
    let rx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.72 : WIDTH * 0.75;

    if (currentMode === 'INFINITE_LADDER') {
        p1Selection = ladder.playerQueue[index] || randomLadderCharacter();
        ladder.playerQueue[index] = p1Selection;
        if (!ladder.queue[index]) ladder.queue[index] = randomLadderCharacter([p1Selection]);
        p2Selection = ladder.queue[index];
    }
    let lvl = currentMode === 'INFINITE_LADDER' ? Math.min(1, 0.35 + index * 0.04) : ladderLevelFor(index, ladder.queue.length);
    let teamFight = currentMode === 'LADDER2';
    if (teamFight) {
        // 2v2 ladder: your squad vs the rung's challenger + its pre-rolled partner (shown on the climb screen)
        let partner = ladder.partners[index] || getRandomCharacter();
        buildTeams(playerTeam.slice(0, 2), [ladder.queue[index], partner], lvl);
        teams[1].forEach(f => { f.maxHp = Math.floor(f.maxHp * (1 + index * 0.05)); f.hp = f.maxHp; });
    } else {
        teamBattle = false;
        players.push(new Fighter('P1', lx, p1Selection, false, 0));
        document.getElementById('p1-name').innerText = CHARACTERS[p1Selection].name;
        let oppType = ladder.queue[index];
        let opp = new Fighter('P2', rx, oppType, true, 1);
        opp.dir = -1;
        opp.aiLevel = lvl;
        opp.maxHp = Math.floor(opp.maxHp * (1 + index * 0.05)); opp.hp = opp.maxHp; // mild stat ramp
        players.push(opp);
        document.getElementById('p2-name').innerText = "CPU - " + CHARACTERS[oppType].name;
    }
    setupTeamHud(teamFight);

    document.getElementById('timer').classList.remove('hidden');
    document.getElementById('wave-counter').classList.remove('hidden');
    document.getElementById('wave-counter').innerText = currentMode === 'INFINITE_LADDER' ? "STREAK " + (index + 1) : "RUNG " + (index + 1) + "/" + ladder.queue.length;
    matchTimer = 99; document.getElementById('timer').innerText = matchTimer; matchTimerAccumulator = 0;

    roundWins = [0, 0]; currentRound = 1; roundAnnounce = null;
    document.querySelectorAll('.round-pips').forEach(el => el.classList.toggle('hidden', teamFight));
    if (!teamFight) renderRoundPips();
    roundAnnounce = { text: "ROUND 1", t: 0, dur: 1.4 };
    beginIntroSequence('round1');
    startEntranceSequence(); // walk-ons + banter before the announcer (skippable)
    updateHUD();
    gameState = 'PLAYING';
    music.resetFightPick();
    music.play('fight');
    document.getElementById('settings-btn').classList.add('hidden');
}

// Called once a rung's best-of-3 is decided (after the win animation).
function ladderResolveMatch() {
    let playerWon = roundWins[0] > roundWins[1];
    if (playerWon) {
        ladder.index++;
        if (currentMode === 'INFINITE_LADDER') {
            appendInfiniteLadderRung();
            showLadderScreen(true);
            return;
        }
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
    ladder.active = false;
    ladderView = null;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('settings-btn').classList.remove('hidden');
    let opp = CHARACTERS[ladder.queue[ladder.index]];
    document.getElementById('ladder-defeat-sub').innerText = currentMode === 'INFINITE_LADDER'
        ? 'Infinite streak ended at fight ' + (ladder.index + 1) + (opp ? ' — ' + opp.name + ' bested you.' : '.')
        : 'Fell at rung ' + (ladder.index + 1) + ' of ' + ladder.queue.length + (opp ? ' — ' + opp.name + ' bested you.' : '.');
    showScreen('ladder-defeat-screen');
    gameState = 'MENU';
}

function ladderRetry() {
    if (currentMode === 'INFINITE_LADDER') {
        enterInfiniteLadder();
        return;
    }
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
    teamBattle = false;
    infiniteMeter = false;
    timeScale = 1; ultActive = null; ultBanner = null; ultCamera = null; overkillFx = null; bodyParts = [];
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('training-ui').classList.add('hidden');
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
    document.getElementById('training-ui').classList.add('hidden');
    goToCharSelect(currentMode);
}

function toggleInfiniteMeter() {
    infiniteMeter = !infiniteMeter;
    let btn = document.getElementById('train-meter-toggle');
    btn.classList.toggle('on', infiniteMeter);
    btn.innerText = 'Infinite Meter: ' + (infiniteMeter ? 'ON' : 'OFF');
    if (players[0]) updateHUD();
}

// Open/close the training settings popup from its dedicated button.
function toggleDummyPanel() {
    document.getElementById('training-panel').classList.toggle('hidden');
}

// Training panel — choose what the dummy does. Highlights the active option.
function setDummyBehavior(mode, btn) {
    dummyBehavior = mode;
    document.querySelectorAll('#dummy-settings .dummy-btn').forEach(b => b.classList.toggle('on', b === btn));
    // drop the dummy out of any locked state so the new behavior takes over cleanly
    let dummy = players.find(p => p && p.isDummy);
    if (dummy && (dummy.state === 'BLOCK')) dummy.changeState('IDLE');
}

function restartMatch() {
    // In online play the "Rematch" button is a negotiated choice, not an instant restart.
    if (currentMode === 'ONLINE') { onlinePostMatchChoose('rematch'); return; }
    startGame();
}

// Start Engine
