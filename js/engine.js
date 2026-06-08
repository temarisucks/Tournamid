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
    // Ladder: the player finishing the very last challenger earns the overkill.
    if (currentMode === 'LADDER') return winnerIdx === 0 && ladder.active && ladder.index >= ladder.queue.length - 1;
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
                        let landed = p.takeDamage(h.damage, h.knockback, h.stun, h.owner, { isUlt: !!h.ultActivator, unblockable: !!h.grab });
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
                    let landed = p.takeDamage(proj.damage, proj.knockback, proj.stun, proj.owner,
                        { unblockable: proj.unblockable, isUlt: !!proj.ultActivator });

                    // Ultimate activation projectile (Mage orb / Ranger bomb) connected
                    if (proj.ultActivator) {
                        if (landed) proj.ultActivator.onUltConnect(p);
                        proj.active = false;
                    }

                    // On-hit elemental effects
                    if (proj.slow) p.slowTimer = Math.max(p.slowTimer, proj.slow);
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

function updateHUD() {
    if (players.length >= 1) {
        document.getElementById('p1-hp').style.width = Math.max(0, (players[0].hp / players[0].maxHp) * 100) + '%';
        setMeterBar('p1', players[0]);
    }
    if (currentMode !== 'PVE' && players.length >= 2) setMeterBar('p2', players[1]);

    if (currentMode === 'PVE') {
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
        document.getElementById('p2-hp').style.width = Math.max(0, (players[1].hp / players[1].maxHp) * 100) + '%';
    }
}

function checkWinCondition() {
    if (gameState !== 'PLAYING') return;
    if (trainingMode) return; // training never ends
    if (currentMode === 'ONLINE' && onlineState.slot !== 0) return; // host owns match outcomes

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
    if (currentMode === 'LADDER') { ladderEndRound(winnerIdx); return; }
    if (currentMode === 'ONLINE' && onlineState.slot === 0 && !suppressRollbackEffects) onlineSend('round-result', { winnerIdx, subtitle });
    gameState = 'ROUND_END';
    if (winnerIdx >= 0) roundWins[winnerIdx]++;
    renderRoundPips();

    if (roundWins[0] >= ROUNDS_TO_WIN || roundWins[1] >= ROUNDS_TO_WIN) {
        let p1Won = roundWins[0] > roundWins[1];
        endGame(p1Won ? "PLAYER 1 WINS" : "PLAYER 2 WINS", `Match ${roundWins[0]} – ${roundWins[1]}`);
        return;
    }

    let txt = winnerIdx === -1 ? "DRAW ROUND" : (winnerIdx === 0 ? "PLAYER 1" : "PLAYER 2") + " TAKES IT";
    roundAnnounce = { text: txt, t: 0, dur: 2.0 };
    setTimeout(nextRound, 2000);
}

// ---- LADDER mode: each rung is a single decisive round vs the next fighter ----
function ladderEndRound(winnerIdx) {
    gameState = 'ROUND_END';
    if (winnerIdx === 0) { // player cleared this challenger
        ladder.index++;
        if (ladder.index >= ladder.queue.length) {
            endGame("LADDER CLEARED", "You conquered every challenger.");
        } else {
            roundAnnounce = { text: "RUNG " + ladder.index + " CLEARED", t: 0, dur: 1.8 };
            setTimeout(ladderNextRung, 2000);
        }
    } else {
        endGame("DEFEATED", `Fell at rung ${ladder.index + 1} of ${ladder.queue.length}`);
    }
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
        p.comboCount = 0; p.slowTimer = 0; p.invulnTimer = 0; p.ult = null; p._ringedOut = false; p._overkilled = false;
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
    if (!overkillFx) {
        let winner = null;
        if (roundWins[0] > roundWins[1]) winner = players[0];
        else if (roundWins[1] > roundWins[0]) winner = players[1];
        if (winner) playAudio(winVoices[winner.charType]);
    }
    setTimeout(() => {
        document.getElementById('end-screen').classList.remove('hidden');
        if (currentMode === 'ONLINE') onlineBeginPostMatch();
    }, overkillFx ? 3200 : 1500); // Dramatic delay
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
    drawCharacterSelectPreview(realDt);

    requestID = requestAnimationFrame(loop);
}

function updateCinematics(realDt) {
    // Ease slow-motion back to normal once no ultimate is forcing it
    if (!ultActive) timeScale += (1 - timeScale) * Math.min(1, realDt * 5);
    if (ultBanner) { ultBanner.t += realDt; if (ultBanner.t > ultBanner.dur) ultBanner = null; }
    if (roundAnnounce) { roundAnnounce.t += realDt; if (roundAnnounce.t > roundAnnounce.dur) roundAnnounce = null; }
    if (overkillFx) { overkillFx.t += realDt; if (overkillFx.t > overkillFx.dur) overkillFx = null; }
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
                // Time up — award the round on remaining health
                let p1 = players[0].hp / players[0].maxHp;
                let p2 = players[1].hp / players[1].maxHp;
                if (p1 > p2) endRound(0, "Time Up — health lead.");
                else if (p2 > p1) endRound(1, "Time Up — health lead.");
                else endRound(-1, "Time Up — dead even.");
            }
        }
    }

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
        // ---- P STREET: greyscale downtown at night ----
        let sky = targetCtx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#0b0b0b'); sky.addColorStop(0.6, '#060606'); sky.addColorStop(1, '#0e0e0e');
        targetCtx.fillStyle = sky;
        targetCtx.fillRect(0, 0, width, height);

        let horizon = groundY - height * 0.06;
        let bw = width / 7;
        for (let i = 0; i < 8; i++) {
            let bx = i * bw - bw * 0.25;
            let bh = height * (0.22 + ((i * 53) % 17) / 17 * 0.28);
            let shade = 16 + ((i * 7) % 5) * 4;
            targetCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
            targetCtx.fillRect(bx, horizon - bh, bw * 0.92, bh + 60);
            for (let wy = horizon - bh + 12; wy < horizon - 10; wy += 16) {
                for (let wx = bx + 8; wx < bx + bw * 0.92 - 8; wx += 14) {
                    let lit = ((Math.floor(wx) * 13 + Math.floor(wy) * 7) % 5) < 2;
                    targetCtx.fillStyle = lit ? 'rgba(225,225,225,0.45)' : 'rgba(110,110,110,0.10)';
                    targetCtx.fillRect(wx, wy, 7, 9);
                }
            }
        }
        // road + sidewalk
        targetCtx.fillStyle = '#0f0f0f';
        targetCtx.fillRect(0, groundY, width, height - groundY);
        targetCtx.strokeStyle = '#555'; targetCtx.lineWidth = 3;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY); targetCtx.lineTo(width, groundY); targetCtx.stroke();
        targetCtx.strokeStyle = '#262626'; targetCtx.lineWidth = 2;
        targetCtx.beginPath(); targetCtx.moveTo(0, groundY + 16); targetCtx.lineTo(width, groundY + 16); targetCtx.stroke();
        targetCtx.fillStyle = '#3a3a3a';
        for (let x = 20; x < width; x += 90) targetCtx.fillRect(x, groundY + (height - groundY) * 0.62, 44, 5);
        // streetlights with soft cones
        [width * 0.15, width * 0.85].forEach(lx => {
            let top = horizon - height * 0.02;
            targetCtx.strokeStyle = '#444'; targetCtx.lineWidth = 4;
            targetCtx.beginPath(); targetCtx.moveTo(lx, groundY); targetCtx.lineTo(lx, top); targetCtx.stroke();
            targetCtx.save();
            targetCtx.globalAlpha = 0.5; targetCtx.fillStyle = '#dcdcdc';
            targetCtx.beginPath(); targetCtx.arc(lx, top, 6, 0, Math.PI * 2); targetCtx.fill();
            targetCtx.globalAlpha = 0.10;
            targetCtx.beginPath(); targetCtx.moveTo(lx - 34, groundY); targetCtx.lineTo(lx, top); targetCtx.lineTo(lx + 34, groundY); targetCtx.closePath(); targetCtx.fill();
            targetCtx.restore();
        });
        if (targetCtx !== ctx) { // static spectators in thumbnails (live draws animated ones)
            let s = height / 430;
            for (let i = 0; i < 5; i++) drawBgStickman(targetCtx, width * (0.12 + i * 0.18), horizon + height * 0.05, s, 85, 'spectate', i * 1.3, 1);
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
            arr.push({ x, y: GROUND_Y - HEIGHT * 0.10, phase: Math.random() * Math.PI * 2,
                       rate: 1.4 + Math.random() * 1.2, scale: 0.6 + Math.random() * 0.14,
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

function draw() {
    // Clear in screen space so cinematic zoom never smears the edges
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

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
    ctx.fillStyle = '#aa0022'; // Darker red for stains
    for (let stain of bloodStains) {
        ctx.beginPath(); ctx.arc(stain.x, stain.y, stain.size, 0, Math.PI); ctx.fill();
    }

    // Entities
    players.forEach(p => p.draw(ctx));
    projectiles.forEach(p => p.draw(ctx));
    hitboxes.forEach(h => h.draw(ctx));
    particles.forEach(p => p.draw(ctx));
    bodyParts.forEach(p => p.draw(ctx));
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
