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
            bloodStains.push({
                x: Math.max(0, Math.min(WIDTH, victim.x + (Math.random() - 0.5) * 520)),
                y: GROUND_Y + (Math.random() * 8 - 4),
                size: 4 + Math.random() * 16
            });
        }
    }
    spawnParticles(victim.x, victim.y - 48, 35, '#fff');
    stageActorsFlee(); // background spectators/dancers scatter
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
                    } else {
                        // Melee swing sound plays only on contact (whiffs stay silent)
                        if (h.atk && h.owner) h.owner.playAttackSound(h.atk);
                        let landed = p.takeDamage(h.damage, h.knockback, h.stun, h.owner, { isUlt: !!h.ultActivator, unblockable: !!h.grab || !!h.unblockableUlt });
                        if (landed && h.ultActivator) h.ultActivator.onUltConnect(p);
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
                    if (landed && proj.lightningStun && p.state === 'HITSTUN') {
                        p.stateTimer = Math.max(p.stateTimer, proj.lightningStun);
                        spawnParticles(p.x, p.y - 56, 12, '#fff');
                    }
                    if (proj.markTarget) {
                        p.beastMarkedTimer = 9999;
                        spawnParticles(p.x, p.y - 70, 12, '#ff0033');
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
                            : proj.subtype === 'homing' ? '#c98bff' : '#fff';
                    spawnParticles(proj.x, proj.y, 10, col);
                    if (!proj.pierce) proj.active = false; // beams pierce, everything else pops
                }
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

function updateTeamHud() {
    for (let tm = 0; tm < 2; tm++) {
        let pfx = tm === 0 ? 'p1' : 'p2';
        for (let i = 0; i < 2; i++) {
            let f = teams[tm][i];
            let hpEl = document.getElementById(pfx + '-team-hp-' + i);
            let rowEl = document.getElementById(pfx + '-team-row-' + i);
            if (!f || !hpEl || !rowEl) continue;
            hpEl.style.width = Math.max(0, (f.hp / f.maxHp) * 100) + '%';
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
    }
    if (currentMode !== 'PVE' && players.length >= 2) setMeterBar('p2', players[1]);

    if (currentMode === 'PVE') {
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
    }
}

function isLadderMode() { return currentMode === 'LADDER' || currentMode === 'LADDER2'; }

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
    bench.x = atX; bench.y = GROUND_Y; bench.vx = 0; bench.vy = 0;
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
        if (currentMode === 'LADDER') endGame(p1Won ? "PLAYER 1 WINS" : "PLAYER 2 WINS", "");
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
    hitboxes = []; projectiles = []; particles = []; bodyParts = [];
    initStageActors(); // bring fled spectators back for the new round
    let geo = getStageGeo();
    let lx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.28 : WIDTH / 4;
    let rx = geo.ringOut ? geo.main.left + (geo.main.right - geo.main.left) * 0.72 : WIDTH * 0.75;
    [[players[0], lx, 1], [players[1], rx, -1]].forEach(([p, x, dir]) => {
        p.x = x; p.y = GROUND_Y; p.vx = 0; p.vy = 0;
        p.hp = p.maxHp; p.state = 'IDLE'; p.stateTimer = 0; // meter carries over between rounds
        p.dir = dir; p.blockHealth = p.blockMax; p.ledge = null;
        p.comboCount = 0; p.slowTimer = 0; p.slowFactor = 1; p.burnTimer = 0; p.burnTickTimer = 0; p.beastMarkedTimer = 0; p.invulnTimer = 0; p.ult = null; p._ringedOut = false; p._overkilled = false;
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
        if (p.y < GROUND_Y) { p.vy += 1500 * dt; p.y = Math.min(GROUND_Y, p.y + p.vy * dt); if (p.y >= GROUND_Y) p.vy = 0; }
        else p.vy = 0;
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

    if (gameState === 'PLAYING') checkCollisions();
    updateHUD(); // keep meters/health live (meter charges continuously)
    Object.assign(previousKeys, keys);
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
    } else {
        targetCtx.fillStyle = '#050505';
        targetCtx.fillRect(0, 0, width, height);
        targetCtx.strokeStyle = '#333';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(0, groundY);
        targetCtx.lineTo(width, groundY);
        targetCtx.stroke();
    }
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
const LADDER_ICON_FILE = { BRAWLER: 'brawler', SWORDSMAN: 'swordsman', MAGE: 'mage', RANGER: 'ranger', DARK_RULER: 'darkruler', TELEPATH: 'telepath', BEAST_TAMER: 'beasttamer', ZOMBIE: 'zombie' };
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
    c.fillText('THE LADDER', WIDTH / 2, 64);
    c.fillStyle = '#888'; c.font = '14px monospace';
    c.fillText('Defeat every challenger to reach the top', WIDTH / 2, 92);

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
        drawCharIcon(c, ladder.queue[i], cx, y, box);
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
    let mySquad = (currentMode === 'LADDER2' && playerTeam.length) ? playerTeam : [p1Selection];
    if (mySquad.length >= 2) { // two mini-icons for the 2v2 squad
        drawCharIcon(c, mySquad[0], px, py - 12, pbox - 20);
        drawCharIcon(c, mySquad[1], px, py + 12, pbox - 20);
    } else {
        drawCharIcon(c, mySquad[0], px, py, pbox);
    }
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(px - pbox / 2, py - pbox / 2, pbox, pbox);
    c.fillStyle = '#fff'; c.font = 'bold 11px monospace';
    c.fillText('YOU', px, py + pbox / 2 + 12);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px + pbox / 2, py); c.lineTo(railL, py); c.stroke();

    let nextName = CHARACTERS[ladder.queue[ladder.index]] ? CHARACTERS[ladder.queue[ladder.index]].name : '';
    let cap = ladderView && ladderView.phase === 'climb' ? 'Climbing the ladder...' : ('NEXT  —  ' + nextName);
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

    // Blood Stains (Draw first so they are on the floor)
    if (settings.blood) {
        ctx.fillStyle = '#aa0022'; // Darker red for stains
        for (let stain of bloodStains) {
            ctx.beginPath(); ctx.arc(stain.x, stain.y, stain.size, 0, Math.PI); ctx.fill();
        }
    }

    // Entities
    players.forEach(p => p.draw(ctx));
    projectiles.forEach(p => p.draw(ctx));
    hitboxes.forEach(h => h.draw(ctx));
    particles.forEach(p => p.draw(ctx));
    if (settings.blood) bodyParts.forEach(p => p.draw(ctx));
    drawUltWorldFx(ctx);

    ctx.restore();

    drawUltBanner(ctx);
    drawRoundAnnounce(ctx);
    drawIntroText(ctx);
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
