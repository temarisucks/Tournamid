/**
 * MASSACRE - Core Engine & Logic
 */

// --- GLOBAL VARIABLES & SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = HEIGHT - 80;

let lastTime = 0;
let requestID;
let gameState = 'MENU'; // MENU, ONLINE_LOBBY, CHAR_SELECT, STAGE_SELECT, PLAYING, PAUSED, END
let currentMode = 'CPU'; // CPU, PVP, PVE, TRAINING, ONLINE
let selectedStage = 'dojo';

let p1Selection = null;
let p2Selection = null;
let waveCount = 1;
let matchTimer = 99;
let matchTimerAccumulator = 0;
let pausedFromState = null;

// Best-of-3 rounds (CPU / PVP)
const ROUNDS_TO_WIN = 2;
let roundWins = [0, 0];
let currentRound = 1;
let roundAnnounce = null; // { text, t, dur } transient banner

let players = [];
let hitboxes = [];
let projectiles = [];
let particles = [];
let bloodStains = [];
let bodyParts = [];

// --- META: ultimates, block-break, training ---
let infiniteMeter = false; // training toggle: ultimates always ready
let trainingMode = false;  // dummy opponent
let dummyBehavior = 'idle'; // training dummy behavior: idle|center|forward|backward|jump|light|heavy|block|cpu
let timeScale = 1;         // global slow-motion factor (cinematics)
let ultBanner = null;      // { owner, line, t, dur } cinematic title card
let ultCamera = null;      // { x, y, zoom, t, dur } cinematic camera focus
let ultActive = null;      // the Fighter currently performing an ultimate
let camNow = { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1 }; // eased cinematic camera
let frameRealDt = 0; // unscaled delta — ultimate performer acts in real time
let overkillFx = null;     // { t, dur, x, y } final-round ultimate kill banner
let suppressRollbackEffects = false;

const BLOCK_DUR = { BRAWLER: 110, SWORDSMAN: 65, MAGE: 45, RANGER: 78, DARK_RULER: 130, TELEPATH: 58, BEAST_TAMER: 72, PHANTOM: 118, COPYCAT: 60, ZOMBIE: 40 };
const ULT_LINES = {
    BRAWLER: "YOU'RE DEAD",
    SWORDSMAN: "OUTPLAYED.",
    MAGE: "HEY LOSER, CATCH!",
    RANGER: "DON'T BLINK",
    DARK_RULER: "KNEEL.",
    TELEPATH: "IDIOT",
    BEAST_TAMER: "ALPHA COMMAND.",
    PHANTOM: "SOUL TRAIN.",
    COPYCAT: "I can do anything better than you!"
};

// Which ultimate "kind" each character runs. The Copy Cat has none of its own —
// it copies the kind of whichever opponent's ultimate it survived (Nine Lives).
const ULT_KIND = {
    BRAWLER: 'counter', SWORDSMAN: 'arena', MAGE: 'orb', RANGER: 'bomb',
    DARK_RULER: 'darkslash', TELEPATH: 'mindbreak', BEAST_TAMER: 'beaststorm', PHANTOM: 'soultrain'
};

// Total damage each character's ultimate deals once it connects. Used to draw the
// "ult-lethal" threshold line on HP bars: if a fighter's HP is at/below the strongest
// enemy's value here, that enemy's ultimate will kill them outright.
// KEEP IN SYNC if an ultimate's damage is ever retuned.
const ULT_DAMAGE = {
    BRAWLER: 48,    // grab 20 + 2 wall bounces (10+10) + launch 8
    SWORDSMAN: 57,  // opener 6 + 7 dash slices (35) + finisher 16
    MAGE: 56,       // orb 6 + 10 payoff ticks (50)
    RANGER: 36,     // bomb 6 + blast 14 + execute 16
    DARK_RULER: 40, // the giant crescent slash (single hit)
    TELEPATH: 65,   // snare 3 + 8 vice ticks (40) + crush 22
    BEAST_TAMER: 66,// snare 4 + bind 6 + brute 18 + raven 14 + whip 24
    PHANTOM: 43     // claw 4 + seize 3 + void chips 12 + smash 24
};

// Ultimate voice lines (played when an ultimate is activated)
const ultVoices = {
    BRAWLER: new Audio('audio/voicelines/brawlerult.wav'),
    SWORDSMAN: new Audio('audio/voicelines/swordsmanult.wav'),
    MAGE: new Audio('audio/voicelines/mageult.wav'),
    RANGER: new Audio('audio/voicelines/rangerult.wav'),
    DARK_RULER: new Audio('audio/voicelines/darkrulerult.wav'),
    TELEPATH: new Audio('audio/voicelines/telepathult.wav'),
    BEAST_TAMER: new Audio('audio/voicelines/beasttamerult.wav'),
    PHANTOM: new Audio('audio/voicelines/phantomult.wav'),
    COPYCAT: new Audio('audio/voicelines/copycatult.wav')
};
Object.values(ultVoices).forEach(a => { a.preload = 'auto'; a.volume = 0.9; });
function playUltVoice(type) {
    let a = ultVoices[type];
    if (a) { try { a.currentTime = 0; a.play(); } catch (e) {} }
}

// --- BACKGROUND MUSIC ---
function makeMusic(path, volume = 0.45) {
    let a = new Audio(path);
    a.loop = true;
    a.preload = 'auto';
    a.volume = volume;
    return a;
}
const music = {
    menu: makeMusic('audio/music/Tournamid.wav'),
    stages: {
        dojo: makeMusic('audio/music/Tournamid - Basic Arena.wav'),
        moonBridge: makeMusic('audio/music/Tournamid - Moon Bridge.wav'),
        bloodBall: makeMusic('audio/music/Tournamid - Blood Ball.wav'),
        pStreet: makeMusic('audio/music/Tournamid - P Street.wav'),
        championsArena: makeMusic('audio/music/Tournamid - Champions Arena.wav'),
        livingGraveyard: makeMusic('audio/music/Tournamid - Living Graveyard.wav'),
        darkCastle: makeMusic('audio/music/Tournamid - Dark Castle.wav')
    },
    fallbackStages: ['dojo', 'moonBridge', 'bloodBall', 'pStreet'],
    fallbackPick: null,
    current: null,
    ready: false,
    init() {
        this.ready = true;
    },
    stageTrack() {
        if (this.stages[selectedStage]) {
            this.fallbackPick = null;
            return this.stages[selectedStage];
        }
        if (!this.fallbackPick) {
            this.fallbackPick = this.fallbackStages[Math.floor(Math.random() * this.fallbackStages.length)];
        }
        return this.stages[this.fallbackPick] || this.stages.dojo;
    },
    play(which) {
        if (!this.ready) this.init();
        let next = which === 'fight' ? this.stageTrack() : this.menu;
        if (this.current === next) return;
        if (this.current) { try { this.current.pause(); this.current.currentTime = 0; } catch (e) {} }
        this.current = next;
        try { next.currentTime = 0; next.play(); } catch (e) {}
    },
    resetFightPick() { this.fallbackPick = null; },
    stop() { if (this.current) { try { this.current.pause(); } catch (e) {} this.current = null; } }
};
// Browsers block autoplay until a user gesture — start the right track on first input
let _musicKick = false;
function kickMusic() {
    if (_musicKick) return; _musicKick = true;
    music.play(gameState === 'PLAYING' ? 'fight' : 'menu');
}
window.addEventListener('pointerdown', kickMusic);
window.addEventListener('keydown', kickMusic);
const overkillVoice = new Audio('audio/voicelines/overkill.wav');
overkillVoice.preload = 'auto';
overkillVoice.volume = 1.0;
function playOverkillVoice() {
    try { overkillVoice.currentTime = 0; overkillVoice.play(); } catch (e) {}
}
function makeAudio(path, volume = 0.9, voices = 1) {
    let pool = [];
    for (let i = 0; i < voices; i++) {
        let a = new Audio(path);
        a.preload = 'auto';
        a.volume = volume;
        pool.push(a);
    }
    return voices === 1 ? pool[0] : { pool, cursor: 0 };
}
// A pool of DIFFERENT files, cycled in order (for varied attack sounds)
function makeAudioSet(paths, volume = 0.9) {
    let pool = paths.map(p => { let a = new Audio(p); a.preload = 'auto'; a.volume = volume; return a; });
    return { pool, cursor: 0 };
}
function playAudio(a) {
    if (suppressRollbackEffects) return;
    if (!a) return;
    if (a.pool) {
        let voice = a.pool[a.cursor];
        a.cursor = (a.cursor + 1) % a.pool.length;
        try { voice.currentTime = 0; voice.play(); } catch (e) {}
        return;
    }
    try { a.currentTime = 0; a.play(); } catch (e) {}
}
const attackSfx = {
    punch: makeAudio('audio/sfx/punch.wav', 0.68, 3),
    kick: makeAudio('audio/sfx/kick.wav', 0.68, 3),
    knife: makeAudio('audio/sfx/knife.wav', 0.68, 3),
    sword: makeAudio('audio/sfx/sword.wav', 0.68, 3),
    shot: makeAudio('audio/sfx/shot.wav', 0.64, 3),
    magic: makeAudio('audio/sfx/magichit.wav', 0.64, 3),
    fire: makeAudio('audio/sfx/firespell.wav', 0.66, 3),
    ice: makeAudio('audio/sfx/icespell.wav', 0.66, 3),
    lightning: makeAudio('audio/sfx/lightningspell.wav', 0.66, 3),
    block: makeAudio('audio/sfx/block.wav', 0.6, 3),
    tele: makeAudioSet(['audio/sfx/telehit1.wav', 'audio/sfx/telehit2.wav', 'audio/sfx/telehit3.wav'], 0.7), // Telepath
    snake: makeAudio('audio/sfx/snake.wav', 0.68, 3),
    raven: makeAudio('audio/sfx/raven.wav', 0.68, 3),
    brute: makeAudioSet(['audio/sfx/brute1.wav', 'audio/sfx/brute2.wav'], 0.72),
    beastSwitch: makeAudio('audio/sfx/switch.wav', 0.66, 3),
    phantomHit: makeAudio('audio/sfx/phantomhit.wav', 0.7, 3), // Phantom special connects
    soulTrain: makeAudio('audio/sfx/soultrain.wav', 0.85, 2),  // Soul Train ultimate
    piano: makeAudio('audio/sfx/Piano.wav', 0.8, 2)            // Copy Cat's Piano Drop impact
};
// Copy Cat's Piano Drop sprite
const pianoImg = new Image();
pianoImg.src = 'textures/piano.png';
const selectVoices = {
    BRAWLER: makeAudio('audio/voicelines/brawler.wav', 0.92),
    SWORDSMAN: makeAudio('audio/voicelines/swordsman.wav', 0.92),
    MAGE: makeAudio('audio/voicelines/mage.wav', 0.92),
    RANGER: makeAudio('audio/voicelines/ranger.wav', 0.92),
    DARK_RULER: makeAudio('audio/voicelines/darkruler.wav', 0.92),
    TELEPATH: makeAudio('audio/voicelines/telepath.wav', 0.92),
    BEAST_TAMER: makeAudio('audio/voicelines/beasttamer.wav', 0.92),
    PHANTOM: makeAudio('audio/voicelines/phantom.wav', 0.92),
    COPYCAT: makeAudio('audio/voicelines/copycat.wav', 0.92)
};
const winVoices = {
    BRAWLER: makeAudio('audio/voicelines/brawlerwin.wav', 0.95),
    SWORDSMAN: makeAudio('audio/voicelines/swordsmanwin.wav', 0.95),
    MAGE: makeAudio('audio/voicelines/magewin.wav', 0.95),
    RANGER: makeAudio('audio/voicelines/rangerwin.wav', 0.95),
    DARK_RULER: makeAudio('audio/voicelines/darkrulerwin.wav', 0.95),
    TELEPATH: makeAudio('audio/voicelines/telepathwin.wav', 0.95),
    BEAST_TAMER: makeAudio('audio/voicelines/beasttamerwin.wav', 0.95),
    PHANTOM: makeAudio('audio/voicelines/phantomwin.wav', 0.95),
    COPYCAT: makeAudio('audio/voicelines/copycatwin.wav', 0.95)
};
const roundVoices = {
    ready: makeAudio('audio/voicelines/doesheknow.wav', 0.95),
    fight: makeAudio('audio/voicelines/fight.wav', 0.95),
    round2: makeAudio('audio/voicelines/round2.wav', 0.95),
    final: makeAudio('audio/voicelines/finalround.wav', 0.95)
};

// --- SETTINGS: per-category volume + custom key bindings (persisted) ---
let settings = { master: 1, music: 0.6, sfx: 0.85, voice: 0.9, touchControls: false, blood: true };
try { let s = JSON.parse(localStorage.getItem('massacreSettings')); if (s) Object.assign(settings, s); } catch (e) {}
function saveSettings() { try { localStorage.setItem('massacreSettings', JSON.stringify(settings)); } catch (e) {} }

const audioRegistry = [];
function registerAudio(a, cat) {
    if (!a) return;
    if (a.pool) a.pool.forEach(v => audioRegistry.push({ a: v, cat, base: v.volume }));
    else audioRegistry.push({ a, cat, base: a.volume });
}
function applyVolumes() {
    for (let e of audioRegistry) {
        let cat = settings[e.cat] != null ? settings[e.cat] : 1;
        e.a.volume = Math.max(0, Math.min(1, e.base * cat * settings.master));
    }
    // Procedural Tone.js SFX route through the master destination
    if (window.Tone && sfx.initialized) {
        try {
            let v = settings.master * settings.sfx;
            Tone.getDestination().volume.value = v > 0.001 ? 20 * Math.log10(v) : -60;
        } catch (e) {}
    }
}
// register every sound under its category
Object.values(attackSfx).forEach(a => registerAudio(a, 'sfx'));
[selectVoices, winVoices, roundVoices, ultVoices].forEach(coll => Object.values(coll).forEach(a => registerAudio(a, 'voice')));
registerAudio(overkillVoice, 'voice');
registerAudio(music.menu, 'music');
Object.values(music.stages).forEach(a => registerAudio(a, 'music'));
setTimeout(applyVolumes, 0); // defer so the Tone `sfx` object exists when first applied

const DEFAULT_BINDINGS = {
    P1: { l: 'KeyA', r: 'KeyD', u: 'KeyW', d: 'KeyS', block: 'KeyI', atkL: 'KeyJ', atkH: 'KeyK', special: 'KeyL', ult: 'KeyO', tag: 'KeyU' },
    P2: { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown', block: 'KeyU', atkL: 'KeyO', atkH: 'KeyP', special: 'Slash', ult: 'Period', tag: 'Backslash' }
};
let keyBindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
try { let b = JSON.parse(localStorage.getItem('massacreBindings')); if (b && b.P1 && b.P2) keyBindings = b; } catch (e) {}
function saveBindings() { try { localStorage.setItem('massacreBindings', JSON.stringify(keyBindings)); } catch (e) {} }
let introSequence = null; // { phase, t, text, done, fightPlayed }
function beginIntroSequence(kind = 'round1') {
    if (currentMode === 'TRAINING') {
        introSequence = null;
        return;
    }
    introSequence = { kind, phase: 'ready', t: 0, text: '', done: false, playedReady: false, playedFight: false };
}
let charSelectPreview = {
    p1: null,
    p2: null,
    p1Burst: 0,
    p2Burst: 0,
    timer: 0
};

const STAGES = {
    dojo: { name: 'Original' },
    moonBridge: { name: 'Moon Bridge' },
    platform: { name: 'Sky Platform' },
    pStreet: { name: 'P Street' },
    bloodBall: { name: 'Blood Ball' },
    championsArena: { name: "Champions Arena" },
    livingGraveyard: { name: 'Living Graveyard' },
    darkCastle: { name: "Dark King's Castle" }
};

// Ladder mode progression + animated stage background actors (set up in engine/ui)
let ladder = { queue: [], partners: [], index: 0, active: false }; // partners[i] = the rung's tag partner (LADDER2 only)
let ladderView = null; // canvas ladder-climb screen animation state
let stageActors = null;

// 2v2 tag-team battles (modes VS2 / LADDER2). `players` holds the two ACTIVE fighters
// on the field; `teams` holds each side's full roster of two, `activeIdx` who is in.
let teamBattle = false;
let teams = [[], []];
let activeIdx = [0, 0];
let playerTeam = [];   // the two characters the player picked for their squad
let opponentTeam = []; // the two characters picked for the opposing local/CPU-watch squad
let pendingTag = [0, 0]; // brief pause-then-tag-in timer per side after a KO

// --- STAGE GEOMETRY ---
// Each stage describes the surfaces fighters collide with:
//   main       : the primary floor { left, right, top } (solid within its span)
//   platforms  : one-way platforms you land on from above and can fall off the sides
//   ringOut    : if true, falling off the map below the death plane is a loss
// Offsets are kept as fractions of width/height so the same layout renders
// correctly both in the 1024x576 arena and in the small stage-select thumbnails.
function stagePlatformLayout(w, gy, h) {
    return {
        ringOut: true,
        main: { left: w * 0.22, right: w * 0.78, top: gy },
        platforms: [
            { left: w * 0.40, right: w * 0.60, top: gy - h * 0.30 },   // center high platform
            { left: w * 0.03, right: w * 0.17, top: gy - h * 0.20 },   // left floating ledge
            { left: w * 0.83, right: w * 0.97, top: gy - h * 0.20 }    // right floating ledge
        ]
    };
}
function stageGeometry(stageId, w, gy, h) {
    if (stageId === 'platform') return stagePlatformLayout(w, gy, h);
    // Default stages: one solid full-width floor, no ring-out
    return { ringOut: false, main: { left: 0, right: w, top: gy }, platforms: [] };
}
let _geoCache = {};
function getStageGeo() {
    if (!_geoCache[selectedStage]) _geoCache[selectedStage] = stageGeometry(selectedStage, WIDTH, GROUND_Y, HEIGHT);
    return _geoCache[selectedStage];
}

// Audio Setup using Tone.js
const sfx = {
    initialized: false,
    nextEventTime: {},
    init: async function() {
        if(this.initialized) return;
        await Tone.start();
        
        // Short white noise for hits
        this.hitSynth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).toDestination();
        this.hitSynth.volume.value = -10;

        // Sweeping noise for swings/whooshes
        this.swingSynth = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0 } }).toDestination();
        this.swingSynth.volume.value = -15;

        // Sharp percussive synth for guns
        this.gunSynth = new Tone.MembraneSynth({ pitchDecay: 0.01, oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination();
        this.gunSynth.volume.value = -12;

        // Magical chime
        this.magicSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0 } }).toDestination();
        this.magicSynth.volume.value = -10;

        // Deep thud for deaths
        this.deathSynth = new Tone.MembraneSynth({ pitchDecay: 0.2, oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.8, sustain: 0 } }).toDestination();
        this.deathSynth.volume.value = -5;

        this.initialized = true;
        applyVolumes(); // route the procedural SFX through the saved volume settings
    },
    getEventTime: function(name, gap = 0.03) {
        let now = Tone.now() + 0.001;
        let scheduled = Math.max(now, (this.nextEventTime[name] || 0) + gap);
        this.nextEventTime[name] = scheduled;
        return scheduled;
    },
    playHit: function() { if(!suppressRollbackEffects && this.initialized) this.hitSynth.triggerAttackRelease("16n", this.getEventTime('hit', 0.025)); },
    playSwing: function() { if(!suppressRollbackEffects && this.initialized) this.swingSynth.triggerAttackRelease("16n", this.getEventTime('swing', 0.08)); },
    playGun: function() { if(!suppressRollbackEffects && this.initialized) this.gunSynth.triggerAttackRelease("C2", "16n", this.getEventTime('gun', 0.025)); },
    playMagic: function() { if(!suppressRollbackEffects && this.initialized) this.magicSynth.triggerAttackRelease("C5", "8n", this.getEventTime('magic', 0.025)); },
    playDeath: function() { if(!suppressRollbackEffects && this.initialized) this.deathSynth.triggerAttackRelease("C1", "4n", this.getEventTime('death', 0.025)); },
};

// Input Management
const keys = {};
const previousKeys = {};
function keyPressed(code) {
    return keys[code] && !previousKeys[code];
}
window.addEventListener('keydown', e => { 
    keys[e.code] = true; 
    if (e.code === 'Escape') {
        e.preventDefault();
        handleEscape();
    }
    // Prevent default scrolling for game keys
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Slash'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => keys[e.code] = false);

function createAttackVariant(fighter, variant) {
    const baseLight = fighter.attacks.light;
    const baseHeavy = fighter.attacks.heavy || baseLight;
    const comboScale = fighter.charType === 'SWORDSMAN' ? 1.12 : fighter.charType === 'MAGE' ? 0.92 : fighter.charType === 'RANGER' ? 1.0 : 1.18;
    const melee = (source, overrides) => ({ ...source, isProj: false, pSpeed: undefined, pLife: undefined, ...overrides });

    const variants = {
        airLight: melee(baseLight, { startup: 0.08, active: 0.14, recovery: 0.22, dmg: 6, w: 48, h: 42, ox: 18, oy: -58, kb: {x: 120, y: 80}, stun: 0.22, type: 'airLight' }),
        airHeavy: melee(baseHeavy, { startup: 0.18, active: 0.18, recovery: 0.34, dmg: 12, w: 62, h: 52, ox: 22, oy: -52, kb: {x: 180, y: 220}, stun: 0.38, type: 'airHeavy' }),
        lowLight: melee(baseLight, { startup: 0.08, active: 0.12, recovery: 0.18, dmg: 5, w: 52, h: 18, ox: 16, oy: -24, kb: {x: 90, y: 20}, stun: 0.22, type: 'lowLight' }),
        lowHeavy: melee(baseHeavy, { startup: 0.2, active: 0.18, recovery: 0.32, dmg: 11, w: 74, h: 22, ox: 18, oy: -22, kb: {x: 210, y: -80}, stun: 0.38, type: 'lowHeavy' }),
        comboLLL: melee(baseLight, { startup: 0.08, active: 0.18, recovery: 0.28, dmg: Math.round(10 * comboScale), w: 70, h: 34, ox: 22, oy: -54, kb: {x: 290, y: -120}, stun: 0.42, type: 'comboLLL', combo: 'LLL' }),
        comboLLH: melee(baseHeavy, { startup: 0.14, active: 0.2, recovery: 0.34, dmg: Math.round(13 * comboScale), w: 66, h: 62, ox: 18, oy: -70, kb: {x: 170, y: -520}, stun: 0.5, type: 'comboLLH', combo: 'LLH' }),
        comboLH: melee(baseHeavy, { startup: 0.12, active: 0.17, recovery: 0.28, dmg: Math.round(9 * comboScale), w: 66, h: 34, ox: 22, oy: -48, kb: {x: 240, y: -80}, stun: 0.34, type: 'comboLH', combo: 'LH' }),
        comboLHL: melee(baseLight, { startup: 0.1, active: 0.18, recovery: 0.3, dmg: Math.round(12 * comboScale), w: 82, h: 24, ox: 18, oy: -30, kb: {x: 260, y: -220}, stun: 0.46, type: 'comboLHL', combo: 'LHL' }),
        comboHLL: melee(baseHeavy, { startup: 0.13, active: 0.2, recovery: 0.34, dmg: Math.round(14 * comboScale), w: 58, h: 54, ox: 20, oy: -58, kb: {x: 330, y: -180}, stun: 0.5, type: 'comboHLL', combo: 'HLL' })
    };

    if (fighter.charType === 'MAGE' && variant.startsWith('combo')) {
        variants[variant].w += 12;
        variants[variant].h += 8;
        variants[variant].type = variant;
    }
    if (fighter.charType === 'RANGER' && variant === 'airHeavy') {
        variants[variant].w = 78;
        variants[variant].kb = {x: 260, y: 180};
    }

    return variants[variant] ? { ...variants[variant], name: variant } : null;
}

// --- CHARACTER DATA DICTIONARY ---
const CHARACTERS = {
    BRAWLER: {
        name: "THE BRAWLER", hp: 120, speed: 300, jump: -600, width: 40, height: 90,
        attacks: {
            light: { startup: 0.1, active: 0.15, recovery: 0.2, dmg: 5, w: 45, h: 20, ox: 20, oy: -60, kb: {x: 150, y: -100}, stun: 0.3 },
            heavy: { startup: 0.3, active: 0.2, recovery: 0.3, dmg: 12, w: 55, h: 30, ox: 20, oy: -40, kb: {x: 350, y: -200}, stun: 0.5 },
            specNeutral: { startup: 0.28, active: 0.12, recovery: 0.32, dmg: 18, w: 56, h: 42, ox: 26, oy: -58, kb: {x: 440, y: -160}, stun: 0.55, type: 'haymaker', armor: true }, // Haymaker (armored charge punch)
            specSide: { startup: 0.14, active: 0.24, recovery: 0.3, dmg: 12, w: 52, h: 62, ox: 22, oy: -55, kb: {x: 300, y: -120}, stun: 0.42, type: 'shoulderRush', armor: true }, // Shoulder Rush (armored tackle)
            specUp: { startup: 0.16, active: 0.34, recovery: 0.3, dmg: 15, w: 52, h: 84, ox: 12, oy: -92, kb: {x: 120, y: -660}, stun: 0.6, type: 'uppercut' }, // Power Uppercut
            specDown: { startup: 0.34, active: 0.2, recovery: 0.45, dmg: 20, w: 165, h: 32, ox: 0, oy: -15, kb: {x: 220, y: -420}, stun: 0.6, type: 'groundSlam' } // Ground Breaker
        }
    },
    SWORDSMAN: {
        name: "THE SWORDSMAN", hp: 90, speed: 350, jump: -550, width: 35, height: 90,
        attacks: {
            light: { startup: 0.1, active: 0.1, recovery: 0.15, dmg: 4, w: 60, h: 15, ox: 25, oy: -50, kb: {x: 100, y: -50}, stun: 0.25 },
            heavy: { startup: 0.25, active: 0.15, recovery: 0.25, dmg: 10, w: 80, h: 20, ox: 30, oy: -55, kb: {x: 250, y: -100}, stun: 0.4 },
            specNeutral: { startup: 0.22, active: 0.1, recovery: 0.3, dmg: 12, isProj: true, pSpeed: 750, pLife: 0.7, w: 46, h: 34, oy: -55, kb: {x: 240, y: -120}, stun: 0.4, type: 'vacuumSlash' }, // Iai Draw (vacuum blade)
            specSide: { startup: 0.15, active: 0.3, recovery: 0.2, dmg: 12, w: 60, h: 40, ox: 10, oy: -50, kb: {x: 220, y: -100}, stun: 0.4, type: 'dashSlash' }, // Flash Slash
            specUp: { startup: 0.12, active: 0.24, recovery: 0.28, dmg: 11, w: 52, h: 82, ox: 16, oy: -92, kb: {x: 150, y: -560}, stun: 0.5, type: 'risingSlash' }, // Rising Crescent
            specDown: { startup: 0.05, active: 0.4, recovery: 0.3, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x:0, y:0}, stun: 0, type: 'parry' } // Perfect Parry
        }
    },
    MAGE: {
        name: "THE MAGE", hp: 80, speed: 200, jump: -500, width: 30, height: 85,
        attacks: {
            light: { startup: 0.2, active: 0.1, recovery: 0.2, dmg: 4, isProj: true, pSpeed: 600, pLife: 1.0, w: 15, h: 15, oy: -55, kb: {x: 100, y: -50}, stun: 0.2 },
            heavy: { startup: 0.4, active: 0.1, recovery: 0.4, dmg: 12, isProj: true, pSpeed: 300, pLife: 2.0, w: 30, h: 30, oy: -55, kb: {x: 200, y: -150}, stun: 0.5 },
            specNeutral: { startup: 0.25, active: 0.1, recovery: 0.3, dmg: 8, isProj: true, pSpeed: 450, pLife: 2.2, w: 20, h: 20, oy: -55, kb: {x: 150, y: -100}, stun: 0.35, type: 'chaosBolt' }, // Chaos Bolt (random projectile)
            specSide: { startup: 0.2, active: 0.2, recovery: 0.35, dmg: 10, oy: -55, kb: {x: 200, y: -90}, stun: 0.35, type: 'arcaneRoulette' }, // Arcane Roulette (random horizontal spell)
            specUp: { startup: 0.08, active: 0.05, recovery: 0.28, dmg: 0, w: 0, h: 0, kb: {x: 0, y: 0}, stun: 0, type: 'blink' }, // Blink (teleport + RNG kicker)
            specDown: { startup: 0.3, active: 0.1, recovery: 0.4, dmg: 12, isProj: true, pSpeed: 0, pLife: 6.0, w: 40, h: 20, ox: 130, oy: -10, kb: {x: 100, y: -300}, stun: 0.5, type: 'runeTrap' } // Rune Trap (random ground rune)
        }
    },
    RANGER: {
        name: "THE RANGER", hp: 100, speed: 300, jump: -550, width: 35, height: 90,
        attacks: {
            light: { startup: 0.1, active: 0.1, recovery: 0.15, dmg: 5, w: 40, h: 30, ox: 20, oy: -50, kb: {x: 120, y: -80}, stun: 0.25 }, // Knife
            heavy: { startup: 0.2, active: 0.1, recovery: 0.3, dmg: 8, isProj: true, pSpeed: 1200, pLife: 0.8, w: 10, h: 5, oy: -60, kb: {x: 150, y: -50}, stun: 0.3 }, // Gun
            specNeutral: { startup: 0.18, active: 0.34, recovery: 0.32, dmg: 2, type: 'quickDraw', isProj: true, pSpeed: 1000, pLife: 0.6, w: 8, h: 4, oy: -60, kb: {x: 40, y: -15}, stun: 0.12 }, // Quickdraw (exactly 3 light shots)
            specSide: { startup: 0.1, active: 0.3, recovery: 0.2, dmg: 10, w: 50, h: 40, ox: 20, oy: -50, kb: {x: 250, y: -200}, stun: 0.4, type: 'knifeRush' }, // Knife Rush
            specUp: { startup: 0.1, active: 0.2, recovery: 0.34, dmg: 8, w: 44, h: 52, ox: 0, oy: -8, kb: {x: 80, y: -200}, stun: 0.3, type: 'updraftShot' }, // Updraft Shot (recovery + blast below)
            specDown: { startup: 0.05, active: 0.3, recovery: 0.16, dmg: 0, w: 0, h: 0, kb: {x: 0, y: 0}, stun: 0, type: 'combatRoll' } // Combat Roll (dodge + Tactical Reload)
        }
    },
    DARK_RULER: {
        name: "THE DARK RULER", hp: 145, speed: 215, jump: -560, width: 44, height: 96,
        attacks: {
            light: { startup: 0.14, active: 0.12, recovery: 0.22, dmg: 7, w: 66, h: 30, ox: 30, oy: -56, kb: {x: 180, y: -70}, stun: 0.3 }, // big sword swing
            heavy: { startup: 0.32, active: 0.18, recovery: 0.34, dmg: 16, w: 92, h: 56, ox: 32, oy: -60, kb: {x: 330, y: -230}, stun: 0.5 }, // overhead cleave
            specNeutral: { startup: 0.26, active: 0.1, recovery: 0.32, dmg: 11, isProj: true, pSpeed: 380, pLife: 2.2, w: 28, h: 28, oy: -58, kb: {x: 190, y: -120}, stun: 0.4, type: 'darkBolt' }, // Dark Bolt
            specSide: { startup: 0.18, active: 0.16, recovery: 0.42, dmg: 19, w: 58, h: 74, ox: 32, oy: -62, kb: {x: 160, y: -360}, stun: 0.7, type: 'abyssalGrab', grab: true }, // Abyssal Grab (unblockable command grab)
            specUp: { startup: 0.14, active: 0.26, recovery: 0.3, dmg: 13, w: 58, h: 92, ox: 16, oy: -100, kb: {x: 130, y: -620}, stun: 0.5, type: 'risingEdge' }, // Rising Edge (dark launcher)
            specDown: { startup: 0.3, active: 0.2, recovery: 0.44, dmg: 18, w: 180, h: 42, ox: 0, oy: -16, kb: {x: 250, y: -380}, stun: 0.55, type: 'darkNova' } // Dark Nova (shockwave)
        }
    },
    TELEPATH: {
        name: "THE TELEPATH", hp: 95, speed: 270, jump: -720, width: 32, height: 88,
        attacks: {
            light: { startup: 0.09, active: 0.1, recovery: 0.16, dmg: 5, w: 52, h: 28, ox: 32, oy: -56, kb: {x: 120, y: -60}, stun: 0.25, type: 'psiJab' }, // telekinetic palm
            heavy: { startup: 0.2, active: 0.14, recovery: 0.28, dmg: 11, w: 76, h: 44, ox: 42, oy: -54, kb: {x: 240, y: -120}, stun: 0.4, type: 'psyBlade' }, // disjoint psy-blade
            specNeutral: { startup: 0.06, active: 0.34, recovery: 0.24, dmg: 3, w: 42, h: 86, ox: 22, oy: -82, kb: {x: 140, y: -40}, stun: 0.25, type: 'psiBarrier' }, // Psi Barrier (reflect)
            specSide: { startup: 0.16, active: 0.1, recovery: 0.36, dmg: 6, isProj: true, pSpeed: 1150, pLife: 0.5, w: 24, h: 24, oy: -55, kb: {x: -760, y: -150}, stun: 0.5, type: 'mindGrip' }, // Mind Grip (pull)
            specUp: { startup: 0.12, active: 0.22, recovery: 0.3, dmg: 10, w: 72, h: 90, ox: 6, oy: -100, kb: {x: 80, y: -640}, stun: 0.5, type: 'psiLift' }, // Psi Lift (launcher + altitude)
            specDown: { startup: 0.1, active: 0.22, recovery: 0.3, dmg: 12, w: 150, h: 48, ox: 0, oy: -18, kb: {x: 200, y: -240}, stun: 0.45, type: 'teleCrash' } // Telekinetic Crash (dive / sweep)
        }
    },
    BEAST_TAMER: {
        name: "THE BEAST TAMER", hp: 100, speed: 285, jump: -575, width: 36, height: 90,
        attacks: {
            light: { startup: 0.09, active: 0.11, recovery: 0.17, dmg: 5, w: 58, h: 24, ox: 26, oy: -55, kb: {x: 130, y: -70}, stun: 0.25, type: 'whipJab' },
            heavy: { startup: 0.22, active: 0.16, recovery: 0.3, dmg: 11, w: 84, h: 30, ox: 28, oy: -50, kb: {x: 250, y: -140}, stun: 0.42, type: 'whipCrack' },
            specNeutral: { startup: 0.1, active: 0.08, recovery: 0.24, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'beastSwitch' },
            specSide: { startup: 0.14, active: 0.16, recovery: 0.3, dmg: 8, w: 48, h: 30, ox: 24, oy: -50, kb: {x: 220, y: -100}, stun: 0.35, type: 'beastSide' },
            specUp: { startup: 0.12, active: 0.18, recovery: 0.32, dmg: 8, w: 54, h: 76, ox: 8, oy: -92, kb: {x: 90, y: -520}, stun: 0.38, type: 'beastUp' },
            specDown: { startup: 0.18, active: 0.18, recovery: 0.34, dmg: 9, w: 90, h: 34, ox: 10, oy: -22, kb: {x: 180, y: -180}, stun: 0.4, type: 'beastDown' }
        }
    },
    PHANTOM: {
        name: "THE PHANTOM", hp: 112, speed: 250, jump: -560, width: 34, height: 92,
        attacks: {
            light: { startup: 0.1, active: 0.1, recovery: 0.2, dmg: 6, w: 66, h: 26, ox: 32, oy: -56, kb: {x: 120, y: -60}, stun: 0.26, type: 'mistClaw' },       // reaching mist swipe
            heavy: { startup: 0.24, active: 0.16, recovery: 0.32, dmg: 12, w: 96, h: 40, ox: 36, oy: -52, kb: {x: 240, y: -150}, stun: 0.45, type: 'scytheLash' },   // wide reaping lash
            specNeutral: { startup: 0.16, active: 0.18, recovery: 0.34, dmg: 8, w: 108, h: 28, ox: 44, oy: -58, kb: {x: 120, y: -80}, stun: 0.4, type: 'soulSiphon' }, // long claw, drains HP
            specSide: { startup: 0.22, active: 0.14, recovery: 0.4, dmg: 8, isProj: true, pSpeed: 540, pLife: 0.92, w: 30, h: 22, oy: -56, kb: {x: 0, y: 0}, stun: 0.55, type: 'graveDrag' }, // mist-chain that reels the foe in (blockable)
            specUp: { startup: 0.12, active: 0.2, recovery: 0.34, dmg: 11, w: 72, h: 96, ox: 8, oy: -104, kb: {x: 90, y: -600}, stun: 0.5, type: 'wraithRise' },       // rising anti-air grab + recovery
            specDown: { startup: 0.2, active: 0.16, recovery: 0.38, dmg: 7, w: 134, h: 40, ox: 30, oy: -20, kb: {x: 0, y: 0}, stun: 0.3, grab: true, type: 'graveGrasp' } // ground hands ROOT the foe in place (unblockable)
        }
    },
    COPYCAT: {
        name: "THE COPY CAT", hp: 88, speed: 360, jump: -580, width: 32, height: 88,
        attacks: {
            light: { startup: 0.08, active: 0.1, recovery: 0.14, dmg: 4, w: 46, h: 22, ox: 24, oy: -56, kb: {x: 120, y: -60}, stun: 0.22, type: 'catClaw' },   // quick scratch
            heavy: { startup: 0.18, active: 0.14, recovery: 0.26, dmg: 9, w: 60, h: 30, ox: 28, oy: -52, kb: {x: 240, y: -130}, stun: 0.4, type: 'catSlash' },   // raking double slash
            specNeutral: { startup: 0.14, active: 0.12, recovery: 0.26, dmg: 7, w: 60, h: 30, ox: 26, oy: -55, kb: {x: 180, y: -100}, stun: 0.35, type: 'copyClaw' }, // Copy — replays the last special used (default: claw)
            specSide: { startup: 0.14, active: 0.2, recovery: 0.34, dmg: 6, w: 54, h: 60, ox: 22, oy: -55, kb: {x: 0, y: 0}, stun: 0.3, type: 'catDash' },        // Cat Dash — lunge + pin & slash
            specUp: { startup: 0.16, active: 0.1, recovery: 0.42, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'pianoDrop' },                // Piano Drop — drops a piano on the foe
            specDown: { startup: 0.06, active: 0.1, recovery: 0.3, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'agility' }                 // Agility — counter mark
        }
    },
    ZOMBIE: {
        name: "THE HORDE", hp: 40, speed: 100, jump: -300, width: 35, height: 85,
        attacks: {
            light: { startup: 0.4, active: 0.2, recovery: 0.4, dmg: 4, w: 40, h: 20, ox: 15, oy: -50, kb: {x: 50, y: -20}, stun: 0.2 },
            heavy: { startup: 0.6, active: 0.3, recovery: 0.5, dmg: 8, w: 45, h: 30, ox: 20, oy: -40, kb: {x: 100, y: -50}, stun: 0.4 }
        }
    }
};
