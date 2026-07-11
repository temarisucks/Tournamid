/* Tournamid character normals and cancel routes. Loaded before setup.js. */

// Character-owned normal attacks. Specials were already highly individual, while
// low/aerial normals and strings used to be universal templates. These profiles keep
// the compact generator while giving every fighter a distinct neutral-game identity.
const NORMAL_PROFILES = {
    BRAWLER: {
        airLight: { displayName: 'Flying Knee', dmg: 7, w: 50, h: 46, ox: 20, oy: -62, kb: {x: 150, y: -120}, stun: 0.27, pose: 'knee' },
        airHeavy: { displayName: 'Meteor Heel', dmg: 14, w: 58, h: 58, ox: 18, oy: -48, kb: {x: 150, y: 310}, stun: 0.46, pose: 'axeKick', dive: 180 },
        lowLight: { displayName: 'Body Jab', dmg: 6, w: 48, h: 24, ox: 18, oy: -34, kb: {x: 105, y: -30}, stun: 0.26, pose: 'lowPunch' },
        lowHeavy: { displayName: 'Leg Breaker', dmg: 13, w: 78, h: 24, ox: 16, oy: -22, kb: {x: 250, y: -70}, stun: 0.44, pose: 'sweep' },
        comboScale: 1.16, comboNames: { LLL:'One-Two-Wallop', LLH:'Rising Verdict', LH:'Liver Hook', LHL:'Hammer & Anvil', HLL:'Freight Train', HLH:'Buster Chain', HHL:'Street Sweeper', HHH:'Concrete Finale' }
    },
    SWORDSMAN: {
        airLight: { displayName: 'Sky Draw', dmg: 5, w: 70, h: 26, ox: 24, oy: -68, kb: {x: 130, y: -150}, stun: 0.24, pose: 'airSlash' },
        airHeavy: { displayName: 'Falling Moon', dmg: 12, w: 82, h: 70, ox: 20, oy: -54, kb: {x: 170, y: 280}, stun: 0.42, pose: 'downSlash', dive: 140 },
        lowLight: { displayName: 'Ankle Cut', dmg: 4, w: 68, h: 16, ox: 20, oy: -20, kb: {x: 90, y: 10}, stun: 0.22, pose: 'lowSlash' },
        lowHeavy: { displayName: 'Sheathed Sweep', dmg: 10, w: 94, h: 20, ox: 22, oy: -24, kb: {x: 220, y: -120}, stun: 0.4, pose: 'sweepSlash' },
        comboScale: 1.08, comboNames: { LLL:'Three Petals', LLH:'Rising Crescent', LH:'Crossing Steel', LHL:'Falling Leaf', HLL:'Duelist\'s Answer', HLH:'Moon Splitter', HHL:'Low Tide', HHH:'Final Draw' }
    },
    MAGE: {
        airLight: { displayName: 'Wisp Tap', dmg: 5, w: 20, h: 20, oy: -62, kb: {x: 110, y: -80}, stun: 0.23, pose: 'airCast', isProj: true, pSpeed: 560, pLife: 0.7 },
        airHeavy: { displayName: 'Comet', dmg: 11, w: 34, h: 34, oy: -48, kb: {x: 120, y: 260}, stun: 0.42, pose: 'downCast', isProj: true, pSpeed: 360, pLife: 1.2, gravity: 520 },
        lowLight: { displayName: 'Spark Crawl', dmg: 4, w: 24, h: 14, oy: -18, kb: {x: 80, y: 20}, stun: 0.21, pose: 'lowCast', isProj: true, pSpeed: 480, pLife: 0.8 },
        lowHeavy: { displayName: 'Hex Eruption', dmg: 10, w: 86, h: 34, ox: 36, oy: -20, kb: {x: 130, y: -330}, stun: 0.43, pose: 'groundCast' },
        comboScale: 0.94, comboNames: { LLL:'Arcane Sequence', LLH:'Launch Sigil', LH:'Force Pulse', LHL:'Gravity Script', HLL:'Spellbreak', HLH:'Chaos Thesis', HHL:'Low Constellation', HHH:'Grand Thesis' }
    },
    RANGER: {
        airLight: { displayName: 'Air Knife', dmg: 5, w: 54, h: 28, ox: 24, oy: -58, kb: {x: 135, y: -90}, stun: 0.24, pose: 'airKnife' },
        airHeavy: { displayName: 'Downrange', dmg: 9, w: 12, h: 7, oy: -42, kb: {x: 110, y: 250}, stun: 0.33, pose: 'downShot', isProj: true, pSpeed: 820, pLife: 0.65, gravity: 700 },
        lowLight: { displayName: 'Shin Shiv', dmg: 5, w: 52, h: 18, ox: 20, oy: -22, kb: {x: 100, y: 10}, stun: 0.23, pose: 'lowKnife' },
        lowHeavy: { displayName: 'Kneecap', dmg: 8, w: 10, h: 6, oy: -26, kb: {x: 170, y: -90}, stun: 0.32, pose: 'lowShot', isProj: true, pSpeed: 1050, pLife: 0.65 },
        comboScale: 1, comboNames: { LLL:'Knife Work', LLH:'Pop Shot', LH:'Point Blank', LHL:'Slide & Slice', HLL:'Double Tap', HLH:'Deadeye Route', HHL:'Ricochet Low', HHH:'Last Round' }
    },
    DARK_RULER: {
        airLight: { displayName: 'Dread Swipe', dmg: 8, w: 76, h: 38, ox: 30, oy: -64, kb: {x: 180, y: -110}, stun: 0.3, pose: 'airSlash' },
        airHeavy: { displayName: 'Tyrant Fall', dmg: 17, w: 96, h: 74, ox: 28, oy: -58, kb: {x: 190, y: 360}, stun: 0.52, pose: 'downSlash', dive: 220 },
        lowLight: { displayName: 'Hilt Check', dmg: 7, w: 58, h: 24, ox: 24, oy: -30, kb: {x: 150, y: -20}, stun: 0.29, pose: 'lowPunch' },
        lowHeavy: { displayName: 'King\'s Reaping', dmg: 16, w: 118, h: 28, ox: 24, oy: -24, kb: {x: 310, y: -130}, stun: 0.5, pose: 'sweepSlash' },
        comboScale: 1.26, comboNames: { LLL:'Royal Tax', LLH:'Thronebreaker', LH:'Black Cleave', LHL:'Execution Order', HLL:'Conquest', HLH:'Abyss Chain', HHL:'Kneel', HHH:'Royal Execution' }
    },
    TELEPATH: {
        airLight: { displayName: 'Mind Tap', dmg: 5, w: 58, h: 42, ox: 30, oy: -66, kb: {x: 125, y: -120}, stun: 0.24, pose: 'airCast' },
        airHeavy: { displayName: 'Gravity Palm', dmg: 12, w: 86, h: 62, ox: 22, oy: -50, kb: {x: 90, y: 330}, stun: 0.44, pose: 'downCast', dive: 90 },
        lowLight: { displayName: 'Thought Trip', dmg: 5, w: 68, h: 18, ox: 26, oy: -18, kb: {x: 80, y: 40}, stun: 0.24, pose: 'lowCast' },
        lowHeavy: { displayName: 'Floor Fold', dmg: 11, w: 118, h: 28, ox: 10, oy: -18, kb: {x: 140, y: -310}, stun: 0.43, pose: 'groundCast' },
        comboScale: 1.02, comboNames: { LLL:'Read Ahead', LLH:'Elevate', LH:'Mind Bend', LHL:'Forced Error', HLL:'Psychic Rush', HLH:'Vice Route', HHL:'Subconscious Sweep', HHH:'Brain Crush' }
    },
    BEAST_TAMER: {
        airLight: { displayName: 'Raven Peck', dmg: 6, w: 62, h: 42, ox: 38, oy: -76, kb: {x: 145, y: -100}, stun: 0.25, pose: 'airWhip' },
        airHeavy: { displayName: 'Brute Drop', dmg: 13, w: 76, h: 64, ox: 20, oy: -50, kb: {x: 180, y: 310}, stun: 0.46, pose: 'beastDrop', dive: 170 },
        lowLight: { displayName: 'Serpent Snap', dmg: 5, w: 82, h: 18, ox: 28, oy: -18, kb: {x: 110, y: 10}, stun: 0.24, pose: 'lowWhip' },
        lowHeavy: { displayName: 'Brute Sweep', dmg: 12, w: 102, h: 30, ox: 18, oy: -22, kb: {x: 260, y: -150}, stun: 0.44, pose: 'beastSweep' },
        comboScale: 1.08, comboNames: { LLL:'Pack Tactics', LLH:'Raven Launch', LH:'Serpent Coil', LHL:'Alpha Order', HLL:'Stampede', HLH:'Wild Route', HHL:'Low Hunt', HHH:'Alpha Stampede' }
    },
    PHANTOM: {
        airLight: { displayName: 'Mist Rake', dmg: 6, w: 78, h: 42, ox: 34, oy: -66, kb: {x: 120, y: -80}, stun: 0.26, pose: 'airClaw' },
        airHeavy: { displayName: 'Gravefall', dmg: 13, w: 104, h: 70, ox: 34, oy: -54, kb: {x: 150, y: 290}, stun: 0.47, pose: 'downClaw', dive: 100 },
        lowLight: { displayName: 'Cold Hand', dmg: 6, w: 76, h: 18, ox: 32, oy: -18, kb: {x: 90, y: 20}, stun: 0.26, pose: 'lowClaw' },
        lowHeavy: { displayName: 'Grave Scythe', dmg: 13, w: 124, h: 26, ox: 30, oy: -22, kb: {x: 230, y: -180}, stun: 0.46, pose: 'sweepClaw' },
        comboScale: 1.12, comboNames: { LLL:'Haunting', LLH:'Soul Rise', LH:'Mist Hook', LHL:'Burial Rite', HLL:'Reaping', HLH:'Grave Route', HHL:'Underworld Sweep', HHH:'Death Knell' }
    },
    COPYCAT: {
        airLight: { displayName: 'Cat Pounce', dmg: 4, w: 50, h: 42, ox: 24, oy: -62, kb: {x: 125, y: -110}, stun: 0.22, pose: 'airClaw' },
        airHeavy: { displayName: 'Nine-Tail Drop', dmg: 10, w: 66, h: 58, ox: 18, oy: -48, kb: {x: 160, y: 280}, stun: 0.4, pose: 'axeKick', dive: 150 },
        lowLight: { displayName: 'Cat Scratch', dmg: 4, w: 58, h: 18, ox: 24, oy: -18, kb: {x: 90, y: 20}, stun: 0.21, pose: 'lowClaw' },
        lowHeavy: { displayName: 'Tail Sweep', dmg: 9, w: 86, h: 22, ox: 18, oy: -20, kb: {x: 220, y: -120}, stun: 0.39, pose: 'sweep' },
        comboScale: 0.96, comboNames: { LLL:'Copy Copy Cat', LLH:'Catapult', LH:'Claw Hook', LHL:'Nine-Step', HLL:'Pounce Route', HLH:'Mimic Break', HHL:'Tail End', HHH:'Nine Lives Left' }
    },
    CULT: {
        airLight: { displayName: 'Winged Disciple', dmg: 5, w: 62, h: 46, ox: 28, oy: -70, kb: {x: 135, y: -100}, stun: 0.25, pose: 'airCast' },
        airHeavy: { displayName: 'Falling Congregation', dmg: 12, w: 92, h: 62, ox: 22, oy: -50, kb: {x: 170, y: 300}, stun: 0.44, pose: 'downCast', dive: 110 },
        lowLight: { displayName: 'Kneeling Offering', dmg: 5, w: 66, h: 18, ox: 26, oy: -18, kb: {x: 95, y: 10}, stun: 0.24, pose: 'lowCast' },
        lowHeavy: { displayName: 'Procession Sweep', dmg: 11, w: 112, h: 26, ox: 20, oy: -22, kb: {x: 220, y: -170}, stun: 0.43, pose: 'ritualSweep' },
        comboScale: 1.02, comboNames: { LLL:'Three Witnesses', LLH:'Rapture', LH:'Dark Chorus', LHL:'Ritual Cycle', HLL:'Procession', HLH:'Final Offering', HHL:'Kneel Together', HHH:'Mass Offering' }
    },
    TWINS: {
        airLight: { displayName: 'Crossing Knees', dmg: 4, w: 52, h: 40, ox: 22, oy: -62, kb: {x: 120, y: -100}, stun: 0.22, pose: 'knee' },
        airHeavy: { displayName: 'Double Drop', dmg: 7, w: 66, h: 56, ox: 20, oy: -48, kb: {x: 150, y: 250}, stun: 0.36, pose: 'axeKick', dive: 120 },
        lowLight: { displayName: 'Pincer Poke', dmg: 3, w: 54, h: 18, ox: 18, oy: -20, kb: {x: 80, y: 10}, stun: 0.2, pose: 'lowPunch' },
        lowHeavy: { displayName: 'Mirror Sweep', dmg: 7, w: 78, h: 22, ox: 18, oy: -20, kb: {x: 180, y: -100}, stun: 0.34, pose: 'sweep' },
        comboScale: 0.64, comboNames: { LLL:'Perfect Unison', LLH:'Twin Launch', LH:'Crossfire', LHL:'Inside-Out', HLL:'Pincer Rush', HLH:'Mirror Break', HHL:'Double Low', HHH:'Two-Fold Finish' }
    },
    TRAVELER: {
        airLight: { displayName: 'Phase Jab', dmg: 5, w: 54, h: 40, ox: 22, oy: -64, kb: {x: 135, y: -130}, stun: 0.23, pose: 'phaseJab' },
        airHeavy: { displayName: 'Future Fall', dmg: 12, w: 72, h: 58, ox: 20, oy: -50, kb: {x: 180, y: 300}, stun: 0.43, pose: 'flashKick', dive: 140 },
        lowLight: { displayName: 'Timeline Check', dmg: 5, w: 58, h: 18, ox: 20, oy: -20, kb: {x: 95, y: 10}, stun: 0.22, pose: 'lowPunch' },
        lowHeavy: { displayName: 'Skipped Second', dmg: 11, w: 88, h: 24, ox: 18, oy: -22, kb: {x: 250, y: -150}, stun: 0.41, pose: 'sweep' },
        comboScale: 1.04, comboNames: { LLL:'Three Seconds Ahead', LLH:'Future Rising', LH:'Time Hook', LHL:'Loop Break', HLL:'Fast Forward', HLH:'Paradox Route', HHL:'Lost Moment', HHH:'End of Time' }
    },
    GAMBLER: {
        airLight: { displayName: 'Lucky Knee', dmg: 5, w: 50, h: 42, ox: 20, oy: -62, kb: {x: 130, y: -100}, stun: 0.23, pose: 'knee' },
        airHeavy: { displayName: 'Double Down', dmg: 12, w: 72, h: 58, ox: 22, oy: -52, kb: {x: 180, y: 290}, stun: 0.44, pose: 'leverDrop', dive: 140 },
        lowLight: { displayName: 'Low Bet', dmg: 5, w: 56, h: 18, ox: 20, oy: -20, kb: {x: 90, y: 15}, stun: 0.22, pose: 'lowPunch' },
        lowHeavy: { displayName: 'Table Sweep', dmg: 11, w: 92, h: 24, ox: 20, oy: -22, kb: {x: 240, y: -130}, stun: 0.42, pose: 'sweep' },
        comboScale: 1.04, comboNames: { LLL:'Three of a Kind', LLH:'High Roller', LH:'Raise', LHL:'Full House', HLL:'All In', HLH:'Jackpot Route', HHL:'Snake Eyes', HHH:'House Always Wins' }
    }
};

const COMBO_ROUTES = {
    LL:'chainLL', HH:'chainHH', HL:'chainHL', LH:'comboLH',
    LLL:'comboLLL', LLH:'comboLLH', LHL:'comboLHL', LHH:'comboLHH',
    HLL:'comboHLL', HLH:'comboHLH', HHL:'comboHHL', HHH:'comboHHH'
};

