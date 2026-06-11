/**
 * Tournamid - Core Engine & Logic
 */

// --- GLOBAL VARIABLES & SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = HEIGHT - 80;

// --- MOBILE SUPPORT: detect touch devices and scale the fixed 1024x576 stage to fit ---
const isMobileDevice = (() => {
    const ua = navigator.userAgent || navigator.vendor || '';
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)
        || (coarse && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
})();
// Scale the whole game container (canvas + all DOM overlays live inside it at a fixed
// 1024x576) so the internal coordinate system is untouched — only the presentation scales.
function fitGameToScreen() {
    const gc = document.getElementById('game-container');
    if (!gc) return;
    // visualViewport gives the TRUE visible area on iOS Safari (innerHeight lies while the
    // dynamic toolbar is showing, which mis-centred the game and cut off the bottom).
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    const fit = Math.min(vw / WIDTH, vh / HEIGHT);
    if (isMobileDevice) {
        // Phones are wider than 16:9, which left big black pillarbox bars. Fill the screen:
        // fit the height exactly, then stretch sideways (capped) to swallow the bars.
        const sx = Math.min(vw / WIDTH, fit * 1.5);
        gc.style.transform = 'scale(' + sx + ', ' + fit + ')';
    } else {
        const s = fit * 0.96; // desktop: fill the window, small margin so the border/glow isn't clipped
        gc.style.transform = 'scale(' + s + ', ' + s + ')';
    }
}
window.addEventListener('resize', fitGameToScreen);
window.addEventListener('orientationchange', () => setTimeout(fitGameToScreen, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitGameToScreen);
fitGameToScreen();
// iOS Safari zoom guards: double/triple-tap zoom is disabled via CSS touch-action:manipulation;
// these block the remaining routes (pinch gestures + double-click zoom on the page).
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

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

// The Cult — transient summoned-cultist visual actors and Consecrated Ground trap zones
const CULT_MASKS = 6;       // number of distinct cultist mask shapes
let cultSummons = [];
let consecrateZones = [];
let cultTraps = [];         // snare-traps planted by the Procession
let lumBeastFx = [];        // Lumatrossia's fire-breathing beast maws
let lumPortalFx = [];       // Lumatrossia's drop-portals (visual rings)
const LUM_DURATION = 13;    // seconds the Lumatrossia install lasts before the bar empties

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

const BLOCK_DUR = { BRAWLER: 110, SWORDSMAN: 65, MAGE: 45, RANGER: 78, DARK_RULER: 130, TELEPATH: 58, BEAST_TAMER: 72, PHANTOM: 118, COPYCAT: 60, CULT: 96, LUMATROSSIA: 999, TWINS: 84, TRAVELER: 62, ZOMBIE: 40 };
const ULT_LINES = {
    BRAWLER: "YOU'RE DEAD",
    SWORDSMAN: "OUTPLAYED.",
    MAGE: "HEY LOSER, CATCH!",
    RANGER: "DON'T BLINK",
    DARK_RULER: "KNEEL.",
    TELEPATH: "IDIOT",
    BEAST_TAMER: "ALPHA COMMAND.",
    PHANTOM: "SOUL TRAIN.",
    COPYCAT: "I can do anything better than you!",
    CULT: "RISE, LUMATROSSIA!",
    TWINS: "CAUGHT IN THE MIDDLE.",
    TRAVELER: "SAW THAT COMING."
};

// Which ultimate "kind" each character runs. The Copy Cat has none of its own —
// it copies the kind of whichever opponent's ultimate it survived (Nine Lives).
const ULT_KIND = {
    BRAWLER: 'counter', SWORDSMAN: 'arena', MAGE: 'orb', RANGER: 'bomb',
    DARK_RULER: 'darkslash', TELEPATH: 'mindbreak', BEAST_TAMER: 'beaststorm', PHANTOM: 'soultrain',
    TRAVELER: 'chronostop'
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
    PHANTOM: 43,    // claw 4 + seize 3 + void chips 12 + smash 24
    TWINS: 28,      // Eclipse — both twins collide on the centered foe
    TRAVELER: 40    // chronostop — 6 stored flurry hits (30) + the detonation finale 10
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
    COPYCAT: new Audio('audio/voicelines/copycatult.wav'),
    CULT: new Audio('audio/voicelines/cultult.wav'),
    TWINS: new Audio('audio/voicelines/twinsult.wav'),
    TRAVELER: new Audio('audio/voicelines/travelerult.wav')
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
    // Pitch wobble: marked sounds play at a slightly different rate every time so no
    // two hits sound identical (preservesPitch off so the rate change shifts the pitch).
    const applyPitch = el => {
        try {
            if (!a.pitchVar) { el.playbackRate = 1; return; }
            el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false;
            el.playbackRate = 1 - a.pitchVar / 2 + Math.random() * a.pitchVar;
        } catch (e) {}
    };
    if (a.pool) {
        let voice = a.pool[a.cursor];
        a.cursor = (a.cursor + 1) % a.pool.length;
        applyPitch(voice);
        try { voice.currentTime = 0; voice.play(); } catch (e) {}
        return;
    }
    applyPitch(a);
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
    piano: makeAudio('audio/sfx/Piano.wav', 0.8, 2),           // Copy Cat's Piano Drop impact
    timeHit: makeAudio('audio/sfx/timehit.wav', 0.72, 3)       // Traveler's specials connecting
};
// Every attack SFX gets a little random pitch wobble per play so repeats never sound identical
Object.values(attackSfx).forEach(a => { a.pitchVar = 0.18; });
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
    COPYCAT: makeAudio('audio/voicelines/copycat.wav', 0.92),
    CULT: makeAudio('audio/sfx/cult.wav', 0.92),
    TWINS: makeAudio('audio/voicelines/twins.wav', 0.92),
    TRAVELER: makeAudio('audio/voicelines/traveler.wav', 0.92)
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
    COPYCAT: makeAudio('audio/voicelines/copycatwin.wav', 0.95),
    CULT: makeAudio('audio/sfx/cultwin.wav', 0.95),
    TWINS: makeAudio('audio/voicelines/twinswin.wav', 0.95),
    TRAVELER: makeAudio('audio/voicelines/travelerwin.wav', 0.95)
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
// First-time mobile players get on-screen controls turned on by default (still toggleable in Settings)
if (isMobileDevice && !localStorage.getItem('massacreSettings')) settings.touchControls = true;
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
// ---------------- PRE-FIGHT ENTRANCES + DIALOGUE ----------------
let entranceSeq = null; // { phase, t, script, lineIdx, charIdx, ... } — walk-ons + typed banter before the announcer

// How each character arrives (drives movement + the entrance pose flourish)
const ENTRANCE_KIND = {
    BRAWLER: 'jog', SWORDSMAN: 'spinblade', MAGE: 'float', RANGER: 'roll',
    DARK_RULER: 'stride', TELEPATH: 'levitate', BEAST_TAMER: 'whip', PHANTOM: 'mist',
    COPYCAT: 'allfours', CULT: 'procession', TWINS: 'cartwheel', TRAVELER: 'stutter'
};

// Undertale-style speech blips — every character talks in their own synth voice
const BLIP_VOICE = {
    BRAWLER: { f: 150, w: 'square' },   SWORDSMAN: { f: 220, w: 'triangle' },
    MAGE: { f: 540, w: 'triangle' },    RANGER: { f: 260, w: 'square' },
    DARK_RULER: { f: 92, w: 'sawtooth' }, TELEPATH: { f: 620, w: 'sine' },
    BEAST_TAMER: { f: 190, w: 'square' }, PHANTOM: { f: 120, w: 'sine' },
    COPYCAT: { f: 450, w: 'triangle' }, CULT: { f: 70, w: 'sawtooth' },
    TWINS: { f: 330, w: 'triangle' },   TWINS_B: { f: 415, w: 'triangle' },
    TRAVELER: { f: 480, w: 'square' }
};

// Unique pre-fight exchange for EVERY matchup. Keyed by both charTypes sorted + '|'.
// Entries are [speaker, text]; 'P1'/'P2' = slot-based (mirrors), 'TWINS_B' = the second twin.
const INTRO_DIALOGUE = {
    'BRAWLER|SWORDSMAN': [['BRAWLER', "A sword? Cute. I brought two fists."], ['SWORDSMAN', "And I only need one cut."]],
    'BRAWLER|MAGE': [['MAGE', "Heads up, I have NO idea what this next spell does."], ['BRAWLER', "Great. Neither will your face."]],
    'BRAWLER|RANGER': [['RANGER', "Brawling's messy. Bullets are tidy."], ['BRAWLER', "Then catch me first, cowboy."]],
    'BRAWLER|DARK_RULER': [['DARK_RULER', "Kneel, peasant."], ['BRAWLER', "Sure, so your jaw's easier to reach."]],
    'BRAWLER|TELEPATH': [['TELEPATH', "You'll lead with the right. You always do."], ['BRAWLER', "Then dodge THIS left."]],
    'BEAST_TAMER|BRAWLER': [['BEAST_TAMER', "My beasts eat tough guys for breakfast."], ['BRAWLER', "Funny. I skip breakfast."]],
    'BRAWLER|PHANTOM': [['PHANTOM', "Your soul burns bright, boxer."], ['BRAWLER', "Touch it and lose the hand."]],
    'BRAWLER|COPYCAT': [['COPYCAT', "Teach me that haymaker! Actually, I'll just take it."], ['BRAWLER', "Get your own gloves."]],
    'BRAWLER|CULT': [['CULT', "Join us. The flock loves a strong arm."], ['BRAWLER', "I work alone. Mostly on faces."]],
    'BRAWLER|TWINS': [['TWINS', "He swings like a truck."], ['TWINS_B', "Good thing there's two of us."], ['BRAWLER', "Double the targets."]],
    'BRAWLER|TRAVELER': [['TRAVELER', "I've watched this fight twelve times. You drop in round one."], ['BRAWLER', "Then you ain't seen nothing yet."]],
    'BRAWLER|BRAWLER': [['P1', "Nice gloves."], ['P2', "Nice face. Shame about what's coming."]],

    'MAGE|SWORDSMAN': [['SWORDSMAN', "Magic is a crutch."], ['MAGE', "Says the guy holding a metal stick."]],
    'RANGER|SWORDSMAN': [['RANGER', "Blades lose to bullets, friend."], ['SWORDSMAN', "Not when the blade arrives first."]],
    'DARK_RULER|SWORDSMAN': [['SWORDSMAN', "Your blade is large. Your honor is not."], ['DARK_RULER', "Honor is for the kneeling."]],
    'SWORDSMAN|TELEPATH': [['TELEPATH', "Your next strike is already in my head."], ['SWORDSMAN', "Then my second will surprise you."]],
    'BEAST_TAMER|SWORDSMAN': [['BEAST_TAMER', "Sit, boy. The swordsman is mine."], ['SWORDSMAN', "Leash your pets or lose them."]],
    'PHANTOM|SWORDSMAN': [['PHANTOM', "Steel cannot cut mist."], ['SWORDSMAN', "We shall test that."]],
    'COPYCAT|SWORDSMAN': [['COPYCAT', "Ooh, the topknot! I'm SO stealing the topknot."], ['SWORDSMAN', "The blade comes with it."]],
    'CULT|SWORDSMAN': [['CULT', "Lumatrossia admires your discipline."], ['SWORDSMAN', "Your god will not catch my blade either."]],
    'SWORDSMAN|TWINS': [['TWINS', "One sword..."], ['TWINS_B', "...two of us. Math says we win."], ['SWORDSMAN', "I cut faster than you count."]],
    'SWORDSMAN|TRAVELER': [['TRAVELER', "Your iai draw, 0.3 seconds. I've timed it."], ['SWORDSMAN', "Then you know you cannot block it."]],
    'SWORDSMAN|SWORDSMAN': [['P1', "Your form is sloppy."], ['P2', "Your grave is ready."]],

    'MAGE|RANGER': [['RANGER', "Pick a spell and stick with it."], ['MAGE', "Where's the FUN in that?"]],
    'DARK_RULER|MAGE': [['DARK_RULER', "Parlor tricks, before a king?"], ['MAGE', "Wanna see the one where the king explodes?"]],
    'MAGE|TELEPATH': [['TELEPATH', "Your mind is... chaos. Literal chaos."], ['MAGE', "Thank you!!"]],
    'BEAST_TAMER|MAGE': [['MAGE', "Can I turn one of them into a newt? Pleeease?"], ['BEAST_TAMER', "Touch them and become the chew toy."]],
    'MAGE|PHANTOM': [['PHANTOM', "Even wizards have souls to take."], ['MAGE', "Mine's full of glitter. You don't want it."]],
    'COPYCAT|MAGE': [['COPYCAT', "Random spells? I can do random BETTER."], ['MAGE', "Nobody out-randoms me. I think. Maybe."]],
    'CULT|MAGE': [['CULT', "Chaos is just faith without direction."], ['MAGE', "Deep! Anyway, fireball."]],
    'MAGE|TWINS': [['TWINS', "Which of us do you aim at?"], ['TWINS_B', "Spoiler: you'll miss both."], ['MAGE', "Good thing my spells aim themselves. Sometimes."]],
    'MAGE|TRAVELER': [['TRAVELER', "Even I can't predict your spells. It's infuriating."], ['MAGE', "Best compliment EVER."]],
    'MAGE|MAGE': [['P1', "Copycat!"], ['P2', "YOU'RE the copycat! Wait, no..."]],

    'DARK_RULER|RANGER': [['DARK_RULER', "Guns. How dishonorable."], ['RANGER', "Says the man with a magic sword."]],
    'RANGER|TELEPATH': [['TELEPATH', "You'll reach for the knife when the gun jams."], ['RANGER', "Then I'll make sure it doesn't."]],
    'BEAST_TAMER|RANGER': [['RANGER', "I've bagged bigger beasts than yours."], ['BEAST_TAMER', "Not ones that hunt back."]],
    'PHANTOM|RANGER': [['PHANTOM', "Bullets pass right through me."], ['RANGER', "Good thing I pack knives too."]],
    'COPYCAT|RANGER': [['COPYCAT', "Pew pew! See? I'm you already."], ['RANGER', "You're missing the part where you hit."]],
    'CULT|RANGER': [['CULT', "Every shot you fire, Lumatrossia hears."], ['RANGER', "Then he knows I don't miss."]],
    'RANGER|TWINS': [['TWINS', "Six bullets..."], ['TWINS_B', "...two of us. Do the math."], ['RANGER', "Three each. Generous."]],
    'RANGER|TRAVELER': [['TRAVELER', "You draw in point-two seconds. I dodge in point-one."], ['RANGER', "Clocks lie."]],
    'RANGER|RANGER': [['P1', "Nice aim."], ['P2', "We'll see whose is nicer."]],

    'DARK_RULER|TELEPATH': [['TELEPATH', "Your crown is heavy with fear."], ['DARK_RULER', "And your skull is light with hope."]],
    'BEAST_TAMER|DARK_RULER': [['DARK_RULER', "I'll add your beasts to my menagerie."], ['BEAST_TAMER', "They don't kneel either."]],
    'DARK_RULER|PHANTOM': [['PHANTOM', "Kings die. I collect what's left."], ['DARK_RULER', "This king collects ghosts."]],
    'COPYCAT|DARK_RULER': [['COPYCAT', "A crown! Gimme gimme gimme!"], ['DARK_RULER', "It comes with the burden. And the blade."]],
    'CULT|DARK_RULER': [['CULT', "Our god is older than your throne."], ['DARK_RULER', "Then he can watch it outlive you."]],
    'DARK_RULER|TWINS': [['TWINS', "One throne..."], ['TWINS_B', "...two heirs?"], ['DARK_RULER', "Two graves."]],
    'DARK_RULER|TRAVELER': [['TRAVELER', "Your reign ends in exactly four minutes."], ['DARK_RULER', "Time serves kings too, traveler."]],
    'DARK_RULER|DARK_RULER': [['P1', "Impostor."], ['P2', "Pretender."]],

    'BEAST_TAMER|TELEPATH': [['BEAST_TAMER', "Can you read THEIR minds too?"], ['TELEPATH', "Yes. They're hungry. Run."]],
    'PHANTOM|TELEPATH': [['TELEPATH', "Your mind is empty. Just... a train whistle."], ['PHANTOM', "All aboard."]],
    'COPYCAT|TELEPATH': [['COPYCAT', "Think of a number! I'll copy it!"], ['TELEPATH', "You're thinking of seven. Disappointing."]],
    'CULT|TELEPATH': [['CULT', "One mind in many bodies. Read THAT."], ['TELEPATH', "I did. You're all terrified."]],
    'TELEPATH|TWINS': [['TWINS', "Two minds!"], ['TWINS_B', "Twice the reading!"], ['TELEPATH', "Two copies of the same bad plan."]],
    'TELEPATH|TRAVELER': [['TRAVELER', "You see thoughts. I see endings."], ['TELEPATH', "Then you saw yours."]],
    'TELEPATH|TELEPATH': [['P1', "Stop reading me."], ['P2', "Stop thinking so loud."]],

    'BEAST_TAMER|PHANTOM': [['PHANTOM', "Beasts fear what they cannot bite."], ['BEAST_TAMER', "Mine bite everything."]],
    'BEAST_TAMER|COPYCAT': [['COPYCAT', "A kitty's gotta start somewhere, right?"], ['BEAST_TAMER', "Strays get adopted or eaten."]],
    'BEAST_TAMER|CULT': [['CULT', "Your beasts would make fine offerings."], ['BEAST_TAMER', "Say that closer to the snake."]],
    'BEAST_TAMER|TWINS': [['TWINS', "Three pets..."], ['TWINS_B', "...two of us. Unfair!"], ['BEAST_TAMER', "Four, counting me."]],
    'BEAST_TAMER|TRAVELER': [['TRAVELER', "The raven dives left. Always left."], ['BEAST_TAMER', "She heard that. Now it's right."]],
    'BEAST_TAMER|BEAST_TAMER': [['P1', "My pack's bigger."], ['P2', "Mine's hungrier."]],

    'COPYCAT|PHANTOM': [['COPYCAT', "Spooky! Teach me the floaty thing!"], ['PHANTOM', "Die first. Then we talk."]],
    'CULT|PHANTOM': [['CULT', "A ghost! Lumatrossia LOVES ghosts."], ['PHANTOM', "Your god rides my train like everyone else."]],
    'PHANTOM|TWINS': [['TWINS', "It's see-through!"], ['TWINS_B', "Hit it anyway!"], ['PHANTOM', "Two tickets. One train."]],
    'PHANTOM|TRAVELER': [['TRAVELER', "Death isn't on your schedule today, spirit."], ['PHANTOM', "Death IS the schedule."]],
    'PHANTOM|PHANTOM': [['P1', "This town's souls are mine."], ['P2', "We'll let the train decide."]],

    'COPYCAT|CULT': [['CULT', "The flock has room for a clever cat."], ['COPYCAT', "Hmm... I'd rather copy your god."]],
    'COPYCAT|TWINS': [['TWINS', "It's copying me!"], ['TWINS_B', "No, me!"], ['COPYCAT', "Both! I have two hands!"]],
    'COPYCAT|TRAVELER': [['TRAVELER', "Copy this fight all you want. The ending stays mine."], ['COPYCAT', "Then I'll copy the ending!"]],
    'COPYCAT|COPYCAT': [['P1', "Stop copying me!"], ['P2', "Stop copying ME!"]],

    'CULT|TWINS': [['TWINS', "A whole cult..."], ['TWINS_B', "...still only counts as one."], ['CULT', "We count as many."]],
    'CULT|TRAVELER': [['TRAVELER', "I've seen your god. He doesn't show up."], ['CULT', "He is already here, traveler."]],
    'CULT|CULT': [['P1', "OUR flock is the true flock."], ['P2', "Lumatrossia will judge."]],

    'TRAVELER|TWINS': [['TRAVELER', "Two of you, one of me. Still over in three minutes."], ['TWINS', "Funny..."], ['TWINS_B', "...we counted two."]],
    'TWINS|TWINS': [['P1', "Wait, which ones are us?"], ['P2', "Just hit the ones in orange."]],
    'TRAVELER|TRAVELER': [['P1', "I've seen this. I win."], ['P2', "Funny. So have I."]]
};

// Second exchange per matchup — each fight randomly picks between the two sets.
const INTRO_DIALOGUE_B = {
    'BRAWLER|SWORDSMAN': [['SWORDSMAN', "I'll give you one free swing."], ['BRAWLER', "Big mistake. I only need one."]],
    'BRAWLER|MAGE': [['BRAWLER', "No tricks, wizard. Just you and me."], ['MAGE', "Okay, but the tricks are coming anyway."]],
    'BRAWLER|RANGER': [['BRAWLER', "Guns? In a fistfight?"], ['RANGER', "It's only a fistfight if I miss."]],
    'BRAWLER|DARK_RULER': [['BRAWLER', "Nice crown. I'm gonna dent it."], ['DARK_RULER', "Many have tried. Their graves agree."]],
    'BRAWLER|TELEPATH': [['BRAWLER', "Stay outta my head."], ['TELEPATH', "Don't worry. There's barely anything to read."]],
    'BEAST_TAMER|BRAWLER': [['BRAWLER', "I've tussled with bears, y'know."], ['BEAST_TAMER', "Mine have friends."]],
    'BRAWLER|PHANTOM': [['BRAWLER', "Ghosts can't take a punch."], ['PHANTOM', "Punches can't take a soul."]],
    'BRAWLER|COPYCAT': [['BRAWLER', "Quit makin' my face!"], ['COPYCAT', "Quit makin' it so easy!"]],
    'BRAWLER|CULT': [['BRAWLER', "A whole club just to lose together?"], ['CULT', "The flock never loses alone."]],
    'BRAWLER|TWINS': [['BRAWLER', "I'll knock you into each other."], ['TWINS', "He's bluffing."], ['TWINS_B', "He's REALLY not."]],
    'BRAWLER|TRAVELER': [['BRAWLER', "Round one, huh? Let's rewrite that."], ['TRAVELER', "People always say that. Right before round one."]],
    'BRAWLER|BRAWLER': [['P1', "Southpaw?"], ['P2', "You'll find out the hard way."]],

    'MAGE|SWORDSMAN': [['MAGE', "Hold still while I randomize!"], ['SWORDSMAN', "A blade doesn't roll dice."]],
    'RANGER|SWORDSMAN': [['SWORDSMAN', "Holster it. Fight with honor."], ['RANGER', "Honor doesn't stop bullets."]],
    'DARK_RULER|SWORDSMAN': [['DARK_RULER', "Your little knife amuses me."], ['SWORDSMAN', "It will do more than that."]],
    'SWORDSMAN|TELEPATH': [['SWORDSMAN', "Read this."], ['TELEPATH', "...You shouldn't say such things in your head."]],
    'BEAST_TAMER|SWORDSMAN': [['SWORDSMAN', "I duel warriors, not zookeepers."], ['BEAST_TAMER', "Then today you learn a new trade."]],
    'PHANTOM|SWORDSMAN': [['SWORDSMAN', "Even spirits fall to a perfect cut."], ['PHANTOM', "Then show me perfection."]],
    'COPYCAT|SWORDSMAN': [['SWORDSMAN', "Mimic my stance and you mimic my mistakes."], ['COPYCAT', "Ooh, you ADMIT to mistakes?"]],
    'CULT|SWORDSMAN': [['SWORDSMAN', "Faith won't parry steel."], ['CULT', "Steel rusts. Faith doesn't."]],
    'SWORDSMAN|TWINS': [['SWORDSMAN', "Two of you. One stance between you."], ['TWINS', "Rude!"], ['TWINS_B', "Accurate. But rude!"]],
    'SWORDSMAN|TRAVELER': [['SWORDSMAN', "Foresight is not skill."], ['TRAVELER', "No, but it's SO convenient."]],
    'SWORDSMAN|SWORDSMAN': [['P1', "There can only be one blade."], ['P2', "Agreed. Mine."]],

    'MAGE|RANGER': [['MAGE', "Bet my next spell beats your next bullet!"], ['RANGER', "Loser buys dinner."]],
    'DARK_RULER|MAGE': [['MAGE', "Ooooh, your sword is SO dramatic."], ['DARK_RULER', "It has flattened louder fools."]],
    'MAGE|TELEPATH': [['MAGE', "Quick, what am I thinking?!"], ['TELEPATH', "Nothing. Genuinely nothing. Incredible."]],
    'BEAST_TAMER|MAGE': [['BEAST_TAMER', "Magic spooks the animals."], ['MAGE', "Magic spooks ME and I still use it!"]],
    'MAGE|PHANTOM': [['MAGE', "Do the spooky train noise! Pleeease?"], ['PHANTOM', "You will hear it soon enough."]],
    'COPYCAT|MAGE': [['MAGE', "If you copy my spells, do they still explode randomly?"], ['COPYCAT', "Let's BOTH find out!"]],
    'CULT|MAGE': [['MAGE', "Is the robe club taking applications?"], ['CULT', "All are welcome. Few remain."]],
    'MAGE|TWINS': [['MAGE', "Double trouble! Literally my favorite spell!"], ['TWINS', "We're not a spell."], ['TWINS_B', "Probably."]],
    'MAGE|TRAVELER': [['MAGE', "Surprise me, future boy!"], ['TRAVELER', "I can't. But you always surprise me."]],
    'MAGE|MAGE': [['P1', "My chaos is more chaotic."], ['P2', "That's not even measurable! ...Mine is though."]],

    'DARK_RULER|RANGER': [['RANGER', "Kings bleed like everyone else."], ['DARK_RULER', "Come learn what kings do to hunters."]],
    'RANGER|TELEPATH': [['RANGER', "Get outta my head, lady."], ['TELEPATH', "Then stop planning so loudly."]],
    'BEAST_TAMER|RANGER': [['BEAST_TAMER', "Lay one trap and the brute eats you."], ['RANGER', "He can try. I season my traps."]],
    'PHANTOM|RANGER': [['RANGER', "I've shot at shadows before."], ['PHANTOM', "Did the shadows shoot back?"]],
    'COPYCAT|RANGER': [['RANGER', "Copy the hat all you want. The aim's mine."], ['COPYCAT', "The hat IS the aim!"]],
    'CULT|RANGER': [['RANGER', "Cute robes. Easy targets."], ['CULT', "We are many targets. You are one."]],
    'RANGER|TWINS': [['RANGER', "Don't suppose you two could line up?"], ['TWINS', "Sure!"], ['TWINS_B', "Right after you reload."]],
    'RANGER|TRAVELER': [['RANGER', "Quick-draw contest. Right now."], ['TRAVELER', "I already won it tomorrow."]],
    'RANGER|RANGER': [['P1', "Two hunters, one prize."], ['P2', "Winner takes the bounty."]],

    'DARK_RULER|TELEPATH': [['DARK_RULER', "Pry into my mind and despair."], ['TELEPATH', "I did. Seek help."]],
    'BEAST_TAMER|DARK_RULER': [['BEAST_TAMER', "Even kings get bitten."], ['DARK_RULER', "And even beasts learn to bow."]],
    'DARK_RULER|PHANTOM': [['DARK_RULER', "Phantom. Fetch me souls and be spared."], ['PHANTOM', "I don't fetch. I collect."]],
    'COPYCAT|DARK_RULER': [['DARK_RULER', "Imitating royalty is treason."], ['COPYCAT', "Then arrest me, your fakeness!"]],
    'CULT|DARK_RULER': [['DARK_RULER', "Your god may kneel beside you."], ['CULT', "He will dethrone you instead."]],
    'DARK_RULER|TWINS': [['DARK_RULER', "Which of you dies first?"], ['TWINS', "Him."], ['TWINS_B', "HEY?!"]],
    'DARK_RULER|TRAVELER': [['DARK_RULER', "I have ruled for a thousand years."], ['TRAVELER', "I've seen the year it ends."]],
    'DARK_RULER|DARK_RULER': [['P1', "Bow."], ['P2', "Never. You first."]],

    'BEAST_TAMER|TELEPATH': [['TELEPATH', "Your raven thinks you're loud."], ['BEAST_TAMER', "She's not wrong."]],
    'PHANTOM|TELEPATH': [['PHANTOM', "Peer too deep and you'll fall in."], ['TELEPATH', "Then I'll mind the gap."]],
    'COPYCAT|TELEPATH': [['TELEPATH', "Copying me won't copy the gift."], ['COPYCAT', "Watch me fake it!"]],
    'CULT|TELEPATH': [['TELEPATH', "So many mouths. One borrowed thought."], ['CULT', "Borrowed? It was GIVEN."]],
    'TELEPATH|TWINS': [['TELEPATH', "I hear double. How tiresome."], ['TWINS', "Good!"], ['TWINS_B', "We talk double too!"]],
    'TELEPATH|TRAVELER': [['TELEPATH', "Your future-sight is just guessing."], ['TRAVELER', "Guess what you're about to say. Oh wait, I know."]],
    'TELEPATH|TELEPATH': [['P1', "Get out of my head."], ['P2', "YOU'RE in MY head."]],

    'BEAST_TAMER|PHANTOM': [['BEAST_TAMER', "Can ghosts be tamed?"], ['PHANTOM', "Try the leash. Lose the arm."]],
    'BEAST_TAMER|COPYCAT': [['BEAST_TAMER', "Here, kitty. I have treats."], ['COPYCAT', "...What KIND of treats?"]],
    'BEAST_TAMER|CULT': [['BEAST_TAMER', "Your flock follows a monster."], ['CULT', "So does yours."]],
    'BEAST_TAMER|TWINS': [['BEAST_TAMER', "The serpent counts two meals."], ['TWINS', "It can't even count!"], ['TWINS_B', "...Can it?"]],
    'BEAST_TAMER|TRAVELER': [['BEAST_TAMER', "Animals sense bad omens. They hate you."], ['TRAVELER', "Smart animals."]],
    'BEAST_TAMER|BEAST_TAMER': [['P1', "Your beasts look underfed."], ['P2', "They're about to eat."]],

    'COPYCAT|PHANTOM': [['PHANTOM', "Nine lives. I'll take all nine."], ['COPYCAT', "You can have ONE. As a treat."]],
    'CULT|PHANTOM': [['PHANTOM', "Your chanting disturbs the dead."], ['CULT', "The dead are welcome to join."]],
    'PHANTOM|TWINS': [['PHANTOM', "Two souls, one stop."], ['TWINS', "We're not getting on!"], ['TWINS_B', "DEFINITELY not."]],
    'PHANTOM|TRAVELER': [['PHANTOM', "All timelines end at my station."], ['TRAVELER', "Mine has a connecting line."]],
    'PHANTOM|PHANTOM': [['P1', "These souls are spoken for."], ['P2', "Then I'll speak louder."]],

    'COPYCAT|CULT': [['COPYCAT', "If I copy ALL of you, do I get a god too?"], ['CULT', "You would only anger ours."]],
    'COPYCAT|TWINS': [['COPYCAT', "Finally! A matched set to copy!"], ['TWINS', "It's planning something."], ['TWINS_B', "It's DEFINITELY planning something."]],
    'COPYCAT|TRAVELER': [['COPYCAT', "Show me the time powers! Show me!"], ['TRAVELER', "You couldn't handle the paperwork."]],
    'COPYCAT|COPYCAT': [['P1', "I'm the original!"], ['P2', "I'm the original-ER!"]],

    'CULT|TWINS': [['CULT', "Two bodies, one purpose. You'd fit right in."], ['TWINS', "Hard pass."], ['TWINS_B', "SO hard."]],
    'CULT|TRAVELER': [['CULT', "Time means nothing to Lumatrossia."], ['TRAVELER', "Tell him to stop being late, then."]],
    'CULT|CULT': [['P1', "Heretics."], ['P2', "Schismatics."]],

    'TRAVELER|TWINS': [['TWINS', "If you've seen the future..."], ['TWINS_B', "...did we win?"], ['TRAVELER', "You don't want me to answer that."]],
    'TWINS|TWINS': [['P1', "Copycats!"], ['P2', "You copied US first!"]],
    'TRAVELER|TRAVELER': [['P1', "There's only supposed to be one of me."], ['P2', "Yes. ME."]]
};

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

        // Speech blips for the pre-fight dialogue (Undertale-style typing voices)
        this.blipSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 } }).toDestination();
        this.blipSynth.volume.value = -14;

        this.initialized = true;
        applyVolumes(); // route the procedural SFX through the saved volume settings
    },
    // One typed-letter voice blip in the speaker's timbre, randomly detuned per blip
    playBlip(speaker) {
        if (!this.initialized || !this.blipSynth) return;
        let v = BLIP_VOICE[speaker] || { f: 300, w: 'square' };
        try {
            this.blipSynth.oscillator.type = v.w;
            this.blipSynth.triggerAttackRelease(v.f * (0.94 + Math.random() * 0.12), 0.045, this.getEventTime('blip', 0.02));
        } catch (e) {}
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
    const comboScale = fighter.charType === 'SWORDSMAN' ? 1.12 : fighter.charType === 'MAGE' ? 0.92 : fighter.charType === 'RANGER' ? 1.0 : fighter.charType === 'TWINS' ? 0.62 : 1.18; // Twins land twice, so each combo hit is smaller
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
        comboHLL: melee(baseHeavy, { startup: 0.13, active: 0.2, recovery: 0.34, dmg: Math.round(14 * comboScale), w: 58, h: 54, ox: 20, oy: -58, kb: {x: 330, y: -180}, stun: 0.5, type: 'comboHLL', combo: 'HLL' }),
        comboHLH: melee(baseHeavy, { startup: 0.16, active: 0.2, recovery: 0.36, dmg: Math.round(15 * comboScale), w: 72, h: 60, ox: 22, oy: -60, kb: {x: 300, y: -320}, stun: 0.54, type: 'comboHLH', combo: 'HLH' }),
        comboHHL: melee(baseLight, { startup: 0.12, active: 0.2, recovery: 0.34, dmg: Math.round(13 * comboScale), w: 88, h: 28, ox: 20, oy: -34, kb: {x: 340, y: -210}, stun: 0.5, type: 'comboHHL', combo: 'HHL' })
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
    CULT: {
        name: "THE CULT", hp: 96, speed: 250, jump: -560, width: 32, height: 90,
        attacks: {
            light: { startup: 0.1, active: 0.12, recovery: 0.18, dmg: 5, w: 52, h: 24, ox: 24, oy: -55, kb: {x: 120, y: -60}, stun: 0.26, type: 'cultLight' },     // a cultist swings in
            heavy: { startup: 0.2, active: 0.16, recovery: 0.3, dmg: 11, w: 74, h: 34, ox: 30, oy: -52, kb: {x: 240, y: -130}, stun: 0.42, type: 'cultHeavy' },     // two cultists lunge
            specNeutral: { startup: 0.2, active: 0.1, recovery: 0.34, dmg: 7, isProj: true, pSpeed: 520, pLife: 1.7, w: 22, h: 22, oy: -58, kb: {x: 150, y: -90}, stun: 0.35, type: 'darkOffering' }, // hexed bolt(s)
            specSide: { startup: 0.2, active: 0.16, recovery: 0.36, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'procession' }, // cultists run out and plant a snare-trap
            specUp: { startup: 0.14, active: 0.1, recovery: 0.34, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'cultPuppet' },  // summon / detonate the mimic puppet
            specDown: { startup: 0.22, active: 0.1, recovery: 0.4, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'consecrate' }                 // ritual trap-zone
        }
    },
    // Summoned by The Cult's ultimate (install). Never selectable on its own.
    LUMATROSSIA: {
        name: "LUMATROSSIA", hp: 96, speed: 195, jump: -520, width: 52, height: 132,
        attacks: {
            light: { startup: 0.16, active: 0.16, recovery: 0.28, dmg: 9, w: 100, h: 38, ox: 48, oy: -96, kb: {x: 320, y: -120}, stun: 0.4, type: 'lumBackhand' },   // huge sweep
            heavy: { startup: 0.32, active: 0.2, recovery: 0.4, dmg: 18, w: 112, h: 74, ox: 44, oy: -74, kb: {x: 300, y: -380}, stun: 0.62, type: 'lumFist', armor: true }, // overhead slam
            specNeutral: { startup: 0.3, active: 0.12, recovery: 0.42, dmg: 14, isProj: true, pSpeed: 760, pLife: 1.2, w: 42, h: 42, oy: -104, kb: {x: 260, y: -120}, stun: 0.5, type: 'doomgaze' }, // eye beam
            specSide: { startup: 0.08, active: 0.06, recovery: 0.3, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'lumTeleport' },  // blink behind the foe
            specUp: { startup: 0.2, active: 0.18, recovery: 0.42, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'lumBeast' },        // beast rains mage-fire from above
            specDown: { startup: 0.26, active: 0.1, recovery: 0.42, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'lumPortal' }      // portal: drop the foe from the sky (cooldown)
        }
    },
    TWINS: {
        name: "THE TWINS", hp: 110, speed: 280, jump: -560, width: 30, height: 86,
        attacks: {
            light: { startup: 0.09, active: 0.1, recovery: 0.16, dmg: 3, w: 48, h: 22, ox: 22, oy: -54, kb: {x: 110, y: -60}, stun: 0.24, type: 'twinJab' },   // both twins jab inward (each does little; together adds up)
            heavy: { startup: 0.2, active: 0.14, recovery: 0.28, dmg: 6, w: 58, h: 30, ox: 26, oy: -52, kb: {x: 230, y: -130}, stun: 0.4, type: 'twinClap' },   // both swing a committed clap
            specNeutral: { startup: 0.18, active: 0.1, recovery: 0.3, dmg: 4, isProj: true, pSpeed: 560, pLife: 1.3, w: 18, h: 18, oy: -56, kb: {x: 120, y: -80}, stun: 0.3, type: 'mirrorVolley' }, // both fire inward
            specSide: { startup: 0.14, active: 0.22, recovery: 0.3, dmg: 5, w: 54, h: 48, ox: 18, oy: -52, kb: {x: 210, y: -120}, stun: 0.4, type: 'crossover' }, // dash through, scissoring strike
            specUp: { startup: 0.14, active: 0.16, recovery: 0.4, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'fastball' },   // hurl the OTHER twin bodily across the map
            specDown: { startup: 0.2, active: 0.1, recovery: 0.36, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'twinTether' }              // wire strung between the twins
        }
    },
    TRAVELER: {
        name: "THE TRAVELER", hp: 85, speed: 300, jump: -580, width: 32, height: 88,
        attacks: {
            light: { startup: 0.08, active: 0.1, recovery: 0.15, dmg: 4, w: 50, h: 22, ox: 24, oy: -55, kb: {x: 110, y: -60}, stun: 0.24, type: 'phaseJab' },     // blurred double-tap jab
            heavy: { startup: 0.14, active: 0.12, recovery: 0.26, dmg: 8, w: 62, h: 34, ox: 28, oy: -50, kb: {x: 240, y: -140}, stun: 0.4, type: 'flashKick' },    // frame-skipping kick
            specNeutral: { startup: 0.22, active: 0.1, recovery: 0.36, dmg: 0, isProj: true, pSpeed: 120, pLife: 1.4, w: 30, h: 30, oy: -56, kb: {x: 0, y: 0}, stun: 0, type: 'timeVortex' }, // dragging singularity (short-lived)
            specSide: { startup: 0.16, active: 0.1, recovery: 0.3, dmg: 6, isProj: true, pSpeed: 720, pLife: 0.9, w: 18, h: 12, oy: -56, kb: {x: 150, y: -80}, stun: 0.3, type: 'tachyonEcho' }, // bolt that hits AGAIN 1s later
            specUp: { startup: 0.1, active: 0.12, recovery: 0.3, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'timeSkip' },                  // fast-forward out of the timeline
            specDown: { startup: 0.12, active: 0.1, recovery: 0.34, dmg: 0, w: 0, h: 0, ox: 0, oy: 0, kb: {x: 0, y: 0}, stun: 0, type: 'rewind' }                  // snap back to your echo, undo damage
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
