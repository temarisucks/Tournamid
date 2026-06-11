// --- ENGINE FUNCTIONS ---

function spawnParticles(x, y, amount, color) {
    if (suppressRollbackEffects) return;
    for (let i = 0; i < amount; i++) {
        let vx = (Math.random() - 0.5) * 600;
        let vy = -200 - Math.random() * 500;
        let life = 0.5 + Math.random();
        let size = 2 + Math.random() * 4;
        particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
}

// ---------------- THE CULT: summoned-cultist flair + Consecrated Ground ----------------
function spawnCultists(x, y, dir, n, kind) {
    if (suppressRollbackEffects) return;
    for (let i = 0; i < n; i++) {
        let cx = (kind === 'march') ? x - dir * (12 + i * 26)
               : x - dir * ((i + 1) * 26) + (Math.random() - 0.5) * 12;
        cultSummons.push({ x: cx, y, dir, t: 0, life: kind === 'kneel' ? 1.0 : kind === 'march' ? 0.85 : 0.62, kind, mask: Math.floor(Math.random() * CULT_MASKS), scale: 0.82 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2 });
    }
    if (cultSummons.length > 40) cultSummons.splice(0, cultSummons.length - 40);
}
function updateCultSummons(dt) {
    for (let c of cultSummons) {
        c.t += dt;
        if (c.kind === 'march') c.x += c.dir * 430 * dt; // the procession advances
    }
    cultSummons = cultSummons.filter(c => c.t < c.life);
}
function drawCultMask(c, mx, my, mask, scale) {
    let s = scale || 1.5; // masks are big and prominent
    c.save();
    c.translate(mx, my); c.scale(s, s);
    c.fillStyle = '#e2e2e2'; c.strokeStyle = '#000'; c.lineWidth = 1 / s;
    c.beginPath(); c.ellipse(0, 0, 5, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#000'; c.strokeStyle = '#000'; c.lineWidth = 1.2 / s;
    if (mask === 0) { c.beginPath(); c.moveTo(1, -2); c.lineTo(11, 0); c.lineTo(1, 2); c.closePath(); c.fill(); } // beak
    else if (mask === 1) { c.beginPath(); c.moveTo(-3, -5); c.lineTo(-6, -11); c.moveTo(3, -5); c.lineTo(6, -11); c.stroke(); } // horns
    else if (mask === 2) { c.beginPath(); c.arc(-1.5, -1, 1, 0, Math.PI * 2); c.arc(2.5, -1, 1, 0, Math.PI * 2); c.fill(); } // blank eyes
    else if (mask === 3) { c.beginPath(); c.moveTo(-3, -2); c.lineTo(3, -2); c.lineTo(0, 4); c.closePath(); c.fill(); } // triangle
    else if (mask === 4) { c.beginPath(); c.moveTo(-3, 1); c.lineTo(3, 1); c.stroke(); for (let k = -2; k <= 2; k += 2) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 2); c.stroke(); } } // stitched smile
    else { c.beginPath(); c.moveTo(0, -3); c.lineTo(-5, -9); c.moveTo(-3, -6); c.lineTo(-6, -6); c.moveTo(0, -3); c.lineTo(5, -9); c.moveTo(3, -6); c.lineTo(6, -6); c.stroke(); } // antlers
    c.restore();
}
// The pose (limb angles) for a summoned cultist, animated by ritual + time.
// Convention matches the fighters: angle 0 = straight down, +sin toward facing, ~π = up.
function cultistPose(kind, t, prog, ph) {
    let ease = Math.sin(Math.min(1, prog) * Math.PI); // 0->1->0 across the action
    // neutral robed stance
    let p = { llA: -0.26, llB: 0.34, rlA: 0.30, rlB: 0.30, laA: 0.5, laB: 0.6, raA: -0.5, raB: -0.6, lean: 0.04, headDY: 0, hipDY: 0 };
    if (kind === 'march') {
        let g = Math.sin(t * 11 + ph);
        p.llA = -0.04 + g * 0.42; p.rlA = -0.04 - g * 0.42;
        p.llB = 0.30 + Math.max(0, g) * 0.5; p.rlB = 0.30 + Math.max(0, -g) * 0.5;
        p.laA = 1.5 - g * 0.35; p.laB = 0.4; p.raA = 1.5 + g * 0.35; p.raB = 0.4; // arms reaching forward, swinging
        p.lean = 0.2; p.headDY = Math.abs(g) * 1.5;
    } else if (kind === 'raise') {
        let lift = ease;
        p.laA = 2.95; p.laB = -0.25; p.raA = 3.05; p.raB = 0.25;   // both arms thrust overhead
        p.llA = -0.12; p.rlA = 0.14; p.llB = 0.18; p.rlB = 0.18;   // legs together, on tiptoe
        p.lean = -0.05; p.headDY = -lift * 8; p.hipDY = -lift * 8;  // the body floats up
    } else if (kind === 'kneel') {
        p.llA = -0.5; p.llB = 1.0; p.rlA = 0.55; p.rlB = 1.0;       // dropped onto the knees
        p.laA = 1.5; p.laB = 0.4; p.raA = 1.45; p.raB = 0.4;        // hands clasped low in prayer
        p.lean = 0.16; p.headDY = 8; p.hipDY = 14;
    } else if (kind === 'throw') {
        let wind = prog < 0.4 ? 1 : 1 - (prog - 0.4) / 0.6;        // draw back, then hurl
        p.raA = 1.0 + wind * 1.6; p.raB = -0.2 - wind * 0.4;       // throwing arm whips forward
        p.laA = 1.4; p.laB = 0.3;
        p.llA = -0.34; p.rlA = 0.5; p.llB = 0.4; p.rlB = 0.5;
        p.lean = 0.05 + (1 - wind) * 0.2;
    } else { // strike — an overhand swing
        let sw = Math.min(1, prog * 1.4);
        p.raA = 2.5 - sw * 1.5; p.raB = -0.5 + sw * 0.5;           // chamber high, swing down-forward
        p.laA = 1.6; p.laB = 0.4;
        p.llA = -0.4; p.rlA = 0.55; p.llB = 0.4; p.rlB = 0.5;      // lunging stance
        p.lean = -0.05 + sw * 0.3;
    }
    return p;
}
// A fully two-bone-rigged hooded cultist, animated per ritual.
function drawRiggedCultist(c, s) {
    let prog = s.t / s.life;
    let p = cultistPose(s.kind, s.t, prog, s.phase || 0);
    let now = performance.now() / 1000;
    c.save();
    c.translate(s.x, s.y);
    c.scale(s.dir * s.scale, s.scale);
    c.globalAlpha = prog > 0.82 ? Math.max(0, (1 - prog) / 0.18) : 1; // fade out at the end
    c.lineCap = 'round'; c.lineJoin = 'round';

    const pelvisY = -32 + p.hipDY, neckY = -54 + p.hipDY;
    let neckX = Math.sin(p.lean) * (pelvisY - neckY);
    let headX = neckX + Math.sin(p.lean) * 9, headY = neckY - 11 + p.headDY;

    function limb(sx, sy, ang, bend, up, lo) {
        let ua = ang + bend, la = ang - bend;
        let jx = sx + Math.sin(ua) * up, jy = sy + Math.cos(ua) * up;
        let ex = jx + Math.sin(la) * lo, ey = jy + Math.cos(la) * lo;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(jx, jy); c.lineTo(ex, ey); c.stroke();
        return { jx, jy };
    }
    c.strokeStyle = '#cfcfcf'; c.lineWidth = 3;
    // legs (knees always bend toward facing)
    let ll = limb(0, pelvisY, p.llA, Math.abs(p.llB), 14, 15);
    let rl = limb(0, pelvisY, p.rlA, Math.abs(p.rlB), 14, 15);
    // spine
    c.beginPath(); c.moveTo(0, pelvisY); c.lineTo(neckX, neckY); c.stroke();
    // arms
    let la2 = limb(neckX, neckY + 3, p.laA, p.laB, 12, 13);
    let ra2 = limb(neckX, neckY + 3, p.raA, p.raB, 12, 13);
    // joint pips
    c.fillStyle = '#cfcfcf';
    [ll, rl, la2, ra2].forEach(j => { c.beginPath(); c.arc(j.jx, j.jy, 1.6, 0, Math.PI * 2); c.fill(); });
    // head
    c.beginPath(); c.arc(headX, headY, 8, 0, Math.PI * 2); c.stroke();
    // robe draped over the lower body
    let hem = Math.sin(now * 3 + (s.phase || 0)) * 1.6;
    c.fillStyle = '#1a1a1a'; c.strokeStyle = '#000'; c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(neckX * 0.5 - 7, pelvisY - 6); c.lineTo(neckX * 0.5 + 7, pelvisY - 6);
    c.lineTo(13 + hem, -3); c.lineTo(-13 - hem, -3); c.closePath(); c.fill(); c.stroke();
    // big pointed hood framing the head
    c.fillStyle = '#242424'; c.strokeStyle = '#000'; c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(headX - 14, headY + 10);
    c.quadraticCurveTo(headX - 15, headY - 18, headX, headY - 32);
    c.quadraticCurveTo(headX + 15, headY - 18, headX + 14, headY + 10);
    c.quadraticCurveTo(headX, headY + 4, headX - 14, headY + 10);
    c.closePath(); c.fill(); c.stroke();
    // big unique mask
    drawCultMask(c, headX + 2, headY + 1, s.mask, 1.7);
    c.restore();
}
function drawCultSummons(c) {
    for (let s of cultSummons) drawRiggedCultist(c, s);
}
function updateConsecrateZones(dt) {
    for (let z of consecrateZones) {
        z.t += dt;
        z.tick -= dt;
        if (z.t >= z.life) continue;
        if (z.tick <= 0) {
            z.tick = 0.4;
            let zy = z.y == null ? stageGroundYAt(z.x) : z.y;
            for (let p of players) {
                if (!p || p.team === z.team || p.state === 'DEAD') continue;
                if (Math.abs(p.x - z.x) <= z.radius && Math.abs(p.y - zy) <= 42) {
                    p.takeDamage(2, { x: 0, y: 0 }, 0.12, z.owner, { unblockable: true }); // chip
                    p.meter = Math.max(0, p.meter - 6); // siphon their meter
                    if (z.owner && !z.owner.lumActive) z.owner.meter = Math.min(z.owner.meterMax, z.owner.meter + 3); // feed the install
                    spawnParticles(p.x, p.y - 30, 5, '#ff0033');
                }
            }
        }
    }
    consecrateZones = consecrateZones.filter(z => z.t < z.life);
}
function drawConsecrateZones(c) {
    for (let z of consecrateZones) {
        let life = 1 - z.t / z.life;
        let pulse = 0.5 + 0.5 * Math.sin(performance.now() / 140);
        let zy = z.y == null ? stageGroundYAt(z.x) : z.y;
        c.save();
        c.globalAlpha = Math.min(1, life * 1.5);
        c.strokeStyle = '#ff0033'; c.lineWidth = 2; c.shadowBlur = 12; c.shadowColor = '#ff0033';
        c.beginPath(); c.ellipse(z.x, zy - 2, z.radius, 14 + pulse * 3, 0, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.ellipse(z.x, zy - 2, z.radius * 0.6, 9 + pulse * 2, 0, 0, Math.PI * 2); c.stroke();
        // a ring of ritual ticks
        c.strokeStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 8; i++) { let a = i / 8 * Math.PI * 2 + z.t; let ex = z.x + Math.cos(a) * z.radius, ey = zy - 2 + Math.sin(a) * (14 + pulse * 3); c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex, ey - 10); c.stroke(); }
        c.restore();
    }
}

// --- The Procession snare-traps ---
function updateCultTraps(dt) {
    for (let z of cultTraps) {
        z.t += dt;
        if (z.triggered || z.t < z.arm || z.t >= z.life) continue;
        let zy = z.y == null ? stageGroundYAt(z.x) : z.y;
        for (let p of players) {
            if (!p || p.team === z.team || p.state === 'DEAD') continue;
            if (Math.abs(p.x - z.x) <= z.radius && Math.abs(p.y - zy) <= 54) {
                z.triggered = true;
                p.takeDamage(12, { x: 0, y: -380 }, 0.6, z.owner, { unblockable: true }); // snap shut + pop up
                spawnParticles(z.x, zy - 10, 24, '#ff0033'); spawnParticles(z.x, zy - 10, 12, '#fff');
                break;
            }
        }
    }
    cultTraps = cultTraps.filter(z => z.t < z.life && !z.triggered);
}
function drawCultTraps(c) {
    for (let z of cultTraps) {
        let armed = z.t >= z.arm;
        let pulse = 0.5 + 0.5 * Math.sin(performance.now() / 110);
        let zy = z.y == null ? stageGroundYAt(z.x) : z.y;
        c.save();
        c.globalAlpha = z.t > z.life - 0.6 ? Math.max(0, (z.life - z.t) / 0.6) : (armed ? 1 : 0.55);
        c.strokeStyle = armed ? '#ff0033' : '#888'; c.lineWidth = 2; c.shadowBlur = armed ? 10 : 0; c.shadowColor = '#ff0033';
        c.beginPath(); c.ellipse(z.x, zy - 2, z.radius, 10, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = armed ? '#ff0033' : '#666';
        for (let i = 0; i < 8; i++) { // jagged snare teeth
            let a = i / 8 * Math.PI * 2, ex = z.x + Math.cos(a) * z.radius, ey = zy - 2 + Math.sin(a) * 10;
            c.beginPath(); c.moveTo(ex - 3, ey); c.lineTo(ex + 3, ey); c.lineTo(ex, ey - 7 - (armed ? pulse * 3 : 0)); c.closePath(); c.fill();
        }
        c.restore();
    }
}

// --- Lumatrossia drop-portals + fire-breathing beast maws ---
function updateLumFx(dt) {
    for (let f of lumPortalFx) f.t += dt;
    lumPortalFx = lumPortalFx.filter(f => f.t < f.life);
    for (let f of lumBeastFx) f.t += dt;
    lumBeastFx = lumBeastFx.filter(f => f.t < f.life);
}
function drawLumFx(c) {
    for (let f of lumPortalFx) {
        let p = f.t / f.life;
        c.save(); c.translate(f.x, f.y); c.rotate(f.t * 6);
        c.globalAlpha = Math.min(1, (1 - p) * 1.6);
        c.strokeStyle = '#ff0033'; c.lineWidth = 4; c.shadowBlur = 16; c.shadowColor = '#ff0033';
        for (let k = 0; k < 3; k++) c.beginPath(), c.ellipse(0, 0, 46 - k * 9, 17 - k * 3, 0, 0, Math.PI * 2), c.stroke();
        c.restore();
    }
    for (let f of lumBeastFx) {
        let open = Math.sin(Math.min(1, f.t / f.life) * Math.PI);
        c.save(); c.translate(f.x, f.y);
        c.fillStyle = '#111'; c.strokeStyle = '#ff0033'; c.lineWidth = 3; c.shadowBlur = 12; c.shadowColor = '#ff0033';
        c.beginPath(); c.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2); c.fill(); c.stroke();      // head
        c.beginPath(); c.moveTo(-20, -16); c.lineTo(-30, -34); c.moveTo(20, -16); c.lineTo(30, -34); c.stroke(); // horns
        c.fillStyle = '#ff0033'; c.beginPath(); c.ellipse(0, 14, 16, 6 + open * 12, 0, 0, Math.PI * 2); c.fill(); // maw
        c.fillStyle = '#fff';
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 6, 10); c.lineTo(i * 6 - 2, 18); c.lineTo(i * 6 + 2, 18); c.closePath(); c.fill(); } // fangs
        c.fillStyle = '#ff0033'; c.shadowBlur = 8; c.beginPath(); c.arc(-11, -4, 3, 0, Math.PI * 2); c.arc(11, -4, 3, 0, Math.PI * 2); c.fill(); // eyes
        c.restore();
    }
}

// --- The Cult's mimic puppet (echoes the leader on a delay) ---
function puppetPose(snap, now) {
    let st = snap.state;
    if (st === 'ATTACK') return cultistPose(snap.atk === 'darkOffering' ? 'throw' : 'strike', snap.anim, 0.5, 0);
    if (st === 'WALK') return cultistPose('march', snap.anim, 0.5, 0);
    if (st === 'JUMP' || st === 'FALL') return { llA: -0.2, llB: 0.8, rlA: 0.3, rlB: 0.7, laA: 1.0, laB: 0.3, raA: -1.0, raB: -0.3, lean: 0.05, headDY: 0, hipDY: 0 };
    let bob = Math.sin(now * 3);
    return { llA: -0.26, llB: 0.34, rlA: 0.30, rlB: 0.30, laA: 0.5, laB: 0.6, raA: -0.5, raB: -0.6, lean: 0.04, headDY: bob * 1.5, hipDY: 0 };
}
function drawStickFigure(c, p, d) {
    let neckX = Math.sin(p.lean) * (d.pelvisY - d.neckY);
    let headX = neckX + Math.sin(p.lean) * (d.hr + 1), headY = d.neckY - d.hr - 3 + (p.headDY || 0);
    function limb(sx, sy, ang, bend, up, lo) {
        let uA = ang + bend, lA = ang - bend;
        let jx = sx + Math.sin(uA) * up, jy = sy + Math.cos(uA) * up;
        let ex = jx + Math.sin(lA) * lo, ey = jy + Math.cos(lA) * lo;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(jx, jy); c.lineTo(ex, ey); c.stroke();
        return { jx, jy };
    }
    let j1 = limb(0, d.pelvisY, p.llA, Math.abs(p.llB), d.ul, d.ll);
    let j2 = limb(0, d.pelvisY, p.rlA, Math.abs(p.rlB), d.ul, d.ll);
    c.beginPath(); c.moveTo(0, d.pelvisY); c.lineTo(neckX, d.neckY); c.stroke();
    let j3 = limb(neckX, d.neckY + 3, p.laA, p.laB, d.ua, d.la);
    let j4 = limb(neckX, d.neckY + 3, p.raA, p.raB, d.ua, d.la);
    c.fillStyle = c.strokeStyle; [j1, j2, j3, j4].forEach(j => { c.beginPath(); c.arc(j.jx, j.jy, 1.8, 0, Math.PI * 2); c.fill(); });
    c.beginPath(); c.arc(headX, headY, d.hr, 0, Math.PI * 2); c.stroke();
    return { headX, headY, neckX };
}
function drawCultPuppets(c) {
    let now = performance.now() / 1000;
    for (let leader of players) {
        if (!leader || !leader.puppet || leader.state === 'DEAD') continue;
        let pp = leader.puppet;
        let snap = pp.hist.length ? pp.hist[0] : { x: leader.x, dir: leader.dir, state: 'IDLE', anim: 0, atk: null };
        let footY = stageGroundYAt(snap.x, GROUND_Y) - (pp.fall || 0) * 130; // drops into place
        c.save();
        c.translate(snap.x, footY);
        c.scale(snap.dir || 1, 1);
        c.globalAlpha = 0.88;
        // marionette strings up into the dark
        c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-9, -92); c.lineTo(-9, -300); c.moveTo(9, -92); c.lineTo(9, -300); c.stroke();
        // body (player-sized rig)
        c.strokeStyle = '#cfcfcf'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
        let dims = { ul: 19, ll: 20, ua: 16, la: 17, hr: 12, pelvisY: -36, neckY: -60 };
        let h = drawStickFigure(c, puppetPose(snap, now), dims);
        // robe
        let hem = Math.sin(now * 3) * 1.6;
        c.fillStyle = '#1a1a1a'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(-8, -44); c.lineTo(8, -44); c.lineTo(15 + hem, -3); c.lineTo(-15 - hem, -3); c.closePath(); c.fill(); c.stroke();
        // hood + mask
        c.fillStyle = '#242424';
        c.beginPath();
        c.moveTo(h.headX - 17, h.headY + 12); c.quadraticCurveTo(h.headX - 19, h.headY - 22, h.headX, h.headY - 40);
        c.quadraticCurveTo(h.headX + 19, h.headY - 22, h.headX + 17, h.headY + 12);
        c.quadraticCurveTo(h.headX, h.headY + 4, h.headX - 17, h.headY + 12); c.closePath(); c.fill(); c.stroke();
        drawCultMask(c, h.headX + 3, h.headY + 2, leader.maskId || 0, 2.0);
        c.restore();
    }
}

// The Traveler — afterimage ghost trail + the Rewind after-echo. Ghosts re-draw the fighter's
// current pose at recent positions with fading alpha, so everything he does smears through time.
function drawTravelerFx(c) {
    for (let p of players) {
        if (!p || p.charType !== 'TRAVELER' || p.state === 'DEAD') continue;
        // the faint after-echo marking where Rewind would take him
        if (p.posHistory.length && p.rewindCd <= 0 && gameState === 'PLAYING') {
            let past = p.posHistory[0];
            if (Math.abs(past.x - p.x) > 30) {
                let sx = p.x, sy = p.y, sd = p.dir;
                p.x = past.x; p.y = Math.min(stageGroundYAt(past.x, GROUND_Y), past.y);
                c.save(); c.globalAlpha = 0.13; p.draw(c); c.restore();
                p.x = sx; p.y = sy; p.dir = sd;
            }
        }
        // motion afterimages
        if (p._trail && p._trail.length) {
            let sx = p.x, sy = p.y, sd = p.dir;
            for (let g of p._trail) {
                if (Math.abs(g.x - sx) < 6 && Math.abs(g.y - sy) < 6) continue;
                p.x = g.x; p.y = g.y; p.dir = g.dir;
                c.save();
                c.globalAlpha = Math.max(0.04, 0.2 * (1 - g.age / 0.24));
                p.draw(c);
                c.restore();
            }
            p.x = sx; p.y = sy; p.dir = sd;
        }
    }
}

// Combo counter — "N HITS" pops up under each fighter's side of the HUD while their
// chain is alive (2+ consecutive hits before the foe recovers), pulsing on each tick.
function drawComboCounters(c) {
    for (let i = 0; i < Math.min(2, players.length); i++) {
        let p = players[i];
        if (!p || (p.comboHits || 0) < 2 || p.comboHitTimer <= 0) continue;
        let x = i === 0 ? 92 : WIDTH - 92;
        let pop = 1 + Math.max(0, p._comboPop || 0) * 2.4;
        c.save();
        c.translate(x, 172);
        c.scale(pop, pop);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = 'bold 46px Courier New';
        c.fillStyle = p.comboHits >= 8 ? '#ffd23f' : '#ff0033'; // gold once it gets disrespectful
        c.shadowBlur = 14; c.shadowColor = c.fillStyle;
        c.fillText(p.comboHits, 0, 0);
        c.shadowBlur = 0;
        c.fillStyle = '#fff'; c.font = 'bold 15px Courier New';
        c.fillText('HITS', 0, 31);
        c.restore();
    }
}

// The Traveler's TIME STOP — the world drains of colour while he works
function drawChronoStop(c) {
    if (!ultActive || !ultActive.ult || ultActive.ult.kind !== 'chronostop') return;
    let ph = ultActive.ult.phase;
    if (ph !== 'freeze' && ph !== 'slide') return;
    c.save();
    c.fillStyle = 'rgba(190, 215, 235, 0.16)'; c.fillRect(0, 0, WIDTH, HEIGHT); // drained, cold wash
    // a giant faint clock face hanging over the arena, hands locked
    c.strokeStyle = 'rgba(111,208,255,0.28)'; c.lineWidth = 3;
    c.beginPath(); c.arc(WIDTH / 2, HEIGHT / 2, 195, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.6;
    for (let i = 0; i < 12; i++) {
        let a = i / 12 * Math.PI * 2;
        c.beginPath(); c.moveTo(WIDTH / 2 + Math.cos(a) * 178, HEIGHT / 2 + Math.sin(a) * 178);
        c.lineTo(WIDTH / 2 + Math.cos(a) * 195, HEIGHT / 2 + Math.sin(a) * 195); c.stroke();
    }
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(WIDTH / 2, HEIGHT / 2); c.lineTo(WIDTH / 2, HEIGHT / 2 - 130); c.stroke(); // frozen at midnight
    c.beginPath(); c.moveTo(WIDTH / 2, HEIGHT / 2); c.lineTo(WIDTH / 2 + 64, HEIGHT / 2); c.stroke();
    c.restore();
}

// The Twins — the wire strung between the two bodies (Down special)
function drawTwinFx(c) {
    for (let p of players) {
        if (!p || p.charType !== 'TWINS' || p.isPartner || !p.tether) continue;
        let px = p.twinPartnerX();
        let life = 1 - p.tether.t / p.tether.life;
        let lx = Math.min(p.x, px), rx = Math.max(p.x, px), y = stageGroundYAt((lx + rx) / 2, GROUND_Y) - 10 + Math.sin(performance.now() / 120) * 2;
        c.save();
        c.globalAlpha = Math.min(1, life * 1.6);
        c.strokeStyle = '#9be3ff'; c.lineWidth = 2.5; c.shadowBlur = 10; c.shadowColor = '#9be3ff';
        c.beginPath(); c.moveTo(lx, y); c.lineTo(rx, y); c.stroke();
        c.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) { let fx = lx + (rx - lx) * (((i / 5) + (performance.now() / 600) % 1) % 1); c.beginPath(); c.arc(fx, y, 1.6, 0, Math.PI * 2); c.fill(); }
        c.restore();
    }
}

function isMatchWinningUltimateKill(attacker) {
    if (!attacker || trainingMode || currentMode === 'PVE' || currentMode === 'TRAINING') return false;
    let winnerIdx = players.indexOf(attacker);
    if (winnerIdx !== 0 && winnerIdx !== 1) return false;
    if (teamBattle) { // 2v2: overkill if this ult wipes the enemy squad
        let enemy = teams[1 - winnerIdx];
        return enemy && enemy.every(f => f.hp <= 0);
    }
    // A match-winning ultimate blow earns the overkill — including every Ladder rung.
    return roundWins[winnerIdx] + 1 >= ROUNDS_TO_WIN;
}

function triggerOverkill(attacker, victim) {
    if (!attacker || !victim || overkillFx) return;
    attacker.overkillRed = true;
    victim._overkilled = true;
    victim.vx = 0;
    victim.vy = 0;
    overkillFx = { t: 0, dur: 3.2, x: victim.x, y: victim.y - 45 };
    timeScale = Math.min(timeScale, 0.45);
    playOverkillVoice();

    if (settings.blood) {
        ['head', 'torso', 'arm', 'arm', 'leg', 'leg'].forEach((kind, i) => {
            let spread = (i - 2.5) * 95 + (Math.random() - 0.5) * 120;
            bodyParts.push(new BodyPart(
                victim.x,
                victim.y - 48,
                spread,
                -420 - Math.random() * 520,
                kind === 'head' ? 9 : kind === 'torso' ? 12 : 10,
                kind,
                (Math.random() - 0.5) * 12
            ));
        });

        for (let i = 0; i < 150; i++) {
            let vx = (Math.random() - 0.5) * 1300;
            let vy = -150 - Math.random() * 950;
            let life = 0.55 + Math.random() * 1.35;
            let size = 3 + Math.random() * 7;
            particles.push(new Particle(victim.x, victim.y - 45, vx, vy, life, '#ff0033', size));
        }
        for (let i = 0; i < 70; i++) {
            let sx = Math.max(0, Math.min(WIDTH, victim.x + (Math.random() - 0.5) * 520));
            bloodStains.push({
                x: sx,
                y: stageGroundYAt(sx) + (Math.random() * 8 - 4), // pool on the stage's real floor height
                size: 4 + Math.random() * 16
            });
        }
    }
    spawnParticles(victim.x, victim.y - 48, 35, '#fff');
    stageActorsFlee(); // background spectators/dancers scatter
}

// The Traveler's Time Vortex: a slow-drifting singularity with a STRONG pull for its short
// life — anyone dragged into the core is hitstunned while it churns. Never strikes on contact.
function vortexLogic(self, dt) {
    let cx = self.x + self.w / 2, cy = self.y + self.h / 2;
    self._coreTick = (self._coreTick || 0) - dt;
    for (let p of players) {
        if (!p || !self.owner || p.team === self.owner.team || p.state === 'DEAD' || p.state === 'ULT') continue;
        let dx = cx - p.x, dy = cy - (p.y - 45);
        let dist = Math.hypot(dx, dy);
        if (dist > 240) continue;
        // strong pull, scaling up as they get closer
        let pull = 320 + (1 - dist / 240) * 420;
        p.x += Math.sign(dx) * pull * dt;
        if (p.y >= stageGroundYAt(p.x, GROUND_Y) && dy < -30) p.vy = Math.min(p.vy, -120); // lifts grounded foes slightly toward an airborne core
        if (dist < 46 && self._coreTick <= 0) { // churned in the core
            self._coreTick = 0.38;
            p.takeDamage(2, { x: 0, y: 0 }, 0.34, self.owner, { unblockable: true });
            spawnParticles(p.x, p.y - 45, 8, '#6fd0ff');
            playAudio(attackSfx.timeHit);
        }
    }
}

// Chaos Bolt "split" element: shatters into three fragments shortly after firing
function splitLogic(self, dt) {
    self._age = (self._age || 0) + dt;
    if (!self._split && self._age > 0.22) {
        self._split = true;
        for (let i = -1; i <= 1; i++) {
            let p = new Projectile(self.x, self.y, self.vx * 0.6, i * 280, 12, 12,
                self.damage * 0.7, self.knockback, self.stun, self.owner, 0.8, null);
            p.subtype = 'spark';
            p.lightningStun = 0.45;
            projectiles.push(p);
        }
        self.active = false;
        spawnParticles(self.x, self.y, 8, '#ffe089');
    }
}

function checkCollisions() {
    // Hitboxes vs Players
    for (let h of hitboxes) {
        if (!h.active || !h.owner) {
            if (!h.owner) h.active = false;
            continue;
        }
        for (let p of players) {
            if (p !== h.owner && p.team !== h.owner.team && p.state !== 'DEAD' && !h.hasHit.has(p.id)) {
                // AABB Collision
                let px = p.x - p.width/2;
                let py = p.y - p.height;
                if (h.x < px + p.width && h.x + h.w > px && h.y < py + p.height && h.y + h.h > py) {
                    h.hasHit.add(p.id);
                    if (h.grabThrow) {
                        // Dark Ruler seizes the foe — the throw resolves over the next frames
                        h.grabThrow.captureThrow(p);
                        h.active = false;
                    } else if (h.catPin) {
                        // Copy Cat's Cat Dash pounce catches the foe — pin & slash
                        h.catPin.startCatPin(p);
                        h.active = false;
                    } else {
                        // Melee swing sound plays only on contact (whiffs stay silent)
                        if (h.atk && h.owner) h.owner.playAttackSound(h.atk);
                        let landed = p.takeDamage(h.damage, h.knockback, h.stun, h.owner, { isUlt: !!h.ultActivator, unblockable: !!h.grab || !!h.unblockableUlt });
                        if (landed && h.ultActivator) h.ultActivator.onUltConnect(p);
                        if (landed && h.atk && h.atk.type === 'graveGrasp' && p.startRoot) p.startRoot(); // hands clamp the foe in place
                    }
                }
            }
        }
    }

    // Projectiles vs Players
    for (let proj of projectiles) {
        if (!proj.active || !proj.owner) {
            if (!proj.owner) proj.active = false;
            continue;
        }
        for (let p of players) {
            if (p !== proj.owner && p.team !== proj.owner.team && p.state !== 'DEAD' && !proj.hasHit.has(p.id)) {
                let px = p.x - p.width/2;
                let py = p.y - p.height;
                if (proj.x < px + p.width && proj.x + proj.w > px && proj.y < py + p.height && proj.y + proj.h > py) {
                    if (proj.benign) continue; // mana-font rune doesn't strike foes
                    if (p.isReflecting && p.isReflecting()) { // Telepath Psi Barrier sends it back
                        p.reflectProjectile(proj);
                        continue;
                    }
                    proj.hasHit.add(p.id);
                    let hitDamage = proj.damage;
                    if (proj.gravityKnockback) {
                        hitDamage += Math.min(8, (Math.abs(proj.knockback.x || 0) + Math.abs(proj.knockback.y || 0)) / 170);
                    }
                    let landed = p.takeDamage(hitDamage, proj.knockback, proj.lightningStun || proj.stun, proj.owner,
                        { unblockable: proj.unblockable, isUlt: !!proj.ultActivator || !!proj.isUltDamage });

                    // Ultimate activation projectile (Mage orb / Ranger bomb) connected
                    if (proj.ultActivator) {
                        if (landed) proj.ultActivator.onUltConnect(p);
                        proj.active = false;
                    }

                    // On-hit elemental effects
                    if (landed && proj.burn) {
                        p.burnTimer = Math.max(p.burnTimer || 0, proj.burn);
                        p.burnTickTimer = Math.min(p.burnTickTimer || 0.55, 0.35);
                    }
                    if (landed && proj.slow) {
                        p.slowTimer = Math.max(p.slowTimer, proj.slow);
                        p.slowFactor = Math.min(p.slowFactor || 1, proj.slowFactor || 0.45);
                    }
                    if (landed && proj.venom) {
                        p.venomTimer = Math.max(p.venomTimer || 0, proj.venom);
                        p.venomTickTimer = Math.min(p.venomTickTimer || 0.45, 0.2);
                    }
                    if (landed && proj.lightningStun && p.state === 'HITSTUN') {
                        p.stateTimer = Math.max(p.stateTimer, proj.lightningStun);
                        spawnParticles(p.x, p.y - 56, 12, '#fff');
                    }
                    if (proj.markTarget) {
                        p.beastMarkedTimer = 9999;
                        spawnParticles(p.x, p.y - 70, 12, '#ff0033');
                    }
                    if (proj.subtype === 'mistChain' && landed && p.startYank) {
                        p.startYank(proj.owner); // reel the foe all the way to the Phantom
                    }
                    if (proj.subtype === 'piano') playAudio(attackSfx.piano); // Piano Drop crunch on contact
                    if (proj.subtype === 'echoBolt' && landed) { // Tachyon Echo — the hit repeats 1s later
                        p._echoHit = { t: 1.0, dmg: proj.damage, owner: proj.owner };
                        spawnParticles(p.x, p.y - 50, 6, '#6fd0ff');
                        playAudio(attackSfx.timeHit);
                    }
                    if (proj.explode) {
                        // AoE burst that catches everyone nearby
                        let bx = proj.x + proj.w/2, by = proj.y + proj.h/2;
                        let ownerDir = proj.owner ? proj.owner.dir : Math.sign(proj.vx || 1);
                        hitboxes.push(new Hitbox(bx - 45, by - 45, 90, 90, proj.damage * 0.6,
                            {x: 220 * Math.sign(proj.vx || ownerDir || 1), y: -260}, 0.35, proj.owner, 0.1));
                        spawnParticles(bx, by, 18, '#ff5a2a');
                    }

                    let col = proj.subtype === 'fire' ? '#ff5a2a' : proj.subtype === 'frost' ? '#7fd8ff'
                            : proj.subtype === 'venom' ? '#fff'
                            : proj.subtype === 'homing' ? '#c98bff' : '#fff';
                    spawnParticles(proj.x, proj.y, 10, col);
                    if (!proj.pierce) proj.active = false; // beams pierce, everything else pops
                }
            }
        }
    }

    // The Twins — the SECOND body is also a hurtbox feeding the shared HP. Route hits to the
    // controller (keyed on its id, so one swing can't double-dip across both bodies).
    for (let owner of players) {
        let tw = owner.partner;
        if (!tw || owner.state === 'DEAD') continue;
        let px = tw.x - owner.width / 2, py = tw.y - owner.height;
        for (let h of hitboxes) {
            if (!h.active || !h.owner || h.owner.team === owner.team || h.hasHit.has(owner.id)) continue;
            if (h.x < px + owner.width && h.x + h.w > px && h.y < py + owner.height && h.y + h.h > py) {
                h.hasHit.add(owner.id);
                if (h.grabThrow) { h.grabThrow.captureThrow(owner); h.active = false; continue; }
                if (h.atk && h.owner) h.owner.playAttackSound(h.atk);
                let landed = owner.takeDamage(h.damage, h.knockback, h.stun, h.owner, { isUlt: !!h.ultActivator, unblockable: !!h.grab || !!h.unblockableUlt, hitBody: 'partner' });
                if (landed && h.ultActivator) h.ultActivator.onUltConnect(owner);
            }
        }
        for (let proj of projectiles) {
            if (!proj.active || !proj.owner || proj.owner.team === owner.team || proj.hasHit.has(owner.id)) continue;
            if (proj.x < px + owner.width && proj.x + proj.w > px && proj.y < py + owner.height && proj.y + proj.h > py) {
                proj.hasHit.add(owner.id);
                let landed = owner.takeDamage(proj.damage, proj.knockback, proj.lightningStun || proj.stun, proj.owner, { unblockable: proj.unblockable, isUlt: !!proj.ultActivator || !!proj.isUltDamage, hitBody: 'partner' });
                if (proj.ultActivator) { if (landed) proj.ultActivator.onUltConnect(owner); proj.active = false; }
                else if (!proj.pierce) proj.active = false;
            }
        }
    }
}

function setMeterBar(id, p) {
    let fill = document.getElementById(id + '-meter');
    if (!fill || !p) return;
    let pct = (infiniteMeter && p.team === 0) ? 100 : (p.meter / p.meterMax) * 100;
    fill.style.width = Math.min(100, pct) + '%';
    if (fill.parentElement) fill.parentElement.classList.toggle('ready', pct >= 100);
}

function setHudIcon(id, fighter) {
    let icon = document.getElementById(id + '-icon');
    if (!icon || !fighter) return;
    icon.onerror = function () { this.style.visibility = 'hidden'; };
    icon.style.visibility = 'visible';
    icon.src = 'textures/icons/' + (LADDER_ICON_FILE[fighter.charType] || 'x') + '.png';
}

// Show/hide the 2v2 stacked bars and load each fighter's icon (called at match start).
function setupTeamHud(on) {
    for (let tm = 0; tm < 2; tm++) {
        let pfx = tm === 0 ? 'p1' : 'p2';
        let hud = document.getElementById(pfx + '-hud');
        let single = document.getElementById(pfx + '-single-row');
        let team = document.getElementById(pfx + '-team');
        if (hud) hud.classList.toggle('team-mode', on);
        if (single) single.classList.toggle('hidden', on);
        if (team) team.classList.toggle('hidden', !on);
        if (!on) {
            setHudIcon(pfx, players[tm]);
            continue;
        }
        for (let i = 0; i < 2; i++) {
            let f = teams[tm][i];
            let icon = document.getElementById(pfx + '-team-icon-' + i);
            if (icon && f) {
                icon.onerror = function () { this.style.visibility = 'hidden'; };
                icon.style.visibility = 'visible';
                icon.src = 'textures/icons/' + (LADDER_ICON_FILE[f.charType] || 'x') + '.png';
            }
        }
    }
}

// Position the "ult-lethal" line on a fighter's HP bar: at the strongest living
// enemy's ult damage (as a fraction of maxHp). Hidden when no enemy can ultimate.
function setUltLine(lineId, victim, enemies) {
    let el = document.getElementById(lineId);
    if (!el) return;
    let dmg = 0;
    if (enemies) for (let e of enemies) {
        if (e && e.hp > 0 && ULT_DAMAGE[e.charType]) dmg = Math.max(dmg, ULT_DAMAGE[e.charType]);
    }
    if (!victim || victim.maxHp <= 0 || dmg <= 0) { el.classList.add('hidden'); return; }
    el.style.left = Math.min(100, (dmg / victim.maxHp) * 100) + '%';
    el.classList.remove('hidden');
}

function updateTeamHud() {
    for (let tm = 0; tm < 2; tm++) {
        let pfx = tm === 0 ? 'p1' : 'p2';
        for (let i = 0; i < 2; i++) {
            let f = teams[tm][i];
            let hpEl = document.getElementById(pfx + '-team-hp-' + i);
            let rowEl = document.getElementById(pfx + '-team-row-' + i);
            if (!f || !hpEl || !rowEl) continue;
            hpEl.style.width = Math.max(0, (f.hp / f.maxHp) * 100) + '%';
            setUltLine(pfx + '-team-ult-' + i, f, teams[1 - tm]); // threat = the opposing squad's ults
            rowEl.classList.toggle('active', i === activeIdx[tm]);
            rowEl.classList.toggle('downed', f.hp <= 0);
        }
        setMeterBar(pfx, players[tm]);
    }
}

function updateHUD() {
    if (teamBattle) { updateTeamHud(); return; }
    if (players.length >= 1) {
        setHudIcon('p1', players[0]);
        document.getElementById('p1-hp').style.width = Math.max(0, (players[0].hp / players[0].maxHp) * 100) + '%';
        setMeterBar('p1', players[0]);
        setUltLine('p1-ult-line', players[0], players.slice(1)); // enemies' ults (none in PVE → hidden)
    }
    if (currentMode !== 'PVE' && players.length >= 2) setMeterBar('p2', players[1]);

    if (currentMode === 'PVE') {
        document.getElementById('p2-ult-line')?.classList.add('hidden'); // aggregate horde bar has no single ult
        if (players.length >= 2) setHudIcon('p2', players[1]);
        // Find total HP of enemies
        let totalMax = 0, totalCur = 0;
        for (let i = 1; i < players.length; i++) {
            totalMax += players[i].maxHp;
            totalCur += players[i].hp;
        }
        if (totalMax > 0) {
            document.getElementById('p2-hp').style.width = Math.max(0, (totalCur / totalMax) * 100) + '%';
        } else {
            document.getElementById('p2-hp').style.width = '0%';
        }
    } else if (players.length >= 2) {
        setHudIcon('p2', players[1]);
        document.getElementById('p2-hp').style.width = Math.max(0, (players[1].hp / players[1].maxHp) * 100) + '%';
        setUltLine('p2-ult-line', players[1], [players[0]]);
    }
}

function isLadderMode() { return currentMode === 'LADDER' || currentMode === 'LADDER2' || currentMode === 'INFINITE_LADDER'; }

// ---------------- 2v2 TAG-TEAM ----------------
// Bring the benched team-mate onto the field. `auto` (a KO swap) skips the manual guards.
function switchActive(team, auto) {
    if (!teamBattle) return false;
    let curI = activeIdx[team], otherI = 1 - curI;
    let cur = teams[team][curI], bench = teams[team][otherI];
    if (!bench || bench.hp <= 0) return false;
    if (!auto) {
        if (!cur || cur.hp <= 0) return false;
        if (cur.switchCooldown > 0) return false;
        if (['HITSTUN', 'BLOCKBREAK', 'LEDGE', 'ULT', 'DEAD'].includes(cur.state)) return false;
    }
    // The incoming fighter takes the outgoing one's spot, turns to face the foe, and
    // bursts in with a signature entrance strike.
    let foe = players[1 - team];
    let atX = cur ? cur.x : bench.x;
    let atDir = foe ? (foe.x >= atX ? 1 : -1) : (cur ? cur.dir : bench.dir);
    bench.x = atX; bench.y = stageGroundYAt(atX, GROUND_Y); bench.vx = 0; bench.vy = 0;
    bench.dir = atDir;
    bench.ledge = null; bench.ult = null; bench.currentAttack = null;
    bench.invulnTimer = Math.max(bench.invulnTimer || 0, 0.55); // tag-in protection
    bench.switchCooldown = 1.4;
    activeIdx[team] = otherI;
    players[team] = bench;
    spawnParticles(bench.x, bench.y - 45, 22, team === 0 ? '#fff' : '#ff0033');
    playAudio(attackSfx.beastSwitch);
    bench.startTagIn(); // unique entrance attack that damages whoever it hits
    return true;
}

// Benched fighters slowly recover and the CPU tags out when its active fighter is hurting.
function updateBench(dt) {
    if (!teamBattle) return;
    // Delayed tag-in after a KO (the brief dramatic pause)
    for (let tm = 0; tm < 2; tm++) {
        if (pendingTag[tm] > 0) {
            pendingTag[tm] -= dt;
            if (pendingTag[tm] <= 0) switchActive(tm, true);
        }
    }
    for (let tm = 0; tm < 2; tm++) {
        let benchI = 1 - activeIdx[tm];
        let bench = teams[tm][benchI];
        if (bench && bench.hp > 0 && bench.hp < bench.maxHp) bench.hp = Math.min(bench.maxHp, bench.hp + 4 * dt);
        // CPU auto-tag: swap out a badly hurt active fighter for a healthier rested one
        let cur = teams[tm][activeIdx[tm]];
        if (cur && cur.isAI && bench && bench.hp > 0 && cur.switchCooldown <= 0 &&
            cur.hp > 0 && cur.hp < cur.maxHp * 0.3 && bench.hp > cur.hp + 25 &&
            ['IDLE', 'WALK'].includes(cur.state) && Math.random() < 0.02) {
            switchActive(tm, false);
        }
    }
}

function team2v2End(winnerIdx) {
    // No best-of-3 in 2v2 — wiping a squad ends the match. Set roundWins so the
    // win-animation/winner detection in endGame picks the right side.
    roundWins = winnerIdx === 0 ? [ROUNDS_TO_WIN, 0] : winnerIdx === 1 ? [0, ROUNDS_TO_WIN] : [0, 0];
    let title = winnerIdx === 0 ? 'PLAYER 1 WINS' : winnerIdx === 1 ? 'PLAYER 2 WINS' : 'DRAW';
    endGame(title, winnerIdx === -1 ? 'Mutual Destruction' : 'Squad Wiped');
}

function checkWinCondition() {
    if (gameState !== 'PLAYING') return;
    if (trainingMode) return; // training never ends
    if (currentMode === 'ONLINE' && onlineState.slot !== 0) return; // host owns match outcomes

    if (teamBattle) {
        // A downed active fighter is replaced by a living team-mate after a brief pause
        // (see updateBench); a squad with both fighters down loses the match.
        for (let tm = 0; tm < 2; tm++) {
            if (players[tm].hp <= 0 && pendingTag[tm] <= 0) {
                let bench = teams[tm][1 - activeIdx[tm]];
                if (bench && bench.hp > 0) pendingTag[tm] = 0.95; // hold on the KO, then tag in
            }
        }
        let t0dead = teams[0].every(f => f.hp <= 0);
        let t1dead = teams[1].every(f => f.hp <= 0);
        if (t0dead && t1dead) team2v2End(-1);
        else if (t0dead) team2v2End(1);
        else if (t1dead) team2v2End(0);
        return;
    }

    let p1Alive = players[0].hp > 0;

    if (currentMode === 'PVE') {
        let enemiesAlive = players.slice(1).some(p => p.hp > 0);
        if (!p1Alive) {
            endGame("GAME OVER", players[0]._ringedOut ? `Ring Out at Wave ${waveCount}` : `Surrounded at Wave ${waveCount}`);
        } else if (!enemiesAlive) {
            // Next Wave
            waveCount++;
            setTimeout(startPvEWave, 2000);
        }
    } else {
        let p2Alive = players[1].hp > 0;
        let reason = (players[0]._ringedOut || players[1]._ringedOut) ? "Ring Out!" : null;
        if (!p1Alive && !p2Alive) endRound(-1, "Double K.O.");      // draw round
        else if (!p1Alive) endRound(1, reason || "Brutal Decimation.");
        else if (!p2Alive) endRound(0, reason || "Flawless Victory.");
    }
}

// One round decided (CPU/PVP). winnerIdx: 0=P1, 1=P2, -1=draw.
function endRound(winnerIdx, subtitle) {
    if (gameState !== 'PLAYING') return;
    if (currentMode === 'ONLINE' && onlineState.slot === 0 && !suppressRollbackEffects) onlineSend('round-result', { winnerIdx, subtitle });
    gameState = 'ROUND_END';
    if (winnerIdx >= 0) roundWins[winnerIdx]++;
    renderRoundPips();

    if (roundWins[0] >= ROUNDS_TO_WIN || roundWins[1] >= ROUNDS_TO_WIN) {
        let p1Won = roundWins[0] > roundWins[1];
        // Ladder rungs are best-of-3; endGame routes to the ladder flow when in LADDER mode.
        if (currentMode === 'LADDER' || currentMode === 'INFINITE_LADDER') endGame(p1Won ? "PLAYER 1 WINS" : "PLAYER 2 WINS", "");
        else endGame(p1Won ? "PLAYER 1 WINS" : "PLAYER 2 WINS", `Match ${roundWins[0]} – ${roundWins[1]}`);
        return;
    }

    let txt = winnerIdx === -1 ? "DRAW ROUND" : (winnerIdx === 0 ? "PLAYER 1" : "PLAYER 2") + " TAKES IT";
    roundAnnounce = { text: txt, t: 0, dur: 2.0 };
    setTimeout(nextRound, 2000);
}

function nextRound() {
    if (gameState !== 'ROUND_END') return;
    if (currentMode === 'ONLINE' && onlineState.slot === 0 && !suppressRollbackEffects) onlineSend('next-round');
    currentRound++;
    hitboxes = []; projectiles = []; particles = []; bodyParts = []; cultSummons = []; consecrateZones = []; cultTraps = []; lumBeastFx = []; lumPortalFx = [];
    initStageActors(); // bring fled spectators back for the new round
    let geo = getStageGeo();
    let lx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.28 : WIDTH / 4;
    let rx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.72 : WIDTH * 0.75;
    [[players[0], lx, 1], [players[1], rx, -1]].forEach(([p, x, dir]) => {
        // The Cult: winning/ending a round as Lumatrossia drops the install — revert and reset the bar
        if (p.lumActive && p.revertFromLumatrossia) { p.revertFromLumatrossia(); p.meter = 0; }
        if ('devotion' in p) p.devotion = 0;
        p.puppet = null; p._portalSlam = null; p.portalCd = 0;
        if (p.charType === 'TWINS') { p.tether = null; p.fastball = null; p.symBuff = 0; p.twinOffset = 60; p._twinLeaping = 0; if (p.partner) { p.partner.x = x + 60; p.partner.y = stageGroundYAt(x + 60, GROUND_Y); p.partner.state = 'IDLE'; p.partner.vx = 0; p.partner.vy = 0; } } // reset the pair beside each other
        if (p.charType === 'TRAVELER') { p.posHistory = []; p._trail = []; p._echoHit = null; p.slipCd = 0; p.rewindCd = 0; p.vortexCd = 0; p._skipHide = 0; } // fresh timeline each round
        p.comboHits = 0; p.comboHitTimer = 0; p._comboPop = 0;
        p.x = x; p.y = stageGroundYAt(x, GROUND_Y); p.vx = 0; p.vy = 0;
        p.hp = p.maxHp; p.state = 'IDLE'; p.stateTimer = 0; // meter carries over between rounds
        p.dir = dir; p.blockHealth = p.blockMax; p.ledge = null;
        p.comboCount = 0; p.slowTimer = 0; p.slowFactor = 1; p.burnTimer = 0; p.burnTickTimer = 0; p.venomTimer = 0; p.venomTickTimer = 0; p.beastMarkedTimer = 0; p.invulnTimer = 0; p.ult = null; p._ringedOut = false; p._overkilled = false;
        p.overkillRed = false;
        p.pose = null;
    });
    ultActive = null; timeScale = 1; ultBanner = null; ultCamera = null;
    roundAnnounce = { text: "ROUND " + currentRound, t: 0, dur: 1.4 };
    beginIntroSequence(currentRound >= 3 ? 'final' : currentRound === 2 ? 'round2' : 'round1');
    matchTimer = 99;
    if (currentMode !== 'PVE' && currentMode !== 'TRAINING') {
        document.getElementById('timer').innerText = matchTimer;
        matchTimerAccumulator = 0;
    }
    updateHUD();
    gameState = 'PLAYING';
}

function endGame(title, subtitle) {
    if (currentMode === 'ONLINE' && onlineState.slot === 0 && !suppressRollbackEffects) onlineSend('game-over', { title, subtitle });
    gameState = 'END';
    document.getElementById('end-title').innerText = title;
    document.getElementById('end-subtitle').innerText = subtitle;
    let gear = document.getElementById('settings-btn'); if (gear) gear.classList.remove('hidden');

    // The match is over — tear down any in-progress ultimate cinematic. updateUlt
    // (which would normally call endUlt) stops running once gameState is END, so
    // without this ultActive/ultCamera linger and the view stays zoomed + in slow-mo.
    ultActive = null;
    ultCamera = null;
    ultBanner = null;
    players.forEach(p => { if (p) p.ult = null; }); // timeScale eases back now that ultActive is null

    // Work out the winner and let them play a victory animation before the menu shows.
    let winnerIdx = roundWins[0] > roundWins[1] ? 0
                  : roundWins[1] > roundWins[0] ? 1
                  : (players[0] && players[1] && players[0].hp >= players[1].hp ? 0 : 1);
    let winner = players[winnerIdx];
    if (winner && winner.state !== 'DEAD') {
        winner.startWinPose();
        if (!overkillFx) playAudio(winVoices[winner.charType]);
    }

    // Hold on the celebration + "X WINS" banner before revealing the post-battle menu.
    let animMs = overkillFx ? 3200 : 2800;
    roundAnnounce = { text: title, t: 0, dur: animMs / 1000 };
    setTimeout(() => {
        if (isLadderMode()) { ladderResolveMatch(); return; } // win -> climb, loss -> retry
        document.getElementById('end-screen').classList.remove('hidden');
        if (currentMode === 'ONLINE') onlineBeginPostMatch();
    }, animMs);
}

// Advance victory poses while on the END screen (fighters are otherwise frozen there).
function updateWinAnimations(dt) {
    for (let p of players) {
        if (!p || p.state !== 'WIN') continue;
        p.animTimer += dt;
        p.stateTimer += dt;
        p.vx = 0;
        let winGy = stageGroundYAt(p.x, GROUND_Y);
        if (p.y < winGy) { p.vy += 1500 * dt; p.y = Math.min(winGy, p.y + p.vy * dt); if (p.y >= winGy) p.vy = 0; }
        else { p.vy = 0; p.y = winGy; }
        let col = p.charType === 'MAGE' ? '#c98bff' : p.charType === 'TELEPATH' ? '#9be3ff' : p.charType === 'DARK_RULER' ? '#ff0033' : null;
        if (col) {
            p._winFxTimer = (p._winFxTimer || 0) - dt;
            if (p._winFxTimer <= 0) { p._winFxTimer = 0.07; spawnParticles(p.x + (Math.random() * 70 - 35), p.y - 55 - Math.random() * 45, 2, col); }
        }
    }
}

// --- GAME LOOP & STATE MANAGEMENT ---

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let realDt = (timestamp - lastTime) / 1000;
    // Cap dt to prevent huge jumps if tab was inactive
    if (realDt > 0.1) realDt = 0.1;
    lastTime = timestamp;

    frameRealDt = realDt;
    updateCinematics(realDt);
    if (currentMode === 'ONLINE') onlineFixedUpdate(realDt);
    else update(realDt * timeScale); // gameplay runs in slow-mo during ultimates
    draw();
    if (typeof updateTouchControlsVisibility === 'function') updateTouchControlsVisibility();
    drawCharacterSelectPreview(realDt);

    requestID = requestAnimationFrame(loop);
}

function updateCinematics(realDt) {
    // Ease slow-motion back to normal once no ultimate is forcing it
    if (!ultActive) timeScale += (1 - timeScale) * Math.min(1, realDt * 5);
    if (ultBanner) { ultBanner.t += realDt; if (ultBanner.t > ultBanner.dur) ultBanner = null; }
    if (roundAnnounce) { roundAnnounce.t += realDt; if (roundAnnounce.t > roundAnnounce.dur) roundAnnounce = null; }
    if (overkillFx) { overkillFx.t += realDt; if (overkillFx.t > overkillFx.dur) overkillFx = null; }
    if (gameState === 'LADDER_SCREEN') updateLadderScreen(realDt);
    updateStageActors(realDt);
    updateIntroSequence(realDt);
}

function updateIntroSequence(realDt) {
    if (!introSequence || introSequence.done) return;
    introSequence.t += realDt;

    if (introSequence.phase === 'ready') {
        if (!introSequence.playedReady) {
            introSequence.playedReady = true;
            if (introSequence.kind === 'round2') {
                introSequence.text = 'ROUND 2';
                playAudio(roundVoices.round2);
            } else if (introSequence.kind === 'final') {
                introSequence.text = 'FINAL ROUND';
                playAudio(roundVoices.final);
            } else {
                introSequence.text = "I DON'T THINK THEY'RE READY";
                playAudio(roundVoices.ready);
            }
        }
        if (introSequence.t >= 1.45) {
            introSequence.phase = 'fight';
            introSequence.t = 0;
        }
    } else if (introSequence.phase === 'fight') {
        if (!introSequence.playedFight) {
            introSequence.playedFight = true;
            introSequence.text = 'FIGHT';
            playAudio(roundVoices.fight);
        }
        if (introSequence.t >= 0.85) introSequence.done = true;
    }
}

function renderRoundPips() {
    [0, 1].forEach(i => {
        let el = document.getElementById('p' + (i + 1) + '-rounds');
        if (!el) return;
        let pips = '';
        for (let r = 0; r < ROUNDS_TO_WIN; r++) pips += `<span class="pip${r < roundWins[i] ? ' won' : ''}"></span>`;
        el.innerHTML = pips;
    });
}

function drawRoundAnnounce(ctx) {
    if (!roundAnnounce) return;
    let p = roundAnnounce.t / roundAnnounce.dur;
    let a = Math.sin(Math.min(1, p) * Math.PI);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 64px Courier New'; ctx.shadowBlur = 24; ctx.shadowColor = '#ff0033';
    ctx.fillText(roundAnnounce.text, WIDTH / 2, HEIGHT / 2 - 30);
    ctx.restore();
}

// ---------------- PRE-FIGHT ENTRANCES + DIALOGUE ----------------
// Both fighters arrive with their own signature entrance, trade a matchup-specific
// exchange (typed out with per-character voice blips), THEN the announcer runs.
function startEntranceSequence() {
    if (currentMode === 'ONLINE' || currentMode === 'PVE' || currentMode === 'TRAINING') return;
    if (players.length < 2 || !players[0] || !players[1]) return;
    let a = players[0], b = players[1];
    if (!ENTRANCE_KIND[a.charType] || !ENTRANCE_KIND[b.charType]) return;
    let key = [a.charType, b.charType].sort().join('|');
    let scriptPool = [INTRO_DIALOGUE[key], INTRO_DIALOGUE_B[key], INTRO_DIALOGUE_C[key], INTRO_DIALOGUE_D[key]].filter(Boolean);
    entranceSeq = {
        phase: 'enter', t: 0,
        script: scriptPool.length ? scriptPool[Math.floor(Math.random() * scriptPool.length)] : null,
        lineIdx: 0, charIdx: 0, blipTick: 0, lineHold: 0,
        targets: [a.x, b.x],
        showRound: !!roundAnnounce
    };
    roundAnnounce = null;      // the ROUND 1 banner waits for the ceremony to finish
    introSequence = null;      // so does the announcer
    Object.assign(previousKeys, keys); // a held key from the menus shouldn't insta-skip
    a.x = -50; b.x = WIDTH + 50; // start off-screen
    a.dir = 1; b.dir = -1;
    [a, b].forEach(p => {
        p._entKind = ENTRANCE_KIND[p.charType];
        p._entProg = 0;
        if (p.partner) { p.partner.x = p.x - p.dir * 40; p.partner.y = stageGroundYAt(p.partner.x); }
    });
}

function updateEntranceSeq(dt) {
    let s = entranceSeq, a = players[0], b = players[1];
    if (!s || !a || !b) { entranceSeq = null; return; }
    // any fresh button press skips the whole ceremony
    for (let k in keys) { if (keys[k] && !previousKeys[k]) { finishEntranceSeq(); return; } }
    s.t += dt;
    // afterimage trails keep aging so the Traveler's stutter ghosts fade properly
    [a, b].forEach(p => { if (p._trail && p._trail.length) { p._trail.forEach(g => g.age += dt); p._trail = p._trail.filter(g => g.age < 0.24); } });

    if (s.phase === 'enter') {
        let prog = Math.min(1, s.t / 1.8);
        driveEntrance(a, 0, prog, dt);
        driveEntrance(b, 1, prog, dt);
        if (prog >= 1) {
            if (s.script) { s.phase = 'line'; s.t = 0; s.lineIdx = 0; s.charIdx = 0; s.lineHold = 0; }
            else finishEntranceSeq();
        }
        return;
    }
    if (s.phase === 'line') {
        [a, b].forEach(p => { p.animTimer += dt; if (p.partner) p.partner.animTimer += dt; });
        let line = s.script[s.lineIdx];
        let text = line[1];
        // the camera drifts over and leans in on whoever is talking (camNow eases it)
        let spkPos = entranceSpeakerPos(line);
        ultCamera = { fx: Math.max(170, Math.min(WIDTH - 170, spkPos.x)), fy: stageGroundYAt(spkPos.x) - 88, zoom: 1.5 };
        if (s.charIdx < text.length) { // typing out
            s.blipTick -= dt;
            if (s.blipTick <= 0) {
                s.blipTick = 0.04;
                s.charIdx++;
                let ch = text[s.charIdx - 1];
                if (s.charIdx % 2 === 0 && /[a-zA-Z0-9]/.test(ch)) {
                    let spk = line[0];
                    let voice = spk === 'P1' ? a.charType : spk === 'P2' ? b.charType : spk;
                    sfx.playBlip(voice);
                }
            }
        } else { // hold the finished line, then advance
            s.lineHold += dt;
            if (s.lineHold > 0.85) {
                s.lineIdx++; s.charIdx = 0; s.lineHold = 0; s.blipTick = 0;
                if (s.lineIdx >= s.script.length) finishEntranceSeq();
            }
        }
    }
}

// Where the current line's speaker is standing (the second twin speaks from the partner body)
function entranceSpeakerPos(line) {
    let a = players[0], b = players[1];
    let spk = line[0];
    let speaker = spk === 'P1' ? a : spk === 'P2' ? b : [a, b].find(p => p.charType === (spk === 'TWINS_B' ? 'TWINS' : spk)) || a;
    if (spk === 'TWINS_B' && speaker.partner) return { x: speaker.partner.x, y: speaker.partner.y, speaker };
    return { x: speaker.x, y: speaker.y, speaker };
}

// Per-character arrival movement. Poses come from the entrance flourish block in Fighter.draw.
function driveEntrance(p, i, prog, dt) {
    let s = entranceSeq;
    let from = i === 0 ? -50 : WIDTH + 50;
    let to = s.targets[i];
    p.animTimer += dt;
    p._entProg = prog;
    p.dir = i === 0 ? 1 : -1;
    let k = p._entKind;
    if (k === 'roll') { // Ranger: combat-roll in, come up spinning the pistol
        if (prog < 0.45) {
            p.x = from + (to - from) * (prog / 0.45);
            p.tumbleTimer = 0.2; p._tumbleAngle += dt * 14 * p.dir; p.state = 'CROUCH';
        } else { p.x = to; p.tumbleTimer = 0; p._tumbleAngle = 0; p.state = 'IDLE'; }
    } else if (k === 'float') { // Mage: drifts in hovering, juggling sparks
        p.x = from + (to - from) * Math.min(1, prog / 0.85);
        let h = prog < 0.8 ? 24 + Math.sin(s.t * 4) * 3 : Math.max(0, 24 * (1 - (prog - 0.8) / 0.18));
        p.y = stageGroundYAt(p.x) - h;
        p.state = 'IDLE';
        if (prog < 0.8 && Math.random() < 0.14) spawnParticles(p.x + p.dir * 10, p.y - 78, 1, '#c98bff');
    } else if (k === 'levitate') { // Telepath: descends serenely from on high
        p.x = from + (to - from) * Math.min(1, prog / 0.7);
        p.y = stageGroundYAt(p.x) - 130 * (1 - Math.min(1, prog / 0.85));
        p.state = 'IDLE';
    } else if (k === 'mist') { // Phantom: rises out of the floor at his mark
        p.x = to;
        p.y = stageGroundYAt(to) + 70 * (1 - Math.min(1, prog / 0.85));
        p._entAlpha = Math.min(1, prog / 0.7);
        p.state = 'IDLE';
        if (prog < 0.9 && Math.random() < 0.3) spawnParticles(to + (Math.random() - 0.5) * 44, stageGroundYAt(to) - 6, 1, '#cfd8ff');
    } else if (k === 'allfours') { // Copy Cat: sprints in low, then stands and stretches
        if (prog < 0.55) { p.x = from + (to - from) * (prog / 0.55); p.state = 'CROUCH'; }
        else { p.x = to; p.state = 'IDLE'; }
    } else if (k === 'stutter') { // Traveler: teleports forward in discrete skips
        let steps = 4;
        let q = Math.min(steps, Math.floor(Math.min(1, prog / 0.8) * (steps + 1)));
        let nx = from + (to - from) * (q / steps);
        if (p._lastStutterX !== nx) {
            if (p._trail) p._trail.push({ x: p.x, y: p.y, dir: p.dir, age: 0 });
            p._lastStutterX = nx;
            if (prog > 0.05) spawnParticles(nx, stageGroundYAt(nx) - 50, 5, '#6fd0ff');
        }
        p.x = nx; p.y = stageGroundYAt(p.x); p.state = 'IDLE';
    } else if (k === 'cartwheel') { // Twins: both flip in, the partner overtaking the lead
        let pr = Math.min(1, prog / 0.7);
        p.x = from + (to - from) * pr;
        let cgy = stageGroundYAt(p.x);
        if (prog < 0.7) {
            p.tumbleTimer = 0.2; p._tumbleAngle += dt * 10 * p.dir; p.state = 'JUMP';
            p.y = cgy - Math.abs(Math.sin(prog * 12)) * 24;
        } else { p.tumbleTimer = 0; p._tumbleAngle = 0; p.state = 'IDLE'; p.y = cgy; }
        if (p.partner) {
            let pf = from - p.dir * 46, pt = to + p.dir * 60;
            p.partner.x = pf + (pt - pf) * pr;
            let pgy = stageGroundYAt(p.partner.x);
            p.partner.y = prog < 0.7 ? pgy - Math.abs(Math.cos(prog * 12)) * 24 : pgy;
            p.partner.state = p.state; p.partner.animTimer = p.animTimer; p.partner.dir = p.dir;
            p.partner.tumbleTimer = p.tumbleTimer; p.partner._tumbleAngle = -p._tumbleAngle;
        }
    } else { // walk-class entrances: jog / spinblade / stride / whip / procession
        p.x = from + (to - from) * Math.min(1, prog / 0.82);
        p.y = stageGroundYAt(p.x); // walk ON the stage's floor (raised on some maps)
        p.state = prog < 0.82 ? 'WALK' : 'IDLE';
        if (k === 'procession' && prog < 0.78 && Math.random() < 0.09) spawnCultists(p.x, stageGroundYAt(p.x), p.dir, 1, 'march');
        if (k === 'stride' && prog < 0.82 && Math.random() < 0.4) spawnParticles(p.x - p.dir * 30, stageGroundYAt(p.x) - 5, 1, '#ff0033'); // dragged blade sparks
    }
    // every other grounded arrival (roll, all-fours sprint) also rides the real floor
    if (k === 'roll' || k === 'allfours') p.y = stageGroundYAt(p.x);
}

function finishEntranceSeq() {
    let s = entranceSeq;
    if (!s) return;
    [players[0], players[1]].forEach((p, i) => {
        if (!p) return;
        p.x = s.targets[i]; p.y = stageGroundYAt(p.x); p.vx = 0; p.vy = 0; p.state = 'IDLE'; p.stateTimer = 0;
        p._entProg = null; p._entAlpha = null; p._lastStutterX = null;
        p.tumbleTimer = 0; p._tumbleAngle = 0;
        if (p.charType === 'TWINS' && p.partner) {
            p.twinOffset = 60;
            p.partner.x = p.x + 60; p.partner.y = stageGroundYAt(p.partner.x); p.partner.state = 'IDLE';
            p.partner.tumbleTimer = 0; p.partner._tumbleAngle = 0;
        }
    });
    if (players[0]) players[0].dir = 1;
    if (players[1]) players[1].dir = -1;
    entranceSeq = null;
    ultCamera = null; // pan back out from the speaker to the full arena
    if (s.showRound) roundAnnounce = { text: 'ROUND 1', t: 0, dur: 1.4 };
    beginIntroSequence('round1'); // now the announcer takes the stage
}

// The typed speech bubble above whoever is talking
function drawEntranceDialogue(c) {
    if (!entranceSeq || entranceSeq.phase !== 'line' || !entranceSeq.script) return;
    let s = entranceSeq;
    let line = s.script[s.lineIdx];
    let shown = line[1].slice(0, s.charIdx);
    if (!shown.length) return;
    // speaker is in world space; the camera is zoomed in on them — map to screen coords
    let pos = entranceSpeakerPos(line);
    let bx = (pos.x - camNow.x) * camNow.zoom + WIDTH / 2;
    let by = (pos.y - camNow.y) * camNow.zoom + HEIGHT / 2;

    c.save();
    c.font = '15px Courier New';
    // wrap the visible text at ~30 chars
    let words = shown.split(' '), lines = [''], li = 0;
    for (let w of words) {
        if ((lines[li] + ' ' + w).trim().length > 30) { lines.push(w); li++; }
        else lines[li] = (lines[li] + ' ' + w).trim();
    }
    let boxW = Math.max(...lines.map(l => c.measureText(l).width)) + 22;
    let boxH = lines.length * 18 + 14;
    let x = Math.max(12, Math.min(WIDTH - boxW - 12, bx - boxW / 2));
    let y = Math.max(10, by - 118 * camNow.zoom - boxH); // clear the (zoomed) fighter's head
    // bubble
    c.fillStyle = 'rgba(6, 8, 12, 0.92)';
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, boxW, boxH, 7); else c.rect(x, y, boxW, boxH);
    c.fill(); c.stroke();
    // the little tail down toward the speaker
    let tx = Math.max(x + 12, Math.min(x + boxW - 12, bx));
    c.beginPath(); c.moveTo(tx - 7, y + boxH); c.lineTo(tx + 7, y + boxH); c.lineTo(tx, y + boxH + 10); c.closePath();
    c.fillStyle = 'rgba(6, 8, 12, 0.92)'; c.fill(); c.stroke();
    // text
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, x + 11, y + 8 + i * 18));
    c.restore();
}

function drawIntroText(ctx) {
    if (!introSequence || introSequence.done || !introSequence.text) return;
    let p = introSequence.phase === 'ready' ? introSequence.t / 1.45 : introSequence.t / 0.85;
    let a = Math.sin(Math.min(1, p) * Math.PI);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = introSequence.phase === 'fight' ? '900 104px Courier New' : '900 54px Courier New';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ff0033';
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ff0033';
    ctx.strokeText(introSequence.text, WIDTH / 2, HEIGHT / 2 - 38);
    ctx.fillText(introSequence.text, WIDTH / 2, HEIGHT / 2 - 38);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function update(dt) {
    if (currentMode === 'ONLINE') {
        onlineFixedUpdate(dt);
        return;
    }
    updateGameplay(dt);
}

function updateGameplay(dt) {
    if (gameState === 'END') {
        updateWinAnimations(dt);
        projectiles.forEach(p => p.update(dt));
        projectiles = projectiles.filter(p => p.active);
        particles.forEach(p => p.update(dt));
        particles = particles.filter(p => p.life > 0);
        bodyParts.forEach(p => p.update(dt));
        bodyParts = bodyParts.filter(p => p.life > 0);
        Object.assign(previousKeys, keys);
        return;
    }
    if (gameState !== 'PLAYING') return;
    if (entranceSeq) { // pre-fight walk-ons + dialogue: the world waits while they talk
        updateEntranceSeq(dt);
        particles.forEach(p => p.update(dt));
        particles = particles.filter(p => p.life > 0);
        updateCultSummons(dt); // the Cult's procession files in during its entrance
        Object.assign(previousKeys, keys);
        return;
    }
    if (introSequence && !introSequence.done) {
        particles.forEach(p => p.update(dt));
        particles = particles.filter(p => p.life > 0);
        Object.assign(previousKeys, keys);
        return;
    }

    // Timer
    if (gameState === 'PLAYING' && currentMode !== 'PVE' && currentMode !== 'TRAINING' &&
        (currentMode !== 'ONLINE' || onlineState.slot === 0)) {
        matchTimerAccumulator += dt;
        if (matchTimerAccumulator >= 1.0) {
            matchTimerAccumulator -= 1.0;
            matchTimer--;
            document.getElementById('timer').innerText = matchTimer;
            if (matchTimer <= 0) {
                if (teamBattle) {
                    // Time up — the squad with more total remaining health wins
                    let h0 = teams[0].reduce((s, f) => s + Math.max(0, f.hp), 0);
                    let h1 = teams[1].reduce((s, f) => s + Math.max(0, f.hp), 0);
                    team2v2End(h0 > h1 ? 0 : h1 > h0 ? 1 : -1);
                } else {
                    // Time up — award the round on remaining health
                    let p1 = players[0].hp / players[0].maxHp;
                    let p2 = players[1].hp / players[1].maxHp;
                    if (p1 > p2) endRound(0, "Time Up — health lead.");
                    else if (p2 > p1) endRound(1, "Time Up — health lead.");
                    else endRound(-1, "Time Up — dead even.");
                }
            }
        }
    }

    if (teamBattle) updateBench(dt);

    players.forEach(p => {
        // During an ultimate's pause/payoff, freeze everyone except the performer
        if (ultActive && p !== ultActive && ultActive.ult &&
            (ultActive.ult.phase === 'declare' || ultActive.ult.connected)) return;
        p.update(dt);
    });

    hitboxes.forEach(h => h.update(dt));
    hitboxes = hitboxes.filter(h => h.active);
    
    projectiles.forEach(p => p.update(dt));
    projectiles = projectiles.filter(p => p.active);
    
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);
    bodyParts.forEach(p => p.update(dt));
    bodyParts = bodyParts.filter(p => p.life > 0);
    updateCultSummons(dt);
    updateConsecrateZones(dt);
    updateCultTraps(dt);
    updateLumFx(dt);

    if (gameState === 'PLAYING') checkCollisions();
    updateHUD(); // keep meters/health live (meter charges continuously)
    Object.assign(previousKeys, keys);
}

function isDarkRulerInFight() {
    let pool = [];
    if (Array.isArray(players)) pool = pool.concat(players);
    if (teamBattle && Array.isArray(teams)) teams.forEach(team => { if (Array.isArray(team)) pool = pool.concat(team); });
    return pool.some(p => p && p.charType === 'DARK_RULER');
}

function drawGhostShape(c, x, y, s, phase) {
    c.save();
    c.translate(x, y + Math.sin(phase) * 5 * s);
    c.globalAlpha = 0.28 + Math.sin(phase * 1.7) * 0.08;
    c.strokeStyle = '#eee';
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = Math.max(1.5, 2.5 * s);
    c.shadowBlur = 14 * s;
    c.shadowColor = '#fff';
    c.beginPath();
    c.arc(0, -16 * s, 14 * s, Math.PI, 0);
    c.lineTo(14 * s, 18 * s);
    c.quadraticCurveTo(7 * s, 10 * s, 0, 18 * s);
    c.quadraticCurveTo(-7 * s, 10 * s, -14 * s, 18 * s);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#050505';
    c.shadowBlur = 0;
    c.beginPath(); c.arc(-5 * s, -16 * s, 2 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(5 * s, -16 * s, 2 * s, 0, Math.PI * 2); c.fill();
    c.restore();
}

function drawStabbedWeapon(c, x, y, s, kind, lean = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(lean);
    c.strokeStyle = '#bbb';
    c.fillStyle = '#111';
    c.lineWidth = Math.max(2, 3 * s);
    c.shadowBlur = 6 * s;
    c.shadowColor = '#777';
    if (kind === 'axe') {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -42 * s); c.stroke();
        c.beginPath(); c.moveTo(0, -42 * s); c.quadraticCurveTo(18 * s, -38 * s, 13 * s, -20 * s); c.quadraticCurveTo(4 * s, -27 * s, 0, -30 * s); c.fill(); c.stroke();
    } else if (kind === 'spear') {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -58 * s); c.stroke();
        c.beginPath(); c.moveTo(0, -70 * s); c.lineTo(7 * s, -55 * s); c.lineTo(0, -48 * s); c.lineTo(-7 * s, -55 * s); c.closePath(); c.fill(); c.stroke();
    } else {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -62 * s); c.stroke();
        c.beginPath(); c.moveTo(-13 * s, -44 * s); c.lineTo(13 * s, -44 * s); c.stroke();
        c.beginPath(); c.moveTo(0, -76 * s); c.lineTo(7 * s, -62 * s); c.lineTo(0, -48 * s); c.lineTo(-7 * s, -62 * s); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
}

function drawThroneDarkRuler(c, x, y, scale) {
    let ruler = new Fighter('THRONE_DARK_RULER', 0, 'DARK_RULER', true, 1);
    ruler.x = 0;
    ruler.y = 0;
    ruler.dir = 1;
    ruler.state = 'IDLE';
    ruler.animTimer = performance.now() / 1000;
    ruler.stageSeat = true;
    ruler.pose = {
        la: 1.28, ra: 2.42, lab: 0.25, rab: -0.2,
        ll: -1.18, rl: 1.18, llb: 0.9, rlb: 0.9,
        hy: -76, tl: -0.03, cd: 11
    };
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    ruler.draw(c);
    c.restore();
}

function getNewYorkClockParts() {
    try {
        let parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour12: false,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).formatToParts(new Date());
        let value = type => Number((parts.find(p => p.type === type) || {}).value || 0);
        return { hour: value('hour') % 12, minute: value('minute'), second: value('second') };
    } catch (e) {
        let now = new Date();
        return { hour: now.getHours() % 12, minute: now.getMinutes(), second: now.getSeconds() };
    }
}

function drawReversedClock(c, cx, cy, r) {
    let time = getNewYorkClockParts();
    c.save();
    c.translate(cx, cy);
    c.fillStyle = '#050505';
    c.strokeStyle = '#9a9a9a';
    c.lineWidth = Math.max(2, r * 0.018);
    c.shadowBlur = r * 0.18;
    c.shadowColor = 'rgba(255,255,255,0.28)';
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;

    c.strokeStyle = 'rgba(255,255,255,0.24)';
    for (let i = 0; i < 60; i++) {
        let a = -(i / 60 * Math.PI * 2 - Math.PI / 2);
        let inner = i % 5 === 0 ? r * 0.83 : r * 0.9;
        c.lineWidth = i % 5 === 0 ? Math.max(2, r * 0.012) : 1;
        c.beginPath();
        c.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        c.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
        c.stroke();
    }

    c.strokeStyle = 'rgba(255,255,255,0.11)';
    c.lineWidth = Math.max(1, r * 0.008);
    for (let ring = 0; ring < 4; ring++) {
        c.beginPath();
        c.arc(0, 0, r * (0.32 + ring * 0.14), 0, Math.PI * 2);
        c.stroke();
    }
    c.strokeStyle = 'rgba(255,0,51,0.24)';
    for (let i = 0; i < 5; i++) {
        let a = -0.9 + i * 0.42;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
        c.lineTo(Math.cos(a + 0.08) * r * (0.58 + i * 0.04), Math.sin(a + 0.08) * r * (0.58 + i * 0.04));
        c.lineTo(Math.cos(a - 0.22) * r * (0.72 - i * 0.03), Math.sin(a - 0.22) * r * (0.72 - i * 0.03));
        c.stroke();
    }

    const hand = (angle, len, color, width) => {
        c.strokeStyle = color;
        c.lineWidth = width;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        c.stroke();
    };
    let secA = -(time.second / 60 * Math.PI * 2 - Math.PI / 2);
    let minA = -(((time.minute + time.second / 60) / 60) * Math.PI * 2 - Math.PI / 2);
    let hourA = -(((time.hour + time.minute / 60) / 12) * Math.PI * 2 - Math.PI / 2);
    hand(hourA, r * 0.42, '#f1f1f1', Math.max(4, r * 0.035));
    hand(minA, r * 0.61, '#cfcfcf', Math.max(3, r * 0.025));
    hand(secA, r * 0.74, '#ff0033', Math.max(1.5, r * 0.012));
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(0, 0, r * 0.035, 0, Math.PI * 2);
    c.fill();
    c.restore();
}

function drawClockGear(c, x, y, r, teeth, rot, alpha) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = alpha;
    c.strokeStyle = '#5a5a5a';
    c.fillStyle = '#090909';
    c.lineWidth = Math.max(1.5, r * 0.07);
    c.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
        let a = i / (teeth * 2) * Math.PI * 2;
        let rr = i % 2 ? r * 0.92 : r * 1.1;
        let px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r * 0.48, 0, Math.PI * 2);
    c.stroke();
    c.restore();
}

function drawMansionPortrait(c, x, y, w, h, label) {
    c.save();
    c.fillStyle = '#080808';
    c.strokeStyle = '#777';
    c.lineWidth = 2;
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.arc(x + w * 0.5, y + h * 0.36, w * 0.16, 0, Math.PI * 2);
    c.moveTo(x + w * 0.28, y + h * 0.78);
    c.quadraticCurveTo(x + w * 0.5, y + h * 0.52, x + w * 0.72, y + h * 0.78);
    c.stroke();
    c.fillStyle = '#aaa';
    c.font = `bold ${Math.max(7, h * 0.09)}px Courier New`;
    c.textAlign = 'center';
    c.fillText(label, x + w * 0.5, y + h * 0.94);
    c.restore();
}

function drawStage(targetCtx, stageId, width, height, groundY) {
    targetCtx.fillStyle = '#050505';
    targetCtx.fillRect(0, 0, width, height);

    if (stageId === 'moonBridge') {
        let sky = targetCtx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#111');
        sky.addColorStop(0.55, '#020202');
        sky.addColorStop(1, '#080808');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        targetCtx.save();
        targetCtx.shadowBlur = 45;
        targetCtx.shadowColor = '#fff';
        targetCtx.fillStyle = '#ddd';
        targetCtx.beginPath();
        targetCtx.arc(width * 0.5, height * 0.22, height * 0.16, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.shadowBlur = 0;
        targetCtx.fillStyle = '#050505';
        targetCtx.beginPath();
        targetCtx.arc(width * 0.55, height * 0.18, height * 0.15, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.restore();

        targetCtx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 5; i++) {
            targetCtx.fillRect(0, groundY - 68 + i * 11, width, 2);
        }
        targetCtx.strokeStyle = '#555';
        targetCtx.lineWidth = 4;
        targetCtx.beginPath();
        targetCtx.moveTo(0, groundY - 22);
        targetCtx.quadraticCurveTo(width * 0.5, groundY + 22, width, groundY - 22);
        targetCtx.stroke();
        targetCtx.strokeStyle = '#aaa';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(0, groundY);
        targetCtx.quadraticCurveTo(width * 0.5, groundY + 28, width, groundY);
        targetCtx.stroke();
        for (let x = 60; x < width; x += 90) {
            targetCtx.strokeStyle = '#333';
            targetCtx.beginPath();
            targetCtx.moveTo(x, groundY - 25);
            targetCtx.lineTo(x + 18, groundY + 5);
            targetCtx.stroke();
        }
    } else if (stageId === 'platform') {
        let sky = targetCtx.createRadialGradient(width * 0.5, height * 0.25, 20, width * 0.5, height * 0.25, height * 0.8);
        sky.addColorStop(0, '#303030');
        sky.addColorStop(0.45, '#111');
        sky.addColorStop(1, '#030303');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        // faint parallax grid receding into the void
        targetCtx.strokeStyle = 'rgba(255,255,255,0.07)';
        targetCtx.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
            let y = height * 0.2 + i * (height * 0.06);
            targetCtx.beginPath();
            targetCtx.moveTo(0, y);
            targetCtx.lineTo(width, y + 22);
            targetCtx.stroke();
        }

        // Draw the actual collidable surfaces so visuals match physics
        let lay = stagePlatformLayout(width, groundY, height);
        const slab = (L, R, T, depth, lead) => {
            targetCtx.fillStyle = '#0d0d0d';
            targetCtx.beginPath();
            targetCtx.moveTo(L, T);
            targetCtx.lineTo(R, T);
            targetCtx.lineTo(R - depth * 0.45, T + depth);
            targetCtx.lineTo(L + depth * 0.45, T + depth);
            targetCtx.closePath();
            targetCtx.fill();
            // glowing top lip
            targetCtx.strokeStyle = lead;
            targetCtx.lineWidth = Math.max(2, depth * 0.14);
            targetCtx.shadowBlur = 12; targetCtx.shadowColor = lead;
            targetCtx.beginPath();
            targetCtx.moveTo(L, T); targetCtx.lineTo(R, T);
            targetCtx.stroke();
            targetCtx.shadowBlur = 0;
        };
        // main island (deep) then the floating platforms
        slab(lay.main.left, lay.main.right, lay.main.top, Math.max(34, height * 0.13), '#e8e8e8');
        lay.platforms.forEach(p => slab(p.left, p.right, p.top, Math.max(14, height * 0.05), '#9ad8ff'));
    } else if (stageId === 'clockworkTower') {
        let t = performance.now() / 1000;
        let sky = targetCtx.createRadialGradient(width * 0.5, height * 0.35, height * 0.08, width * 0.5, height * 0.4, height * 0.75);
        sky.addColorStop(0, '#303030');
        sky.addColorStop(0.52, '#070707');
        sky.addColorStop(1, '#010101');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        // timber ribs, hanging chains, and the inner shell of the tower.
        targetCtx.strokeStyle = '#202020';
        targetCtx.lineWidth = Math.max(7, width * 0.009);
        for (let i = 0; i < 8; i++) {
            let x = width * (0.02 + i * 0.14);
            targetCtx.beginPath();
            targetCtx.moveTo(x, 0);
            targetCtx.lineTo(width * 0.5 + (x - width * 0.5) * 0.28, groundY);
            targetCtx.stroke();
        }
        targetCtx.strokeStyle = 'rgba(255,255,255,0.13)';
        targetCtx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
            let x = width * (0.11 + i * 0.13);
            targetCtx.beginPath();
            targetCtx.moveTo(x, 0);
            for (let y = 12; y < groundY - height * 0.08; y += height * 0.045) {
                targetCtx.lineTo(x + Math.sin(y * 0.05 + i) * width * 0.006, y);
            }
            targetCtx.stroke();
        }
        targetCtx.strokeStyle = 'rgba(255,255,255,0.07)';
        targetCtx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            let y = height * (0.1 + i * 0.075);
            targetCtx.beginPath();
            targetCtx.ellipse(width * 0.5, y, width * (0.48 - i * 0.025), height * 0.055, 0, 0, Math.PI * 2);
            targetCtx.stroke();
        }

        drawClockGear(targetCtx, width * 0.22, height * 0.26, height * 0.075, 12, -t * 0.22, 0.5);
        drawClockGear(targetCtx, width * 0.77, height * 0.31, height * 0.095, 16, t * 0.18, 0.45);
        drawClockGear(targetCtx, width * 0.32, height * 0.57, height * 0.06, 10, t * 0.28, 0.35);
        drawClockGear(targetCtx, width * 0.68, height * 0.56, height * 0.07, 14, -t * 0.24, 0.35);
        drawClockGear(targetCtx, width * 0.5, height * 0.62, height * 0.08, 18, t * 0.16, 0.26);
        drawReversedClock(targetCtx, width * 0.5, height * 0.33, height * 0.22);
        targetCtx.save();
        targetCtx.globalAlpha = 0.34 + Math.sin(t * 1.5) * 0.08;
        targetCtx.strokeStyle = '#ff0033';
        targetCtx.shadowBlur = 18;
        targetCtx.shadowColor = '#ff0033';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(width * 0.5, height * 0.55);
        targetCtx.bezierCurveTo(width * 0.43, height * 0.58, width * 0.57, height * 0.64, width * 0.49, height * 0.69);
        targetCtx.stroke();
        targetCtx.restore();

        // catwalk floor
        targetCtx.fillStyle = '#070707';
        targetCtx.fillRect(0, groundY - height * 0.035, width, height * 0.035);
        targetCtx.fillRect(0, groundY, width, height - groundY);
        targetCtx.strokeStyle = '#8c8c8c';
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.moveTo(0, groundY);
        targetCtx.lineTo(width, groundY);
        targetCtx.stroke();
        targetCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        targetCtx.lineWidth = 1;
        for (let x = -20; x < width + 30; x += width * 0.055) {
            targetCtx.beginPath();
            targetCtx.moveTo(x, groundY);
            targetCtx.lineTo(x + width * 0.04, groundY - height * 0.035);
            targetCtx.stroke();
        }
    } else if (stageId === 'endWorld') {
        let t = performance.now() / 1000;
        let geo = stageGeometry(stageId, width, groundY, height);
        let sky = targetCtx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#232323');
        sky.addColorStop(0.32, '#080808');
        sky.addColorStop(0.68, '#020202');
        sky.addColorStop(1, '#000');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        // Fast downward-moving debris sells that the battlefield is rising hard.
        for (let i = 0; i < 58; i++) {
            let seed = i * 97.13;
            let x = (Math.sin(seed) * 0.5 + 0.5) * width;
            let y = ((t * (92 + i % 7 * 21) + seed) % (height + 150)) - 75;
            let s = height * (0.006 + (i % 6) * 0.004);
            targetCtx.save();
            targetCtx.translate(x, y);
            targetCtx.rotate(seed + t * (0.8 + (i % 5) * 0.18));
            targetCtx.fillStyle = i % 6 === 0 ? 'rgba(255,0,51,0.32)' : 'rgba(230,230,230,0.16)';
            targetCtx.beginPath();
            targetCtx.moveTo(-s, -s * 0.5);
            targetCtx.lineTo(s * 0.8, -s);
            targetCtx.lineTo(s * 0.45, s);
            targetCtx.lineTo(-s * 0.8, s * 0.7);
            targetCtx.closePath();
            targetCtx.fill();
            targetCtx.restore();
        }

        // broken horizon, cracked red moon, and reality scars
        targetCtx.save();
        targetCtx.globalAlpha = 0.85;
        targetCtx.strokeStyle = 'rgba(255,255,255,0.18)';
        targetCtx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
            let x = width * (0.12 + i * 0.13);
            targetCtx.beginPath();
            targetCtx.moveTo(x, height * 0.04);
            targetCtx.lineTo(x + Math.sin(i) * width * 0.05, height * (0.24 + (i % 3) * 0.05));
            targetCtx.lineTo(x - width * 0.035, height * (0.38 + (i % 2) * 0.07));
            targetCtx.stroke();
        }
        let moonX = width * 0.78, moonY = height * 0.18, moonR = height * 0.19;
        targetCtx.globalAlpha = 1;
        targetCtx.shadowBlur = 72;
        targetCtx.shadowColor = '#ff0033';
        targetCtx.fillStyle = 'rgba(255,0,51,0.26)';
        targetCtx.strokeStyle = 'rgba(255,0,51,0.95)';
        targetCtx.lineWidth = Math.max(3, width * 0.004);
        targetCtx.beginPath();
        targetCtx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.shadowBlur = 28;
        targetCtx.strokeStyle = 'rgba(255,255,255,0.46)';
        for (let i = 0; i < 7; i++) {
            let a = -1.1 + i * 0.34 + Math.sin(t * 0.5 + i) * 0.03;
            targetCtx.beginPath();
            targetCtx.moveTo(moonX + Math.cos(a) * moonR * 0.2, moonY + Math.sin(a) * moonR * 0.2);
            targetCtx.lineTo(moonX + Math.cos(a + 0.18) * moonR * (0.55 + i * 0.04), moonY + Math.sin(a + 0.18) * moonR * (0.55 + i * 0.04));
            targetCtx.lineTo(moonX + Math.cos(a - 0.14) * moonR * 0.92, moonY + Math.sin(a - 0.14) * moonR * 0.92);
            targetCtx.stroke();
        }
        targetCtx.shadowBlur = 18;
        targetCtx.strokeStyle = '#ff0033';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.arc(moonX - moonR * 0.08, moonY + moonR * 0.04, moonR * 1.22, 0.38, Math.PI * 1.28);
        targetCtx.stroke();
        targetCtx.restore();

        // Event bursts: a falling city slab, a beam, and a giant eye flare cycle in and out.
        let eventPhase = (t % 9) / 9;
        if (eventPhase < 0.28) {
            let p = eventPhase / 0.28;
            targetCtx.save();
            targetCtx.translate(width * (0.15 + p * 0.5), height * (-0.12 + p * 0.55));
            targetCtx.rotate(-0.7 + p * 0.6);
            targetCtx.fillStyle = 'rgba(28,28,28,0.9)';
            targetCtx.strokeStyle = 'rgba(255,255,255,0.2)';
            targetCtx.lineWidth = 2;
            targetCtx.fillRect(-width * 0.09, -height * 0.035, width * 0.18, height * 0.07);
            targetCtx.strokeRect(-width * 0.09, -height * 0.035, width * 0.18, height * 0.07);
            for (let i = 0; i < 7; i++) {
                targetCtx.fillStyle = i % 3 === 0 ? 'rgba(255,0,51,0.4)' : 'rgba(255,255,255,0.12)';
                targetCtx.fillRect(-width * 0.075 + i * width * 0.022, -height * 0.018, width * 0.01, height * 0.014);
            }
            targetCtx.restore();
        } else if (eventPhase > 0.42 && eventPhase < 0.58) {
            let p = Math.sin((eventPhase - 0.42) / 0.16 * Math.PI);
            targetCtx.save();
            targetCtx.globalAlpha = p * 0.65;
            targetCtx.strokeStyle = '#fff';
            targetCtx.shadowBlur = 28;
            targetCtx.shadowColor = '#ff0033';
            targetCtx.lineWidth = width * 0.018;
            targetCtx.beginPath();
            targetCtx.moveTo(width * 0.08, 0);
            targetCtx.lineTo(width * 0.52, groundY);
            targetCtx.stroke();
            targetCtx.restore();
        } else if (eventPhase > 0.72) {
            let p = Math.sin((eventPhase - 0.72) / 0.28 * Math.PI);
            targetCtx.save();
            targetCtx.globalAlpha = p * 0.5;
            targetCtx.strokeStyle = '#ff0033';
            targetCtx.fillStyle = 'rgba(255,0,51,0.08)';
            targetCtx.shadowBlur = 30;
            targetCtx.shadowColor = '#ff0033';
            targetCtx.beginPath();
            targetCtx.ellipse(width * 0.27, height * 0.17, width * 0.11, height * 0.045, 0.12, 0, Math.PI * 2);
            targetCtx.fill(); targetCtx.stroke();
            targetCtx.beginPath();
            targetCtx.arc(width * 0.27, height * 0.17, height * 0.018, 0, Math.PI * 2);
            targetCtx.fillStyle = '#fff';
            targetCtx.fill();
            targetCtx.restore();
        }

        let pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        targetCtx.fillStyle = `rgba(255,0,51,${0.08 + pulse * 0.08})`;
        targetCtx.beginPath();
        targetCtx.moveTo(width * 0.04, height * 0.2);
        targetCtx.lineTo(width * 0.34, height * 0.48);
        targetCtx.lineTo(width * 0.21, groundY);
        targetCtx.closePath();
        targetCtx.fill();
        for (let i = 0; i < 7; i++) {
            let y = ((t * (160 + i * 18) + i * 90) % height) - height * 0.05;
            targetCtx.strokeStyle = `rgba(255,255,255,${0.08 + i * 0.01})`;
            targetCtx.lineWidth = 1 + (i % 3);
            targetCtx.beginPath();
            targetCtx.moveTo(width * (0.04 + i * 0.15), y);
            targetCtx.lineTo(width * (0.1 + i * 0.15), y + height * 0.22);
            targetCtx.stroke();
        }

        // floating rock: this is the actual ring-out floor span.
        let L = geo.main.left, R = geo.main.right, T = geo.main.top;
        targetCtx.fillStyle = '#111';
        targetCtx.beginPath();
        targetCtx.moveTo(L, T);
        targetCtx.lineTo(R, T);
        targetCtx.lineTo(R - width * 0.12, T + height * 0.16);
        targetCtx.lineTo(width * 0.5, T + height * 0.23);
        targetCtx.lineTo(L + width * 0.12, T + height * 0.16);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.fillStyle = 'rgba(0,0,0,0.5)';
        targetCtx.beginPath();
        targetCtx.ellipse(width * 0.5, T + height * 0.25, (R - L) * 0.35, height * 0.04, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.strokeStyle = '#e7e7e7';
        targetCtx.lineWidth = 3;
        targetCtx.shadowBlur = 16;
        targetCtx.shadowColor = '#fff';
        targetCtx.beginPath();
        targetCtx.moveTo(L, T);
        targetCtx.lineTo(R, T);
        targetCtx.stroke();
        targetCtx.shadowBlur = 0;
        targetCtx.strokeStyle = 'rgba(255,0,51,0.55)';
        targetCtx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            let x = L + (R - L) * (0.15 + i * 0.13);
            targetCtx.beginPath();
            targetCtx.moveTo(x, T + 4);
            targetCtx.lineTo(x + Math.sin(t + i) * width * 0.025, T + height * (0.08 + (i % 3) * 0.025));
            targetCtx.stroke();
        }
    } else if (stageId === 'megaMansion') {
        let t = performance.now() / 1000;
        let room = targetCtx.createRadialGradient(width * 0.5, height * 0.22, height * 0.05, width * 0.5, height * 0.42, height * 0.92);
        room.addColorStop(0, '#343434');
        room.addColorStop(0.55, '#080808');
        room.addColorStop(1, '#010101');
        targetCtx.fillStyle = room;
        targetCtx.fillRect(0, 0, width, height);

        // towering windows and city lights beyond the estate
        for (let i = 0; i < 7; i++) {
            let x = width * (0.08 + i * 0.14), ww = width * 0.085, y = height * 0.07, h = height * 0.43;
            targetCtx.fillStyle = '#050505';
            targetCtx.strokeStyle = '#555';
            targetCtx.lineWidth = 2;
            targetCtx.fillRect(x - ww / 2, y, ww, h);
            targetCtx.strokeRect(x - ww / 2, y, ww, h);
            targetCtx.strokeStyle = 'rgba(255,255,255,0.13)';
            targetCtx.beginPath();
            targetCtx.moveTo(x, y);
            targetCtx.lineTo(x, y + h);
            targetCtx.moveTo(x - ww / 2, y + h * 0.5);
            targetCtx.lineTo(x + ww / 2, y + h * 0.5);
            targetCtx.stroke();
            for (let k = 0; k < 9; k++) {
                let lx = x - ww * 0.38 + (k % 3) * ww * 0.28;
                let ly = y + h * 0.58 + Math.floor(k / 3) * h * 0.1;
                targetCtx.fillStyle = k % 4 === 0 ? 'rgba(255,0,51,0.24)' : 'rgba(230,230,230,0.16)';
                targetCtx.fillRect(lx, ly, ww * 0.08, h * 0.035);
            }
        }

        // columns, balcony, and a private trophy mezzanine.
        targetCtx.fillStyle = '#060606';
        targetCtx.strokeStyle = '#444';
        targetCtx.lineWidth = 2;
        targetCtx.fillRect(0, height * 0.48, width, height * 0.055);
        targetCtx.strokeRect(0, height * 0.48, width, height * 0.055);
        for (let i = 0; i < 6; i++) {
            let x = width * (0.08 + i * 0.17);
            targetCtx.fillStyle = '#0d0d0d';
            targetCtx.fillRect(x - width * 0.015, height * 0.2, width * 0.03, groundY - height * 0.2);
            targetCtx.strokeStyle = 'rgba(255,255,255,0.18)';
            targetCtx.strokeRect(x - width * 0.015, height * 0.2, width * 0.03, groundY - height * 0.2);
            targetCtx.fillStyle = '#171717';
            targetCtx.fillRect(x - width * 0.028, height * 0.49, width * 0.056, height * 0.018);
        }

        // grand split staircase
        targetCtx.strokeStyle = '#4b4b4b';
        targetCtx.fillStyle = '#0c0c0c';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(width * 0.18, groundY - height * 0.03);
        targetCtx.quadraticCurveTo(width * 0.32, height * 0.58, width * 0.48, height * 0.43);
        targetCtx.lineTo(width * 0.52, height * 0.43);
        targetCtx.quadraticCurveTo(width * 0.68, height * 0.58, width * 0.82, groundY - height * 0.03);
        targetCtx.lineTo(width * 0.72, groundY - height * 0.03);
        targetCtx.quadraticCurveTo(width * 0.62, height * 0.66, width * 0.5, height * 0.52);
        targetCtx.quadraticCurveTo(width * 0.38, height * 0.66, width * 0.28, groundY - height * 0.03);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        targetCtx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            targetCtx.beginPath();
            targetCtx.moveTo(width * (0.23 + i * 0.035), groundY - height * (0.035 + i * 0.035));
            targetCtx.lineTo(width * (0.77 - i * 0.035), groundY - height * (0.035 + i * 0.035));
            targetCtx.stroke();
        }

        // chandelier and trophy portraits
        targetCtx.save();
        targetCtx.translate(width * 0.5, height * 0.16);
        targetCtx.strokeStyle = '#d4d4d4';
        targetCtx.fillStyle = '#111';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, -height * 0.16); targetCtx.lineTo(0, 0); targetCtx.stroke();
        targetCtx.beginPath(); targetCtx.ellipse(0, 0, width * 0.09, height * 0.025, 0, 0, Math.PI * 2); targetCtx.stroke();
        targetCtx.beginPath(); targetCtx.ellipse(0, height * 0.025, width * 0.14, height * 0.018, 0, 0, Math.PI * 2); targetCtx.stroke();
        for (let i = -3; i <= 3; i++) {
            let flame = 0.5 + 0.5 * Math.sin(t * 4 + i);
            targetCtx.fillStyle = `rgba(255,${80 + flame * 120},${90 + flame * 90},0.75)`;
            targetCtx.beginPath();
            targetCtx.arc(i * width * 0.025, height * 0.01, 3 + flame * 2, 0, Math.PI * 2);
            targetCtx.fill();
        }
        targetCtx.restore();
        drawMansionPortrait(targetCtx, width * 0.055, height * 0.2, width * 0.1, height * 0.19, 'HEIR');
        drawMansionPortrait(targetCtx, width * 0.845, height * 0.2, width * 0.1, height * 0.19, 'HOST');

        // Indoor fountain and velvet carpet to give the stage a centerpiece.
        targetCtx.save();
        targetCtx.translate(width * 0.5, groundY - height * 0.07);
        targetCtx.fillStyle = '#060606';
        targetCtx.strokeStyle = '#777';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, width * 0.13, height * 0.028, 0, 0, Math.PI * 2);
        targetCtx.fill(); targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.moveTo(-width * 0.045, 0);
        targetCtx.quadraticCurveTo(0, -height * 0.085, width * 0.045, 0);
        targetCtx.stroke();
        targetCtx.strokeStyle = 'rgba(255,255,255,0.34)';
        for (let i = -2; i <= 2; i++) {
            targetCtx.beginPath();
            targetCtx.moveTo(i * width * 0.018, -height * 0.075);
            targetCtx.quadraticCurveTo(i * width * 0.035, -height * (0.045 + Math.sin(t * 2 + i) * 0.008), i * width * 0.055, -height * 0.006);
            targetCtx.stroke();
        }
        targetCtx.restore();
        targetCtx.fillStyle = 'rgba(255,0,51,0.16)';
        targetCtx.beginPath();
        targetCtx.moveTo(width * 0.43, groundY);
        targetCtx.lineTo(width * 0.57, groundY);
        targetCtx.lineTo(width * 0.68, height);
        targetCtx.lineTo(width * 0.32, height);
        targetCtx.closePath();
        targetCtx.fill();

        // polished marble arena floor
        targetCtx.fillStyle = '#080808';
        targetCtx.fillRect(0, groundY - height * 0.025, width, height * 0.025);
        targetCtx.fillRect(0, groundY, width, height - groundY);
        targetCtx.fillStyle = 'rgba(255,0,51,0.2)';
        targetCtx.beginPath();
        targetCtx.moveTo(width * 0.42, groundY);
        targetCtx.lineTo(width * 0.58, groundY);
        targetCtx.lineTo(width * 0.72, height);
        targetCtx.lineTo(width * 0.28, height);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.strokeStyle = '#888';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
        targetCtx.strokeStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < 9; i++) {
            let x = i * width / 8;
            targetCtx.beginPath(); targetCtx.moveTo(x, groundY); targetCtx.lineTo(width * 0.5 + (x - width * 0.5) * 0.25, groundY - height * 0.12); targetCtx.stroke();
        }
    } else if (stageId === 'livingGraveyard') {
        let t = performance.now() / 1000;
        let sky = targetCtx.createRadialGradient(width * 0.52, height * 0.16, 10, width * 0.52, height * 0.28, height * 0.9);
        sky.addColorStop(0, '#303030');
        sky.addColorStop(0.34, '#101010');
        sky.addColorStop(1, '#030303');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        // huge moon and its clean white wash across the arena
        targetCtx.save();
        targetCtx.shadowBlur = 58;
        targetCtx.shadowColor = '#fff';
        targetCtx.fillStyle = '#e5e5e5';
        targetCtx.beginPath();
        targetCtx.arc(width * 0.52, height * 0.18, height * 0.17, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.shadowBlur = 0;
        targetCtx.fillStyle = 'rgba(5,5,5,0.55)';
        targetCtx.beginPath();
        targetCtx.arc(width * 0.57, height * 0.14, height * 0.145, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.restore();
        let beam = targetCtx.createLinearGradient(0, height * 0.25, 0, groundY);
        beam.addColorStop(0, 'rgba(255,255,255,0.16)');
        beam.addColorStop(1, 'rgba(255,255,255,0.03)');
        targetCtx.fillStyle = beam;
        targetCtx.beginPath();
        targetCtx.moveTo(width * 0.42, height * 0.26);
        targetCtx.lineTo(width * 0.62, height * 0.26);
        targetCtx.lineTo(width * 0.78, groundY);
        targetCtx.lineTo(width * 0.18, groundY);
        targetCtx.closePath();
        targetCtx.fill();

        // fog bands drifting just above the graves
        for (let i = 0; i < 5; i++) {
            targetCtx.fillStyle = `rgba(255,255,255,${0.035 + i * 0.008})`;
            let y = groundY - height * (0.22 - i * 0.035);
            let off = (t * (18 + i * 7) + i * 90) % (width + 220) - 110;
            targetCtx.beginPath();
            targetCtx.ellipse(off, y, width * 0.22, height * 0.025, 0, 0, Math.PI * 2);
            targetCtx.ellipse(off + width * 0.55, y + 7, width * 0.26, height * 0.022, 0, 0, Math.PI * 2);
            targetCtx.fill();
        }

        // crooked grave markers and iron fence silhouettes
        targetCtx.strokeStyle = '#242424';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY - height * 0.20); targetCtx.lineTo(width, groundY - height * 0.20); targetCtx.stroke();
        for (let x = -20; x < width + 30; x += width * 0.065) {
            targetCtx.beginPath();
            targetCtx.moveTo(x, groundY - height * 0.20);
            targetCtx.lineTo(x, groundY - height * 0.30);
            targetCtx.stroke();
        }
        for (let i = 0; i < 16; i++) {
            let x = width * ((i * 0.073 + 0.05) % 1);
            let y = groundY - height * (0.04 + (i % 3) * 0.035);
            let w = width * (0.025 + (i % 2) * 0.012);
            let h = height * (0.07 + (i % 4) * 0.012);
            targetCtx.save();
            targetCtx.translate(x, y);
            targetCtx.rotate(((i % 5) - 2) * 0.055);
            targetCtx.fillStyle = i % 4 === 0 ? '#1d1d1d' : '#141414';
            targetCtx.strokeStyle = '#4a4a4a';
            targetCtx.lineWidth = 1.5;
            targetCtx.beginPath();
            targetCtx.moveTo(-w / 2, 0);
            targetCtx.lineTo(-w / 2, -h * 0.68);
            targetCtx.quadraticCurveTo(0, -h, w / 2, -h * 0.68);
            targetCtx.lineTo(w / 2, 0);
            targetCtx.closePath();
            targetCtx.fill(); targetCtx.stroke();
            if (i % 3 === 0) {
                targetCtx.beginPath(); targetCtx.moveTo(0, -h * 0.72); targetCtx.lineTo(0, -h * 0.38); targetCtx.moveTo(-w * 0.22, -h * 0.55); targetCtx.lineTo(w * 0.22, -h * 0.55); targetCtx.stroke();
            }
            targetCtx.restore();
        }
        // animated ghosts in the background
        for (let i = 0; i < 6; i++) {
            let x = ((t * (22 + i * 6) + i * width * 0.18) % (width + 120)) - 60;
            let y = height * (0.30 + (i % 3) * 0.09) + Math.sin(t * 0.7 + i) * height * 0.035;
            drawGhostShape(targetCtx, x, y, height / 520 * (0.75 + (i % 2) * 0.35), t * 1.5 + i);
        }
        targetCtx.fillStyle = '#090909';
        targetCtx.fillRect(0, groundY, width, height - groundY);
        targetCtx.strokeStyle = '#777'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
    } else if (stageId === 'darkCastle') {
        let t = performance.now() / 1000;
        let flash = Math.max(0, Math.sin(t * 1.7 + 1.5));
        flash = flash > 0.94 ? (flash - 0.94) / 0.06 : 0;
        let room = targetCtx.createLinearGradient(0, 0, 0, height);
        room.addColorStop(0, flash > 0 ? '#2b2b2b' : '#121212');
        room.addColorStop(0.5, '#070707');
        room.addColorStop(1, '#020202');
        targetCtx.fillStyle = room;
        targetCtx.fillRect(0, 0, width, height);

        // tall castle windows with rain and occasional lightning outside
        let windowXs = [0.16, 0.34, 0.66, 0.84];
        for (let i = 0; i < windowXs.length; i++) {
            let x = width * windowXs[i], ww = width * 0.105, wy = height * 0.08, wh = height * 0.42;
            targetCtx.fillStyle = flash > 0 ? `rgba(220,220,220,${0.35 + flash * 0.5})` : '#0a0a0a';
            targetCtx.strokeStyle = '#454545';
            targetCtx.lineWidth = 3;
            targetCtx.beginPath();
            targetCtx.moveTo(x - ww / 2, wy + wh);
            targetCtx.lineTo(x - ww / 2, wy + ww * 0.5);
            targetCtx.quadraticCurveTo(x, wy - ww * 0.25, x + ww / 2, wy + ww * 0.5);
            targetCtx.lineTo(x + ww / 2, wy + wh);
            targetCtx.closePath();
            targetCtx.fill(); targetCtx.stroke();
            targetCtx.strokeStyle = 'rgba(255,255,255,0.18)';
            targetCtx.lineWidth = 1;
            for (let r = 0; r < 9; r++) {
                let rx = x - ww * 0.38 + ((r * 17 + t * 120) % (ww * 0.76));
                targetCtx.beginPath(); targetCtx.moveTo(rx, wy + 12); targetCtx.lineTo(rx - ww * 0.16, wy + wh - 10); targetCtx.stroke();
            }
            targetCtx.strokeStyle = '#333';
            targetCtx.beginPath(); targetCtx.moveTo(x, wy + 6); targetCtx.lineTo(x, wy + wh); targetCtx.moveTo(x - ww / 2, wy + wh * 0.55); targetCtx.lineTo(x + ww / 2, wy + wh * 0.55); targetCtx.stroke();
        }
        if (flash > 0) {
            targetCtx.save();
            targetCtx.globalAlpha = flash;
            targetCtx.strokeStyle = '#fff';
            targetCtx.shadowBlur = 18;
            targetCtx.shadowColor = '#fff';
            targetCtx.lineWidth = 3;
            let bx = width * 0.78;
            targetCtx.beginPath();
            targetCtx.moveTo(bx, 0);
            targetCtx.lineTo(bx - width * 0.04, height * 0.13);
            targetCtx.lineTo(bx + width * 0.015, height * 0.22);
            targetCtx.lineTo(bx - width * 0.055, height * 0.36);
            targetCtx.stroke();
            targetCtx.restore();
        }

        // distant throne dais, stone floor, and the central throne
        targetCtx.fillStyle = '#101010';
        targetCtx.fillRect(0, groundY - height * 0.12, width, height * 0.12);
        targetCtx.strokeStyle = '#333'; targetCtx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
            let y = groundY - height * 0.12 + i * height * 0.024;
            targetCtx.beginPath(); targetCtx.moveTo(0, y); targetCtx.lineTo(width, y); targetCtx.stroke();
        }
        targetCtx.fillStyle = '#0a0a0a';
        targetCtx.fillRect(width * 0.34, groundY - height * 0.15, width * 0.32, height * 0.065);
        targetCtx.strokeStyle = '#555'; targetCtx.lineWidth = 2;
        targetCtx.strokeRect(width * 0.34, groundY - height * 0.15, width * 0.32, height * 0.065);

        let tx = width * 0.5, ty = groundY - height * 0.15;
        targetCtx.save();
        targetCtx.translate(tx, ty);
        targetCtx.fillStyle = '#080808';
        targetCtx.strokeStyle = '#686868';
        targetCtx.lineWidth = 2.3;
        targetCtx.beginPath();
        targetCtx.moveTo(-width * 0.058, 0);
        targetCtx.lineTo(-width * 0.05, -height * 0.21);
        targetCtx.lineTo(-width * 0.027, -height * 0.17);
        targetCtx.lineTo(0, -height * 0.26);
        targetCtx.lineTo(width * 0.027, -height * 0.17);
        targetCtx.lineTo(width * 0.05, -height * 0.21);
        targetCtx.lineTo(width * 0.058, 0);
        targetCtx.closePath();
        targetCtx.fill(); targetCtx.stroke();
        targetCtx.fillStyle = '#161616';
        targetCtx.fillRect(-width * 0.065, -height * 0.012, width * 0.13, height * 0.045);
        targetCtx.strokeRect(-width * 0.065, -height * 0.012, width * 0.13, height * 0.045);
        targetCtx.restore();

        let occupied = targetCtx !== ctx ? true : !isDarkRulerInFight();
        if (occupied) {
            drawThroneDarkRuler(targetCtx, tx, ty + height * 0.018, height / 740);
            drawStabbedWeapon(targetCtx, tx + width * 0.065, ty + height * 0.035, height / 650, 'sword', -0.04);
        }

        // stabbed weapons littering the throne room floor
        let weapons = [
            [0.13, 'spear', -0.18], [0.22, 'sword', 0.12], [0.32, 'axe', -0.1],
            [0.68, 'sword', -0.12], [0.78, 'spear', 0.16], [0.89, 'axe', 0.09]
        ];
        weapons.forEach((w, i) => drawStabbedWeapon(targetCtx, width * w[0], groundY - height * (0.01 + (i % 2) * 0.015), height / 520, w[1], w[2]));
        targetCtx.fillStyle = '#070707';
        targetCtx.fillRect(0, groundY, width, height - groundY);
        targetCtx.strokeStyle = '#777'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
    } else if (stageId === 'pStreet') {
        // ---- P STREET: greyscale downtown at night. The sidewalk recedes into a back
        // road with traffic, so the spectators stand on real ground, not mid-air. ----
        let t = performance.now() / 1000;
        let sky = targetCtx.createLinearGradient(0, 0, 0, groundY);
        sky.addColorStop(0, '#0c0c0c'); sky.addColorStop(1, '#060606');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        let roadTop = groundY - height * 0.30;   // building bases / far side of the road
        let walkBack = groundY - height * 0.13;  // back edge of the sidewalk (spectators stand here)

        // distant buildings with lit windows
        let bw = width / 7;
        for (let i = 0; i < 8; i++) {
            let bx = i * bw - bw * 0.25;
            let bh = height * (0.20 + ((i * 53) % 17) / 17 * 0.26);
            let shade = 14 + ((i * 7) % 5) * 4;
            targetCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
            targetCtx.fillRect(bx, roadTop - bh, bw * 0.92, bh + 6);
            for (let wy = roadTop - bh + 12; wy < roadTop - 8; wy += 16) {
                for (let wx = bx + 8; wx < bx + bw * 0.92 - 8; wx += 14) {
                    let lit = ((Math.floor(wx) * 13 + Math.floor(wy) * 7) % 5) < 2;
                    targetCtx.fillStyle = lit ? 'rgba(225,225,225,0.4)' : 'rgba(110,110,110,0.08)';
                    targetCtx.fillRect(wx, wy, 7, 9);
                }
            }
        }

        // back road with lane dashes + passing cars
        targetCtx.fillStyle = '#0a0a0a';
        targetCtx.fillRect(0, roadTop, width, walkBack - roadTop);
        targetCtx.fillStyle = '#363636';
        let laneY = roadTop + (walkBack - roadTop) * 0.52;
        for (let x = -((t * 40) % 70); x < width; x += 70) targetCtx.fillRect(x, laneY, 34, 3);
        drawStreetCar(targetCtx, ((t * 70) % (width + 280)) - 140, roadTop + (walkBack - roadTop) * 0.34, 1, height);
        drawStreetCar(targetCtx, width - (((t * 96) % (width + 340)) - 170), roadTop + (walkBack - roadTop) * 0.72, -1, height);

        // traffic lights at the roadside (cycle through their lamps)
        drawTrafficLight(targetCtx, width * 0.2, walkBack, height, t);
        drawTrafficLight(targetCtx, width * 0.78, walkBack, height, t + 1.3);

        // the sidewalk: spectators at the back edge, fighters across the front
        let sg = targetCtx.createLinearGradient(0, walkBack, 0, height);
        sg.addColorStop(0, '#1c1c1c'); sg.addColorStop(1, '#0d0d0d');
        targetCtx.fillStyle = sg;
        targetCtx.fillRect(0, walkBack, width, height - walkBack);
        targetCtx.strokeStyle = '#555'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, walkBack); targetCtx.lineTo(width, walkBack); targetCtx.stroke();
        targetCtx.strokeStyle = '#333'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
        targetCtx.strokeStyle = 'rgba(255,255,255,0.05)'; targetCtx.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
            let x = width * (i / 6);
            targetCtx.beginPath(); targetCtx.moveTo(x, walkBack); targetCtx.lineTo(x + (x - width / 2) * 0.35, height); targetCtx.stroke();
        }

        if (targetCtx !== ctx) { // static spectators in thumbnails (live draws animated ones)
            let s = height / 460;
            for (let i = 0; i < 5; i++) drawBgStickman(targetCtx, width * (0.12 + i * 0.18), walkBack, s, 85, 'spectate', i * 1.3, 1);
        }
    } else if (stageId === 'bloodBall') {
        // ---- BLOOD BALL: greyscale disco club ----
        let t = performance.now() / 1000;
        let sky = targetCtx.createRadialGradient(width * 0.5, height * 0.18, 10, width * 0.5, height * 0.5, height * 0.95);
        sky.addColorStop(0, '#1b1b1b'); sky.addColorStop(0.5, '#0a0a0a'); sky.addColorStop(1, '#040404');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        let cx = width * 0.5, cy = height * 0.17, br = height * 0.085;
        // rotating light beams
        targetCtx.save();
        targetCtx.globalAlpha = 0.09;
        for (let i = 0; i < 6; i++) {
            let ang = t * 0.6 + i * Math.PI / 3;
            targetCtx.fillStyle = i % 2 ? '#fff' : '#888';
            targetCtx.beginPath();
            targetCtx.moveTo(cx, cy);
            targetCtx.lineTo(cx + Math.cos(ang) * width, cy + Math.abs(Math.sin(ang)) * height * 1.3);
            targetCtx.lineTo(cx + Math.cos(ang + 0.16) * width, cy + Math.abs(Math.sin(ang + 0.16)) * height * 1.3);
            targetCtx.closePath(); targetCtx.fill();
        }
        targetCtx.restore();
        // pulsing dance floor
        let fT = groundY - height * 0.02;
        let cols = 8;
        for (let r = 0; r < 4; r++) {
            let yy = fT + (height - fT) * (r / 4), yy2 = fT + (height - fT) * ((r + 1) / 4);
            for (let cI = 0; cI < cols; cI++) {
                let x0 = width * (0.16 + 0.68 * (cI / cols)), x1 = width * (0.16 + 0.68 * ((cI + 1) / cols));
                let pulse = 0.5 + 0.5 * Math.sin(t * 4 + cI + r * 1.7);
                let v = Math.floor(34 + pulse * 150);
                targetCtx.fillStyle = `rgb(${v},${v},${v})`;
                targetCtx.fillRect(x0, yy, x1 - x0 - 2, yy2 - yy - 2);
            }
        }
        // disco ball
        targetCtx.strokeStyle = '#555'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(cx, 0); targetCtx.lineTo(cx, cy - br); targetCtx.stroke();
        targetCtx.save();
        targetCtx.translate(cx, cy);
        targetCtx.beginPath(); targetCtx.arc(0, 0, br, 0, Math.PI * 2); targetCtx.clip();
        let spin = t * 0.8, fs = br / 3.2;
        for (let yy = -br; yy < br; yy += fs) {
            for (let xx = -br; xx < br; xx += fs) {
                let b = 0.5 + 0.5 * Math.sin((xx / fs) * 0.9 + spin * 3 + (yy / fs) * 0.5);
                let v = Math.floor(40 + b * 205);
                targetCtx.fillStyle = `rgb(${v},${v},${v})`;
                targetCtx.fillRect(xx, yy, fs - 1.5, fs - 1.5);
            }
        }
        targetCtx.restore();
        targetCtx.strokeStyle = 'rgba(0,0,0,0.5)'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.arc(cx, cy, br, 0, Math.PI * 2); targetCtx.stroke();
        targetCtx.fillStyle = 'rgba(255,255,255,0.85)';
        targetCtx.beginPath(); targetCtx.arc(cx - br * 0.35, cy - br * 0.35, br * 0.12, 0, Math.PI * 2); targetCtx.fill();
        // floor line
        targetCtx.strokeStyle = '#333'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
        if (targetCtx !== ctx) {
            let s = height / 430;
            for (let i = 0; i < 5; i++) drawBgStickman(targetCtx, width * (0.2 + i * 0.15), groundY - height * 0.01, s, 95, 'dance', i * 1.7 + t, 1);
        }
    } else if (stageId === 'championsArena') {
        drawChampionsArena(targetCtx, width, height, groundY);
    } else {
        // ---- ORIGINAL / DOJO: a plain room. A back wall behind the floor so blood
        // can splatter across it, with a baseboard where wall meets ground. ----
        let wall = targetCtx.createLinearGradient(0, 0, 0, groundY);
        wall.addColorStop(0, '#0c0c0c'); wall.addColorStop(1, '#070707');
        targetCtx.fillStyle = wall;
        targetCtx.fillRect(0, 0, width, groundY);
        // faint vertical paneling on the wall
        targetCtx.strokeStyle = 'rgba(255,255,255,0.035)'; targetCtx.lineWidth = 2;
        for (let x = width * 0.12; x < width; x += width * 0.16) {
            targetCtx.beginPath(); targetCtx.moveTo(x, height * 0.06); targetCtx.lineTo(x, groundY); targetCtx.stroke();
        }
        // floor
        targetCtx.fillStyle = '#050505';
        targetCtx.fillRect(0, groundY, width, height - groundY);
        // baseboard + floor line
        targetCtx.strokeStyle = '#2a2a2a'; targetCtx.lineWidth = 4;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
        targetCtx.strokeStyle = '#333'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY + 5); targetCtx.lineTo(width, groundY + 5); targetCtx.stroke();
    }
}

// ---- CHAMPIONS ARENA: a sports stadium. Tiered stands packed with crowd ring the
// background, and a giant jumbotron hangs center-stage mirroring the live battle. ----
function drawChampionsArena(c, width, height, groundY) {
    let t = performance.now() / 1000;
    let bg = c.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0a0a0a'); bg.addColorStop(0.6, '#0f0f0f'); bg.addColorStop(1, '#070707');
    c.fillStyle = bg; c.fillRect(0, 0, width, height);

    // --- Tiered stands sweeping up the back, with a packed crowd ---
    let standsTop = height * 0.20, standsBottom = groundY - height * 0.05;
    let rows = 7;
    for (let r = 0; r < rows; r++) {
        let f0 = r / rows, f1 = (r + 1) / rows;
        let yTop = standsBottom + (standsTop - standsBottom) * f1;
        let yBot = standsBottom + (standsTop - standsBottom) * f0;
        // each tier is a touch lighter toward the front
        let shade = 16 + r * 3;
        c.fillStyle = `rgb(${shade},${shade},${shade})`;
        c.fillRect(0, yTop, width, yBot - yTop + 1);
        // crowd: rows of little heads, shimmering slightly so the stands feel alive
        let headR = Math.max(1.4, (yBot - yTop) * 0.22);
        let step = headR * 2.6;
        for (let x = step * 0.5; x < width; x += step) {
            let flick = ((Math.floor(x) * 7 + r * 31 + Math.floor(t * 2)) % 11);
            let v = flick < 2 ? 150 : (60 + ((Math.floor(x) + r) % 4) * 22);
            c.fillStyle = `rgb(${v},${v},${v})`;
            c.beginPath();
            c.arc(x + Math.sin(t * 1.5 + x) * 0.6, yTop + (yBot - yTop) * 0.5, headR, 0, Math.PI * 2);
            c.fill();
        }
    }
    // railing between the stands and the field
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, standsBottom); c.lineTo(width, standsBottom); c.stroke();

    // --- Arena floor / court markings ---
    c.fillStyle = '#0c0c0c';
    c.fillRect(0, groundY, width, height - groundY);
    c.strokeStyle = '#444'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, groundY); c.lineTo(width, groundY); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 2;
    // center line + center circle painted on the floor
    c.beginPath(); c.moveTo(width * 0.5, groundY); c.lineTo(width * 0.5, height); c.stroke();
    c.beginPath(); c.ellipse(width * 0.5, groundY + (height - groundY) * 0.55, width * 0.12, (height - groundY) * 0.4, 0, 0, Math.PI * 2); c.stroke();

    // --- The JUMBOTRON hanging center-stage ---
    let mw = width * 0.30, mh = mw * 0.52;
    let mx = width * 0.5 - mw / 2, my = height * 0.045;
    // suspension cables to the top of the screen
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(width * 0.5 - mw * 0.3, 0); c.lineTo(width * 0.5 - mw * 0.3, my); c.stroke();
    c.beginPath(); c.moveTo(width * 0.5 + mw * 0.3, 0); c.lineTo(width * 0.5 + mw * 0.3, my); c.stroke();
    // housing / frame
    c.fillStyle = '#161616';
    c.fillRect(mx - 8, my - 8, mw + 16, mh + 16);
    c.strokeStyle = '#555'; c.lineWidth = 3;
    c.strokeRect(mx - 8, my - 8, mw + 16, mh + 16);

    // screen contents: a live feed of the fight (only on the real canvas, not thumbnails)
    let sx = mx, sy = my, sw = mw, sh = mh;
    c.save();
    c.beginPath(); c.rect(sx, sy, sw, sh); c.clip();
    c.fillStyle = '#06121c'; c.fillRect(sx, sy, sw, sh);
    if (c === ctx && typeof players !== 'undefined' && players.length) {
        // frame the action: center on the living fighters, mapped into the screen rect
        let alive = players.filter(p => p && p.state !== 'DEAD');
        let group = alive.length ? alive : players;
        let fx = group.reduce((a, p) => a + p.x, 0) / group.length;
        fx = Math.max(width * 0.28, Math.min(width * 0.72, fx));
        let fy = groundY - height * 0.08;
        let viewW = width * 0.42, sc = sw / viewW;
        c.translate(sx + sw / 2, sy + sh / 2);
        c.scale(sc, sc);
        c.translate(-fx, -fy);
        // mini ground line + the live fighters
        c.strokeStyle = '#15303f'; c.lineWidth = 3 / sc;
        c.beginPath(); c.moveTo(fx - viewW, groundY); c.lineTo(fx + viewW, groundY); c.stroke();
        players.forEach(p => { if (p && p.draw) p.draw(c); });
    } else {
        // thumbnail / pre-fight: a stylized "LIVE" placeholder
        c.fillStyle = '#9ad8ff'; c.font = `bold ${Math.floor(sh * 0.3)}px monospace`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('LIVE', sx + sw / 2, sy + sh / 2);
    }
    c.restore();
    // glassy scanlines over the screen
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 1;
    for (let yy = sy + 2; yy < sy + sh; yy += 4) { c.beginPath(); c.moveTo(sx, yy); c.lineTo(sx + sw, yy); c.stroke(); }
    // a red "● LIVE" tag in the corner of the screen
    c.fillStyle = '#ff0033'; c.beginPath(); c.arc(sx + 12, sy + 11, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 10px monospace'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('LIVE', sx + 20, sy + 11);
}

// ---------------- ANIMATED STAGE BACKGROUND ACTORS ----------------
// P Street spectators / Blood Ball dancers. Purely cosmetic; they animate in place
// and all flee toward the nearest edge when an overkill happens.
function initStageActors() {
    stageActors = null;
    if (selectedStage === 'pStreet') {
        let arr = [], n = 9;
        for (let i = 0; i < n; i++) {
            let x = 55 + i * (WIDTH - 110) / (n - 1) + (Math.random() * 28 - 14);
            arr.push({ x, y: GROUND_Y - HEIGHT * 0.13, phase: Math.random() * Math.PI * 2,
                       rate: 1.4 + Math.random() * 1.2, scale: 0.5 + Math.random() * 0.12,
                       shade: 70 + Math.floor(Math.random() * 60), dir: Math.random() < 0.5 ? 1 : -1,
                       fleeing: false, gone: false });
        }
        stageActors = { type: 'pStreet', actors: arr };
    } else if (selectedStage === 'bloodBall') {
        let arr = [], n = 8;
        for (let i = 0; i < n; i++) {
            let x = WIDTH * 0.16 + i * (WIDTH * 0.68) / (n - 1) + (Math.random() * 22 - 11);
            arr.push({ x, y: GROUND_Y - HEIGHT * 0.015, phase: Math.random() * Math.PI * 2,
                       rate: 2.6 + Math.random() * 2.4, scale: 0.58 + Math.random() * 0.16,
                       shade: 80 + Math.floor(Math.random() * 60), dir: Math.random() < 0.5 ? 1 : -1,
                       fleeing: false, gone: false });
        }
        stageActors = { type: 'bloodBall', actors: arr };
    }
}

function updateStageActors(dt) {
    if (!stageActors) return;
    for (let a of stageActors.actors) {
        if (a.gone) continue;
        a.phase += dt * a.rate;
        if (a.fleeing) {
            a.x += a.fleeDir * 520 * dt;
            if (a.x < -50 || a.x > WIDTH + 50) a.gone = true;
        }
    }
}

function stageActorsFlee() {
    if (!stageActors) return;
    for (let a of stageActors.actors) {
        if (a.gone || a.fleeing) continue;
        a.fleeing = true;
        a.fleeDir = a.x < WIDTH / 2 ? -1 : 1; // bolt for the nearest edge
        a.rate = 7 + Math.random() * 3;        // frantic limbs
    }
}

function drawStageActors(c) {
    if (!stageActors) return;
    let resting = stageActors.type === 'bloodBall' ? 'dance' : 'spectate';
    for (let a of stageActors.actors) {
        if (a.gone) continue;
        let mode = a.fleeing ? 'run' : resting;
        drawBgStickman(c, a.x, a.y, a.scale, a.shade, mode, a.phase, a.fleeing ? a.fleeDir : a.dir);
    }
}

// A small greyscale background stickman. mode: 'spectate' | 'dance' | 'run'.
function drawBgStickman(c, x, gy, s, shade, mode, ph, dir) {
    const col = `rgb(${shade},${shade},${shade})`;
    const HIP = -44, SH = -70, HEAD = -82, HR = 8;
    let sway = 0, bob = 0, legA, legB, armA, armB;

    if (mode === 'run') {
        let sw = Math.sin(ph) * 16;
        legA = { x: sw, y: -Math.max(0, Math.sin(ph)) * 8 };
        legB = { x: -sw, y: -Math.max(0, -Math.sin(ph)) * 8 };
        armA = { x: -sw, y: SH + 10 };
        armB = { x: sw, y: SH + 10 };
        bob = -Math.abs(Math.sin(ph * 2)) * 4;
    } else if (mode === 'dance') {
        sway = Math.sin(ph) * 5;
        bob = -Math.abs(Math.sin(ph * 2)) * 7;
        let sw = Math.sin(ph) * 5;
        legA = { x: 8 + sw * 0.3, y: 0 };
        legB = { x: -8 + sw * 0.3, y: 0 };
        armA = { x: 15 + Math.sin(ph * 1.2) * 6, y: SH - 20 + Math.cos(ph) * 5 };
        armB = { x: -15 + Math.sin(ph * 1.2 + 1) * 6, y: SH - 20 + Math.cos(ph + 1) * 5 };
    } else { // spectate — stand and gently shift, occasional little cheer
        sway = Math.sin(ph * 0.6) * 2;
        bob = -Math.abs(Math.sin(ph * 0.6)) * 1.5;
        legA = { x: 7, y: 0 };
        legB = { x: -7, y: 0 };
        let lift = Math.max(0, Math.sin(ph * 0.5)) * 22;
        armA = { x: 9, y: SH + 18 - lift };
        armB = { x: -9, y: SH + 18 - lift };
    }

    c.save();
    c.translate(x, gy);
    c.scale(s * (dir || 1), s);
    c.translate(sway, bob);
    c.strokeStyle = col; c.fillStyle = col;
    c.lineWidth = 4.5; c.lineCap = 'round'; c.lineJoin = 'round';
    drawBgLimb(c, 0, HIP, legA.x, legA.y);   // legs
    drawBgLimb(c, 0, HIP, legB.x, legB.y);
    c.beginPath(); c.moveTo(0, HIP); c.lineTo(0, SH); c.stroke();   // torso
    drawBgLimb(c, 0, SH, armA.x, armA.y);     // arms
    drawBgLimb(c, 0, SH, armB.x, armB.y);
    c.beginPath(); c.arc(0, HEAD, HR, 0, Math.PI * 2); c.fill();    // head
    c.restore();
}
function drawBgLimb(c, x0, y0, x1, y1) {
    let mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 3; // slight bend = natural joint
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
}

// A small greyscale car for the P Street back road. (x,y) is the road surface under the wheels.
function drawStreetCar(c, x, y, dir, H) {
    let w = H * 0.14, h = H * 0.052;
    c.save();
    c.translate(x, y);
    c.fillStyle = '#2b2b2b';
    c.beginPath();
    c.moveTo(-w / 2, 0);
    c.lineTo(-w / 2, -h * 0.55);
    c.lineTo(-w * 0.28, -h * 0.55);
    c.lineTo(-w * 0.15, -h);          // windshield up to roof
    c.lineTo(w * 0.18, -h);
    c.lineTo(w * 0.31, -h * 0.55);
    c.lineTo(w / 2, -h * 0.55);
    c.lineTo(w / 2, 0);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(200,200,200,0.45)'; // windows
    c.fillRect(-w * 0.22, -h * 0.92, w * 0.18, h * 0.32);
    c.fillRect(w * 0.02, -h * 0.92, w * 0.15, h * 0.32);
    c.fillStyle = '#000';                   // tyres
    c.beginPath(); c.arc(-w * 0.28, 0, h * 0.34, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(w * 0.28, 0, h * 0.34, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#555';
    c.beginPath(); c.arc(-w * 0.28, 0, h * 0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(w * 0.28, 0, h * 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(240,240,240,0.55)'; // headlight in travel direction
    c.beginPath(); c.arc(dir * w * 0.5, -h * 0.28, 2.5, 0, Math.PI * 2); c.fill();
    c.restore();
}

// A roadside traffic light whose three lamps cycle (greyscale: the live lamp glows).
function drawTrafficLight(c, x, baseY, H, phase) {
    let poleH = H * 0.22, boxW = H * 0.038, boxH = H * 0.10;
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, baseY); c.lineTo(x, baseY - poleH); c.stroke();
    let bx = x - boxW / 2, by = baseY - poleH - boxH;
    c.fillStyle = '#161616'; c.fillRect(bx, by, boxW, boxH);
    c.strokeStyle = '#444'; c.lineWidth = 1; c.strokeRect(bx, by, boxW, boxH);
    let active = Math.floor(phase % 3), r = boxW * 0.3;
    for (let i = 0; i < 3; i++) {
        let cyy = by + boxH * (0.22 + i * 0.29);
        let lit = i === active;
        c.fillStyle = lit ? '#eee' : '#2e2e2e';
        if (lit) { c.shadowBlur = 9; c.shadowColor = '#fff'; }
        c.beginPath(); c.arc(x, cyy, r, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
    }
}

// ---------------- LADDER CLIMB SCREEN ----------------
const LADDER_ICON_FILE = { BRAWLER: 'brawler', SWORDSMAN: 'swordsman', MAGE: 'mage', RANGER: 'ranger', DARK_RULER: 'darkruler', TELEPATH: 'telepath', BEAST_TAMER: 'beasttamer', PHANTOM: 'phantom', COPYCAT: 'copycat', CULT: 'cult', LUMATROSSIA: 'lumatrossia', TWINS: 'twins', TRAVELER: 'traveler', ZOMBIE: 'zombie' };
let _charIconCache = {};
function getCharIcon(type) {
    if (type in _charIconCache) return _charIconCache[type];
    let f = LADDER_ICON_FILE[type];
    if (!f) { _charIconCache[type] = null; return null; }
    let img = new Image();
    img.src = 'textures/icons/' + f + '.png';
    _charIconCache[type] = img;
    return img;
}
function drawCharIcon(c, type, x, y, size) {
    let img = getCharIcon(type);
    if (img && img.complete && img.naturalWidth > 0) {
        c.drawImage(img, x - size / 2, y - size / 2, size, size);
    } else { // icon still loading or missing — draw a lettered placeholder
        c.save();
        c.fillStyle = '#2a2a2a'; c.fillRect(x - size / 2, y - size / 2, size, size);
        c.fillStyle = '#ddd'; c.font = `bold ${Math.floor(size * 0.5)}px monospace`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        let nm = (CHARACTERS[type] ? CHARACTERS[type].name : type).replace('THE ', '');
        c.fillText(nm.charAt(0) || '?', x, y + 1);
        c.restore();
    }
}

const LADDER_TOP_Y = 150, LADDER_BOTTOM_Y = HEIGHT - 96;
function ladderRungY(i) {
    let n = Math.max(1, ladder.queue.length);
    if (n === 1) return LADDER_BOTTOM_Y;
    return LADDER_BOTTOM_Y - i * (LADDER_BOTTOM_Y - LADDER_TOP_Y) / (n - 1);
}

function updateLadderScreen(dt) {
    if (!ladderView || gameState !== 'LADDER_SCREEN') return;
    ladderView.t += dt;
    if (ladderView.phase === 'climb') {
        let p = Math.min(1, ladderView.t / 1.1);
        let e = p * p * (3 - 2 * p); // smoothstep
        let a = ladderRungY(ladderView.fromRung), b = ladderRungY(ladderView.toRung);
        ladderView.playerY = a + (b - a) * e;
        if (p >= 1) { ladderView.phase = 'lightup'; ladderView.t = 0; }
    } else if (ladderView.phase === 'lightup') {
        if (ladderView.t > 1.4) startLadderBattle(ladder.index); // into the fight
    }
}

function drawLadderScreen(c) {
    let g = c.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#0a0a0a'); g.addColorStop(1, '#040404');
    c.fillStyle = g; c.fillRect(0, 0, WIDTH, HEIGHT);

    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.font = 'bold 34px monospace';
    c.fillText(currentMode === 'INFINITE_LADDER' ? 'INFINITE LADDER' : 'THE LADDER', WIDTH / 2, 64);
    c.fillStyle = '#888'; c.font = '14px monospace';
    c.fillText(currentMode === 'INFINITE_LADDER' ? 'Random fighter. Random opponent. Stop when you lose.' : 'Defeat every challenger to reach the top', WIDTH / 2, 92);

    let n = ladder.queue.length;
    let railL = WIDTH * 0.44, railR = WIDTH * 0.56, cx = (railL + railR) / 2, box = 56;

    c.strokeStyle = '#555'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(railL, ladderRungY(0) + 30); c.lineTo(railL, ladderRungY(n - 1) - 30); c.stroke();
    c.beginPath(); c.moveTo(railR, ladderRungY(0) + 30); c.lineTo(railR, ladderRungY(n - 1) - 30); c.stroke();

    for (let i = 0; i < n; i++) {
        let y = ladderRungY(i);
        let cleared = i < ladder.index;
        let isTarget = ladderView && ladderView.phase === 'lightup' && i === ladderView.toRung;
        c.strokeStyle = '#4a4a4a'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(railL, y); c.lineTo(railR, y); c.stroke();
        if (isTarget) {
            let pulse = 0.5 + 0.5 * Math.sin(ladderView.t * 9);
            c.save(); c.shadowBlur = 18 + pulse * 22; c.shadowColor = '#ff0033';
            c.strokeStyle = '#ff0033'; c.lineWidth = 3;
            c.strokeRect(cx - box / 2 - 4, y - box / 2 - 4, box + 8, box + 8);
            c.restore();
        }
        c.fillStyle = '#151515'; c.fillRect(cx - box / 2, y - box / 2, box, box);
        c.globalAlpha = cleared ? 0.35 : 1;
        if (currentMode === 'LADDER2') { // a 2v2 rung fields a pair — show both challengers
            drawCharIcon(c, ladder.queue[i], cx, y - 12, box - 20);
            drawCharIcon(c, ladder.partners[i] || ladder.queue[i], cx, y + 12, box - 20);
        } else {
            drawCharIcon(c, ladder.queue[i], cx, y, box);
        }
        c.globalAlpha = 1;
        c.strokeStyle = cleared ? '#333' : (isTarget ? '#ff0033' : '#666'); c.lineWidth = 2;
        c.strokeRect(cx - box / 2, y - box / 2, box, box);
        if (cleared) { // victory tick
            c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round';
            c.beginPath(); c.moveTo(cx - 11, y); c.lineTo(cx - 2, y + 10); c.lineTo(cx + 13, y - 11); c.stroke();
        }
        c.fillStyle = '#888'; c.font = '13px monospace'; c.textAlign = 'left';
        c.fillText('#' + (i + 1), railR + 16, y);
        c.textAlign = 'center';
    }

    // the player's icon climbing the left rail
    let py = ladderView ? ladderView.playerY : ladderRungY(ladder.index);
    let pbox = 50, px = railL - 70;
    c.save(); c.shadowBlur = 16; c.shadowColor = '#fff';
    c.fillStyle = '#101010'; c.fillRect(px - pbox / 2, py - pbox / 2, pbox, pbox); c.restore();
    let infinitePick = currentMode === 'INFINITE_LADDER' ? (ladder.playerQueue[ladder.index] || p1Selection) : p1Selection;
    let mySquad = (currentMode === 'LADDER2' && playerTeam.length) ? playerTeam : [infinitePick];
    if (mySquad.length >= 2) { // two mini-icons for the 2v2 squad
        drawCharIcon(c, mySquad[0], px, py - 12, pbox - 20);
        drawCharIcon(c, mySquad[1], px, py + 12, pbox - 20);
    } else {
        drawCharIcon(c, mySquad[0], px, py, pbox);
    }
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(px - pbox / 2, py - pbox / 2, pbox, pbox);
    c.fillStyle = '#fff'; c.font = 'bold 11px monospace';
    c.fillText(currentMode === 'INFINITE_LADDER' ? 'YOU: RANDOM' : 'YOU', px, py + pbox / 2 + 12);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px + pbox / 2, py); c.lineTo(railL, py); c.stroke();

    let nextName = CHARACTERS[ladder.queue[ladder.index]] ? CHARACTERS[ladder.queue[ladder.index]].name : '';
    if (currentMode === 'LADDER2') {
        let pt = ladder.partners[ladder.index];
        if (CHARACTERS[pt]) nextName += '  +  ' + CHARACTERS[pt].name;
    }
    let cap = ladderView && ladderView.phase === 'climb'
        ? (currentMode === 'INFINITE_LADDER' ? 'Extending the streak...' : 'Climbing the ladder...')
        : (currentMode === 'INFINITE_LADDER' ? ('FIGHT ' + (ladder.index + 1) + '  —  ' + nextName) : ('NEXT  —  ' + nextName));
    c.fillStyle = '#ddd'; c.font = '18px monospace';
    c.fillText(cap, WIDTH / 2, HEIGHT - 40);
}

function draw() {
    // Clear in screen space so cinematic zoom never smears the edges
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The ladder-climb screen replaces the arena entirely.
    if (gameState === 'LADDER_SCREEN') { drawLadderScreen(ctx); return; }

    // Ease the cinematic camera toward its target (centre + zoom 1 when idle)
    let tx = ultCamera ? ultCamera.fx : WIDTH / 2;
    let ty = ultCamera ? ultCamera.fy : HEIGHT / 2;
    let tz = ultCamera ? ultCamera.zoom : 1;
    camNow.x += (tx - camNow.x) * 0.12;
    camNow.y += (ty - camNow.y) * 0.12;
    camNow.zoom += (tz - camNow.zoom) * 0.12;

    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(camNow.zoom, camNow.zoom);
    ctx.translate(-camNow.x, -camNow.y);

    drawStage(ctx, selectedStage, WIDTH, HEIGHT, GROUND_Y);
    drawStageActors(ctx);
    drawOverkillBackground(ctx);

    // Blood Stains (Draw first so they sit on the floor / back wall, behind fighters)
    if (settings.blood) {
        ctx.fillStyle = '#aa0022'; // Darker red for stains
        for (let stain of bloodStains) {
            if (stain.type === 'wall') {
                // a splat on the wall: full blob with a thin drip running down
                ctx.beginPath(); ctx.arc(stain.x, stain.y, stain.size * 0.7, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(stain.x - stain.size * 0.12, stain.y, stain.size * 0.24, stain.size * 1.6);
            } else {
                ctx.beginPath(); ctx.arc(stain.x, stain.y, stain.size, 0, Math.PI); ctx.fill(); // floor puddle
            }
        }
    }

    drawConsecrateZones(ctx); // The Cult's ritual sigils, painted on the floor behind fighters
    drawCultTraps(ctx);       // Procession snare-traps on the floor

    // Entities
    drawTravelerFx(ctx); // afterimage ghosts + the Rewind after-echo, behind the live body
    players.forEach(p => p.draw(ctx));
    players.forEach(p => { if (p.partner && p.state !== 'DEAD') p.partner.draw(ctx); }); // The Twins' second body
    drawTwinFx(ctx); // tethers + fastball trails
    drawCultSummons(ctx); // summoned cultists performing the ritual alongside the leader
    drawCultPuppets(ctx); // the mimic puppet echoing the leader
    drawLumFx(ctx);       // Lumatrossia's drop-portals + fire-breathing beast maws
    drawYankChains(ctx); // Grave Drag chains, world space, on top of the fighters
    drawRootGrips(ctx);  // Grave Grasp hands clamping a rooted foe
    projectiles.forEach(p => p.draw(ctx));
    hitboxes.forEach(h => h.draw(ctx));
    particles.forEach(p => p.draw(ctx));
    if (settings.blood) bodyParts.forEach(p => p.draw(ctx));
    drawUltWorldFx(ctx);

    ctx.restore();

    drawComboCounters(ctx); // "N HITS" tallies under each side's HUD
    drawChronoStop(ctx); // Traveler ult: the world drained of colour under a frozen clock
    drawSoulTrain(ctx); // Phantom ult: border-shatter + void-drag full-screen cinematic
    drawUltBanner(ctx);
    drawRoundAnnounce(ctx);
    drawIntroText(ctx);
    drawEntranceDialogue(ctx); // pre-fight banter bubbles
}

// Grave Grasp: clawed spectral hands clamped straight up around a rooted foe's legs.
function drawRootGrips(c) {
    for (let p of players) {
        if (!p || !(p.rootTimer > 0)) continue;
        c.save();
        c.strokeStyle = '#cfd8ff'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
        c.shadowBlur = 8; c.shadowColor = '#9aa6c8';
        let wob = Math.sin(performance.now() / 90) * 1.5;
        [-20, -7, 7, 20].forEach((dx, k) => {
            let hx = p.x + dx;
            let topY = GROUND_Y - 34 - (k % 2) * 8 + wob;
            c.beginPath(); c.moveTo(hx, GROUND_Y + 6); c.lineTo(hx, topY); c.stroke(); // straight forearm
            c.beginPath();                                                              // symmetric gripping fingers
            c.moveTo(hx, topY); c.lineTo(hx - 7, topY - 8);
            c.moveTo(hx, topY); c.lineTo(hx, topY - 11);
            c.moveTo(hx, topY); c.lineTo(hx + 7, topY - 8);
            c.stroke();
        });
        c.restore();
    }
}

// Grave Drag: a spectral chain from the Phantom's hand to the foe being reeled in.
function drawYankChains(c) {
    for (let p of players) {
        if (!p || !(p.yankTimer > 0) || !p.yankSource) continue;
        let src = p.yankSource;
        let x1 = src.x + src.dir * 18, y1 = src.y - 56; // the Phantom's outstretched hand
        let x2 = p.x - src.dir * 14, y2 = p.y - 50;      // the caught foe
        c.save();
        c.strokeStyle = '#dfe4f2'; c.lineWidth = 3; c.shadowBlur = 10; c.shadowColor = '#aab4d0'; c.lineCap = 'round';
        c.beginPath();
        let segs = 14, ph = performance.now() / 60;
        for (let i = 0; i <= segs; i++) {
            let u = i / segs, x = x1 + (x2 - x1) * u;
            let y = y1 + (y2 - y1) * u + Math.sin(u * 9 + ph) * 5 * Math.sin(u * Math.PI);
            i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(x2, y2 - 6); c.lineTo(x2 - src.dir * 7, y2);
        c.moveTo(x2, y2); c.lineTo(x2 - src.dir * 8, y2);
        c.moveTo(x2, y2 + 6); c.lineTo(x2 - src.dir * 7, y2);
        c.stroke();
        c.restore();
    }
}

// The Phantom's SOUL TRAIN: shatter the play-box like glass, drag the soul through
// space, then smash them into a new stage. Drawn in screen space over everything.
function drawSoulTrain(c) {
    let u = (ultActive && ultActive.ult && ultActive.ult.kind === 'soultrain') ? ultActive.ult : null;
    if (!u) return;
    let phase = u.phase, t = u.t || 0;

    if (phase === 'shatter') {
        let p = Math.min(1, t / 0.9);
        let ox = u.wallDir > 0 ? WIDTH - 26 : 26, oy = HEIGHT * 0.42;
        c.save();
        c.fillStyle = `rgba(0,0,0,${0.32 * p})`; c.fillRect(0, 0, WIDTH, HEIGHT);
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.lineCap = 'round';
        for (let i = 0; i < 18; i++) {
            let ang = (i / 18) * Math.PI * 2 + i * 0.31;
            let len = (130 + (i % 4) * 95) * p;
            c.beginPath(); c.moveTo(ox, oy);
            for (let s = 1; s <= 4; s++) {
                let r = len * (s / 4);
                c.lineTo(ox + Math.cos(ang) * r + Math.sin(s * 9 + i) * 13, oy + Math.sin(ang) * r + Math.cos(s * 7 + i) * 13);
            }
            c.stroke();
        }
        c.strokeStyle = 'rgba(255,255,255,0.45)';
        for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(ox, oy, 42 * r * p, 0, Math.PI * 2); c.stroke(); }
        // a few falling shards
        c.fillStyle = 'rgba(230,235,245,0.85)';
        for (let i = 0; i < 10; i++) {
            let sx = ox + Math.cos(i) * 90 * p, sy = oy + Math.sin(i * 2) * 70 * p + p * p * 120;
            c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 8, sy + 4); c.lineTo(sx + 3, sy + 14); c.closePath(); c.fill();
        }
        c.restore();
        return;
    }

    // void drag (and the very start of the smash, fading back out into the new stage)
    let fade = phase === 'void' ? Math.min(1, t / 0.28) : phase === 'smash' ? Math.max(0, 1 - t / 0.3) : 0;
    if (fade <= 0) return;
    let vt = (phase === 'void') ? t : 1.7 + t; // keep the warp moving into the smash
    c.save();
    c.globalAlpha = fade;
    c.fillStyle = '#000'; c.fillRect(0, 0, WIDTH, HEIGHT);
    // warp streaks dragging past (greyscale)
    for (let i = 0; i < 80; i++) {
        let speed = 240 + (i % 7) * 150;
        let y = (i * 53.7) % HEIGHT;
        let x = WIDTH - ((vt * speed + i * 137) % (WIDTH + 240));
        let len = 26 + (i % 5) * 44, shade = 55 + (i % 4) * 45;
        c.strokeStyle = `rgba(${shade},${shade},${shade},0.55)`; c.lineWidth = 1 + (i % 3);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke();
    }
    let cx = WIDTH / 2, cy = HEIGHT / 2;
    // spectral chain dragging them from the leading edge
    c.strokeStyle = 'rgba(200,210,235,0.75)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(WIDTH + 10, cy - 60);
    c.quadraticCurveTo(cx + 120, cy - 30 + Math.sin(vt * 8) * 16, cx + 12, cy - 6);
    c.stroke();
    // the tumbling soul — the actual opponent, spinning through the void
    let tgt = u.target;
    if (tgt && tgt.draw) {
        c.save();
        c.translate(cx + Math.sin(vt * 2) * 26, cy + Math.cos(vt * 1.7) * 18);
        c.rotate(vt * 4.2);
        let sx = tgt.x, sy = tgt.y, sh = tgt._hover, stb = tgt.tumbleTimer;
        tgt.x = 0; tgt.y = 45; tgt._hover = 0; tgt.tumbleTimer = 0; // feet at +45 → mid-body on the pivot
        tgt.draw(c);
        tgt.x = sx; tgt.y = sy; tgt._hover = sh; tgt.tumbleTimer = stb;
        c.restore();
    }
    // soul wisps trailing
    c.fillStyle = 'rgba(180,190,215,0.5)';
    for (let i = 0; i < 6; i++) {
        let wx = cx + 30 + i * 36, wy = cy + Math.sin(vt * 5 + i) * 22;
        c.beginPath(); c.arc(wx, wy, 4 - i * 0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
}

function drawOverkillBackground(ctx) {
    if (!overkillFx) return;
    let p = overkillFx.t / overkillFx.dur;
    let a = Math.sin(Math.min(1, p) * Math.PI);
    ctx.save();
    ctx.globalAlpha = a * 0.22;
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = a * 0.88;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 132px Courier New';
    ctx.lineWidth = 10;
    ctx.shadowBlur = 34;
    ctx.shadowColor = '#ff0033';
    ctx.strokeStyle = '#ff0033';
    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT * 0.42);
    ctx.rotate(-0.025);
    ctx.scale(1 + a * 0.06, 1 + a * 0.06);
    ctx.strokeText('OVERKILL', 0, 0);
    ctx.fillText('OVERKILL', 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

// Big in-world ultimate visuals (the huge orb, the blast, the arena ring)
function drawUltWorldFx(ctx) {
    if (!ultActive || !ultActive.ult) return;
    let u = ultActive.ult;
    ctx.save();
    if (u.kind === 'orb' && u.fx) {
        ctx.globalAlpha = 0.82; ctx.fillStyle = '#c98bff'; ctx.shadowBlur = 34; ctx.shadowColor = '#c98bff';
        ctx.beginPath(); ctx.arc(u.fx.x, u.fx.y, u.fx.r, 0, Math.PI * 2); ctx.fill();
    } else if (u.kind === 'bomb' && u.fx && u.phase === 'blast') {
        ctx.globalAlpha = 0.7; ctx.fillStyle = '#ff5a2a'; ctx.shadowBlur = 36; ctx.shadowColor = '#ff5a2a';
        ctx.beginPath(); ctx.arc(u.fx.x, u.fx.y, u.fx.r, 0, Math.PI * 2); ctx.fill();
    } else if (u.kind === 'arena' && u.phase === 'dashes' && u.target) {
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowBlur = 20; ctx.shadowColor = '#fff';
        ctx.beginPath(); ctx.arc(u.target.x, u.target.y - 45, 124, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}

// The cinematic title card: a sweeping streak + the character's line
function drawUltBanner(ctx) {
    if (!ultBanner) return;
    let p = ultBanner.t / ultBanner.dur;
    let intensity = Math.sin(Math.min(1, p) * Math.PI);
    ctx.save();
    // dramatic letterbox tint
    ctx.globalAlpha = intensity * 0.35; ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.16); ctx.fillRect(0, HEIGHT * 0.84, WIDTH, HEIGHT * 0.16);
    // sweeping red streak across the background
    ctx.globalAlpha = intensity * 0.85; ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 7;
    let sweep = p * WIDTH * 1.5 - WIDTH * 0.25;
    ctx.beginPath(); ctx.moveTo(sweep, HEIGHT * 0.18); ctx.lineTo(sweep - 240, HEIGHT * 0.82); ctx.stroke();
    // the line — huge, with a quick punch-in scale
    ctx.globalAlpha = intensity;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let scale = 0.7 + intensity * 0.45;            // pops bigger as it appears
    let size = Math.min(150, (WIDTH * 0.92) / Math.max(8, ultBanner.line.length) * 1.7);
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.rotate(-0.03);
    ctx.font = `900 ${size}px Courier New`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#ff0033'; ctx.shadowBlur = 30; ctx.shadowColor = '#ff0033';
    ctx.strokeText(ultBanner.line, 0, 0);
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 12;
    ctx.fillText(ultBanner.line, 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
}
