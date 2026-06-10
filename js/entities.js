// --- CLASSES ---

class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.color = color; this.size = size;
        this.gravity = 800;
    }
    update(dt) {
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        
        // Floor collision for blood
        if (this.y >= GROUND_Y && this.color === '#ff0033') {
            this.y = GROUND_Y;
            this.life = 0; // kill particle
            // Create a permanent stain
            if (settings.blood && bloodStains.length < 500) {
                bloodStains.push({ x: this.x, y: this.y + (Math.random()*4-2), size: this.size * (Math.random()+1), type: 'floor' });
            }
        } else if (this.color === '#ff0033' && this.life <= 0 && this.y > 50 && this.y < GROUND_Y - 6 && selectedStage === 'dojo') {
            // Blood that never reached the floor splatters onto the back wall instead
            if (settings.blood && bloodStains.length < 500) {
                bloodStains.push({ x: this.x, y: this.y, size: this.size * (0.7 + Math.random() * 0.8), type: 'wall' });
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class BodyPart {
    constructor(x, y, vx, vy, size, kind, spin) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.size = size; this.kind = kind;
        this.rot = Math.random() * Math.PI * 2;
        this.spin = spin;
        this.life = 8.0;
        this.gravity = 1200;
    }
    update(dt) {
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rot += this.spin * dt;
        this.vx *= 0.992;
        this.life -= dt;

        if (this.y >= GROUND_Y - 2) {
            this.y = GROUND_Y - 2;
            this.vy *= -0.32;
            this.vx *= 0.82;
            this.spin *= 0.72;
            if (Math.abs(this.vy) < 70) this.vy = 0;
        }
        if (this.x < 0 || this.x > WIDTH) {
            this.x = Math.max(0, Math.min(WIDTH, this.x));
            this.vx *= -0.45;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.strokeStyle = '#ff0033';
        ctx.fillStyle = '#ff0033';
        ctx.lineWidth = Math.max(3, this.size * 0.35);
        ctx.lineCap = 'round';
        if (this.kind === 'head') {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.kind === 'torso') {
            ctx.beginPath();
            ctx.moveTo(0, -this.size * 1.3);
            ctx.lineTo(0, this.size * 1.3);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(-this.size * 1.4, 0);
            ctx.lineTo(this.size * 1.4, 0);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Hitbox {
    constructor(x, y, w, h, damage, knockback, stun, owner, lifeTime) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.damage = damage; this.knockback = knockback; this.stun = stun;
        this.owner = owner; // reference to Fighter
        this.lifeTime = lifeTime;
        this.active = true;
        this.hasHit = new Set(); // Prevent multi-hits per attack
    }
    update(dt) {
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) this.active = false;
    }
    draw(ctx) {
        // Debug draw could go here
    }
}

class Projectile {
    constructor(x, y, vx, vy, w, h, damage, knockback, stun, owner, lifeTime, customLogic) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.w = w; this.h = h; this.damage = damage; 
        this.knockback = knockback; this.stun = stun;
        this.owner = owner; this.lifeTime = lifeTime;
        this.ownerId = owner ? owner.id : null;
        this.ownerTeam = owner ? owner.team : null;
        this.ownerCharType = owner ? owner.charType : null;
        this.active = true;
        this.hasHit = new Set();
        this.customLogic = customLogic;
    }
    update(dt) {
        if (!this.owner) {
            this.active = false;
            return;
        }
        // Homing wisp: steer velocity toward the nearest enemy
        if (this.homing) {
            let tgt = null, best = Infinity;
            for (let p of players) {
                if (p.team !== this.owner.team && p.state !== 'DEAD') {
                    let d = Math.hypot(p.x - this.x, (p.y - 40) - this.y);
                    if (d < best) { best = d; tgt = p; }
                }
            }
            if (tgt) {
                let ang = Math.atan2((tgt.y - 40) - this.y, tgt.x - this.x);
                let sp = Math.hypot(this.vx, this.vy) || 360;
                this.vx += (Math.cos(ang) * sp - this.vx) * Math.min(1, dt * 6);
                this.vy += (Math.sin(ang) * sp - this.vy) * Math.min(1, dt * 6);
            }
        }
        // Mana Font rune: buff the caster when they stand on it
        if (this.runeType === 'manaFont') {
            let o = this.owner;
            if (o && o.state !== 'DEAD' && Math.abs(o.x - this.x) < 30 && o.y >= GROUND_Y - 6) {
                o.manaFontTimer = 6.0; this.active = false;
                spawnParticles(this.x, GROUND_Y - 30, 16, '#fff');
            }
        }
        // Ultimate orb (Mage): swells as it travels
        if (this.subtype === 'ultorb') { this.w = Math.min(58, this.w + 22 * dt); this.h = this.w; }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Arcing projectiles fall under gravity
        if (this.subtype === 'fire') this.vy += 600 * dt;

        // Piano Drop (Copy Cat): plummets, then SMASHES the floor with its sound
        if (this.subtype === 'piano') {
            this.vy += 900 * dt;
            if (this.y + this.h >= GROUND_Y + 4) {
                this.active = false;
                let bx = this.x + this.w / 2;
                playAudio(attackSfx.piano);
                spawnParticles(bx, GROUND_Y - 6, 22, '#fff');
                spawnParticles(bx, GROUND_Y - 6, 10, '#444');
            }
        }

        // Ultimate bomb (Ranger): arcs, clangs on the floor, then detonates
        if (this.subtype === 'bomb') {
            this.vy += 1400 * dt;
            if (this.y >= GROUND_Y - this.h) {
                this.y = GROUND_Y - this.h; this.vx = 0; this.vy = 0;
                this._sit = (this._sit || 0) + dt;
                if (this._sit > 0.5) {
                    this.active = false;
                    let bx = this.x + this.w / 2;
                    spawnParticles(bx, GROUND_Y - 20, 22, '#ff5a2a'); // the detonation always goes off
                    if (this.ultActivator && this.ultActivator.ult && !this.ultActivator.ult.connected) {
                        // Only trigger the ult if a foe is actually caught in the blast radius
                        let tgt = this.ultActivator.getClosestEnemy();
                        const BLAST = 155;
                        if (tgt && Math.hypot(tgt.x - bx, (tgt.y - 40) - (GROUND_Y - 20)) < BLAST) {
                            this.ultActivator.onUltConnect(tgt);
                        }
                        // otherwise the bomb just explodes harmlessly and the ult fizzles
                    }
                }
            }
        }

        this.lifeTime -= dt;
        if (this.lifeTime <= 0) this.active = false;
        if (this.customLogic) this.customLogic(this, dt);
    }
    draw(ctx) {
        let cx = this.x + this.w/2, cy = this.y + this.h/2;
        ctx.save();
        // Ground runes: a glowing glyph on the floor
        if (this.subtype === 'rune') {
            let col = this.runeType === 'slow' ? '#7df' : this.runeType === 'launch' ? '#fff'
                    : this.runeType === 'manaFont' ? '#9f9' : '#ff0033';
            let pulse = 0.6 + Math.sin(performance.now()/120) * 0.4;
            ctx.globalAlpha = pulse; ctx.strokeStyle = col; ctx.fillStyle = col;
            ctx.shadowBlur = 14; ctx.shadowColor = col; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x + this.w/2, GROUND_Y - 4, 18, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(this.x + this.w/2, GROUND_Y - 4, 9, 0, Math.PI*2); ctx.stroke();
            ctx.restore(); return;
        }
        // Ranger ultimate bomb: dark sphere with a blinking red core
        if (this.subtype === 'bomb') {
            ctx.fillStyle = '#222'; ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, this.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            let blink = 0.5 + Math.sin(performance.now() / 80) * 0.5;
            ctx.fillStyle = `rgba(255,0,51,${blink})`; ctx.shadowBlur = 14; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.arc(cx, cy, this.w / 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); return;
        }
        // Distinct elemental shapes (not just colours)
        let now = performance.now() / 1000;
        let r = Math.max(this.w, this.h) / 2;

        if (this.subtype === 'slash') {
            let ang = Math.atan2(this.vy, this.vx);
            ctx.translate(cx, cy); ctx.rotate(ang);
            ctx.strokeStyle = '#fff'; ctx.shadowBlur = 12; ctx.shadowColor = '#fff'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, this.h / 2, -1.1, 1.1); ctx.stroke();
        } else if (this.subtype === 'beam') {
            ctx.fillStyle = '#fff'; ctx.shadowBlur = 14; ctx.shadowColor = '#fff';
            ctx.fillRect(this.x, this.y, this.w, this.h);
        } else if (this.subtype === 'fire') {
            // Flickering flame
            ctx.translate(cx, cy);
            let fl = 0.85 + Math.sin(now * 32 + this.x) * 0.18;
            ctx.shadowBlur = 22; ctx.shadowColor = '#ff5a2a'; ctx.fillStyle = '#ff3b00';
            ctx.beginPath();
            ctx.moveTo(0, -r * 1.7 * fl);
            ctx.quadraticCurveTo(r * 1.1, -r * 0.1, r * 0.55, r * 0.7);
            ctx.quadraticCurveTo(0, r * 0.3, -r * 0.55, r * 0.7);
            ctx.quadraticCurveTo(-r * 1.1, -r * 0.1, 0, -r * 1.7 * fl);
            ctx.fill();
            ctx.fillStyle = '#ffd23b';
            ctx.beginPath();
            ctx.moveTo(0, -r * fl); ctx.quadraticCurveTo(r * 0.5, 0, 0, r * 0.45);
            ctx.quadraticCurveTo(-r * 0.5, 0, 0, -r * fl); ctx.fill();
        } else if (this.subtype === 'frost') {
            // Six-spoke ice crystal
            ctx.translate(cx, cy); ctx.rotate(now * 0.7);
            ctx.strokeStyle = '#bfeaff'; ctx.fillStyle = 'rgba(127,216,255,0.55)';
            ctx.shadowBlur = 16; ctx.shadowColor = '#7fd8ff'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) { let a = i * Math.PI / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4); }
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i < 4; i++) { let a = i * Math.PI / 2 + Math.PI / 4; (i ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); }
            ctx.closePath(); ctx.fill();
        } else if (this.subtype === 'spark') {
            // Crackling lightning bolt along travel
            ctx.translate(cx, cy); ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.strokeStyle = '#fff'; ctx.shadowBlur = 18; ctx.shadowColor = '#bcdcff'; ctx.lineWidth = 3;
            let seg = r * 1.8, n = 4;
            ctx.beginPath(); ctx.moveTo(-seg, 0);
            for (let i = 1; i <= n; i++) { let x = -seg + (2 * seg) * (i / n); let y = (i % 2 ? -1 : 1) * r * (0.5 + Math.random() * 0.6); ctx.lineTo(x, y); }
            ctx.stroke();
        } else if (this.subtype === 'homing') {
            // Swirling wisp: core + orbiting motes
            ctx.translate(cx, cy);
            ctx.fillStyle = '#c98bff'; ctx.shadowBlur = 18; ctx.shadowColor = '#c98bff';
            ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 3; i++) { let a = now * 6 + i * 2.094; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25, r * 0.3, 0, Math.PI * 2); ctx.fill(); }
        } else if (this.subtype === 'split') {
            // Unstable amber cluster (about to shatter)
            ctx.translate(cx, cy);
            ctx.fillStyle = '#ffe089'; ctx.shadowBlur = 16; ctx.shadowColor = '#ffe089';
            ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 5; i++) { let a = i * 1.2566 + now * 3; let rr = r * (1.0 + Math.sin(now * 12 + i) * 0.28); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.22, 0, Math.PI * 2); ctx.fill(); }
        } else if (this.subtype === 'giantslash') {
            // Dark Ruler ultimate: a colossal crescent screaming across the arena
            let d = Math.sign(this.vx) || 1;
            let R = this.h / 2;
            ctx.translate(cx, cy); ctx.scale(d, 1);
            ctx.fillStyle = '#0a0a0a'; ctx.shadowBlur = 38; ctx.shadowColor = '#ff0033';
            ctx.beginPath();
            ctx.moveTo(-this.w * 0.4, -R);
            ctx.quadraticCurveTo(this.w * 1.5, 0, -this.w * 0.4, R); // bowed leading edge
            ctx.quadraticCurveTo(this.w * 0.1, 0, -this.w * 0.4, -R); // thin trailing edge
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 5; ctx.stroke();
            // inner white-hot edge streak
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(this.w * 0.1, -R * 0.85);
            ctx.quadraticCurveTo(this.w * 1.1, 0, this.w * 0.1, R * 0.85);
            ctx.stroke();
        } else if (this.subtype === 'tether') {
            // Mind Grip: a psychic hook/claw of light streaking out
            ctx.translate(cx, cy); ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.strokeStyle = '#9be3ff'; ctx.shadowBlur = 16; ctx.shadowColor = '#6fd0ff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-r * 2, 0); ctx.lineTo(r, 0); ctx.stroke();           // trailing line
            ctx.beginPath(); ctx.arc(r, 0, r, -2.2, 2.2); ctx.stroke();                        // grasping claw
        } else if (this.subtype === 'mistChain') {
            // Grave Drag: a reaching spectral chain ending in a clawed hand
            ctx.translate(cx, cy); ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.strokeStyle = '#dfe4f2'; ctx.shadowBlur = 12; ctx.shadowColor = '#aab4d0'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) { let u = i / 8; let x = -r * 3 + (r * 3.7) * u; let y = Math.sin(now * 18 + u * 8) * 4 * (1 - u); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(r, -6); ctx.lineTo(r + 7, 0); ctx.moveTo(r, 0); ctx.lineTo(r + 8, 0); ctx.moveTo(r, 6); ctx.lineTo(r + 7, 0);
            ctx.stroke();
        } else if (this.subtype === 'dark') {
            // Dark Bolt: black void orb wreathed in dark wisps with a red core
            ctx.translate(cx, cy);
            ctx.fillStyle = '#000'; ctx.shadowBlur = 24; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.shadowBlur = 0;
            for (let i = 0; i < 4; i++) { let a = now * 5 + i * 1.57; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.28, 0, Math.PI * 2); ctx.stroke(); }
            ctx.globalAlpha = 1; ctx.fillStyle = '#ff0033'; ctx.shadowBlur = 16; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
        } else if (this.subtype === 'ultorb') {
            // Huge arcane sphere with a spinning ring
            ctx.translate(cx, cy);
            ctx.fillStyle = '#c98bff'; ctx.shadowBlur = 34; ctx.shadowColor = '#c98bff';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.rotate(now * 3); ctx.scale(1, 0.4);
            ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2); ctx.stroke();
        } else if (this.subtype === 'serpentBite') {
            ctx.translate(cx, cy); ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
            ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.quadraticCurveTo(-r * 0.3, -r * 0.8, r * 0.8, 0); ctx.stroke();
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(r * 0.9, -2, 2, 0, Math.PI * 2); ctx.arc(r * 0.9, 2, 2, 0, Math.PI * 2); ctx.fill();
        } else if (this.subtype === 'ravenDive' || this.subtype === 'ravenMark') {
            ctx.translate(cx, cy); ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.strokeStyle = this.subtype === 'ravenMark' ? '#ff0033' : '#bbb'; ctx.lineWidth = 3; ctx.shadowBlur = 12; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r * 0.7); ctx.closePath(); ctx.stroke();
        } else if (this.subtype === 'venom') {
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(cx, cy + 4, this.w / 2, this.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(cx + Math.sin(now * 6) * 12, cy, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (this.subtype === 'hex') {
            // The Cult's hexed bolt — a dark sigil-orb rimmed in red
            ctx.translate(cx, cy);
            ctx.fillStyle = '#0a0a0a'; ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 2;
            ctx.shadowBlur = 12; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.rotate(now * 5);
            ctx.beginPath(); for (let i = 0; i < 3; i++) { let a = i * Math.PI * 2 / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * this.w * 0.5, Math.sin(a) * this.w * 0.5); } ctx.stroke();
        } else if (this.subtype === 'twinBolt') {
            // The Twins' mirror-volley bolt — a paired blue spark
            ctx.fillStyle = 'rgba(155,227,255,0.9)'; ctx.shadowBlur = 12; ctx.shadowColor = '#9be3ff';
            ctx.beginPath(); ctx.arc(cx, cy, this.w / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, this.w / 4, 0, Math.PI * 2); ctx.fill();
        } else if (this.subtype === 'twinMissile') {
            // the hurled twin, tumbling forward as a living missile
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(now * 14);
            ctx.strokeStyle = '#9be3ff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowBlur = 12; ctx.shadowColor = '#9be3ff';
            ctx.beginPath(); ctx.arc(0, -8, 6, 0, Math.PI * 2); ctx.stroke();      // head
            ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 12); ctx.stroke();   // body
            ctx.beginPath(); ctx.moveTo(-9, 4); ctx.lineTo(9, 4); ctx.stroke();    // arms tucked
            ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-7, 20); ctx.moveTo(0, 12); ctx.lineTo(7, 20); ctx.stroke(); // legs
            ctx.restore();
        } else if (this.subtype === 'vortex') {
            // The Traveler's time vortex — a churning spiral singularity
            ctx.translate(cx, cy);
            ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 2; ctx.shadowBlur = 16; ctx.shadowColor = '#6fd0ff';
            for (let k = 0; k < 3; k++) {
                ctx.save(); ctx.rotate(now * (4 + k) + k * 2.1);
                ctx.beginPath();
                for (let a = 0; a < 4.7; a += 0.25) { let rr = 4 + a * (8 + k * 3); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
                ctx.stroke(); ctx.restore();
            }
            ctx.fillStyle = '#04141c'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
        } else if (this.subtype === 'echoBolt') {
            // hard-light bolt with a phantom copy trailing one beat behind
            ctx.fillStyle = '#6fd0ff'; ctx.shadowBlur = 12; ctx.shadowColor = '#6fd0ff';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.globalAlpha = 0.4;
            ctx.fillRect(this.x - Math.sign(this.vx || 1) * 16, this.y, this.w, this.h); // the echo
            ctx.globalAlpha = 1;
        } else if (this.subtype === 'doomgaze') {
            // Lumatrossia's eye beam — a searing horizontal lance
            ctx.fillStyle = 'rgba(255,0,51,0.85)'; ctx.shadowBlur = 18; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.ellipse(cx, cy, this.w * 0.75, this.h / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, cy, this.w * 0.4, this.h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        } else if (this.subtype === 'piano') {
            // a tumbling grand piano (Copy Cat's Piano Drop)
            if (typeof pianoImg !== 'undefined' && pianoImg.complete && pianoImg.naturalWidth > 0) {
                ctx.drawImage(pianoImg, this.x, this.y, this.w, this.h);
            } else {
                ctx.fillStyle = '#111'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.fillRect(this.x, this.y, this.w, this.h); ctx.strokeRect(this.x, this.y, this.w, this.h);
                ctx.fillStyle = '#fff'; for (let k = 0; k < 6; k++) ctx.fillRect(this.x + 4 + k * (this.w - 8) / 6, this.y + this.h - 12, (this.w - 8) / 6 - 1.5, 10);
            }
        } else if ((this.owner ? this.owner.charType : this.ownerCharType) === 'MAGE') {
            // Basic arcane sigil: glowing ringed orb with a spinning rune
            ctx.translate(cx, cy);
            ctx.fillStyle = 'rgba(201,139,255,0.65)'; ctx.strokeStyle = '#dcb6ff';
            ctx.shadowBlur = 16; ctx.shadowColor = '#c98bff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2); ctx.stroke();
            ctx.rotate(now * 4);
            ctx.beginPath();
            for (let i = 0; i < 4; i++) { let a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); }
            ctx.stroke();
        } else {
            // plain bullets (Ranger gunfire)
            ctx.fillStyle = '#fff'; ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
            ctx.fillRect(this.x, this.y, this.w, this.h);
        }
        ctx.restore();
    }
}

class Fighter {
    constructor(id, x, typeName, isAI = false, team = 0, isPartner = false) {
        this.id = id;
        this.charType = typeName;
        const stats = CHARACTERS[typeName];
        
        this.x = x; this.y = GROUND_Y;
        this.vx = 0; this.vy = 0;
        this.width = stats.width; this.height = stats.height;
        this.hp = stats.hp; this.maxHp = stats.hp;
        this.speed = stats.speed; this.jumpForce = stats.jump;
        
        this.state = 'IDLE'; // IDLE, WALK, CROUCH, JUMP, FALL, ATTACK, HITSTUN, BLOCK, DEAD
        this.dir = (x < WIDTH/2) ? 1 : -1; // 1 = right, -1 = left
        this.team = team;
        this.isAI = isAI;
        this.aiTimer = 0;
        this.aiReactTimer = 0;   // cooldown between reactive defensive actions (anti-spam)
        this.aiBlockTimer = 0;   // how long the current committed block holds
        this.aiLevel = 0.5;      // 0..1 difficulty scalar; Ladder raises this per rung
        this.switchCooldown = 0; // 2v2 tag cooldown
        // Phantom — Fading Veil passive (intangible when standing still)
        this.fadeCharge = 0; this.fadeActive = 0; this.fadeCooldown = 0; this._fadeIntangible = false;
        this.tumbleTimer = 0; this._tumbleAngle = 0; this._tumbleDir = 1; // post-ult floor tumble
        this.yankTimer = 0; this.yankSource = null; this.yankFromX = 0;   // Grave Drag reel-in
        this.rootTimer = 0; // Grave Grasp: held in place by spectral hands until it lapses or you're hit

        // The last special THIS fighter performed — a Copy Cat's neutral steals the opponent's.
        this.lastSpecialAtk = null;
        // Copy Cat
        this.agilityTimer = 0;        // Agility counter-mark active window
        this.catPin = null;           // { target, t, hits, hitTick } Cat Dash pin-and-slash
        this.ultUnlocked = (this.charType !== 'COPYCAT'); // Copy Cat's ult is locked until Nine Lives procs
        this.ultSealed = false;       // an enemy whose ult was copied & sealed
        this.copiedKind = null;       // the ult kind the Copy Cat stole
        this.sealedEnemy = null;      // who to un-seal when the Copy Cat spends its copy
        this._nineLivesFx = 0;        // Nine Lives revive flash timer

        // The Cult — Congregation (Devotion) + the Lumatrossia install
        this.devotion = 0;            // 0..100, builds on landing hits; tiers grow the rituals
        this.lumActive = false;       // currently transformed into Lumatrossia
        this.lumTimer = 0;            // remaining install time (the draining ult bar)
        this._cultSaved = null;       // saved fighter fields to restore on desummon
        this._lumFx = 0;              // summon/desummon flash timer
        this.maskId = (typeof CULT_MASKS !== 'undefined') ? Math.floor(Math.random() * CULT_MASKS) : 0; // leader's mask
        this.puppet = null;           // Cult Up — the mimic puppet { hist, t }
        this.portalCd = 0;            // Lumatrossia Down — drop-portal cooldown
        this._portalSlam = null;      // marks a foe falling out of a portal { owner, dmg }

        // The Twins — a mirrored pair sharing one HP pool
        this.isPartner = isPartner;   // true = the second (drawn-only) twin body
        this.anchorX = x;             // centre the pair mirrors around
        this.twinGap = 76;            // distance from anchor to each twin (L/R spread/converge)
        this.symBuff = 0;             // Symmetry passive: >0 while the foe is centred between the twins
        this.twinOffset = 60;         // live x-gap of the partner from the lead; both still move/attack together at any gap
        this._twinLeaping = 0;        // Converge leap timer (partner leaps independently, then re-locks)
        this.partner = null;          // the other twin (full Fighter, synced + drawn, hurtbox + hitbox source)
        this.tether = null;           // Down — wire strung between the twins { t, life }
        this.fastball = null;         // Up — the hurled twin as a missile { t, x, y, vx, vy }

        // The Traveler — chrono kit
        this.slipCd = 0;              // Temporal Slip passive: auto-phase one hit, then recharge
        this.rewindCd = 0;            // Down — Rewind cooldown
        this.posHistory = [];         // rolling 3s record of {x, y, hp} for Rewind + the after-echo
        this._echoHit = null;         // Tachyon Echo re-hit pending on this fighter { t, dmg, owner }
        this._skipHide = 0;           // Time Skip: brief edit-out-of-the-timeline invisibility
        this._trail = [];             // afterimage ghosts {x, y, dir, age}

        // Combat state
        this.attacks = stats.attacks;
        this.currentAttack = null;
        this.stateTimer = 0;
        this.hasSpawnedHitbox = false;
        this.comboInputBuffer = [];
        
        // Passives & Buffs
        this.comboCount = 0;
        this.comboTimer = 0;
        this.parryBuffTimer = 0;
        this.tacticalReload = false;

        // Status effects / special-move state
        this.slowTimer = 0;     // movement slowed (Frost / tar runes)
        this.slowFactor = 1;
        this.burnTimer = 0;
        this.burnTickTimer = 0;
        this.venomTimer = 0;
        this.venomTickTimer = 0;
        this.invulnTimer = 0;   // dodge i-frames (Combat Roll / Blink)
        this.manaFontTimer = 0; // Mage: next spell empowered
        this.specialDone = false; // one-shot trigger guard for blink/roll/etc
        this.beastIndex = 0;      // Beast Tamer: 0 serpent, 1 brute, 2 raven
        this.beastSwapFlash = 0;
        this.beastMarkedTimer = 0;
        this.beastAnimTimer = 0;
        this.beastRavenGlideTimer = 0;
        this.beastRavenDiveTimer = 0;
        this.beastSnakeSwingTimer = 0;

        // Ledge grab (ring-out stages)
        this.ledge = null;       // {x, top, side} of the lip being gripped
        this.ledgeTimer = 0;     // time spent hanging
        this.regrabTimer = 0;    // brief lockout so you can intentionally drop off
        this._ringedOut = false; // died by falling off the map

        // Block durability — guard shatters if it absorbs too much
        this.blockMax = BLOCK_DUR[typeName] || 60;
        this.blockHealth = this.blockMax;
        this.blockBreakTimer = 0; // stagger time after a guard break
        this._guardBreakFx = 0;   // timer for the guard-shatter burst animation

        // Ultimate meter & state
        this.meter = 0;
        this.meterMax = 100;
        this.ult = null;          // active ultimate state machine
        this.isDummy = false;     // training dummy: stands still, never dies
        this.throwHold = null;    // { target, t, dmg } Dark Ruler grab-and-throw

        // Animation variables
        this.animTimer = 0;
        this.inputTimer = 0;

        // The Twins — spin up the second body right beside the first (drawn + synced, never self-driven)
        if (typeName === 'TWINS' && !isPartner) {
            this.partner = new Fighter(id + '_B', x + 60, 'TWINS', false, team, true);
        }
    }

    update(dt) {
        if (this.state === 'DEAD') return;
        if (ultActive === this) dt = frameRealDt; // the ult performer acts in real time

        this.animTimer += dt;
        this.beastAnimTimer += dt;
        this.inputTimer += dt;
        if (this.switchCooldown > 0) this.switchCooldown -= dt;
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.comboCount = 0;
        if (this.parryBuffTimer > 0) this.parryBuffTimer -= dt;
        if (this.slowTimer > 0) this.slowTimer -= dt;
        else this.slowFactor = 1;
        if (this.burnTimer > 0) {
            this.burnTimer -= dt;
            this.burnTickTimer -= dt;
            if (this.burnTickTimer <= 0) {
                this.burnTickTimer = 0.55;
                this.hp = Math.max(0, this.hp - 1);
                spawnParticles(this.x, this.y - 48, 4, '#ff5a2a');
                updateHUD();
                if (this.hp <= 0 && !this.isDummy) {
                    this.changeState('DEAD');
                    sfx.playDeath();
                    checkWinCondition();
                    return;
                }
                if (this.isDummy) this.hp = this.maxHp;
            }
        }
        if (this.venomTimer > 0) {
            this.venomTimer -= dt;
            this.venomTickTimer -= dt;
            if (this.venomTickTimer <= 0) {
                this.venomTickTimer = 0.45;
                this.hp = Math.max(0, this.hp - 1);
                spawnParticles(this.x, this.y - 24, 5, '#fff');
                updateHUD();
                if (this.hp <= 0 && !this.isDummy) {
                    this.changeState('DEAD');
                    sfx.playDeath();
                    checkWinCondition();
                    return;
                }
                if (this.isDummy) this.hp = this.maxHp;
            }
        }
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.manaFontTimer > 0) this.manaFontTimer -= dt;
        if (this.beastSwapFlash > 0) this.beastSwapFlash -= dt;
        if (this.beastMarkedTimer > 0) this.beastMarkedTimer -= dt;
        if (this.beastRavenGlideTimer > 0) this.beastRavenGlideTimer -= dt;
        if (this.beastRavenDiveTimer > 0) this.beastRavenDiveTimer -= dt;
        if (this.beastSnakeSwingTimer > 0) this.beastSnakeSwingTimer -= dt;
        if (this.regrabTimer > 0) this.regrabTimer -= dt;
        if (this.charType === 'PHANTOM') this.updateFadingVeil(dt);
        if (this.agilityTimer > 0) this.agilityTimer -= dt; // Copy Cat counter-mark
        if (this._nineLivesFx > 0) this._nineLivesFx -= dt;
        if (this.catPin) this.updateCatPin(dt);             // Cat Dash pin-and-slash
        if (this._lumFx > 0) this._lumFx -= dt;             // Cult summon/desummon flash
        if (this.devotion > 0 && !this.lumActive) this.devotion = Math.max(0, this.devotion - dt * 3.5); // Congregation decays
        if (this.portalCd > 0) this.portalCd -= dt;         // Lumatrossia drop-portal cooldown
        if (this.puppet) this.updatePuppet(dt);             // Cult mimic puppet records the leader
        if (this.tether) { this.tether.t += dt; this.updateTether(dt); if (this.tether.t >= this.tether.life) this.tether = null; }
        if (this.fastball) this.updateFastball(dt); // the thrown twin sails across the map
        if (this.slipCd > 0) this.slipCd -= dt;     // Temporal Slip recharging
        if (this.rewindCd > 0) this.rewindCd -= dt;
        if (this._skipHide > 0) this._skipHide -= dt;
        if (this.charType === 'TRAVELER') {
            // rolling 3s record for Rewind (and its on-stage after-echo)
            this.posHistory.push({ x: this.x, y: this.y, hp: this.hp });
            if (this.posHistory.length > 185) this.posHistory.shift();
            // afterimages — everything he does leaves a ghost trail
            this._trailTick = (this._trailTick || 0) - dt;
            let moving = Math.abs(this.vx) > 60 || this.y < GROUND_Y || this.state === 'ATTACK' || this.state === 'ULT';
            if (moving && this._trailTick <= 0) { this._trailTick = 0.05; this._trail.push({ x: this.x, y: this.y, dir: this.dir, age: 0 }); }
            for (let g of this._trail) g.age += dt;
            this._trail = this._trail.filter(g => g.age < 0.24);
        }
        if (this._echoHit) { // Tachyon Echo — the same hit lands AGAIN out of the past
            this._echoHit.t -= dt;
            if (this._echoHit.t <= 0) {
                let eh = this._echoHit; this._echoHit = null;
                if (this.state !== 'DEAD') {
                    this.takeDamage(eh.dmg, { x: 120 * (this.x >= (eh.owner ? eh.owner.x : this.x) ? 1 : -1), y: -70 }, 0.26, eh.owner);
                    spawnParticles(this.x, this.y - 45, 12, '#6fd0ff');
                }
            }
        }
        if (this._portalSlam && this.y >= GROUND_Y) {       // foe slams down out of a drop-portal
            let ps = this._portalSlam; this._portalSlam = null;
            this.takeDamage(ps.dmg, { x: 0, y: 0 }, 0.5, ps.owner, { unblockable: true });
            spawnParticles(this.x, GROUND_Y - 10, 26, '#ff0033'); spawnParticles(this.x, GROUND_Y - 10, 14, '#fff');
        }
        if (this.lumActive) { // Lumatrossia install — the bar steadily empties, then desummons
            this.lumTimer -= dt;
            this.meter = Math.max(0, this.meterMax * (this.lumTimer / LUM_DURATION));
            if (this.lumTimer <= 0) this.revertFromLumatrossia();
        }
        if (this.tumbleTimer > 0) { this.tumbleTimer -= dt; this._tumbleAngle += Math.abs(this.vx) * dt * 0.04 * (this._tumbleDir || 1); }
        if (this.yankTimer > 0) this.updateYank(dt);
        if (this.rootTimer > 0) {
            this.rootTimer -= dt;
            if (this.rootTimer > 0 && this.state !== 'DEAD') {
                if (this.state !== 'HITSTUN') this.changeState('HITSTUN');
                if (this.stateTimer < 0.15) this.stateTimer = 0.15; // stay held
                this.vx = 0; this.vy = 0; this.y = GROUND_Y;
            }
        }

        // Guard slowly regenerates while not actively blocking
        if (this.state !== 'BLOCK' && this.blockHealth < this.blockMax) {
            this.blockHealth = Math.min(this.blockMax, this.blockHealth + 26 * dt);
        }
        // Training dummies keep full HP/meter and never act
        if (this.isDummy) { this.hp = this.maxHp; }

        // Dark Ruler grab-and-throw plays out over a couple frames
        if (this.throwHold) this.updateThrowHold(dt);

        // An ultimate cinematic fully drives this fighter
        if (this.state === 'ULT') { this.updateUlt(dt); return; }

        // Ledge hang: frozen against gravity until the fighter climbs or drops
        if (this.state === 'LEDGE') {
            this.handleLedge(dt);
            return;
        }

        // Apply Gravity
        this.vy += 1500 * dt;

        // Telepath passive — Levitation: glide slowly while descending (until hit),
        // hold Down to drop fast. Getting knocked (HITSTUN/break) cancels the glide.
        if (this.charType === 'TELEPATH' && this.y < GROUND_Y && this.vy > 0 && !this._diving &&
            this.state !== 'HITSTUN' && this.state !== 'DEAD' && this.state !== 'BLOCKBREAK') {
            let fastFall = false;
            if (!this.isAI) { let c = this.playerControls(); fastFall = keys[c.d]; }
            else fastFall = this.aiFastFall; // AI may choose to dive
            if (fastFall) this.vy = Math.max(this.vy, 520);  // dive
            else this.vy = Math.min(this.vy, 75);            // gentle glide to the ground
        }
        if (this.charType === 'BEAST_TAMER' && this.beastRavenGlideTimer > 0 && this.y < GROUND_Y && this.vy > 0 &&
            this.state !== 'HITSTUN' && this.state !== 'DEAD' && this.state !== 'BLOCKBREAK') {
            let fastFall = false;
            if (!this.isAI) { let c = this.playerControls(); fastFall = keys[c.d]; }
            else fastFall = this.aiFastFall;
            if (fastFall) this.vy = Math.max(this.vy, 540);
            else this.vy = Math.min(this.vy, 82);
        }

        let prevFoot = this.y;
        this.y += this.vy * dt;

        // Stage collision: main floor + one-way platforms
        let floorY = this.floorUnder(prevFoot);
        if (floorY !== null && this.y >= floorY && this.vy >= 0) {
            this.y = floorY;
            this.vy = 0;
            this._onSurface = true; // resting on the main floor or a platform — may jump
            if (this.state !== 'ATTACK') this._diving = false; // clear glide-block once not mid dive-attack
            if (this.state === 'FALL') this.changeState('IDLE');
        } else {
            this._onSurface = false;
            if (this.state !== 'ATTACK' && this.state !== 'HITSTUN' && this.state !== 'DEAD' && this.state !== 'BLOCKBREAK') {
                this.changeState(this.vy < 0 ? 'JUMP' : 'FALL');
            }
            // Over the void and falling — try to catch a ledge
            if (floorY === null && this.vy > 0) this.tryLedgeGrab(prevFoot);
            // Ring out: fell off the map past the death plane
            if (this.state !== 'LEDGE' && this.y > HEIGHT + 90 && getStageGeo().ringOut) {
                this.ringOut();
                return;
            }
        }

        // Handle States
        switch(this.state) {
            case 'IDLE':
            case 'WALK':
            case 'CROUCH':
            case 'JUMP':
            case 'FALL':
            case 'BLOCK':
                this.vx *= 0.8; // Friction
                if (Math.abs(this.vx) < 10) this.vx = 0;
                this.x += this.vx * dt;
                
                if (!this.isAI) this.handleInput();
                else if (this.isDummy) this.updateDummy(dt); // training dummy follows its behavior setting
                else this.handleAI(dt);
                break;
                
            case 'ATTACK':
                this.x += this.vx * dt;
                if (this.vy === 0) this.vx *= 0.9; // Friction on ground attacks
                this.stateTimer += dt;
                this.processAttack();
                break;
                
            case 'HITSTUN':
                this.x += this.vx * dt;
                if (this._thrown > 0) { this._thrown -= dt; this.vx *= 0.992; } // hurled — keeps its momentum across the screen
                else this.vx *= 0.95; // normal slide friction
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) {
                    this.changeState('IDLE');
                }
                break;

            case 'BLOCKBREAK':
                this.x += this.vx * dt;
                this.vx *= 0.9; // stagger slide
                if (this._guardBreakFx > 0) this._guardBreakFx -= dt;
                this.blockBreakTimer -= dt;
                if (this.blockBreakTimer <= 0) {
                    this.blockHealth = this.blockMax * 0.4; // guard returns partially
                    this.changeState('IDLE');
                }
                break;
        }

        // Screen Boundaries
        if (this.x < this.width/2) this.x = this.width/2;
        if (this.x > WIDTH - this.width/2) this.x = WIDTH - this.width/2;

        // Face opponent if not attacking/hit/hanging
        if (this.state !== 'ATTACK' && this.state !== 'HITSTUN' && this.state !== 'DEAD' && this.state !== 'LEDGE') {
            let target = this.getClosestEnemy();
            if (target) {
                this.dir = (target.x > this.x) ? 1 : -1;
            }
        }

        // The Twins — drive the mirrored formation + keep the second body synced
        if (this.charType === 'TWINS' && !this.isPartner) this.updateTwins(dt);
    }

    // Which surface (if any) is directly under the fighter's feet this frame.
    // Returns the floor's top Y, or null when over the void.
    floorUnder(prevFoot) {
        let g = getStageGeo();
        let best = null;
        if (this.x >= g.main.left && this.x <= g.main.right) best = g.main.top;
        for (let pl of g.platforms) {
            // one-way: only land when crossing the top from above while falling
            if (this.x >= pl.left && this.x <= pl.right && this.vy >= 0 &&
                prevFoot <= pl.top + 2 && this.y >= pl.top) {
                if (best === null || pl.top < best) best = pl.top; // prefer the higher surface
            }
        }
        return best;
    }

    // Falling near a stage edge -> grip the lip instead of plummeting.
    tryLedgeGrab(prevFoot) {
        if (this.regrabTimer > 0 || this.state === 'ATTACK' || this.state === 'DEAD' || this.state === 'LEDGE') return;
        if (this.vy <= 0) return;
        let g = getStageGeo();
        if (!g.ringOut) return;
        let edges = [];
        const add = pl => { edges.push({ x: pl.left, top: pl.top, side: -1 }); edges.push({ x: pl.right, top: pl.top, side: 1 }); };
        add(g.main); g.platforms.forEach(add);
        for (let e of edges) {
            let outward = this.x - e.x; // distance past the edge into the void
            if (e.side === -1) { if (outward > 6 || outward < -34) continue; }   // off the left edge
            else { if (outward < -6 || outward > 34) continue; }                 // off the right edge
            let footBelow = this.y - e.top;
            if (footBelow < -4 || footBelow > 74) continue;                      // only just below the lip
            if (!this.isAI && this.holdingAway(e.side)) continue;                // player chose to drop
            this.grabLedge(e);
            return;
        }
    }

    holdingAway(side) {
        let c = this.playerControls();
        let awayKey = side === -1 ? c.l : c.r; // pushing away from the platform, or down
        return keys[awayKey] || keys[c.d];
    }

    grabLedge(e) {
        this.state = 'LEDGE';
        this.stateTimer = 0; this.animTimer = 0; this.ledgeTimer = 0;
        this.ledge = e;
        this.x = e.x + e.side * 15; // hang just off the edge
        this.y = e.top + 84;        // body dangles below the lip
        this.vx = 0; this.vy = 0;
        this.dir = -e.side;         // face into the stage
        spawnParticles(e.x, e.top, 6, '#fff');
        sfx.playHit();
    }

    handleLedge(dt) {
        this.ledgeTimer += dt;
        // pin to the lip
        this.vx = 0; this.vy = 0;
        this.x = this.ledge.x + this.ledge.side * 15;
        this.y = this.ledge.top + 84;
        this.dir = -this.ledge.side;

        let climb = false, drop = false;
        if (this.isAI) {
            if (this.ledgeTimer > 0.35) climb = true; // CPU scrambles back up
        } else {
            let c = this.playerControls();
            let awayKey = this.ledge.side === -1 ? c.l : c.r;
            if (keyPressed(c.u)) climb = true;
            else if (keys[c.d] || keys[awayKey]) drop = true;
        }
        if (this.ledgeTimer > 4) climb = true; // safety auto-climb

        if (climb) {
            this.x = this.ledge.x - this.ledge.side * 22; // step inward onto the platform
            this.y = this.ledge.top;
            this.vy = -260; // small hop up onto the surface
            this.regrabTimer = 0.4;
            this.ledge = null;
            this.changeState('JUMP');
        } else if (drop) {
            this.regrabTimer = 0.5; // can't instantly re-grab -> actually falls
            this.ledge = null;
            this.vy = 80;
            this.changeState('FALL');
        }
    }

    ringOut() {
        if (this.state === 'DEAD') return;
        // In training, falling off just respawns you on the stage
        if (trainingMode) {
            this.x = WIDTH / 2; this.y = GROUND_Y; this.vx = 0; this.vy = 0;
            this.hp = this.maxHp; this.state = 'IDLE'; this.ledge = null;
            return;
        }
        this._ringedOut = true;
        this.hp = 0;
        this.state = 'DEAD';
        this.stateTimer = 0;
        this.ledge = null;
        spawnParticles(this.x, HEIGHT - 40, 24, '#ff0033');
        sfx.playDeath();
        checkWinCondition();
    }

    // ---------------- DARK RULER GRAB-AND-THROW ----------------
    captureThrow(target) {
        if (this.throwHold || !target || target.state === 'DEAD' || target.invulnTimer > 0) return;
        this.throwHold = { target, t: 0, dmg: (this.attacks.specSide ? this.attacks.specSide.dmg : 18) };
        this.dir = target.x >= this.x ? 1 : -1;
        spawnParticles(target.x, target.y - 40, 12, '#111');
        spawnParticles(target.x, target.y - 40, 6, '#ff0033');
        playAudio(attackSfx.punch);
    }

    updateThrowHold(dt) {
        let th = this.throwHold, tg = th.target;
        if (!tg || tg.state === 'DEAD') { this.throwHold = null; return; }
        th.t += dt;
        this.vx = 0; this.vy = 0;
        // Hold them firmly in your grip, hoisted in front of you
        tg.state = 'HITSTUN'; tg.stateTimer = 0.6; tg.vx = 0; tg.vy = 0;
        tg.x = this.x + this.dir * 54; tg.y = GROUND_Y - 16;
        if (th.t >= 0.4) {
            // hurl them clear across to the opposite side of the screen
            tg.takeDamage(th.dmg, { x: 3000 * this.dir, y: -260 }, 0.9, this, { unblockable: true });
            tg._thrown = 0.6; // brief low-friction so they actually reach the far wall
            spawnParticles(this.x + this.dir * 46, GROUND_Y - 46, 22, '#111');
            spawnParticles(this.x + this.dir * 46, GROUND_Y - 46, 12, '#ff0033');
            sfx.playDeath();
            this.throwHold = null;
        }
    }

    // ---------------- COPY CAT: Cat Dash pin & Piano Drop ----------------
    // The pounce connected — pin the foe to the ground and rake them, then leap off.
    startCatPin(target) {
        if (this.catPin || !target || target.state === 'DEAD' || target.invulnTimer > 0) return;
        this.catPin = { target, t: 0, hits: 0, hitTick: 0 };
        this.dir = target.x >= this.x ? 1 : -1;
        this.vx = 0; this.vy = 0; this.y = GROUND_Y;
        spawnParticles(target.x, target.y - 30, 12, '#fff');
        playAudio(attackSfx.knife);
    }

    updateCatPin(dt) {
        let cp = this.catPin, tg = cp.target;
        if (!tg || tg.state === 'DEAD') { this.catPin = null; if (this.state === 'ATTACK') this.changeState('IDLE'); return; }
        cp.t += dt;
        this.vx = 0; this.vy = 0; this.y = GROUND_Y;
        // hold them pinned under the cat
        tg.state = 'HITSTUN'; tg.stateTimer = 0.4; tg.vx = 0; tg.vy = 0;
        tg.x = this.x + this.dir * 22; tg.y = GROUND_Y;
        // a flurry of rapid slashes
        cp.hitTick -= dt;
        if (cp.hitTick <= 0 && cp.hits < 5) {
            cp.hitTick = 0.1; cp.hits++;
            tg.takeDamage(3, { x: 0, y: 0 }, 0.25, this, { unblockable: true });
            spawnParticles(tg.x, tg.y - 30, 8, '#fff');
            playAudio(attackSfx.knife);
        }
        // then spring off, popping them up
        if (cp.hits >= 5 && cp.t > 0.62) {
            tg.takeDamage(6, { x: 140 * this.dir, y: -320 }, 0.45, this, { unblockable: true });
            this.vy = -380; this.vx = -this.dir * 180; this.changeState('JUMP');
            spawnParticles(this.x, GROUND_Y - 30, 16, '#fff');
            this.catPin = null;
        }
    }

    // Piano Drop — a piano plummets from above onto the foe (or smashes the ground).
    dropPiano() {
        let foe = this.getClosestEnemy();
        let tx = foe ? foe.x + (foe.vx || 0) * 0.18 : this.x + this.dir * 150; // lead the target slightly
        let p = new Projectile(tx - 38, -120, 0, 220, 76, 58, 14, { x: 60 * this.dir, y: 300 }, 0.5, this, 4.5, null);
        p.subtype = 'piano';
        p.ownerId = this.id; p.ownerTeam = this.team; p.ownerCharType = this.charType;
        projectiles.push(p);
    }

    // ---------------- THE CULT: Dark Offering & Consecrated Ground ----------------
    spawnDarkOffering(dmgMod = 1) {
        let atk = this.currentAttack;
        let n = 1 + this.cultTier(); // 1 / 2 / 3 hexed bolts as Devotion grows
        let px = this.x + (this.dir === 1 ? 22 : -22 - atk.w);
        let py = this.y + atk.oy;
        for (let i = 0; i < n; i++) {
            let spread = (i - (n - 1) / 2) * 150; // vertical fan
            let p = new Projectile(px, py, atk.pSpeed * this.dir, spread, atk.w, atk.h, atk.dmg * dmgMod,
                { x: atk.kb.x * this.dir, y: atk.kb.y }, atk.stun, this, atk.pLife, null);
            p.subtype = 'hex'; p.ownerId = this.id; p.ownerTeam = this.team; p.ownerCharType = this.charType;
            projectiles.push(p);
        }
        playAudio(attackSfx.magic);
    }

    spawnConsecrate() {
        let tier = this.cultTier();
        let x = Math.max(70, Math.min(WIDTH - 70, this.x + this.dir * 64));
        consecrateZones.push({ x, owner: this, team: this.team, t: 0, life: 5 + tier * 1.6, radius: 70 + tier * 26, tick: 0 });
        spawnParticles(x, GROUND_Y - 8, 22, '#ff0033');
        spawnParticles(x, GROUND_Y - 8, 10, '#fff');
        playAudio(attackSfx.magic);
    }

    // Side — The Procession: cultists run out and plant a snare-trap ahead of the leader.
    spawnProcessionTrap() {
        let x = Math.max(70, Math.min(WIDTH - 70, this.x + this.dir * 190));
        cultTraps.push({ x, owner: this, team: this.team, t: 0, arm: 0.42, life: 7 + this.cultTier(), triggered: false, radius: 44 });
        playAudio(attackSfx.magic);
    }

    // Up — the mimic puppet: a full-size cultist falls in and echoes the leader on a delay.
    spawnPuppet() {
        this.puppet = { hist: [], t: 0, delay: 13, fall: 1 };
        spawnParticles(this.x, GROUND_Y - 60, 18, '#ff0033');
        playAudio(attackSfx.magic);
    }
    updatePuppet(dt) {
        let pp = this.puppet;
        pp.t += dt;
        if (pp.fall > 0) pp.fall = Math.max(0, pp.fall - dt * 3.2); // drops into place at spawn
        pp.hist.push({ x: this.x, dir: this.dir, state: this.state, atk: this.currentAttack ? this.currentAttack.type : null, st: this.stateTimer, anim: this.animTimer, y: this.y });
        if (pp.hist.length > pp.delay + 4) pp.hist.shift();
    }
    explodePuppet() {
        let pp = this.puppet; this.puppet = null;
        let px = (pp.hist.length ? pp.hist[0].x : this.x);
        for (let p of players) {
            if (!p || p.state === 'DEAD') continue;
            if (p.team === this.team) continue;                 // allies unharmed
            if (Math.abs(p.x - px) > 170) continue;
            let away = p.x < px ? -1 : 1;
            p.takeDamage(16, { x: 440 * away, y: -300 }, 0.55, this); // damage ONLY the opponent
        }
        // the leader is thrown back too, but takes no damage
        this.vx = -this.dir * 420; this.vy = -240;
        spawnParticles(px, GROUND_Y - 40, 42, '#ff0033'); spawnParticles(px, GROUND_Y - 40, 22, '#fff');
        playAudio(attackSfx.magic);
    }

    // Lumatrossia Side — blink behind the opponent.
    lumTeleport() {
        let foe = this.getClosestEnemy();
        spawnParticles(this.x, this.y - 60, 22, '#ff0033'); // vanish
        if (foe) {
            this.x = Math.max(60, Math.min(WIDTH - 60, foe.x - foe.dir * 90));
            this.dir = foe.x >= this.x ? 1 : -1;
        } else {
            this.x = Math.max(60, Math.min(WIDTH - 60, this.x + this.dir * 220));
        }
        this.y = GROUND_Y; this.vx = 0; this.vy = 0;
        this.invulnTimer = Math.max(this.invulnTimer, 0.22);
        spawnParticles(this.x, this.y - 60, 26, '#ff0033'); spawnParticles(this.x, this.y - 60, 13, '#fff'); // reappear
        playAudio(attackSfx.magic);
    }

    // Lumatrossia Down — a portal swallows the foe and drops them from the sky (cooldown).
    lumPortal() {
        if (this.portalCd > 0) return; // on cooldown
        let foe = this.getClosestEnemy();
        if (!foe || foe.state === 'DEAD' || foe.invulnTimer > 0) return;
        this.portalCd = 6;
        let fx = foe.x;
        lumPortalFx.push({ x: fx, y: GROUND_Y - 6, t: 0, life: 0.95 });  // ground portal they fall into
        lumPortalFx.push({ x: fx, y: 80, t: 0, life: 0.95 });            // sky portal they emerge from
        foe.x = fx; foe.y = 80; foe.vy = 120; foe.vx = 0;
        foe.state = 'HITSTUN'; foe.stateTimer = 2.2;
        foe._portalSlam = { owner: this, dmg: 18 };
        spawnParticles(fx, GROUND_Y - 8, 20, '#ff0033');
        playAudio(attackSfx.magic);
    }

    // Lumatrossia Up — a beast maw forms above the foe and rains Mage-style fire down.
    spawnBeastFire() {
        let foe = this.getClosestEnemy();
        let bx = Math.max(50, Math.min(WIDTH - 50, foe ? foe.x : this.x + this.dir * 160));
        lumBeastFx.push({ x: bx, y: 72, t: 0, life: 0.85 });
        for (let i = 0; i < 4; i++) {
            let px = bx + (i - 1.5) * 34;
            let p = new Projectile(px, 62, 0, 250, 20, 24, 8, { x: 50 * (i % 2 ? 1 : -1), y: 220 }, 0.3, this, 2.2, null);
            p.subtype = 'fire'; p.burn = 3.2;
            p.ownerId = this.id; p.ownerTeam = this.team; p.ownerCharType = this.charType;
            projectiles.push(p);
        }
        playAudio(attackSfx.fire);
    }

    // ---------------- THE TRAVELER: Rewind ----------------
    // Snap back to where he stood ~3 seconds ago and undo 60% of the HP lost since.
    doRewind() {
        if (this.rewindCd > 0 || !this.posHistory.length) return;
        let past = this.posHistory[0];
        this.rewindCd = 9;
        spawnParticles(this.x, this.y - 45, 18, '#6fd0ff'); // departure flash
        // a ghost streak between here and the echo
        for (let i = 0; i < 6; i++) {
            let fx = this.x + (past.x - this.x) * (i / 6);
            spawnParticles(fx, this.y - 45, 2, '#6fd0ff');
        }
        this.x = Math.max(28, Math.min(WIDTH - 28, past.x));
        this.y = Math.min(GROUND_Y, past.y);
        this.vx = 0; this.vy = 0;
        let lost = past.hp - this.hp;
        if (lost > 0) this.hp = Math.min(this.maxHp, this.hp + lost * 0.6);
        this._echoHit = null; // an incoming echo re-hit is undone too
        this.invulnTimer = Math.max(this.invulnTimer, 0.25);
        spawnParticles(this.x, this.y - 45, 22, '#6fd0ff'); // arrival flash
        playAudio(attackSfx.magic);
        updateHUD();
    }

    // ---------------- THE TWINS: a two-body pair you steer together ----------------
    // Both twins always mirror your actions at their own positions (the partner follows at the
    // current gap). A twin only breaks off if IT was individually stunned/knocked — then it plays
    // out its own hitstun while the other keeps fighting; once recovered it falls back in step.
    updateTwins(dt) {
        let p = this.partner;
        if (!p) return;
        if (this.fastball) return; // the controlled twin is sailing; partner stays anchored
        if (p.state === 'HITSTUN' || this._twinLeaping > 0) {
            this.updateSeparatedPartner(dt); // the partner is busy doing its own thing
        } else {
            this.followPartner(dt);          // both move/act as one at the current gap
        }
        let foe = this.getClosestEnemy();
        let lo = Math.min(this.x, p.x), hi = Math.max(this.x, p.x);
        let centred = !!foe && foe.x > lo && foe.x < hi;
        this.symBuff = centred ? Math.min(1, this.symBuff + dt * 4) : Math.max(0, this.symBuff - dt * 3);
    }

    // The off twin runs its own physics (knockback slide / hitstun countdown); on recovery it
    // re-locks its gap so the pair moves together again.
    updateSeparatedPartner(dt) {
        let p = this.partner;
        p.hp = this.hp; p.maxHp = this.maxHp; p.team = this.team; p.symBuff = 0;
        p.vy += 1500 * dt;
        p.x += p.vx * dt;
        p.y = Math.min(GROUND_Y, p.y + p.vy * dt);
        if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; }
        p.x = Math.max(28, Math.min(WIDTH - 28, p.x));
        if (p.state === 'HITSTUN') {
            p.vx *= p.y < GROUND_Y ? 0.99 : 0.9;
            p.stateTimer -= dt;
            if (p.stateTimer <= 0 && p.y >= GROUND_Y) { p.changeState('IDLE'); this.twinOffset = p.x - this.x; } // re-lock the gap
        } else if (this._twinLeaping > 0) {
            // Converge leap — the partner flies its own arc; once it lands the pair re-locks
            this._twinLeaping -= dt;
            p.state = p.y < GROUND_Y ? 'JUMP' : 'IDLE';
            if (p.y >= GROUND_Y && this._twinLeaping <= 0.4) { this._twinLeaping = 0; p.vx = 0; this.twinOffset = p.x - this.x; }
        } else {
            p.vx *= 0.8;
            if (p.y >= GROUND_Y) { p.state = 'IDLE'; this.twinOffset = p.x - this.x; }
        }
        p.animTimer += dt;
        let foe = this.getClosestEnemy();
        p.dir = foe ? (foe.x >= p.x ? 1 : -1) : p.dir;
    }

    // Both twins act as one: the partner follows at the current gap and mirrors the lead's pose.
    followPartner(dt) {
        let p = this.partner;
        if (!p || this.fastball) return;
        p.hp = this.hp; p.maxHp = this.maxHp; p.team = this.team; p.symBuff = this.symBuff;
        p.invulnTimer = this.invulnTimer; p.overkillRed = this.overkillRed; p._overkilled = this._overkilled;
        // If the LEAD is the one hurt, the other twin holds its ground unstunned (only the hit twin reels).
        if (this.state === 'HITSTUN' || this.state === 'BLOCKBREAK') {
            if (p.state === 'HITSTUN' || p.state === 'BLOCKBREAK') p.changeState('IDLE');
            p.state = 'IDLE'; p.currentAttack = null; p.animTimer += dt; p.vx *= 0.8;
            return;
        }
        p.x = Math.max(28, Math.min(WIDTH - 28, this.x + (this.twinOffset || 60)));
        p.y = this.y;
        p.state = this.state; p.stateTimer = this.stateTimer; p.animTimer = this.animTimer;
        p.currentAttack = this.currentAttack; p.vy = this.vy; p._hover = this._hover || 0;
        p.blockHealth = this.blockHealth; p._guardBreakFx = this._guardBreakFx; p.blockBreakTimer = this.blockBreakTimer;
        p.tether = this.tether;
        let foe = this.getClosestEnemy();
        p.dir = foe ? (foe.x >= p.x ? 1 : -1) : -this.dir;
    }

    // The hitbox/projectile origin for the OTHER twin (used so attacks come from both bodies).
    twinPartnerX() { return this.partner ? this.partner.x : (this.x + 60); }

    // Side — Crossover: the twins dash forward, scissoring through together.
    twinCrossover() {
        this.vx = 720 * this.dir;
        this.invulnTimer = Math.max(this.invulnTimer, 0.18);
        spawnParticles(this.x + 30, GROUND_Y - 40, 14, '#9be3ff');
        playAudio(attackSfx.knife);
    }

    // Up (twins together) — Fastball: hurl the CONTROLLED twin bodily across the map at the foe.
    // You keep control of the twin that flew over; the other stays put where the pair stood.
    twinFastball() {
        let p = this.partner;
        if (!p || this.fastball) return;
        let foe = this.getClosestEnemy();
        let dir = foe ? (foe.x >= this.x ? 1 : -1) : this.dir;
        p.vx = 0; p.vy = 0; p.state = 'IDLE'; // the OTHER twin anchors where it is
        this.vx = 950 * dir; this.vy = -300;  // YOU sail across (still fully controllable on landing)
        this.fastball = { t: 0, dir, hit: false };
        spawnParticles(this.x, this.y - 40, 16, '#9be3ff');
        playAudio(attackSfx.punch);
    }
    // The thrown (controlled) twin is moved by normal physics; this just lands the strike and
    // tumbles it as it sails, then hands control straight back once it touches down.
    updateFastball(dt) {
        let fb = this.fastball;
        fb.t += dt;
        this.tumbleTimer = 0.2; this._tumbleDir = fb.dir; // spin as you fly
        if (!fb.hit) {
            for (let e of players) {
                if (!e || e.team === this.team || e.state === 'DEAD') continue;
                if (Math.abs(e.x - this.x) < 48 && Math.abs(e.y - this.y) < 92) {
                    fb.hit = true;
                    let away = e.x < this.x ? -1 : 1;
                    e.takeDamage(11, { x: 320 * away, y: -360 }, 0.55, this);
                    spawnParticles(e.x, e.y - 40, 22, '#9be3ff');
                    playAudio(attackSfx.punch);
                    break;
                }
            }
        }
        if (this.y >= GROUND_Y && (fb.hit || fb.t > 0.35)) { // landed — full control resumes for BOTH twins
            this.fastball = null; this.tumbleTimer = 0;
            if (this.partner) this.twinOffset = this.partner.x - this.x; // lock the new (wide) gap so both move together
        }
    }

    // Up (twins apart) — both leap at an angle toward each other; anything caught between is hit.
    twinConverge() {
        let p = this.partner;
        if (!p) return;
        let mid = (this.x + p.x) / 2;
        this.vy = -480; this.vx = (mid >= this.x ? 1 : -1) * 380;
        p.vy = -480; p.vx = (mid >= p.x ? 1 : -1) * 380; p.state = 'JUMP'; p.currentAttack = null;
        this._twinLeaping = 0.7; // the partner flies its own arc, then re-locks beside the lead
        this.invulnTimer = Math.max(this.invulnTimer, 0.2);
        let hb = new Hitbox(mid - 75, GROUND_Y - 150, 150, 150, 9, { x: 0, y: -440 }, 0.5, this, 0.45);
        hb.atk = { type: 'twinConverge', name: 'specUp' };
        hitboxes.push(hb);
        spawnParticles(mid, GROUND_Y - 60, 16, '#9be3ff');
        playAudio(attackSfx.knife);
    }

    // Down — Tether: a taut wire strung between the two twins along the ground.
    twinTether() {
        this.tether = { t: 0, life: 3.0, tick: 0 };
        playAudio(attackSfx.magic);
    }
    updateTether(dt) {
        let th = this.tether;
        th.tick -= dt;
        let lx = Math.min(this.x, this.twinPartnerX()), rx = Math.max(this.x, this.twinPartnerX());
        for (let p of players) {
            if (!p || p.team === this.team || p.state === 'DEAD') continue;
            if (p.x > lx + 8 && p.x < rx - 8 && p.y >= GROUND_Y - 36 && th.tick <= 0) {
                th.tick = 0.55;
                p.takeDamage(5, { x: 0, y: -340 }, 0.5, this, { unblockable: true }); // trip + pop up
                spawnParticles(p.x, GROUND_Y - 10, 12, '#9be3ff');
            }
        }
    }

    // Neutral — Mirror Volley: both twins fire a bolt inward toward the centred foe.
    twinVolley(dmgMod = 1) {
        let atk = this.currentAttack;
        let bodies = [{ x: this.x, dir: this.dir }, { x: this.twinPartnerX(), dir: (this.getClosestEnemy() ? (this.getClosestEnemy().x >= this.twinPartnerX() ? 1 : -1) : -this.dir) }];
        for (let b of bodies) {
            let p = new Projectile(b.x + b.dir * 18, this.y + atk.oy, atk.pSpeed * b.dir, 0, atk.w, atk.h, atk.dmg * dmgMod,
                { x: atk.kb.x * b.dir, y: atk.kb.y }, atk.stun, this, atk.pLife, null);
            p.subtype = 'twinBolt'; p.ownerId = this.id; p.ownerTeam = this.team; p.ownerCharType = this.charType;
            projectiles.push(p);
        }
        playAudio(attackSfx.magic);
    }

    // ---------------- TELEPATH PSI BARRIER (reflect) ----------------
    isReflecting() {
        if (this.state !== 'ATTACK' || !this.currentAttack || this.currentAttack.type !== 'psiBarrier') return false;
        let a = this.currentAttack;
        return this.stateTimer >= a.startup && this.stateTimer < a.startup + a.active;
    }

    reflectProjectile(proj) {
        proj.vx = -proj.vx * 1.5; // hurl it back, faster
        proj.vy = -proj.vy * 0.4;
        proj.owner = this;        // now it's hers — it strikes the original caster
        proj.ownerId = this.id;
        proj.ownerTeam = this.team;
        proj.ownerCharType = this.charType;
        proj.hasHit = new Set();
        proj.damage = Math.round(proj.damage * 1.6) + 2;
        proj.reflected = true;
        spawnParticles(proj.x, proj.y, 14, '#9be3ff');
        playAudio(attackSfx.block);
    }

    // ---------------- ULTIMATES ----------------
    tryUltimate() {
        if (['DEAD', 'ULT', 'BLOCKBREAK', 'HITSTUN', 'LEDGE'].includes(this.state)) return;
        // Online ultimates are host-authoritative. Guests send the ult input, but
        // wait for the host's ult-sync instead of creating a competing timeline.
        if (currentMode === 'ONLINE' && onlineState && onlineState.slot !== 0) return;
        if (this.ultSealed) return; // a Copy Cat sealed your ultimate
        if (this.charType === 'COPYCAT' && !this.ultUnlocked) return; // locked until Nine Lives procs
        if (this.lumActive) return; // already summoned Lumatrossia — can't re-ult mid-install
        let ready = (infiniteMeter && this.team === 0) || this.meter >= this.meterMax;
        if (!ready) return;
        // The Twins' Eclipse only lands if the foe is close enough to catch in the collision —
        // no firing it from across the screen.
        if (this.charType === 'TWINS') {
            let foe = this.getClosestEnemy();
            if (!foe || foe.state === 'DEAD' || Math.abs(foe.x - this.x) > 230) return; // out of range — don't spend meter
        }
        if (!(infiniteMeter && this.team === 0)) this.meter = 0;
        this.startUltimate();
    }

    startUltimate() {
        // The Copy Cat performs the ultimate it stole; The Cult installs Lumatrossia; everyone else runs their own.
        let kind = (this.charType === 'COPYCAT') ? this.copiedKind
                 : (this.charType === 'CULT') ? 'install'
                 : (this.charType === 'TWINS') ? 'eclipse'
                 : ULT_KIND[this.charType];
        if (!kind) return; // Zombie has no ultimate (and an un-charged Copy Cat shouldn't reach here)
        if (this.charType === 'COPYCAT') {
            // spending the copy: free the sealed enemy and re-lock until the next Nine Lives
            if (this.sealedEnemy) { this.sealedEnemy.ultSealed = false; this.sealedEnemy = null; }
            this.ultUnlocked = false; this.copiedKind = null;
        }
        this.state = 'ULT';
        this.stateTimer = 0;
        this.vx = 0; this.vy = 0;
        this.ult = { kind, phase: 'declare', t: 0, connected: false, target: null };
        ultActive = this;
        ultBanner = { owner: this, line: ULT_LINES[this.charType] || '', t: 0, dur: 1.4 };
        timeScale = 0.18; // dramatic hush while the line drops
        sfx.playDeath();
        if (this.charType === 'PHANTOM') playAudio(attackSfx.soulTrain);
        playUltVoice(this.charType);
        onlineSendUltSync(this, 'start');
    }

    endUlt() {
        this.ult = null;
        if (ultActive === this) { ultActive = null; ultCamera = null; timeScale = 1; }
        if (this.state === 'ULT') {
            this.state = this.y < GROUND_Y ? 'FALL' : 'IDLE';
            this.stateTimer = 0;
        }
    }

    // ---------------- THE CULT: Lumatrossia install ----------------
    // Morph the controlled cultist into Lumatrossia. Swaps moveset/size/stats only —
    // HP is shared (it's a power-state, not a second life bar). The draining ult bar is the clock.
    becomeLumatrossia() {
        if (this.lumActive) return;
        const lum = CHARACTERS.LUMATROSSIA;
        this._cultSaved = {
            charType: this.charType, attacks: this.attacks,
            width: this.width, height: this.height,
            speed: this.speed, jumpForce: this.jumpForce
        };
        this.charType = 'LUMATROSSIA';
        this.attacks = lum.attacks;
        this.width = lum.width; this.height = lum.height;
        this.speed = lum.speed; this.jumpForce = lum.jump;
        this.lumActive = true;
        this.lumTimer = LUM_DURATION;
        this.puppet = null; // the Cult's mimic doesn't carry into the install
        this.meter = this.meterMax; // the meter bar now reads as the install timer, draining down
        this._lumFx = 1.0;
        this.state = 'IDLE'; this.vx = 0; this.vy = 0; this.currentAttack = null;
        spawnParticles(this.x, GROUND_Y - 70, 44, '#ff0033');
        spawnParticles(this.x, GROUND_Y - 70, 22, '#fff');
    }

    // Desummon Lumatrossia and return the cult to battle.
    revertFromLumatrossia() {
        if (!this.lumActive) return;
        const s = this._cultSaved;
        if (s) {
            this.charType = s.charType; this.attacks = s.attacks;
            this.width = s.width; this.height = s.height;
            this.speed = s.speed; this.jumpForce = s.jumpForce;
        }
        this._cultSaved = null;
        this.lumActive = false; this.lumTimer = 0; this.meter = 0; this._lumFx = 1.0;
        if (this.state !== 'DEAD') { this.state = this.y < GROUND_Y ? 'FALL' : 'IDLE'; this.currentAttack = null; }
        spawnParticles(this.x, GROUND_Y - 60, 30, '#ff0033');
    }

    // Devotion tier (Congregation): 0/1/2 — more cultists, bigger zones, faster ult.
    cultTier() { return this.devotion >= 66 ? 2 : this.devotion >= 33 ? 1 : 0; }

    // Called when the activation hit/projectile of an ultimate connects.
    onUltConnect(target) {
        if (!this.ult || this.ult.connected || !target) return;
        this.ult.connected = true;
        this.ult.target = target;
        this.ult.tx = target.x; this.ult.ty = target.y; // capture spot for puppeteering
        this.ult.t = 0;
        timeScale = 0.28;
        ultCamera = { fx: (this.x + target.x) / 2, fy: (this.y + target.y) / 2 - 40, zoom: 1.7 };
        if (this.ult.kind === 'arena') this.ult.phase = 'dashes';
        else if (this.ult.kind === 'orb') this.ult.phase = 'payoff';
        else if (this.ult.kind === 'bomb') this.ult.phase = 'blast';
        else if (this.ult.kind === 'mindbreak') this.ult.phase = 'vice';
        else if (this.ult.kind === 'beaststorm') this.ult.phase = 'alphaBind';
        else if (this.ult.kind === 'soultrain') this.ult.phase = 'seize';
        if (this.ult.kind === 'orb') playAudio(attackSfx.magic);
        else sfx.playHit();
        onlineSendUltSync(this, 'connect');
    }

    spawnUltActivation() {
        let u = this.ult;
        if (u.kind === 'arena') {
            // a forward-reaching opener so the ult starts from a bit outside normal range (tuned mid)
            let reach = 165;
            let hx = this.dir > 0 ? this.x - 24 : this.x - reach + 24;
            let hb = new Hitbox(hx, this.y - 90, reach, 90, 6, { x: 220 * this.dir, y: -120 }, 0.3, this, 0.42);
            hb.ultActivator = this;
            hitboxes.push(hb);
            sfx.playSwing();
        } else if (u.kind === 'orb') {
            let p = new Projectile(this.x + this.dir * 22, this.y - 55, 360 * this.dir, 0, 26, 26, 6, { x: 120 * this.dir, y: -80 }, 0.3, this, 3.6, null);
            p.subtype = 'ultorb'; p.homing = true; p.ultActivator = this; u.proj = p;
            projectiles.push(p); playAudio(attackSfx.magic);
        } else if (u.kind === 'bomb') {
            let p = new Projectile(this.x + this.dir * 20, this.y - 50, 520 * this.dir, -280, 20, 20, 6, { x: 100 * this.dir, y: -100 }, 0.3, this, 3.0, null);
            p.subtype = 'bomb'; p.unblockable = true; p.ultActivator = this; u.proj = p;
            projectiles.push(p); playAudio(attackSfx.shot);
        } else if (u.kind === 'mindbreak') {
            // Short-range psychic snare that must connect
            let hb = new Hitbox(this.x + (this.dir > 0 ? 8 : -88), this.y - 90, 80, 96, 3, { x: 0, y: 0 }, 0.2, this, 0.4);
            hb.ultActivator = this; hb.unblockableUlt = true; hitboxes.push(hb);
            playAudio(attackSfx.magic);
        } else if (u.kind === 'beaststorm') {
            let hb = new Hitbox(this.x + (this.dir > 0 ? 0 : -110), this.y - 92, 110, 92, 4, { x: 120 * this.dir, y: -80 }, 0.25, this, 0.45);
            hb.ultActivator = this; hb.unblockableUlt = true; hitboxes.push(hb);
            playAudio(attackSfx.magic);
        } else if (u.kind === 'soultrain') {
            // Long unblockable claw out front — the Phantom rushes across with it extended.
            let hb = new Hitbox(this.x + (this.dir > 0 ? 10 : -120), this.y - 96, 120, 96, 4, { x: 0, y: 0 }, 0.2, this, 0.6);
            hb.ultActivator = this; hb.unblockableUlt = true; hitboxes.push(hb);
            playAudio(attackSfx.magic);
        }
    }

    updateUlt(dt) {
        let u = this.ult;
        if (!u) { this.changeState('IDLE'); return; }
        // Crash guard: after an online ult-sync the players array is rebuilt and
        // u.target is re-linked by index. If that link fails (trimmed projectile,
        // length mismatch) the payoff phases would deref a null target and crash.
        // Any connected payoff phase without a live target simply ends the ult.
        const PAYOFF_PHASES = ['grab', 'slam', 'dashes', 'finish', 'payoff', 'blast', 'execute', 'vice', 'alphaBind', 'alphaBrute', 'alphaRaven', 'alphaWhip', 'seize', 'shatter', 'void', 'smash', 'dodges', 'freeze', 'slide', 'wave'];
        if (PAYOFF_PHASES.includes(u.phase) && (!u.target || u.target.state === 'DEAD')) {
            this.endUlt();
            return;
        }
        u.t += dt;
        this.vx = 0;
        // keep grounded unless a phase repositions us
        if (this.y < GROUND_Y) { this.vy += 1500 * dt; this.y = Math.min(GROUND_Y, this.y + this.vy * dt); if (this.y >= GROUND_Y) this.vy = 0; }

        // DECLARE — the line drops, then the activation comes out
        if (u.phase === 'declare') {
            if (u.t >= 0.55) {
                u.t = 0; timeScale = 0.7;
                if (u.kind === 'counter') u.phase = 'window';
                else if (u.kind === 'arena') { u.phase = 'strike'; this.vx = 930 * this.dir; this.spawnUltActivation(); }
                else if (u.kind === 'orb') { u.phase = 'fire'; this.spawnUltActivation(); }
                else if (u.kind === 'bomb') { u.phase = 'throw'; this.spawnUltActivation(); }
                else if (u.kind === 'darkslash') { u.phase = 'swing'; }
                else if (u.kind === 'mindbreak') { u.phase = 'snare'; this.spawnUltActivation(); }
                else if (u.kind === 'beaststorm') { u.phase = 'snare'; this.spawnUltActivation(); }
                else if (u.kind === 'soultrain') { u.phase = 'rush'; }
                else if (u.kind === 'install') { u.phase = 'summon'; this._lumFx = 1.4; }
                else if (u.kind === 'eclipse') { u.phase = 'split'; u.target = this.getClosestEnemy(); }
                else if (u.kind === 'chronostop') { u.phase = 'stance'; }
            }
            return;
        }

        // THE TWINS — Eclipse: blink to the walls, then rocket inward and collide on the centred foe
        if (u.kind === 'eclipse') {
            let tg = u.target;
            let p = this.partner;
            if (!tg || tg.state === 'DEAD' || !p) { this.endUlt(); return; }
            // pin the foe to centre stage
            tg.state = 'HITSTUN'; tg.stateTimer = 3; tg.vx = 0; tg.vy = 0;
            tg.x = WIDTH / 2; tg.y = GROUND_Y;
            this.y = GROUND_Y; p.y = GROUND_Y; this.vx = 0; this.vy = 0;
            // keep the partner drawn/animated through the cinematic
            p.state = this.state; p.currentAttack = null; p.animTimer = this.animTimer; p.team = this.team; p.hp = this.hp; p.maxHp = this.maxHp; p._hover = 0;
            ultCamera = { fx: WIDTH / 2, fy: GROUND_Y - 70, zoom: 1.4 };
            if (u.phase === 'split') {
                // streak to opposite walls
                timeScale = 0.6;
                let s = Math.min(1, u.t / 0.4);
                this.x = WIDTH / 2 + (60 - WIDTH / 2) * s; this.dir = 1;
                p.x = WIDTH / 2 + (WIDTH - 60 - WIDTH / 2) * s; p.dir = -1;
                if (u.t > 0.55) { u.phase = 'rush'; u.t = 0; u.hit = false; }
                return;
            }
            if (u.phase === 'rush') {
                // rocket inward; they collide on the foe
                timeScale = 0.5;
                let s = Math.min(1, u.t / 0.26);
                this.x = 60 + (WIDTH / 2 - 60) * s; this.dir = 1;
                p.x = (WIDTH - 60) + (WIDTH / 2 - (WIDTH - 60)) * s; p.dir = -1;
                for (let i = 0; i < 2; i++) spawnParticles(this.x, GROUND_Y - 50, 1, '#9be3ff'), spawnParticles(p.x, GROUND_Y - 50, 1, '#9be3ff');
                if (!u.hit && s >= 1) {
                    u.hit = true;
                    tg.takeDamage(28, { x: 0, y: -480 }, 1.0, this, { isUlt: true, unblockable: true });
                    tg._thrown = 0.4;
                    spawnParticles(WIDTH / 2, GROUND_Y - 50, 50, '#fff');
                    spawnParticles(WIDTH / 2, GROUND_Y - 50, 30, '#9be3ff');
                    sfx.playDeath();
                }
                if (u.t > 0.6) { this.anchorX = WIDTH / 2; this.endUlt(); }
                return;
            }
            return;
        }

        // THE TRAVELER — chronostop: counter stance → 5-dodge montage → TIME STOP flurry →
        // slide past → wave, and every stored hit detonates at once.
        if (u.kind === 'chronostop') {
            if (u.phase === 'stance') {
                if (u.t > 0.9) this.endUlt(); // nobody swung — the future he saw never happened
                return;
            }
            let tg = u.target;
            if (!tg) { this.endUlt(); return; }
            if (u.phase === 'dodges') {
                // the foe swings over and over; each swing meets a different dodge
                timeScale = 0.42;
                this.y = GROUND_Y; this.vx = 0;
                this.dir = tg.x >= this.x ? 1 : -1;
                tg.x = this.x + this.dir * 58; tg.y = GROUND_Y;
                tg.dir = -this.dir;
                // puppet the foe through repeated light swings
                tg.state = 'ATTACK';
                tg.currentAttack = tg.currentAttack && tg.currentAttack.name === 'light' ? tg.currentAttack : { ...tg.attacks.light, name: 'light' };
                let swingTotal = tg.currentAttack.startup + tg.currentAttack.active + tg.currentAttack.recovery;
                tg.stateTimer = (u.t % 0.42) / 0.42 * swingTotal;
                tg.animTimer += dt;
                u.dodgeIdx = Math.min(4, Math.floor(u.t / 0.42)); // 5 dodges, ~0.42s apiece
                if (u.dodgeIdx !== u._lastDodge) {
                    u._lastDodge = u.dodgeIdx;
                    spawnParticles(this.x - this.dir * 10, this.y - 50, 8, '#6fd0ff'); // whiff blur
                }
                ultCamera = { fx: (this.x + tg.x) / 2, fy: GROUND_Y - 70, zoom: 1.8 };
                if (u.t > 2.1) { u.phase = 'freeze'; u.t = 0; u.hits = 0; u.stored = 0; tg.state = 'HITSTUN'; tg.stateTimer = 5; tg.vx = 0; tg.vy = 0; sfx.playDeath(); }
                return;
            }
            if (u.phase === 'freeze') {
                // TIME STOP — the world drains of colour (overlay in engine); he flurries from every angle
                timeScale = 0.06; // the world is frozen; he acts in real time (frameRealDt)
                tg.state = 'HITSTUN'; tg.stateTimer = 5; tg.vx = 0; tg.vy = 0;
                ultCamera = { fx: tg.x, fy: GROUND_Y - 75, zoom: 1.7 };
                if (u.hits < 6 && u.t > 0.25 + u.hits * 0.24) {
                    u.hits++;
                    u.stored += 4; // damage is STORED, not dealt — it all lands at the wave
                    // teleport to a new angle around the foe for each frozen strike
                    let ang = [1, -1, 1, -1, 1, -1][u.hits - 1];
                    this.x = Math.max(40, Math.min(WIDTH - 40, tg.x + ang * (44 + (u.hits % 3) * 18)));
                    this.dir = tg.x >= this.x ? 1 : -1;
                    u.strikeAlt = u.hits % 2; // alternate punch/kick pose
                    spawnParticles(tg.x + (Math.random() - 0.5) * 30, tg.y - 30 - Math.random() * 40, 6, '#fff');
                    spawnParticles(tg.x, tg.y - 45, 4, '#6fd0ff');
                    playAudio(attackSfx.punch);
                }
                if (u.t > 1.9) { u.phase = 'slide'; u.t = 0; u.slideFrom = this.x; u.slideTo = Math.max(50, Math.min(WIDTH - 50, tg.x + (tg.x >= this.x ? -1 : 1) * -120)); }
                return;
            }
            if (u.phase === 'slide') {
                // he slides right past them, low and smooth
                timeScale = 0.06;
                tg.state = 'HITSTUN'; tg.stateTimer = 5;
                let s = Math.min(1, u.t / 0.4);
                this.x = u.slideFrom + (u.slideTo - u.slideFrom) * (1 - Math.pow(1 - s, 2));
                this.dir = tg.x >= this.x ? 1 : -1;
                spawnParticles(this.x, GROUND_Y - 8, 2, '#6fd0ff');
                if (u.t > 0.55) { u.phase = 'wave'; u.t = 0; }
                return;
            }
            if (u.phase === 'wave') {
                // a flick of the hand — time resumes, and every stored hit lands at once
                tg.state = 'HITSTUN'; tg.stateTimer = 3;
                if (!u.waved && u.t > 0.3) {
                    u.waved = true;
                    timeScale = 0.5;
                    let away = tg.x >= this.x ? 1 : -1;
                    tg.takeDamage((u.stored || 24) + 10, { x: 460 * away, y: -340 }, 0.9, this, { isUlt: true, unblockable: true });
                    tg.tumbleTimer = 0.7; tg._tumbleAngle = 0; tg._tumbleDir = away;
                    spawnParticles(tg.x, tg.y - 45, 44, '#fff');
                    spawnParticles(tg.x, tg.y - 45, 26, '#6fd0ff');
                    sfx.playDeath();
                }
                if (u.t > 1.0) this.endUlt();
                return;
            }
            return;
        }

        // THE CULT — Summon Lumatrossia: cultists float up, then the install takes over
        if (u.kind === 'install') {
            timeScale = 0.5;
            this.vx = 0; this.y = GROUND_Y;
            ultCamera = { fx: this.x, fy: GROUND_Y - 90, zoom: 1.35 };
            // four cultists rise, arms raised, chanting
            for (let i = 0; i < 4; i++) {
                if (onlineDeterministicRandom('cultRise' + i, this) < 0.25) {
                    spawnParticles(this.x + (i - 1.5) * 40, GROUND_Y - 30 - u.t * 120, 2, '#ff0033');
                }
            }
            if (u.t > 1.3) { this.becomeLumatrossia(); this.endUlt(); }
            return;
        }

        // ---- BEAST TAMER Alpha Command ----
        if (u.kind === 'beaststorm') {
            if (u.phase === 'snare') {
                if (u.t > 0.55) this.endUlt();
            } else if (u.phase === 'alphaBind') {
                let tg = u.target;
                timeScale = 0.42;
                tg.state = 'HITSTUN'; tg.stateTimer = 2.6; tg.vx = 0; tg.vy = 0;
                this.dir = tg.x >= this.x ? 1 : -1;
                tg.x = this.x + this.dir * 82 + Math.sin(u.t * 30) * 3;
                tg.y = GROUND_Y - 44 + Math.sin(u.t * 34) * 3;
                ultCamera = { fx: (this.x + tg.x) / 2, fy: GROUND_Y - 80, zoom: 1.55 };
                if (!u.bound) {
                    u.bound = true;
                    tg.takeDamage(6, { x: 0, y: 0 }, 0.35, this, { isUlt: true, unblockable: true });
                    spawnParticles(tg.x, tg.y - 55, 18, '#fff');
                    playAudio(attackSfx.snake);
                }
                if (u.t > 0.36) {
                    u.phase = 'alphaBrute'; u.t = 0;
                    u.bruteStartX = tg.x; u.bruteEndX = Math.max(70, Math.min(WIDTH - 70, tg.x + this.dir * 430));
                    u.bruteY = tg.y;
                }
            } else if (u.phase === 'alphaBrute') {
                let tg = u.target;
                timeScale = 0.46;
                tg.state = 'HITSTUN'; tg.stateTimer = 2.2; tg.vx = 0; tg.vy = 0;
                let p = Math.min(1, u.t / 0.34);
                let ease = 1 - Math.pow(1 - p, 3);
                tg.x = u.bruteStartX + (u.bruteEndX - u.bruteStartX) * ease;
                tg.y = u.bruteY - Math.sin(p * Math.PI) * 34;
                ultCamera = { fx: tg.x, fy: GROUND_Y - 95, zoom: 1.4 };
                if (!u.bruteHit && u.t > 0.08) {
                    u.bruteHit = true;
                    tg.takeDamage(18, { x: 0, y: 0 }, 0.45, this, { isUlt: true, unblockable: true });
                    spawnParticles(tg.x, tg.y - 40, 28, '#ff0033');
                    playAudio(attackSfx.brute);
                    sfx.playDeath();
                }
                if (u.t > 0.38) { u.phase = 'alphaRaven'; u.t = 0; u.ravenHits = 0; }
            } else if (u.phase === 'alphaRaven') {
                let tg = u.target;
                timeScale = 0.5;
                tg.state = 'HITSTUN'; tg.stateTimer = 1.8; tg.vx = 0; tg.vy = 0;
                tg.y = GROUND_Y - 58 + Math.sin(u.t * 18) * 5;
                ultCamera = { fx: (this.x + tg.x) / 2, fy: GROUND_Y - 105, zoom: 1.48 };
                if (u.ravenHits < 2 && u.t > 0.08 + u.ravenHits * 0.12) {
                    u.ravenHits++;
                    tg.takeDamage(7, { x: 0, y: -70 }, 0.25, this, { isUlt: true, unblockable: true });
                    spawnParticles(tg.x + (u.ravenHits === 1 ? -24 : 24), tg.y - 44, 20, '#fff');
                    playAudio(attackSfx.raven);
                }
                if (u.t > 0.36) {
                    u.phase = 'alphaWhip'; u.t = 0; u.whipDone = false;
                    this.x = Math.max(55, Math.min(WIDTH - 55, tg.x - this.dir * 78));
                    this.y = GROUND_Y;
                }
            } else if (u.phase === 'alphaWhip') {
                let tg = u.target;
                timeScale = 0.54;
                this.dir = tg.x >= this.x ? 1 : -1;
                tg.state = 'HITSTUN'; tg.stateTimer = 1.2; tg.vx = 0; tg.vy = 0;
                ultCamera = { fx: (this.x + tg.x) / 2, fy: GROUND_Y - 85, zoom: 1.55 };
                if (!u.whipDone && u.t > 0.14) {
                    u.whipDone = true;
                    tg.takeDamage(24, { x: 980 * this.dir, y: -340 }, 0.75, this, { isUlt: true, unblockable: true });
                    spawnParticles(tg.x, tg.y - 48, 34, '#ff0033');
                    playAudio(attackSfx.knife);
                    sfx.playDeath();
                }
                if (u.t > 0.48) this.endUlt();
            }
            return;
        }

        // ---- PHANTOM Soul Train ----
        if (u.kind === 'soultrain') {
            let tg = u.target;
            if (u.phase === 'rush') {
                // arm extended, streak across the screen looking for a soul to seize
                timeScale = 0.9;
                this.x += 1550 * this.dir * dt;
                this.x = Math.max(38, Math.min(WIDTH - 38, this.x));
                this.y = GROUND_Y;
                spawnParticles(this.x - this.dir * 30, this.y - 50, 2, '#9aa6c8');
                let foe = this.getClosestEnemy();
                if (foe && foe.state !== 'DEAD' && Math.abs(foe.x - this.x) < 74) {
                    this.onUltConnect(foe);
                } else if (u.t > 0.95 || (this.dir > 0 && this.x >= WIDTH - 39) || (this.dir < 0 && this.x <= 39)) {
                    this.endUlt(); // whiffed clean across the arena
                }
                return;
            }
            if (!tg) { this.endUlt(); return; }
            if (u.phase === 'seize') {
                // hauled up by the throat — he keeps facing the way he rushed (no turn-around)
                timeScale = 0.42;
                tg.state = 'HITSTUN'; tg.stateTimer = 4; tg.vx = 0; tg.vy = 0;
                tg.x = this.x + this.dir * 42; tg.y = GROUND_Y; this.y = GROUND_Y;
                ultCamera = { fx: (this.x + tg.x) / 2, fy: GROUND_Y - 72, zoom: 1.95 };
                if (!u.seizeHit) { u.seizeHit = true; tg.takeDamage(3, { x: 0, y: 0 }, 0.5, this, { isUlt: true, unblockable: true }); spawnParticles(tg.x, tg.y - 60, 14, '#cfd8ff'); }
                if (u.t > 0.6) {
                    u.phase = 'shatter'; u.t = 0;
                    u.wallDir = this.dir; // keep driving them forward into the wall ahead
                    u.shatterX = u.wallDir > 0 ? WIDTH - 8 : 8;
                    u.shatterY = GROUND_Y - 96;
                }
                return;
            }
            if (u.phase === 'shatter') {
                // ram them through the border — it cracks like glass (drawn in engine)
                timeScale = 0.5;
                let p = Math.min(1, u.t / 0.45);
                tg.state = 'HITSTUN'; tg.stateTimer = 4; tg.vx = 0; tg.vy = 0;
                tg.x = (this.x + this.dir * 42) + (u.shatterX - (this.x + this.dir * 42)) * p;
                tg.y = u.shatterY;
                this.x = tg.x - u.wallDir * 46; this.dir = u.wallDir; this.y = GROUND_Y;
                ultCamera = { fx: u.shatterX - u.wallDir * 64, fy: u.shatterY, zoom: 2.05 };
                if (!u.cracked && u.t > 0.42) { u.cracked = true; sfx.playDeath(); spawnParticles(u.shatterX, u.shatterY, 34, '#fff'); }
                if (u.t > 1.0) { u.phase = 'void'; u.t = 0; u.voidHits = 0; }
                return;
            }
            if (u.phase === 'void') {
                // dragged through space — the full-screen soul-train overlay takes over
                timeScale = 0.9;
                tg.state = 'HITSTUN'; tg.stateTimer = 5; tg.vx = 0; tg.vy = 0;
                ultCamera = { fx: WIDTH / 2, fy: HEIGHT / 2, zoom: 1 };
                if (u.voidHits < 4 && u.t > 0.35 + u.voidHits * 0.32) {
                    u.voidHits++;
                    tg.takeDamage(3, { x: 0, y: 0 }, 0.5, this, { isUlt: true, unblockable: true });
                    playAudio(attackSfx.magic);
                }
                if (u.t > 1.7) {
                    u.phase = 'smash'; u.t = 0;
                    // crash them down into a DIFFERENT stage
                    let stages = Object.keys(STAGES).filter(s => s !== selectedStage);
                    selectedStage = stages[Math.floor(Math.random() * stages.length)] || 'dojo';
                    if (typeof initStageActors === 'function') initStageActors();
                    if (typeof music !== 'undefined' && music.resetFightPick) { music.resetFightPick(); music.play('fight'); }
                    tg.x = WIDTH / 2; tg.y = GROUND_Y - 260; tg.vy = 0;
                    this.x = Math.max(60, Math.min(WIDTH - 60, WIDTH / 2 + (tg.x > WIDTH / 2 ? -130 : 130))); this.y = GROUND_Y;
                    this.dir = tg.x >= this.x ? 1 : -1;
                }
                return;
            }
            if (u.phase === 'smash') {
                // they plummet into the new arena
                timeScale = 0.55;
                let p = Math.min(1, u.t / 0.32);
                tg.state = 'HITSTUN'; tg.stateTimer = 3; tg.vx = 0;
                tg.x = WIDTH / 2;
                tg.y = (GROUND_Y - 260) + 260 * (p * p);
                ultCamera = { fx: WIDTH / 2, fy: GROUND_Y - 80, zoom: 1.5 };
                if (!u.smashed && p >= 1) {
                    u.smashed = true;
                    tg.y = GROUND_Y;
                    let away = (tg.x >= this.x) ? 1 : -1;
                    tg.takeDamage(24, { x: 520 * away, y: -220 }, 0.95, this, { isUlt: true, unblockable: true });
                    tg.tumbleTimer = 0.85; tg._tumbleAngle = 0; tg._tumbleDir = away; // skid + roll across the floor
                    spawnParticles(tg.x, GROUND_Y - 28, 52, '#fff');
                    spawnParticles(tg.x, GROUND_Y - 28, 30, '#ff0033');
                    sfx.playDeath();
                }
                if (u.t > 0.9) this.endUlt();
                return;
            }
            return;
        }

        // ---- TELEPATH mind break ----
        if (u.kind === 'mindbreak') {
            if (u.phase === 'snare') {
                if (u.t > 0.5) this.endUlt(); // the snare missed
            } else if (u.phase === 'vice') {
                let tg = u.target;
                timeScale = 0.35;
                tg.state = 'HITSTUN'; tg.stateTimer = 3; tg.vx = 0; tg.vy = 0;
                this.dir = tg.x >= this.x ? 1 : -1;
                // suspend the foe in a telekinetic vice, jittering helplessly
                let lift = Math.min(120, u.t * 240);
                tg.x = this.x + this.dir * 70 + Math.sin(u.t * 40) * 4;
                tg.y = GROUND_Y - lift + Math.sin(u.t * 30) * 4;
                ultCamera = { fx: (this.x + tg.x) / 2, fy: GROUND_Y - 100, zoom: 1.7 };
                u.hitTick = (u.hitTick || 0) - dt;
                if (u.hitTick <= 0 && u.t < 1.5) {
                    u.hitTick = 0.2;
                    tg.takeDamage(5, { x: 0, y: 0 }, 0.2, this, { isUlt: true, unblockable: true });
                    spawnParticles(tg.x, tg.y - 20, 10, '#9be3ff');
                    playAudio(attackSfx.tele); // a telehit on every psychic strike
                }
                if (u.t > 1.5 && !u.slammed) {
                    u.slammed = true;
                    // crush and hurl them away
                    tg.takeDamage(22, { x: 1500 * this.dir, y: -360 }, 0.8, this, { isUlt: true, unblockable: true });
                    tg._thrown = 0.5;
                    spawnParticles(tg.x, tg.y, 30, '#9be3ff');
                    playAudio(attackSfx.tele);
                    sfx.playDeath();
                }
                if (u.t > 2.0) this.endUlt();
            }
            return;
        }

        // ---- DARK RULER giant slash ----
        if (u.kind === 'darkslash') {
            timeScale = 0.45;
            ultCamera = { fx: this.x + this.dir * 80, fy: GROUND_Y - 80, zoom: 1.5 };
            if (!u.fired && u.t > 0.14) {
                // unleash an enormous crescent that screams across the arena
                u.fired = true;
                let p = new Projectile(this.x + this.dir * 30, GROUND_Y - 210, 950 * this.dir, 0,
                    72, 210, 40, { x: 620 * this.dir, y: -280 }, 0.7, this, 1.8, null);
                p.subtype = 'giantslash'; p.pierce = true; p.unblockable = true;
                p.isUltDamage = true; // its kills count as ultimate kills (overkill), without the connect/despawn of ultActivator
                projectiles.push(p);
                sfx.playDeath(); playAudio(attackSfx.sword);
                spawnParticles(this.x + this.dir * 40, GROUND_Y - 90, 24, '#111');
                spawnParticles(this.x + this.dir * 40, GROUND_Y - 90, 14, '#ff0033');
            }
            if (u.t > 0.6) this.endUlt();
            return;
        }

        // ---- BRAWLER counter ----
        if (u.kind === 'counter') {
            if (u.phase === 'window') {
                if (u.t > 0.65) this.endUlt(); // nobody attacked into it
            } else if (u.phase === 'grab') {
                let tg = u.target;
                timeScale = 0.2;
                ultCamera = { fx: (this.x + tg.x) / 2, fy: this.y - 50, zoom: 2.0 };
                tg.state = 'HITSTUN'; tg.stateTimer = 2; tg.vx = 0; tg.vy = 0;
                this.dir = tg.x >= this.x ? 1 : -1;
                tg.x = this.x + this.dir * 46; tg.y = GROUND_Y;
                if (u.t > 0.6) {
                    u.phase = 'slam'; u.t = 0; u.bounced = 0;
                    u.flyVx = 1700 * this.dir; // launched toward the wall
                    tg.takeDamage(20, { x: 0, y: 0 }, 0.6, this, { isUlt: true, unblockable: true });
                    sfx.playHit();
                }
            } else if (u.phase === 'slam') {
                let tg = u.target;
                timeScale = 0.4;
                tg.state = 'HITSTUN'; tg.stateTimer = 2; tg.vx = 0; tg.vy = 0;
                tg.x += u.flyVx * dt; tg.y = GROUND_Y;
                ultCamera = { fx: tg.x, fy: GROUND_Y - 60, zoom: 1.7 };
                if (u.bounced < 2) {
                    if (tg.x <= tg.width / 2 + 3) {
                        tg.x = tg.width / 2 + 3; u.flyVx = Math.abs(u.flyVx) * 0.85; u.bounced++;
                        spawnParticles(tg.x, tg.y - 40, 24, '#ff0033'); sfx.playHit();
                        tg.takeDamage(10, { x: 0, y: 0 }, 0.5, this, { isUlt: true, unblockable: true });
                    } else if (tg.x >= WIDTH - tg.width / 2 - 3) {
                        tg.x = WIDTH - tg.width / 2 - 3; u.flyVx = -Math.abs(u.flyVx) * 0.85; u.bounced++;
                        spawnParticles(tg.x, tg.y - 40, 24, '#ff0033'); sfx.playHit();
                        tg.takeDamage(10, { x: 0, y: 0 }, 0.5, this, { isUlt: true, unblockable: true });
                    }
                }
                if (u.t > 1.2 || (u.bounced >= 2 && u.t > 0.45)) {
                    tg.takeDamage(8, { x: u.flyVx * 0.4, y: -260 }, 0.4, this, { isUlt: true, unblockable: true });
                    this.endUlt();
                }
            }
            return;
        }

        // ---- SWORDSMAN arena ----
        if (u.kind === 'arena') {
            if (u.phase === 'strike') {
                this.x += this.vx * dt; this.vx *= 0.9;
                if (u.t > 0.5) this.endUlt(); // whiffed the opener
            } else if (u.phase === 'dashes') {
                let tg = u.target;
                timeScale = 0.5;
                tg.state = 'HITSTUN'; tg.stateTimer = 2.0; tg.vx = 0; tg.vy = 0; tg.x = u.tx; tg.y = u.ty;
                // Pull the camera back so the full-arena dashing is visible
                ultCamera = { fx: WIDTH / 2, fy: tg.y - 40, zoom: 1.12 };
                const DASH_TIME = 0.13, DASHES = 7;
                const leftEdge = 70, rightEdge = WIDTH - 70;
                if (u.dashCount === undefined) { u.dashCount = 0; u.dashProg = 1; }
                if (u.dashProg >= 1) {
                    if (u.dashCount >= DASHES) {
                        u.phase = 'finish'; u.t = 0;
                        this.x = tg.x - (tg.x > WIDTH / 2 ? -60 : 60);
                        tg.takeDamage(16, { x: 480 * Math.sign(tg.x - this.x || 1), y: -300 }, 0.5, this, { isUlt: true });
                        sfx.playHit();
                    } else {
                        // Launch a new full-width dash that slices through the target
                        u.dashCount++;
                        let l2r = u.dashCount % 2 === 1;
                        u.dashFrom = l2r ? leftEdge : rightEdge;
                        u.dashTo = l2r ? rightEdge : leftEdge;
                        this.dir = l2r ? 1 : -1;
                        u.dashProg = 0; u.dashHit = false;
                        this.y = GROUND_Y - (u.dashCount % 3) * 26; // vary the height each pass
                        sfx.playSwing();
                    }
                }
                if (u.dashFrom !== undefined && u.phase === 'dashes') {
                    u.dashProg = Math.min(1, u.dashProg + dt / DASH_TIME);
                    this.x = u.dashFrom + (u.dashTo - u.dashFrom) * u.dashProg;
                    spawnParticles(this.x, this.y - 40, 2, '#fff'); // motion streak
                    if (!u.dashHit && Math.abs(this.x - tg.x) < 55) {
                        u.dashHit = true;
                        tg.takeDamage(5, { x: 0, y: -20 }, 0.3, this, { isUlt: true });
                        spawnParticles(tg.x, tg.y - 40, 12, '#fff');
                    }
                }
            } else if (u.phase === 'finish') {
                this.y = GROUND_Y;
                if (u.t > 0.5) this.endUlt();
            }
            return;
        }

        // ---- MAGE orb ----
        if (u.kind === 'orb') {
            if (u.phase === 'fire') {
                if ((!u.proj || !u.proj.active) && !u.connected) this.endUlt();
            } else if (u.phase === 'payoff') {
                let tg = u.target;
                timeScale = 0.65;
                if (!u.fx) u.fx = { x: tg.x, y: tg.y - 45, r: 24 };
                u.fx.x = tg.x; u.fx.y = tg.y - 45;
                u.fx.r = Math.min(160, u.fx.r + 240 * dt);
                ultCamera = { fx: tg.x, fy: tg.y - 45, zoom: 1.4 };
                u.hitTick = (u.hitTick || 0) - dt;
                if (u.hitTick <= 0 && u.t < 2.0) {
                    u.hitTick = 0.22;
                    u.hitIndex = (u.hitIndex || 0) + 1;
                    let jitter = onlineDeterministicRandom('mageUltTick' + u.hitIndex, this) - 0.5;
                    tg.takeDamage(5, { x: jitter * 120, y: -150 }, 0.25, this, { isUlt: true });
                    playAudio(attackSfx.magic);
                    spawnParticles(tg.x, tg.y - 40, 6, '#c98bff');
                }
                if (u.t > 2.1) this.endUlt();
            }
            return;
        }

        // ---- RANGER bomb ----
        if (u.kind === 'bomb') {
            if (u.phase === 'throw') {
                if ((!u.proj || !u.proj.active) && !u.connected) this.endUlt();
            } else if (u.phase === 'blast') {
                let tg = u.target;
                timeScale = 0.4;
                tg.state = 'HITSTUN'; tg.stateTimer = 2.5; tg.vx = 0; tg.vy = 0;
                if (!u.blasted) {
                    u.blasted = true;
                    u.fx = { x: u.tx, y: GROUND_Y - 20, r: 12 };
                    tg.takeDamage(14, { x: 0, y: 0 }, 0.6, this, { isUlt: true, unblockable: true });
                    spawnParticles(u.tx, GROUND_Y - 20, 30, '#ff5a2a'); playAudio(attackSfx.shot);
                }
                if (u.fx) u.fx.r = Math.min(140, u.fx.r + 420 * dt);
                tg.x = u.tx;
                tg.y = Math.max(GROUND_Y - 210, GROUND_Y - u.t * 900); // blasted upward
                ultCamera = { fx: u.tx, fy: GROUND_Y - 120, zoom: 1.5 };
                if (u.t > 0.5) { u.phase = 'execute'; u.t = 0; u.ty2 = tg.y; this.invulnTimer = 1.0; }
            } else if (u.phase === 'execute') {
                let tg = u.target;
                timeScale = 0.5;
                tg.state = 'HITSTUN'; tg.stateTimer = 2.5; tg.vx = 0; tg.vy = 0;
                tg.x = u.tx;
                this.x = Math.max(40, Math.min(WIDTH - 40, u.tx)); this.dir = 1;
                this.y = Math.max(120, tg.y - 110);
                ultCamera = { fx: u.tx, fy: tg.y, zoom: 1.55 };
                if (!u.shot && u.t > 0.25) {
                    u.shot = true;
                    tg.takeDamage(16, { x: 0, y: 0 }, 0.5, this, { isUlt: true, unblockable: true });
                    let p = new Projectile(this.x - 4, this.y, 0, 1500, 8, 20, 0, { x: 0, y: 0 }, 0, this, 0.3, null);
                    p.subtype = 'beam'; projectiles.push(p);
                    spawnParticles(u.tx, tg.y, 18, '#fff'); playAudio(attackSfx.shot);
                }
                if (u.shot) tg.y = Math.min(GROUND_Y, tg.y + 1500 * dt); // slammed back down
                if (u.t > 0.8) { this.y = GROUND_Y; this.endUlt(); }
            }
            return;
        }
    }

    changeState(newState) {
        if (this.state === 'DEAD') return;
        if (this.state === newState) return;
        this.state = newState;
        this.stateTimer = 0;
        if (newState === 'IDLE' || newState === 'WALK' || newState === 'CROUCH') this.animTimer = 0;
    }

    playerControls() {
        if (currentMode === 'ONLINE' && onlineState && onlineState.slot !== null) {
            let fighterSlot = this.id === 'P2' ? 1 : 0;
            return fighterSlot === onlineState.slot ? (keyBindings.P1 || DEFAULT_BINDINGS.P1) : ONLINE_REMOTE_BINDINGS;
        }
        return keyBindings[this.id] || DEFAULT_BINDINGS[this.id] || DEFAULT_BINDINGS.P1;
    }

    handleInput() {
        if (this.catPin) return; // locked while pinning a foe with Cat Dash
        let controls = this.playerControls();

        // Tag out to the benched team-mate (2v2)
        if (teamBattle && controls.tag && keyPressed(controls.tag)) { if (switchActive(this.team, false)) return; }

        // Ultimate (highest priority — can be invoked from neutral states)
        if (keyPressed(controls.ult)) { this.tryUltimate(); return; }

        // Blocking
        if (keys[controls.block] && this.y === GROUND_Y && !this.lumActive) { // Lumatrossia cannot block
            this.changeState('BLOCK');
            return;
        } else if (this.state === 'BLOCK') {
            this.changeState('IDLE');
        }

        let crouching = keys[controls.d] && this.y === GROUND_Y;

        // Movement (Frost / tar runes slow the fighter)
        let spd = this.slowTimer > 0 ? this.speed * (this.slowFactor || 0.45) : this.speed;
        let moving = false;
        if (!crouching) {
            if (keys[controls.l]) { this.vx = -spd; moving = true; }
            if (keys[controls.r]) { this.vx = spd; moving = true; }
        }
        
        if (crouching) {
            this.vx *= 0.6;
            this.changeState('CROUCH');
        } else if (this.state === 'CROUCH') {
            this.changeState('IDLE');
        } else if (moving && this.y === GROUND_Y && this.state !== 'BLOCK') {
            this.changeState('WALK');
            // Ranger passive
            if (this.charType === 'RANGER' && onlineDeterministicRandom('rangerTacticalReload', this) < 0.02) this.tacticalReload = true;
        } else if (!moving && this.y === GROUND_Y && this.state === 'WALK') {
            this.changeState('IDLE');
        }

        // Jump — from the main floor OR while standing on a platform (so raised
        // platforms can be climbed by hopping ledge to ledge)
        if (!crouching && keyPressed(controls.u) && (this.y === GROUND_Y || this._onSurface)) {
            this.vy = this.jumpForce;
            this._onSurface = false;
            this.changeState('JUMP');
        }

        // Attacks
        if (keyPressed(controls.atkL)) this.startPlayerAttack('L', crouching);
        else if (keyPressed(controls.atkH)) this.startPlayerAttack('H', crouching);
        else if (keyPressed(controls.special)) {
            // Directional specials: held direction picks Up / Down / Side / Neutral
            let dirName = keys[controls.u] ? 'specUp'
                        : keys[controls.d] ? 'specDown'
                        : (keys[controls.l] || keys[controls.r]) ? 'specSide'
                        : 'specNeutral';
            if (this.attacks[dirName]) this.startAttack(dirName);
        }
    }

    startPlayerAttack(input, crouching) {
        if (this.y < GROUND_Y) {
            this.startAttack(input === 'L' ? 'airLight' : 'airHeavy');
            return;
        }
        if (crouching || this.state === 'CROUCH') {
            this.startAttack(input === 'L' ? 'lowLight' : 'lowHeavy');
            return;
        }

        this.comboInputBuffer = this.comboInputBuffer.filter(entry => this.inputTimer - entry.time < 1.0);
        this.comboInputBuffer.push({ input, time: this.inputTimer });
        let pattern = this.comboInputBuffer.map(entry => entry.input).join('').slice(-3);
        const routes = {
            LLL: 'comboLLL',
            LLH: 'comboLLH',
            LH: 'comboLH',
            LHL: 'comboLHL',
            HLL: 'comboHLL',
            HLH: 'comboHLH',
            HHL: 'comboHHL'
        };
        let comboName = routes[pattern] || (input === 'L' ? 'light' : 'heavy');
        this.startAttack(comboName);
        if (comboName.length > 5 && comboName !== 'comboLH') this.comboInputBuffer = [];
    }

    handleAI(dt) {
        if (this.catPin) return; // locked while pinning a foe with Cat Dash
        const target = this.getClosestEnemy();
        if (!target) {
            this.vx *= 0.8;
            if (this.y >= GROUND_Y && this.state === 'WALK') this.changeState('IDLE');
            return;
        }

        const dx = target.x - this.x;
        const dist = Math.abs(dx);
        const toward = dx >= 0 ? 1 : -1;
        const onGround = this.y >= GROUND_Y;
        const spd = this.slowTimer > 0 ? this.speed * (this.slowFactor || 0.45) : this.speed;

        // AI pacing timers + difficulty scalar (0..1). These throttle reactive defense
        // so the CPU can't turtle/parry-spam every frame.
        this.aiReactTimer -= dt;
        this.aiBlockTimer -= dt;
        const lvl = this.aiLevel == null ? 0.5 : this.aiLevel;

        // Hold a committed block for its duration rather than re-deciding it each frame.
        if (this.aiBlockTimer > 0 && onGround && ['IDLE', 'WALK', 'BLOCK', 'CROUCH'].includes(this.state)) {
            this.dir = toward;
            this.vx *= 0.55;
            if (this.state !== 'BLOCK') this.changeState('BLOCK');
            return;
        }
        if (this.state === 'BLOCK' && this.aiBlockTimer <= 0) this.changeState('IDLE');

        // Unleash ultimate when charged and the opponent is in a sensible range
        if (this.meter >= this.meterMax && this.charType !== 'ZOMBIE' && onGround) {
            let want = this.charType === 'BRAWLER' ? dist < 110         // counter up close
                     : this.charType === 'SWORDSMAN' ? dist < 215       // mid-range dash opener
                     : this.charType === 'DARK_RULER' ? dist < 130      // grab range
                     : this.charType === 'TELEPATH' ? dist < 120        // psychic snare range
                     : this.charType === 'BEAST_TAMER' ? dist < 170
                     : this.charType === 'PHANTOM' ? dist < 240        // soul-train rush has reach
                     : this.charType === 'CULT' ? true                  // the install needs no target
                     : this.charType === 'TWINS' ? dist < 220           // Eclipse must catch the foe in range
                     : this.charType === 'TRAVELER' ? dist < 130        // the counter wants them swinging at him
                     : dist < 460;                                      // mage/ranger ranged
            if (want && Math.random() < 0.02 + lvl * 0.05) { this.tryUltimate(); return; }
        }

        // Archetype tuning: preferred spacing, whether they kite, jump tendency
        const arch = ({
            BRAWLER:   { range: 58,  kite: false, jumpy: 0.16 },
            SWORDSMAN: { range: 78,  kite: false, jumpy: 0.18 },
            MAGE:      { range: 320, kite: true,  jumpy: 0.05 },
            RANGER:    { range: 220, kite: true,  jumpy: 0.10 },
            DARK_RULER:{ range: 64,  kite: false, jumpy: 0.06 },
            TELEPATH:  { range: 120, kite: false, jumpy: 0.30 },
            BEAST_TAMER:{ range: 150, kite: false, jumpy: 0.16 },
            PHANTOM:   { range: 88,  kite: false, jumpy: 0.08 },
            COPYCAT:   { range: 72,  kite: false, jumpy: 0.20 },
            CULT:      { range: 240, kite: true,  jumpy: 0.06 },
            LUMATROSSIA:{ range: 120, kite: false, jumpy: 0.04 },
            TWINS:     { range: 70,  kite: false, jumpy: 0.10 },
            TRAVELER:  { range: 105, kite: false, jumpy: 0.16 },
            ZOMBIE:    { range: 40,  kite: false, jumpy: 0.03 }
        })[this.charType] || { range: 70, kite: false, jumpy: 0.12 };

        // ---------- REACTIVE DEFENSE (gated by aiReactTimer so it can't be spammed) ----------
        // Only ever consider a defensive reaction once per cooldown window. When a threat
        // appears we make a SINGLE weighted decision and then commit, instead of re-rolling
        // a block/parry/roll/blink on every frame (which made 0.7-per-frame ≈ always).
        if (onGround && this.charType !== 'ZOMBIE' && this.aiReactTimer <= 0) {
            const proj = this.aiIncomingProjectile();
            const meleeThreat = target.state === 'ATTACK' && target.currentAttack &&
                                !target.currentAttack.isProj && dist < 135;
            if (proj || meleeThreat) {
                const defendChance = 0.32 + lvl * 0.4;   // 0.32..0.72 — never a guaranteed turtle
                const pick = Math.random();
                if (Math.random() < defendChance) {
                    if (proj) {
                        if (this.charType === 'MAGE' && pick < 0.4) this.startAttack('specUp');          // blink away
                        else if (this.charType === 'RANGER' && pick < 0.4) this.startAttack('specDown');  // roll
                        else if (pick < 0.55) { this.vy = this.jumpForce; this.vx = spd * toward; this.changeState('JUMP'); } // hop over
                        else { this.dir = toward; this.aiBlockTimer = 0.18 + Math.random() * 0.2; this.changeState('BLOCK'); }
                    } else {
                        if (this.charType === 'SWORDSMAN' && pick < 0.35) this.startAttack('specDown');   // parry attempt
                        else if (this.charType === 'RANGER' && pick < 0.3) this.startAttack('specDown');  // roll out
                        else { this.dir = toward; this.aiBlockTimer = 0.16 + Math.random() * 0.22; this.changeState('BLOCK'); }
                    }
                    // Commit: no further defensive reaction for a beat (shorter at higher level).
                    this.aiReactTimer = Math.max(0.18, 0.5 + Math.random() * 0.5 - lvl * 0.18);
                    return;
                } else {
                    // Stand our ground: brief lock so we don't re-roll instantly, then maybe punish.
                    this.aiReactTimer = 0.28 + Math.random() * 0.3;
                    if (dist < 100 && Math.random() < 0.35 + lvl * 0.3) {
                        this.startPlayerAttack(Math.random() < 0.6 ? 'L' : 'H');
                        return;
                    }
                }
            }
        }

        // ---------- MOVEMENT (every frame, hold toward preferred spacing) ----------
        let move = 0;
        if (dist > arch.range + 25) move = toward;                       // close in
        else if (arch.kite && dist < arch.range - 70) move = -toward;    // zoners back off
        if (move === -toward && (this.x < 90 || this.x > WIDTH - 90)) move = 0; // don't back into a wall
        if (move !== 0) {
            this.vx = spd * move;
            if (onGround) this.changeState('WALK');
        } else {
            this.vx *= 0.7;
            if (onGround && this.state === 'WALK') this.changeState('IDLE');
        }

        // ---------- DECISION THROTTLE (offense only) ----------
        this.aiTimer -= dt;
        if (this.aiTimer > 0) return;
        this.aiTimer = (0.12 + Math.random() * 0.22) * (1.15 - lvl * 0.4); // sharper at higher level
        const r = Math.random();

        // Air offense: keep it simple
        if (!onGround) {
            if (dist < 130 && r < 0.6) this.startPlayerAttack(r < 0.5 ? 'L' : 'H');
            return;
        }

        // Gap-closing specials for bruisers
        if (!arch.kite && dist > 150 && dist < 520) {
            if (this.charType === 'BRAWLER' && r < 0.30) { this.startAttack('specSide'); return; }
            if (this.charType === 'SWORDSMAN' && r < 0.40) { this.startAttack('specSide'); return; }
            if (this.charType === 'RANGER' && r < 0.25) { this.startAttack('specSide'); return; }
            if (this.charType === 'BEAST_TAMER' && r < 0.35) { this.startAttack('specSide'); return; }
            if (this.charType === 'PHANTOM' && r < 0.45) { this.startAttack('specSide'); return; } // Grave Drag yank
            if (this.charType === 'COPYCAT' && r < 0.45) { this.startAttack('specSide'); return; } // Cat Dash pounce
        }

        // Jump to chase an airborne target up close, or hop the gap when far
        if ((target.y < GROUND_Y - 40 && dist < 150 && r < 0.5) || (dist > 220 && r < arch.jumpy)) {
            this.vy = this.jumpForce; this.vx = spd * toward; this.changeState('JUMP');
            return;
        }

        // ---------- OFFENSE ----------
        if (arch.kite) {
            // ZONER: shoot from range, make space when pressured
            if (dist < arch.range - 80) {
                if (this.charType === 'MAGE' && r < 0.5) this.startAttack('specUp');          // blink away
                else if (this.charType === 'RANGER' && r < 0.5) this.startAttack('specDown'); // roll out
                else if (this.charType === 'CULT' && r < 0.4) this.startAttack('specDown');   // plant a zone underfoot
                else if (this.charType === 'CULT' && r < 0.7) this.startAttack('specSide');   // shove with the procession
                else this.startPlayerAttack(r < 0.6 ? 'L' : 'H');
            } else if (dist < arch.range + 240) {
                if (this.charType === 'MAGE') {
                    if (r < 0.45) this.startAttack('specNeutral');          // Chaos Bolt
                    else if (r < 0.65) this.startPlayerAttack('H');          // big orb
                    else if (r < 0.80) this.startAttack('specSide');         // Arcane Roulette
                    else if (r < 0.90 && dist < 240) this.startAttack('specDown'); // Rune Trap
                    else this.startPlayerAttack('L');
                } else if (this.charType === 'CULT') {
                    if (target.y < GROUND_Y - 30 && r < 0.5) this.startAttack('specUp');   // Rapture anti-air
                    else if (r < 0.5) this.startAttack('specNeutral');       // Dark Offering bolts
                    else if (r < 0.7) this.startAttack('specDown');          // Consecrated Ground
                    else if (r < 0.85) this.startAttack('specSide');         // Procession
                    else this.startPlayerAttack('L');
                } else { // RANGER
                    if (r < 0.5) this.startPlayerAttack('H');                // gun
                    else if (r < 0.82) this.startAttack('specNeutral');      // Quickdraw
                    else this.startPlayerAttack('L');
                }
            }
        } else {
            // BRUISER: pressure once in range
            if (dist < arch.range + 55) {
                if (this.charType === 'ZOMBIE') {
                    this.startPlayerAttack(r < 0.65 ? 'L' : 'H');
                } else if (target.y < GROUND_Y - 30 && r < 0.5) {
                    this.startAttack('specUp');                              // anti-air launcher
                } else if (this.charType === 'BRAWLER') {
                    if (r < 0.55) this.startPlayerAttack('L');               // chains into LLL / LLH
                    else if (r < 0.78) this.startPlayerAttack('H');          // kick / finisher
                    else if (r < 0.90) this.startAttack('specNeutral');      // Haymaker
                    else this.startAttack('specDown');                       // Ground Breaker
                } else if (this.charType === 'BEAST_TAMER') {
                    if (r < 0.16) this.startAttack('specNeutral');
                    else if (r < 0.44) this.startAttack('specSide');
                    else if (r < 0.60) this.startAttack('specDown');
                    else if (r < 0.74) this.startAttack('specUp');
                    else this.startPlayerAttack(r < 0.88 ? 'L' : 'H');
                } else if (this.charType === 'PHANTOM') {
                    if (r < 0.42) this.startPlayerAttack(r < 0.24 ? 'L' : 'H'); // mist claws
                    else if (r < 0.62) this.startAttack('specNeutral');         // Soul Siphon drain
                    else if (r < 0.80) this.startAttack('specDown');            // Grave Grasp root
                    else this.startAttack('specSide');                         // Grave Drag yank
                } else if (this.charType === 'COPYCAT') {
                    if (r < 0.40) this.startPlayerAttack(r < 0.22 ? 'L' : 'H'); // quick claws
                    else if (r < 0.58) this.startAttack('specSide');            // Cat Dash pin
                    else if (r < 0.72) this.startAttack('specUp');              // Piano Drop
                    else if (r < 0.84) this.startAttack('specDown');            // Agility counter-mark
                    else this.startAttack('specNeutral');                      // Copy (replays last special)
                } else if (this.charType === 'LUMATROSSIA') {
                    if (r < 0.40) this.startPlayerAttack(r < 0.5 ? 'L' : 'H');  // huge backhand / slam
                    else if (r < 0.58) this.startAttack('specSide');           // Goring Charge
                    else if (r < 0.72) this.startAttack('specDown');           // Cataclysm
                    else if (r < 0.85) this.startAttack('specNeutral');        // Doomgaze beam
                    else this.startPlayerAttack('H');
                } else if (this.charType === 'TWINS') {
                    if (r < 0.42) this.startPlayerAttack(r < 0.22 ? 'L' : 'H'); // pincer jab / clap
                    else if (r < 0.58) this.startAttack('specNeutral');         // Mirror Volley
                    else if (r < 0.70) this.startAttack('specDown');            // Tether trap
                    else if (target.y < GROUND_Y - 30 ? r < 0.85 : r < 0.78) this.startAttack('specUp'); // Fastball
                    else this.startAttack('specSide');                          // Crossover
                } else if (this.charType === 'TRAVELER') {
                    if (this.hp < this.maxHp * 0.45 && this.rewindCd <= 0 && r < 0.3) this.startAttack('specDown'); // undo the damage
                    else if (r < 0.46) this.startPlayerAttack(r < 0.26 ? 'L' : 'H'); // jab / flash kick
                    else if (r < 0.64) this.startAttack('specNeutral');             // vortex at their feet
                    else if (r < 0.82) this.startAttack('specSide');                // tachyon echo
                    else this.startAttack('specUp');                                // time skip out
                } else { // SWORDSMAN
                    if (r < 0.5) this.startPlayerAttack('L');
                    else if (r < 0.72) this.startPlayerAttack('H');
                    else if (r < 0.86) this.startAttack('specNeutral');      // Iai draw
                    else this.startAttack('specDown');                       // bait parry
                }
            }
        }
    }

    // Is an enemy projectile flying toward me right now?
    aiIncomingProjectile() {
        for (let p of projectiles) {
            if (!p.active || !p.owner || p.owner.team === this.team) continue;
            if (p.subtype === 'rune' || (p.vx === 0 && p.vy === 0)) continue;
            const dxp = this.x - p.x;
            if (Math.sign(p.vx) === Math.sign(dxp) && Math.abs(dxp) < 320 &&
                Math.abs((this.y - 40) - p.y) < 75) return p;
        }
        return null;
    }

    getClosestEnemy() {
        let minDist = Infinity;
        let closest = null;
        for (let p of players) {
            if (p.team !== this.team && p.state !== 'DEAD') {
                let d = Math.abs(p.x - this.x);
                if (d < minDist) { minDist = d; closest = p; }
            }
        }
        return closest;
    }

    startAttack(atkName, overrideAtk = null) {
        if (this.state === 'ATTACK' || this.state === 'HITSTUN' || this.state === 'BLOCK') return;

        // Copy Cat — the neutral special MIMICS the OPPONENT's most recent special.
        if (!overrideAtk && this.charType === 'COPYCAT' && atkName === 'specNeutral') {
            let foe = this.getClosestEnemy();
            if (foe && foe.lastSpecialAtk) overrideAtk = foe.lastSpecialAtk; // steal their last special
        }

        let atk = overrideAtk || this.attacks[atkName] || createAttackVariant(this, atkName);
        if (!atk) return;
        if (!overrideAtk && this.charType === 'BEAST_TAMER') atk = this.beastAttackFor(atkName, atk);

        this.currentAttack = { ...atk, name: atkName };

        // Remember the last special performed so a Copy Cat can steal it (snapshot the
        // resolved move, before any speed modifiers below).
        if (atkName === 'specNeutral' || atkName === 'specSide' || atkName === 'specUp' || atkName === 'specDown') {
            this.lastSpecialAtk = { ...this.currentAttack };
        }
        if (this.charType === 'BEAST_TAMER' && (atkName === 'specSide' || atkName === 'specUp' || atkName === 'specDown')) {
            this.beastAnimTimer = 0;
        }
        
        // Passives integration
        let spdMult = (this.parryBuffTimer > 0) ? 0.6 : 1.0;
        if (this.charType === 'BRAWLER') spdMult *= 0.82; // faster combat speed
        if (this.charType === 'TWINS' && this.symBuff > 0) spdMult *= (1 - 0.22 * this.symBuff); // Symmetry: faster while the foe is centred
        this.currentAttack.startup *= spdMult;
        this.currentAttack.active *= spdMult;
        this.currentAttack.recovery *= spdMult;

        this.changeState('ATTACK');
        this.hasSpawnedHitbox = false;
        this.specialDone = false;
        this._qdShots = 0; // Quickdraw shot counter
        this._crashed = false; this._diving = false; // Telepath dive-bomb state

        // Note: melee swing sounds now play on contact (see checkCollisions),
        // so whiffed attacks are silent. Projectiles still sound on fire.

        // Special movement / setup on attack start
        const t = atk.type;
        if (t === 'dashSlash') { this.vx = 1150 * this.dir; this.invulnTimer = 0.32; } // Flash Slash: longer dash + i-frames
        if (t === 'knifeRush') this.vx = 1000 * this.dir;                              // Knife Rush: longer dash
        if (t === 'shoulderRush') this.vx = 720 * this.dir;
        if (t === 'abyssalGrab') this.vx = 520 * this.dir;           // Dark Ruler lunging grab
        if (t === 'risingEdge') { this.vy = -560; this.vx = 90 * this.dir; }
        if (t === 'psiLift') { this.vy = -560; this.vx = 60 * this.dir; }                 // Telepath rise
        if (t === 'wraithRise') { this.vy = -600; this.vx = 70 * this.dir; this.invulnTimer = Math.max(this.invulnTimer, 0.14); } // Phantom rise (anti-air grab)
        if (t === 'catDash') { this.vx = 1180 * this.dir; this.invulnTimer = Math.max(this.invulnTimer, 0.12); } // Cat Dash: long pouncing lunge
        if (t === 'pianoDrop') { this.vy = -460; this.dropPiano(); }                                  // hop up and drop a piano on the foe
        if (t === 'agility') { this.agilityTimer = 1.6; spawnParticles(this.x, this.y - 50, 12, '#ffd23f'); } // place the counter-mark
        if (t === 'teleCrash') { this._diving = this.y < GROUND_Y; if (this._diving) { this.vy = 1050; this.vx = 0; } } // air dive-bomb
        if (t === 'uppercut') { this.vy = -700; this.vx = 200 * this.dir; }
        if (t === 'risingSlash') { this.vy = -560; this.vx = 110 * this.dir; }
        if (t === 'updraftShot') { this.vy = -620; }
        if (t === 'parry') this.vx = 0;
        if (t === 'combatRoll') { this.vx = 680 * this.dir; this.invulnTimer = 0.32; this.tacticalReload = true; }
        if (t === 'beastBruteRush') this.vx = 780 * this.dir;
        if (t === 'beastSerpentSwing') { this.vy = -660; this.vx = 560 * this.dir; this.beastSnakeSwingTimer = 0.9; }
        if (t === 'beastBruteUpper') { this.vy = -520; this.vx = 70 * this.dir; }
        if (t === 'beastRavenLift') { this.vy = -720; this.vx = 130 * this.dir; this.invulnTimer = 0.16; this.beastRavenGlideTimer = 2.4; }
        if (t === 'airHeavy') this.vy = Math.max(this.vy, 120);
        if (t === 'lowHeavy') this.vx = 80 * this.dir;
        if (atk.combo === 'LLH') this.vx = 120 * this.dir;
        if (atk.combo === 'HLL') this.vx = 180 * this.dir;
        // The Cult specials — the leader stays put and directs the flock
        if (t === 'procession') { this.vx = 0; this.spawnProcessionTrap(); }    // cultists run out, plant a snare
        if (t === 'cultPuppet') { this.vx = 0; if (this.puppet) this.explodePuppet(); else this.spawnPuppet(); } // summon or detonate
        // Lumatrossia specials
        if (t === 'lumTeleport') this.lumTeleport();                            // blink behind the foe
        if (t === 'lumPortal') this.lumPortal();                                // drop them out of the sky
        if (t === 'lumBeast') this.spawnBeastFire();                            // beast rains fire from above
        // The Twins specials
        if (t === 'crossover') this.twinCrossover();                            // scissor through each other
        if (t === 'fastball') {                                                 // Up has two versions
            let p = this.partner;
            if (p && Math.abs(p.x - this.x) < 120) this.twinFastball();  // together: hurl yourself across
            else this.twinConverge();                                   // apart: leap at each other
        }
        if (t === 'twinTether') this.twinTether();                              // string a wire between them
        // The Traveler specials
        if (t === 'timeSkip') { // fast-forward out of the timeline: vanish, reappear at jump apex
            this.vy = -640; this.vx = 110 * this.dir;
            this._skipHide = 0.2;
            this.invulnTimer = Math.max(this.invulnTimer, 0.3);
            spawnParticles(this.x, this.y - 45, 16, '#6fd0ff');
            playAudio(attackSfx.magic);
        }
        if (t === 'rewind') this.doRewind();                                    // snap back to the after-echo

        // Cult — every action summons 1-3 cultists for the ritual (cosmetic flair)
        if (this.charType === 'CULT' && typeof spawnCultists === 'function') {
            let n = (atkName === 'light') ? 1 : (atkName === 'heavy') ? 2 : 2 + Math.min(1, this.cultTier());
            let ck = t === 'darkOffering' ? 'throw' : t === 'procession' ? 'march'
                   : t === 'cultPuppet' ? 'raise' : t === 'consecrate' ? 'kneel' : 'strike';
            spawnCultists(this.x, GROUND_Y, this.dir, n, ck);
        }
    }

    playAttackSound(atk) {
        if (this.charType === 'PHANTOM') {
            // his special claws/grabs land with the spectral hit; light/heavy still punch
            if (atk.type === 'soulSiphon' || atk.type === 'graveGrasp' || atk.type === 'wraithRise' || atk.type === 'graveDrag') playAudio(attackSfx.phantomHit);
            else playAudio(attackSfx.punch);
            return;
        }
        if (this.charType === 'TELEPATH') {
            playAudio(attackSfx.tele);
            return;
        }
        if (this.charType === 'BEAST_TAMER') {
            if (atk.type === 'beastSerpentBite' || atk.type === 'beastSerpentSwing' || atk.type === 'beastSerpentVenom') playAudio(attackSfx.snake);
            else if (atk.type === 'beastRavenDive' || atk.type === 'beastRavenLift' || atk.type === 'beastRavenMark') playAudio(attackSfx.raven);
            else if (atk.type === 'beastBruteRush' || atk.type === 'beastBruteUpper' || atk.type === 'beastBruteStomp') playAudio(attackSfx.brute);
            else playAudio(attackSfx.punch);
            return;
        }
        if (this.charType === 'MAGE' || atk.type === 'chaosBolt' || atk.type === 'arcaneRoulette' || atk.type === 'runeTrap' || atk.type === 'blink') {
            playAudio(attackSfx.magic);
            return;
        }
        if (this.charType === 'SWORDSMAN' || this.charType === 'DARK_RULER' || atk.type === 'dashSlash' || atk.type === 'risingSlash' || atk.type === 'vacuumSlash') {
            playAudio(attackSfx.sword);
            return;
        }
        if (this.charType === 'RANGER') {
            if (atk.isProj || atk.type === 'quickDraw' || atk.type === 'updraftShot') playAudio(attackSfx.shot);
            else playAudio(attackSfx.knife);
            return;
        }
        if (this.charType === 'BRAWLER') {
            if (atk.name === 'heavy' || atk.type === 'lowHeavy' || atk.type === 'airHeavy') playAudio(attackSfx.kick);
            else playAudio(attackSfx.punch);
            return;
        }
        if (this.charType === 'COPYCAT') {
            // claws slash, the dash pounce uses the knife swipe
            if (atk.type === 'catDash') playAudio(attackSfx.knife);
            else playAudio(attackSfx.kick);
            return;
        }
        if (this.charType === 'TWINS') {                                                 // crisp synchronized strikes
            if (atk.type === 'crossover' || atk.type === 'fastball') playAudio(attackSfx.knife);
            else playAudio(attackSfx.punch);
            return;
        }
        if (this.charType === 'TRAVELER') {                                              // sharp tech strikes
            if (atk.name === 'heavy' || atk.type === 'flashKick') playAudio(attackSfx.kick);
            else if (atk.isProj || atk.type === 'timeVortex') playAudio(attackSfx.magic);
            else playAudio(attackSfx.punch);
            return;
        }
        if (this.charType === 'CULT') { playAudio(attackSfx.magic); return; }            // ritual strikes
        if (this.charType === 'LUMATROSSIA') {                                           // heavy demonic blows
            playAudio(atk.name === 'heavy' || atk.type === 'cataclysm' ? attackSfx.kick : attackSfx.punch);
            return;
        }
        if (!atk.isProj) playAudio(attackSfx.punch);
    }

    processAttack() {
        let atk = this.currentAttack;
        let t = this.stateTimer;
        let inActive = t >= atk.startup && t < atk.startup + atk.active;

        // Quickdraw: exactly 3 evenly-spaced shots across the active window
        if (atk.type === 'quickDraw' && inActive) {
            let into = t - atk.startup;
            let shotsDue = Math.min(3, 1 + Math.floor(into / (atk.active / 3)));
            if (this._qdShots < shotsDue) { this._qdShots++; this.spawnProjectile(atk); }
        }

        // Combat Roll can be cancelled into a crouch attack
        if (atk.type === 'combatRoll' && !this.isAI) {
            let c = this.playerControls();
            if (keys[c.d] && (keyPressed(c.atkL) || keyPressed(c.atkH))) {
                this.changeState('CROUCH'); // brief, so startAttack's low-attack path is allowed
                this.startAttack(keyPressed(c.atkL) ? 'lowLight' : 'lowHeavy');
                return;
            }
        }

        // Blink: teleport once when startup finishes, then RNG kicker
        if (atk.type === 'blink' && !this.specialDone && t >= atk.startup) {
            this.specialDone = true;
            this.doBlink();
        }

        if (atk.type === 'beastSwitch' && !this.specialDone && t >= atk.startup) {
            this.specialDone = true;
            this.cycleBeast();
        }

        // Telekinetic Crash dive-bomb: detonate the moment she slams into the ground
        if (atk.type === 'teleCrash' && this._diving && this.y >= GROUND_Y && !this._crashed) {
            this._crashed = true; this._diving = false; this.hasSpawnedHitbox = true; this.vx = 0;
            let hb = new Hitbox(this.x - atk.w / 2, GROUND_Y - atk.h, atk.w, atk.h, atk.dmg, { x: 0, y: atk.kb.y }, atk.stun, this, 0.16);
            hb.atk = atk; hitboxes.push(hb);
            spawnParticles(this.x, GROUND_Y - 12, 26, '#9be3ff');
        }

        if (inActive && !this.hasSpawnedHitbox) {
            this.hasSpawnedHitbox = true;

            // Damage modifiers (passives)
            let dmgMod = 1.0;
            if (this.charType === 'BRAWLER') dmgMod += this.comboCount * 0.1; // Momentum
            if (this.burnTimer > 0 && (atk.name === 'light' || atk.name === 'heavy' || atk.name === 'airLight' || atk.name === 'airHeavy' || atk.name === 'lowLight' || atk.name === 'lowHeavy')) {
                dmgMod *= 0.72;
            }
            if (this.charType === 'RANGER' && this.tacticalReload &&
                (atk.type === 'quickDraw' || atk.type === 'updraftShot' || atk.name === 'heavy')) {
                dmgMod += 0.5; this.tacticalReload = false; // Tactical Reload
            }
            if (this.charType === 'MAGE' && this.manaFontTimer > 0) { dmgMod += 0.6; this.manaFontTimer = 0; }
            if (this.charType === 'TWINS' && this.symBuff > 0) dmgMod += 0.18 * this.symBuff; // Symmetry damage bonus

            if (atk.type === 'mirrorVolley') {
                this.twinVolley(dmgMod);                  // both twins fire inward
            } else if (atk.type === 'arcaneRoulette') {
                this.castArcaneRoulette(dmgMod);
            } else if (atk.type === 'updraftShot') {
                // Blast straight down beneath the Ranger (launches self, hits pursuers)
                let hx = this.x - atk.w / 2, hy = this.y + atk.oy;
                hitboxes.push(new Hitbox(hx, hy, atk.w, atk.h, atk.dmg * dmgMod, {x: 60 * this.dir, y: 200}, atk.stun, this, atk.active));
                playAudio(attackSfx.shot);
                for (let i = 0; i < 8; i++) particles.push(new Particle(this.x, this.y - 6, (Math.random()-0.5)*240, 160+Math.random()*220, 0.4, '#fff', 2));
            } else if (atk.type === 'combatRoll' || atk.type === 'blink' || atk.type === 'beastSwitch' || atk.type === 'timeSkip' || atk.type === 'rewind') {
                // movement-only specials, no hitbox spawned here
            } else if (atk.type === 'beastSerpentSwing') {
                this.spawnBeastSerpentSwing(dmgMod, atk);
            } else if (atk.type === 'beastRavenDive') {
                this.spawnBeastRavenDive(dmgMod, atk);
            } else if (atk.type === 'beastSerpentVenom') {
                this.spawnBeastVenom(dmgMod);
            } else if (atk.type === 'beastRavenMark') {
                this.spawnBeastRavenMark(dmgMod);
            } else if (atk.type === 'darkOffering') {
                this.spawnDarkOffering(dmgMod);                 // 1-3 hexed bolts (Devotion)
            } else if (atk.type === 'consecrate') {
                this.spawnConsecrate();                         // plant the ritual trap-zone
            } else if (atk.type === 'teleCrash') {
                // Ground version = a low psychic sweep; the air dive detonates on landing (handled above)
                if (!this._diving) {
                    let hb = new Hitbox(this.x - atk.w / 2, this.y + atk.oy, atk.w, atk.h, atk.dmg * dmgMod, { x: 0, y: atk.kb.y }, atk.stun, this, atk.active);
                    hb.atk = atk; hitboxes.push(hb);
                    spawnParticles(this.x, GROUND_Y - 12, 14, '#9be3ff');
                }
            } else if (atk.isProj) {
                this.spawnProjectile(atk, dmgMod);
                // Mage passive Wild Magic: chance for a bonus projectile
                if (this.charType === 'MAGE' && onlineEventRandom('mageWildBonus', this) < 0.2) {
                    if (currentMode === 'ONLINE') this.spawnProjectile(atk, dmgMod, true);
                    else setTimeout(() => { if (this.state !== 'DEAD') this.spawnProjectile(atk, dmgMod, true); }, 90);
                }
            } else if (atk.w > 0) {
                let hx = this.x + (atk.ox * this.dir) - (this.dir < 0 ? atk.w : 0);
                let hy = this.y + atk.oy;
                let hb = new Hitbox(hx, hy, atk.w, atk.h, atk.dmg * dmgMod, {x: atk.kb.x * this.dir, y: atk.kb.y}, atk.stun, this, atk.active);
                if (atk.grab) hb.grab = true; // unblockable command grab
                if (atk.type === 'abyssalGrab') hb.grabThrow = this; // seize, then throw
                else if (atk.type === 'catDash') { hb.catPin = this; hb.atk = atk; } // pounce → pin & slash
                else hb.atk = atk; // remember the move so its sound can play on contact
                hitboxes.push(hb);
                // The Twins — the SECOND body strikes too, from its own side (both act as one)
                if (this.charType === 'TWINS' && !this.isPartner && !this.fastball && this.partner &&
                    this.partner.state !== 'HITSTUN' && this.state !== 'HITSTUN') {
                    let px = this.twinPartnerX();
                    let pdir = (this.getClosestEnemy() ? (this.getClosestEnemy().x >= px ? 1 : -1) : -this.dir);
                    let phx = px + (atk.ox * pdir) - (pdir < 0 ? atk.w : 0);
                    let hb2 = new Hitbox(phx, this.y + atk.oy, atk.w, atk.h, atk.dmg * dmgMod, { x: atk.kb.x * pdir, y: atk.kb.y }, atk.stun, this, atk.active);
                    hb2.atk = atk; hitboxes.push(hb2);
                }
                if (atk.type === 'darkNova') { spawnParticles(this.x + 40 * this.dir, GROUND_Y - 10, 20, '#111'); spawnParticles(this.x - 40 * this.dir, GROUND_Y - 10, 14, '#ff0033'); }
                if (atk.type === 'cataclysm') { spawnParticles(this.x, GROUND_Y - 12, 34, '#ff0033'); spawnParticles(this.x, GROUND_Y - 12, 20, '#888'); }
            }
        } else if (t >= atk.startup + atk.active + atk.recovery) {
            this.changeState(this.y < GROUND_Y ? (this.vy < 0 ? 'JUMP' : 'FALL') : 'IDLE');
        }
    }

    beastAttackFor(atkName, baseAtk) {
        const beast = this.beastIndex || 0;
        if (atkName === 'specSide') {
            if (beast === 0) return { ...baseAtk, startup: 0.12, active: 0.1, recovery: 0.28, dmg: 8, isProj: true, pSpeed: 850, pLife: 0.72, w: 26, h: 18, oy: -58, kb: { x: 230, y: -90 }, stun: 0.34, type: 'beastSerpentBite' };
            if (beast === 1) return { ...baseAtk, startup: 0.16, active: 0.24, recovery: 0.34, dmg: 13, w: 74, h: 56, ox: 24, oy: -58, kb: { x: 340, y: -150 }, stun: 0.48, type: 'beastBruteRush', armor: true };
            return { ...baseAtk, startup: 0.12, active: 0.16, recovery: 0.26, dmg: 9, w: 66, h: 54, ox: 150, oy: -92, kb: { x: 230, y: 160 }, stun: 0.34, type: 'beastRavenDive' };
        }
        if (atkName === 'specUp') {
            if (beast === 0) return { ...baseAtk, startup: 0.08, active: 0.26, recovery: 0.32, dmg: 9, w: 190, h: 92, ox: 42, oy: -112, kb: { x: 360, y: -340 }, stun: 0.42, type: 'beastSerpentSwing' };
            if (beast === 1) return { ...baseAtk, startup: 0.16, active: 0.22, recovery: 0.32, dmg: 14, w: 70, h: 92, ox: 14, oy: -104, kb: { x: 130, y: -650 }, stun: 0.5, type: 'beastBruteUpper', armor: true };
            return { ...baseAtk, startup: 0.08, active: 0.18, recovery: 0.34, dmg: 7, w: 72, h: 70, ox: 0, oy: -94, kb: { x: 120, y: -420 }, stun: 0.34, type: 'beastRavenLift' };
        }
        if (atkName === 'specDown') {
            if (beast === 0) return { ...baseAtk, startup: 0.18, active: 0.1, recovery: 0.36, dmg: 6, w: 46, h: 20, ox: 100, oy: -12, kb: { x: 80, y: -130 }, stun: 0.3, type: 'beastSerpentVenom' };
            if (beast === 1) return { ...baseAtk, startup: 0.28, active: 0.2, recovery: 0.42, dmg: 16, w: 170, h: 36, ox: 0, oy: -18, kb: { x: 250, y: -380 }, stun: 0.55, type: 'beastBruteStomp', armor: true };
            return { ...baseAtk, startup: 0.16, active: 0.1, recovery: 0.32, dmg: 4, isProj: true, pSpeed: 760, pLife: 0.9, w: 24, h: 24, oy: -92, kb: { x: 80, y: -60 }, stun: 0.25, type: 'beastRavenMark' };
        }
        return baseAtk;
    }

    cycleBeast() {
        this.beastIndex = ((this.beastIndex || 0) + 1) % 3;
        this.beastSwapFlash = 0.6;
        spawnParticles(this.x, this.y - 55, 18, this.beastIndex === 0 ? '#fff' : this.beastIndex === 1 ? '#ff0033' : '#aaa');
        playAudio(attackSfx.beastSwitch);
    }

    spawnBeastVenom(dmgMod) {
        let px = this.x + this.dir * 72 - (this.dir < 0 ? 132 : 0);
        let p = new Projectile(px, GROUND_Y - 22, 0, 0, 132, 22, 4 * dmgMod, { x: 35 * this.dir, y: -70 }, 0.2, this, 4.2, null);
        p.subtype = 'venom'; p.slow = 2.8; p.slowFactor = 0.28; p.venom = 2.2; p.pierce = true; p.unblockable = true;
        projectiles.push(p);
        spawnParticles(px + p.w / 2, GROUND_Y - 18, 14, '#fff');
        playAudio(attackSfx.snake);
    }

    spawnBeastSerpentSwing(dmgMod, atk) {
        let hx = this.x + this.dir * 18 - (this.dir < 0 ? atk.w : 0);
        let hy = this.y + atk.oy;
        let hb = new Hitbox(hx, hy, atk.w, atk.h, atk.dmg * dmgMod, { x: atk.kb.x * this.dir, y: atk.kb.y }, atk.stun, this, atk.active);
        hb.atk = atk;
        hitboxes.push(hb);
        spawnParticles(this.x + this.dir * 90, this.y - 72, 16, '#fff');
        playAudio(attackSfx.snake);
    }

    spawnBeastRavenDive(dmgMod, atk) {
        let target = this.getClosestEnemy();
        let tx = target ? target.x : this.x + this.dir * 210;
        let ty = target ? target.y - 76 : this.y - 82;
        let hx = tx - atk.w / 2;
        let hy = ty - atk.h / 2;
        let hb = new Hitbox(hx, hy, atk.w, atk.h, atk.dmg * dmgMod, { x: atk.kb.x * this.dir, y: atk.kb.y }, atk.stun, this, atk.active);
        hb.atk = atk;
        hitboxes.push(hb);
        this.beastRavenDiveTimer = 0.46;
        // store the target offset in the Tamer's facing space (companion is drawn dir-flipped)
        this._beastRavenDiveX = (tx - this.x) * this.dir;
        this._beastRavenDiveY = ty - this.y;
        spawnParticles(tx, ty, 12, '#fff');
        playAudio(attackSfx.raven);
    }

    spawnBeastRavenMark(dmgMod) {
        let p = new Projectile(this.x + this.dir * 16, this.y - 92, 760 * this.dir, 170, 24, 24, 4 * dmgMod, { x: 90 * this.dir, y: -80 }, 0.3, this, 0.9, null);
        p.subtype = 'ravenMark'; p.markTarget = true;
        projectiles.push(p);
        playAudio(attackSfx.raven);
    }

    // Mage Blink: vanish, reappear forward with a small hop, plus an RNG kicker
    doBlink() {
        let oldX = this.x, oldY = this.y;
        this.x = Math.max(this.width/2, Math.min(WIDTH - this.width/2, this.x + this.dir * 200));
        this.y = Math.min(GROUND_Y, this.y - 50); this.vy = -240;
        this.invulnTimer = 0.22;
        spawnParticles(oldX, oldY - 40, 12, '#fff');
        spawnParticles(this.x, this.y - 40, 12, '#fff');
        playAudio(attackSfx.magic);
        let r = onlineEventRandom('mageBlinkKicker', this);
        if (r < 0.4) {
            this.spawnRune(oldX, GROUND_Y - 20, 10, 'explosive'); // leave a parting gift
        } else if (r < 0.75) {
            hitboxes.push(new Hitbox(this.x - 42, this.y - 72, 84, 72, 9, {x: 220 * this.dir, y: -220}, 0.3, this, 0.12)); // arrival burst
            spawnParticles(this.x, this.y - 40, 16, '#fff');
        } else {
            this.manaFontTimer = 5.0; // empower next spell
            spawnParticles(this.x, this.y - 50, 18, '#fff');
        }
    }

    // Mage Side: a random horizontal spell each cast
    castArcaneRoulette(dmgMod) {
        let baseY = this.y - 55;
        let pick = Math.floor(onlineEventRandom('mageRoulette', this) * 4);
        if (pick === 0) { // Arcane frost wave
            playAudio(attackSfx.ice);
            let p = new Projectile(this.x + this.dir*20, baseY - 8, 330*this.dir, 0, 46, 46, 10*dmgMod, {x:200*this.dir, y:-60}, 0.35, this, 1.4, null);
            p.subtype = 'frost'; p.slow = 1.25; p.slowFactor = 0.18; projectiles.push(p);
        } else if (pick === 1) { // Phase-step strike (teleport + hit)
            playAudio(attackSfx.magic);
            this.x = Math.max(this.width/2, Math.min(WIDTH - this.width/2, this.x + this.dir*150));
            this.invulnTimer = 0.18; spawnParticles(this.x, baseY, 12, '#fff');
            hitboxes.push(new Hitbox(this.x - 32, this.y - 72, 72, 72, 12*dmgMod, {x:260*this.dir, y:-160}, 0.4, this, 0.12));
        } else if (pick === 2) { // Bolt swarm
            playAudio(attackSfx.lightning);
            for (let i = 0; i < 5; i++) {
                let a = (i - 2) * 0.22, sp = 520;
                let p = new Projectile(this.x + this.dir*20, baseY, Math.cos(a)*sp*this.dir, Math.sin(a)*sp, 12, 12, 5*dmgMod, {x:120*this.dir, y:-60}, 0.55, this, 1.0, null);
                p.subtype = 'spark'; p.lightningStun = 0.55; projectiles.push(p);
            }
        } else { // Piercing beam
            playAudio(attackSfx.lightning);
            let p = new Projectile(this.x + this.dir*20, baseY, 1100*this.dir, 0, 52, 8, 9*dmgMod, {x:140*this.dir, y:-40}, 0.65, this, 0.6, null);
            p.subtype = 'beam'; p.pierce = true; p.lightningStun = 0.65; projectiles.push(p);
        }
    }

    // Mage Down: plant a ground rune (random type, or a forced type from Blink)
    spawnRune(x, y, dmg, forced) {
        let types = ['explosive', 'slow', 'launch', 'manaFont'];
        let rt = forced || types[Math.floor(onlineEventRandom('mageRuneType', this) * types.length)];
        let p = new Projectile(x, GROUND_Y - 20, 0, 0, 40, 20, dmg, {x: 100 * this.dir, y: -300}, 0.5, this, 6.0, null);
        p.subtype = 'rune'; p.runeType = rt;
        if (rt === 'slow') p.slow = 2.0;
        if (rt === 'launch') p.knockback = { x: 60 * this.dir, y: -540 };
        if (rt === 'explosive') p.explode = true;
        if (rt === 'manaFont') p.benign = true; // buffs the caster, doesn't strike foes
        projectiles.push(p);
        playAudio(attackSfx.magic);
    }

    spawnProjectile(atk, dmgMod = 1.0, isBonus = false) {
        let px = this.x + (this.dir === 1 ? 20 : -20 - atk.w);
        let py = this.y + atk.oy + (isBonus ? (onlineEventRandom('mageBonusProjectileY', this)*40-20) : 0);
        let vx = (atk.pSpeed || 0) * this.dir;
        let vy = 0;
        let w = atk.w, h = atk.h, dmg = atk.dmg, life = atk.pLife, logic = null;
        let subtype = null, slow = 0, explode = false, homing = false, pierce = false;

        if (atk.type === 'chaosBolt') {
            // Wild RNG: each cast rolls a different element / behaviour
            let roll = Math.floor(onlineEventRandom('mageChaosBolt', this) * 5);
            if (roll === 0)      { subtype = 'fire';  explode = true; vy = -260; vx *= 0.8; w = 22; h = 22; dmg = 11; } // arcing bomb
            else if (roll === 1) { subtype = 'spark'; vx *= 1.9; w = 16; h = 16; dmg = 6; }                              // fast bolt
            else if (roll === 2) { subtype = 'frost'; slow = 1.25; vx *= 0.9; dmg = 7; }                                 // chilling
            else if (roll === 3) { subtype = 'homing'; homing = true; vx *= 0.7; w = 18; h = 18; dmg = 9; }              // gravity wisp
            else                 { subtype = 'split'; w = 20; h = 20; dmg = 7; logic = splitLogic; }                     // shatters midair
        } else if (atk.type === 'runeTrap') {
            this.spawnRune(this.x + atk.ox * this.dir, GROUND_Y - 20, dmg * dmgMod);
            return;
        } else if (atk.type === 'vacuumSlash') {
            subtype = 'slash';
        } else if (atk.type === 'darkBolt') {
            subtype = 'dark';
        } else if (atk.type === 'mindGrip') {
            subtype = 'tether';
        } else if (atk.type === 'beastSerpentBite') {
            subtype = 'serpentBite';
            homing = true;
        } else if (atk.type === 'beastRavenDive') {
            subtype = 'ravenDive';
            vy = 170;
        } else if (atk.type === 'graveDrag') {
            subtype = 'mistChain';
        } else if (atk.type === 'doomgaze') {
            subtype = 'doomgaze'; pierce = true;
        } else if (atk.type === 'timeVortex') {
            subtype = 'vortex'; logic = vortexLogic; // drags foes in; the core hitstuns (no contact damage)
        } else if (atk.type === 'tachyonEcho') {
            subtype = 'echoBolt'; // the hit repeats itself one second later
        }

        if (this.charType === 'PHANTOM') {
            playAudio(attackSfx.magic);
        } else if (this.charType === 'MAGE') {
            if (subtype === 'fire') playAudio(attackSfx.fire);
            else if (subtype === 'frost') playAudio(attackSfx.ice);
            else if (subtype === 'spark' || subtype === 'beam') playAudio(attackSfx.lightning);
            else playAudio(attackSfx.magic);
        } else if (this.charType === 'RANGER') {
            playAudio(attackSfx.shot);
        } else if (this.charType === 'TELEPATH') {
            playAudio(attackSfx.tele);
        } else if (this.charType === 'BEAST_TAMER') {
            playAudio(subtype === 'ravenDive' ? attackSfx.raven : attackSfx.snake);
        }

        let proj = new Projectile(px, py, vx, vy, w, h, dmg * dmgMod, {x: atk.kb.x * this.dir, y: atk.kb.y}, atk.stun, this, life, logic);
        proj.ownerId = this.id;
        proj.ownerTeam = this.team;
        proj.ownerCharType = this.charType;
        proj.subtype = subtype; proj.slow = slow; proj.explode = explode; proj.homing = homing; proj.pierce = pierce;
        if (subtype === 'fire') proj.burn = 3.2;
        if (subtype === 'frost') proj.slowFactor = 0.18;
        if (subtype === 'spark' || subtype === 'beam') proj.lightningStun = subtype === 'beam' ? 0.65 : 0.55;
        if (subtype === 'homing') {
            proj.gravityKnockback = true;
            proj.knockback = { x: atk.kb.x * this.dir * 2.15, y: -360 };
        }
        if (subtype === 'tether') proj.unblockable = true; // Mind Grip pulls through guard
        if (subtype === 'vortex') proj.benign = true;      // the singularity never strikes on contact — its pull/core does the work
        // Grave Drag (mistChain) is blockable — a guarded hit returns false from takeDamage, so the yank won't fire
        projectiles.push(proj);
    }

    // Returns true if a real (unblocked) hit landed — used for ultimate connects.
    takeDamage(amount, kb, stun, attacker, opts = {}) {
        if (this.state === 'DEAD') return false;
        kb = { x: kb.x, y: kb.y }; // local copy so scaling never mutates the source

        // BRAWLER ultimate COUNTER — negate any attack (even an enemy ultimate) and punish
        if (this.state === 'ULT' && this.ult && this.ult.kind === 'counter' && this.ult.phase === 'window') {
            this.ult.connected = true;
            this.ult.target = attacker || this.getClosestEnemy();
            this.ult.phase = 'grab'; this.ult.t = 0;
            if (attacker && attacker.state === 'ULT') attacker.endUlt(); // cancel their ult too
            spawnParticles(this.x, this.y - 40, 24, '#fff');
            return false; // the incoming attack is fully negated
        }

        // TRAVELER ultimate — they swung at him; the dodge montage begins
        if (this.state === 'ULT' && this.ult && this.ult.kind === 'chronostop' && this.ult.phase === 'stance') {
            this.ult.connected = true;
            this.ult.target = attacker || this.getClosestEnemy();
            this.ult.phase = 'dodges'; this.ult.t = 0; this.ult.dodgeIdx = 0; this.ult.stored = 0;
            if (attacker && attacker.state === 'ULT') attacker.endUlt();
            spawnParticles(this.x, this.y - 40, 20, '#6fd0ff');
            return false;
        }

        // Other ultimate performers are invulnerable during their cinematic
        if (this.state === 'ULT') return false;

        // Telepath Psi Barrier absorbs melee and shoves the attacker back
        if (this.isReflecting() && !opts.unblockable) {
            this.hp -= amount * 0.2;
            if (attacker) { attacker.vx = 360 * this.dir; attacker.vy = Math.min(attacker.vy, -80); }
            spawnParticles(this.x + this.dir * 24, this.y - 50, 10, '#9be3ff');
            playAudio(attackSfx.block);
            updateHUD();
            return false;
        }

        // Dodge i-frames (Combat Roll / Blink) — true unblockables still connect
        if (this.invulnTimer > 0 && !opts.unblockable) {
            spawnParticles(this.x, this.y - 40, 6, '#fff');
            return false;
        }

        // Copy Cat — Agility: while marked, auto-leap the attack and kick the attacker away
        if (this.charType === 'COPYCAT' && this.agilityTimer > 0 && !opts.unblockable && attacker && attacker !== this) {
            this.agilityTimer = 0;
            this.catPin = null;
            this.vy = -540; this.vx = -this.dir * 140; this.changeState('JUMP'); // somersault over them
            this.invulnTimer = Math.max(this.invulnTimer, 0.32);
            let away = attacker.x < this.x ? -1 : 1;
            attacker.takeDamage(8, { x: 360 * away, y: -240 }, 0.5, this);
            spawnParticles(this.x, this.y - 40, 18, '#ffd23f');
            playAudio(attackSfx.kick);
            return false;
        }

        // Phantom Fading Veil — faded out; attacks pass through (true unblockables still land)
        if (this.charType === 'PHANTOM' && this._fadeIntangible && !opts.unblockable) {
            spawnParticles(this.x, this.y - 45, 6, '#9aa6c8');
            return false;
        }

        // Traveler — Temporal Slip passive: auto-phase through one hit, then recharge
        if (this.charType === 'TRAVELER' && this.slipCd <= 0 && !opts.unblockable && this.state !== 'BLOCK' && attacker !== this) {
            this.slipCd = 6;
            this._trail.push({ x: this.x, y: this.y, dir: this.dir, age: 0 }); // he blurs out of the hit
            spawnParticles(this.x, this.y - 45, 14, '#6fd0ff');
            playAudio(attackSfx.magic);
            return false;
        }

        // Super armor (Brawler armored specials): take damage, no flinch
        if (this.state === 'ATTACK' && this.currentAttack.armor && this.stateTimer < this.currentAttack.startup) {
            this.hp -= amount * 0.6;
            this.meter = Math.min(this.meterMax, this.meter + amount * 0.55);
            if (attacker) attacker.meter = Math.min(attacker.meterMax, attacker.meter + amount * 0.28);
            spawnParticles(this.x, this.y - 40, 8, '#ff0033');
            sfx.playHit();
            if (attacker && attacker.charType === 'BRAWLER') { attacker.comboCount++; attacker.comboTimer = 2.0; }
            updateHUD();
            if (this.hp <= 0 && !this.isDummy) {
                this.hp = 0;
                if ((opts.isUlt || (attacker && attacker.lumActive)) && isMatchWinningUltimateKill(attacker)) triggerOverkill(attacker, this); // a kill as Lumatrossia (the Cult's install) counts as an ult kill
                if (!this._ringedOut) {
                    this.y = this.floorUnder(this.y) ?? GROUND_Y;
                    this.vx = 0;
                    this.vy = 0;
                }
                this.changeState('DEAD');
                sfx.playDeath();
                checkWinCondition();
            }
            return true;
        }

        // Swordsman Parry (not vs unblockable ultimates)
        if (this.state === 'ATTACK' && this.currentAttack.type === 'parry' && !opts.unblockable) {
            let t = this.stateTimer;
            if (t >= this.currentAttack.startup && t < this.currentAttack.startup + this.currentAttack.active) {
                this.parryBuffTimer = 3.0;
                spawnParticles(this.x, this.y - 40, 20, '#fff');
                if (attacker) attacker.takeDamage(15, { x: 400 * this.dir, y: -200 }, 1.0, this);
                return false;
            }
        }

        // Blocking — drains guard durability; enough stress shatters the guard
        let blocked = false, guardBroke = false;
        if (!opts.unblockable && this.state === 'BLOCK' && (kb.x === 0 || Math.sign(kb.x) !== this.dir)) {
            this.blockHealth -= amount;
            if (this.blockHealth <= 0) { this.blockHealth = 0; guardBroke = true; }
            else blocked = true;
        }

        if (blocked) {
            amount *= 0.2; kb.x *= 0.2; kb.y *= 0.5; stun *= 0.3;
            playAudio(attackSfx.block);
        } else if (guardBroke) {
            this.changeState('BLOCKBREAK');
            this.blockBreakTimer = 0.9;
            this._guardBreakFx = 0.5; // drives the expanding shatter burst in draw()
            let gc = this.guardColor();
            sfx.playDeath(); // shatter stinger
            spawnParticles(this.x + this.dir * 16, this.y - 46, 26, gc); // guard shards in its own colour
            spawnParticles(this.x + this.dir * 16, this.y - 46, 10, '#fff');
        } else {
            this.rootTimer = 0; // being struck breaks the Grave Grasp hold
            this.catPin = null; // and breaks a Cat Dash pin if the cat gets interrupted
            // The Twins — a hit only stuns/knocks the body that was actually struck; the other
            // twin keeps fighting. HP (below) is still shared.
            let hb = (this.charType === 'TWINS' && opts.hitBody === 'partner' && this.partner) ? this.partner : this;
            hb.changeState('HITSTUN');
            hb.stateTimer = stun;
            hb.vx = kb.x; hb.vy = kb.y; hb.y -= 1; // knockback lands on the struck twin
            this._twinKbApplied = (hb !== this); // skip the generic knockback below if it went to the partner
            sfx.playHit();
            spawnParticles(hb.x, hb.y - 40, amount * 2, '#ff0033');
            if (attacker && attacker.charType === 'BRAWLER') { attacker.comboCount++; attacker.comboTimer = 2.0; }
        }

        // Meter charges from the exchange — more from taking than dealing
        this.meter = Math.min(this.meterMax, this.meter + amount * 0.62 + (blocked ? 1 : 0));
        if (attacker) attacker.meter = Math.min(attacker.meterMax, attacker.meter + amount * 0.32 + 1);

        // The Cult — Congregation: landing hits builds Devotion, which (by tier) grows the
        // rituals and charges the Lumatrossia install faster.
        if (attacker && attacker.charType === 'CULT' && !blocked && !attacker.lumActive) {
            attacker.devotion = Math.min(100, attacker.devotion + 14);
            attacker.meter = Math.min(attacker.meterMax, attacker.meter + amount * 0.12 * (1 + attacker.cultTier()));
        }

        // Dark Ruler passive — Soul Siphon: heal a fraction of damage dealt
        if (attacker && attacker.charType === 'DARK_RULER' && !blocked && attacker.hp > 0) {
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount * 0.2);
        }
        // Phantom — Soul Siphon special drains the souls of whoever it claws
        if (attacker && attacker.charType === 'PHANTOM' && attacker.currentAttack &&
            attacker.currentAttack.type === 'soulSiphon' && !blocked && attacker.hp > 0) {
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount * 0.6);
            spawnParticles(this.x, this.y - 45, 8, '#cfd8ff');
        }
        if (this.beastMarkedTimer > 0 && !blocked) {
            if (attacker && attacker.charType === 'BEAST_TAMER') amount += 3;
            this.beastMarkedTimer = 0;
            spawnParticles(this.x, this.y - 62, 14, '#ff0033');
        }

        this.hp -= amount;
        if (!this._twinKbApplied) { this.vx = kb.x; this.vy = kb.y; this.y -= 1; } // (partner-hit already took the knockback)
        this._twinKbApplied = false;

        updateHUD();

        if (this.isDummy) { this.hp = this.maxHp; return !blocked; }

        if (this.hp <= 0) {
            // Copy Cat — Nine Lives: a lethal ULTIMATE doesn't kill. Survive at full HP,
            // copy that ult, and seal the attacker's ult until you spend your copy.
            if (this.charType === 'COPYCAT' && opts.isUlt && !this.ultUnlocked && attacker && attacker !== this && ULT_KIND[attacker.charType]) {
                this.hp = this.maxHp; this.blockHealth = this.blockMax;
                this.ultUnlocked = true;
                this.meter = this.meterMax;
                this.copiedKind = ULT_KIND[attacker.charType];
                this.sealedEnemy = attacker;
                attacker.ultSealed = true;
                if (attacker.ult) attacker.endUlt(); // cut the killing cinematic short
                this.vx = 0; this.vy = 0; this.y = GROUND_Y;
                this.changeState('IDLE');
                this.invulnTimer = Math.max(this.invulnTimer, 0.6);
                this._nineLivesFx = 1.1;
                spawnParticles(this.x, this.y - 40, 34, '#ffd23f');
                spawnParticles(this.x, this.y - 40, 16, '#fff');
                updateHUD();
                return false;
            }
            // Training never ends — if the CPU dummy KOs the player, just respawn them.
            if (trainingMode && !this.isDummy) {
                this.hp = this.maxHp; this.blockHealth = this.blockMax;
                this.vx = 0; this.vy = 0; this.changeState('IDLE');
                return !blocked;
            }
            this.hp = 0;
            if (opts.isUlt && isMatchWinningUltimateKill(attacker)) triggerOverkill(attacker, this);
            if (!this._ringedOut) {
                this.y = this.floorUnder(this.y) ?? GROUND_Y;
                this.vx = 0;
                this.vy = 0;
            }
            this.changeState('DEAD');
            sfx.playDeath();
            checkWinCondition();
        }
        return !blocked;
    }

    // Victory celebration pose, struck when the match is won (see endGame).
    startWinPose() {
        if (this.state === 'DEAD') return;
        this.state = 'WIN';
        this.stateTimer = 0;
        this.vx = 0; this.vy = 0;
        this.ult = null; this.currentAttack = null;
        this.dir = this.x < WIDTH / 2 ? 1 : -1; // turn to face the arena
        this._winFxTimer = 0;
    }

    // 2v2 tag-in: burst onto the field with a signature entrance strike that damages
    // whoever it catches. The pose is unique per fighter (see the ATTACK draw section).
    startTagIn() {
        let atk = { startup: 0.07, active: 0.2, recovery: 0.24, dmg: 10, w: 80, h: 84, ox: 22, oy: -68, kb: { x: 320, y: -270 }, stun: 0.45, type: 'tagIn' };
        this.currentAttack = { ...atk, name: 'tagIn' };
        this.changeState('ATTACK');
        this.hasSpawnedHitbox = false;
        this.specialDone = false;
        this.vx = 820 * this.dir; // burst forward into the foe
        let col = { MAGE: '#c98bff', TELEPATH: '#9be3ff', DARK_RULER: '#ff0033', SWORDSMAN: '#cfe8ff', RANGER: '#ffd27f' }[this.charType] || '#fff';
        spawnParticles(this.x + this.dir * 18, this.y - 50, 16, col);
    }

    // Grave Grasp: spectral hands clamp us in place. Held until it lapses or we're struck.
    // Training dummy driver — performs the behavior chosen in the training panel.
    // Only acts from a neutral, grounded state so attacks/jumps/hitstun play out.
    updateDummy(dt) {
        let mode = (typeof dummyBehavior !== 'undefined') ? dummyBehavior : 'idle';
        if (mode === 'cpu') { this.handleAI(dt); return; } // "fight back" — full CPU
        let foe = this.getClosestEnemy();
        let neutral = (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'BLOCK');
        let grounded = this.y === GROUND_Y;

        if (mode === 'idle') {
            if (foe) this.dir = (foe.x > this.x) ? 1 : -1;
            if (this.state === 'BLOCK') this.changeState('IDLE');
            this.vx = 0;
        } else if (mode === 'center') {
            let target = WIDTH / 2;
            if (grounded && neutral && Math.abs(this.x - target) > 10) {
                let toward = Math.sign(target - this.x);
                this.vx = this.speed * toward; this.dir = toward; // face the way it's walking
                this.changeState('WALK');
            } else if (neutral) {
                this.vx = 0;
                if (foe) this.dir = (foe.x > this.x) ? 1 : -1; // settle facing the player
                this.changeState('IDLE');
            }
        } else if (mode === 'forward' && foe) {
            if (grounded && neutral) {
                let toward = Math.sign(foe.x - this.x) || 1;
                this.vx = this.speed * toward; this.dir = toward;
                this.changeState('WALK');
            }
        } else if (mode === 'backward' && foe) {
            if (grounded && neutral) {
                let away = -(Math.sign(foe.x - this.x) || 1);
                this.vx = this.speed * away; this.dir = -away; // retreat but keep facing the player
                this.changeState('WALK');
            }
        } else if (mode === 'jump') {
            if (foe) this.dir = (foe.x > this.x) ? 1 : -1;
            if (grounded && neutral) { this.vx = 0; this.vy = this.jumpForce; this.changeState('JUMP'); }
        } else if (mode === 'light') {
            if (foe) this.dir = (foe.x > this.x) ? 1 : -1;
            if (grounded && (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'BLOCK')) { this.vx = 0; this.startAttack('light'); }
        } else if (mode === 'heavy') {
            if (foe) this.dir = (foe.x > this.x) ? 1 : -1;
            if (grounded && (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'BLOCK')) { this.vx = 0; this.startAttack('heavy'); }
        } else if (mode === 'block') {
            if (foe) this.dir = (foe.x > this.x) ? 1 : -1;
            if (grounded && this.state !== 'BLOCK' && (this.state === 'IDLE' || this.state === 'WALK')) { this.vx = 0; this.changeState('BLOCK'); }
        }
    }

    // Colour of this fighter's guard — used by the block shield, its shatter shards,
    // and the block-break burst so each character's break matches their block.
    guardColor() {
        return { MAGE: '#c98bff', TELEPATH: '#9be3ff', DARK_RULER: '#ff0033', PHANTOM: '#dfe4f2', TRAVELER: '#6fd0ff' }[this.charType] || '#ffffff';
    }

    startRoot() {
        if (this.state === 'DEAD') return;
        this.rootTimer = 1.4;
        this.changeState('HITSTUN');
        this.stateTimer = 1.4;
        this.vx = 0; this.vy = 0; this.y = GROUND_Y;
        spawnParticles(this.x, GROUND_Y - 10, 16, '#cfd8ff');
    }

    // Grave Drag: the chain caught us — stunned and reeled all the way to the Phantom.
    startYank(source) {
        if (!source || this.state === 'DEAD') return;
        this.yankSource = source;
        this.yankTimer = 0.3;
        this.yankFromX = this.x;
        this.changeState('HITSTUN');
        this.stateTimer = 0.65; // stays stunned a beat after arriving
        this.vx = 0; this.vy = 0;
        spawnParticles(this.x, this.y - 50, 12, '#cfd8ff');
    }
    updateYank(dt) {
        let src = this.yankSource;
        if (!src || src.state === 'DEAD') { this.yankTimer = 0; this.yankSource = null; return; }
        this.yankTimer -= dt;
        let p = Math.max(0, Math.min(1, 1 - this.yankTimer / 0.3));
        let e = p * p * (3 - 2 * p);
        let destX = Math.max(40, Math.min(WIDTH - 40, src.x + src.dir * 52));
        this.x = this.yankFromX + (destX - this.yankFromX) * e;
        this.y = GROUND_Y; this.vx = 0; this.vy = 0;
        if (this.state !== 'HITSTUN') this.changeState('HITSTUN');
        if (this.stateTimer < 0.2) this.stateTimer = 0.2;
        if (this.yankTimer <= 0) this.yankSource = null;
    }

    // Phantom — Fading Veil: hold still and he fades intangible for a window; acting
    // (or the window ending) snaps him solid and starts a cooldown.
    updateFadingVeil(dt) {
        if (this.fadeCooldown > 0) this.fadeCooldown -= dt;
        let still = this.y >= GROUND_Y && Math.abs(this.vx) < 30 && this.invulnTimer <= 0 &&
                    (this.state === 'IDLE' || this.state === 'CROUCH');
        if (this._fadeIntangible) {
            this.fadeActive -= dt;
            if (!still || this.fadeActive <= 0) {
                this._fadeIntangible = false;
                this.fadeCooldown = 2.4;
                this.fadeCharge = 0;
                spawnParticles(this.x, this.y - 45, 8, '#bcc6e0');
            }
        } else if (still && this.fadeCooldown <= 0) {
            this.fadeCharge += dt;
            if (this.fadeCharge >= 0.4) {
                this._fadeIntangible = true;
                this.fadeActive = 1.1;
                spawnParticles(this.x, this.y - 45, 10, '#9aa6c8');
            }
        } else {
            this.fadeCharge = 0;
        }
    }

    drawBeastCompanion(ctx) {
        let beast = this.beastIndex || 0;
        let t = this.beastAnimTimer || this.animTimer;
        let flash = Math.max(0, this.beastSwapFlash || 0);
        let atk = this.state === 'ATTACK' ? this.currentAttack : null;
        let atkProgress = atk ? Math.max(0, Math.min(1, (this.stateTimer - atk.startup) / Math.max(0.01, atk.active))) : 0;
        let alpha = this.state === 'ULT' && this.ult && this.ult.kind === 'beaststorm' ? this.ult : null;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = flash > 0 ? 18 : 4;
        ctx.shadowColor = beast === 1 ? '#ff0033' : '#fff';
        if (alpha) {
            let bind = alpha.phase === 'alphaBind';
            let brute = alpha.phase === 'alphaBrute';
            let raven = alpha.phase === 'alphaRaven';
            let whip = alpha.phase === 'alphaWhip';
            // Serpent binding coil.
            ctx.strokeStyle = '#fff'; ctx.lineWidth = bind ? 5 : 3; ctx.shadowBlur = bind ? 18 : 8; ctx.shadowColor = '#fff';
            ctx.beginPath();
            for (let i = 0; i < 24; i++) {
                let u = i / 23;
                let x = 34 + u * 78;
                let y = -55 + Math.sin(u * Math.PI * 6 + t * 9) * (bind ? 15 : 9);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
            // Brute: the horned, tailed bruiser — parks aside, then smashes across on its phase.
            let bp = brute ? Math.min(1, alpha.t / 0.34) : 0;
            let smash = Math.sin(bp * Math.PI);
            let bx = brute ? -40 + smash * 150 : -64;
            let by = -44 - smash * 14;
            let bsh = by - 40, bhY = by - 58;
            ctx.strokeStyle = '#ddd'; ctx.lineWidth = brute ? 7 : 5; ctx.shadowBlur = brute ? 18 : 6; ctx.shadowColor = '#ff0033';
            ctx.fillStyle = 'rgba(8,8,8,0.7)';
            ctx.beginPath(); ctx.ellipse(bx, by - 18, 18, 23, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // belly
            ctx.fillStyle = '#070707';
            ctx.beginPath(); ctx.arc(bx, bhY, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();                // head
            ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 4;                                                  // horns
            ctx.beginPath();
            ctx.moveTo(bx - 9, bhY - 10); ctx.quadraticCurveTo(bx - 22, bhY - 21, bx - 13, bhY - 29);
            ctx.moveTo(bx + 9, bhY - 10); ctx.quadraticCurveTo(bx + 22, bhY - 21, bx + 13, bhY - 29);
            ctx.moveTo(bx - 14, by + 2); ctx.quadraticCurveTo(bx - 44, by + 6, bx - 40, by + 32);           // tail
            ctx.stroke();
            ctx.strokeStyle = '#ddd'; ctx.lineWidth = brute ? 8 : 6;
            ctx.beginPath();
            ctx.moveTo(bx + 6, bsh); ctx.lineTo(bx + 22 + bp * 28, bsh + 14); ctx.lineTo(bx + 30 + bp * 52, bsh + 20); // smash arm
            ctx.moveTo(bx - 6, bsh); ctx.lineTo(bx - 20, bsh + 16); ctx.lineTo(bx - 26, bsh + 30);
            ctx.moveTo(bx + 7, by + 2); ctx.lineTo(bx + 16 + bp * 20, by + 26); ctx.lineTo(bx + 22 + bp * 30, by + 48); // legs
            ctx.moveTo(bx - 7, by + 2); ctx.lineTo(bx - 18, by + 26); ctx.lineTo(bx - 24, by + 48);
            ctx.stroke();
            // Raven: the bird itself, swooping in on its phase.
            let rp = raven ? Math.min(1, alpha.t / 0.38) : 0;
            let rx = raven ? -80 + rp * 200 : -28 + Math.sin(t * 2.4) * 8;
            let ry = raven ? -120 + Math.sin(rp * Math.PI * 2) * 26 : -104;
            let rflap = Math.sin(t * 16) * 10;
            ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = raven ? 4 : 3; ctx.shadowBlur = raven ? 16 : 6; ctx.shadowColor = '#ff0033';
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath(); ctx.ellipse(rx, ry, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();         // body
            ctx.beginPath(); ctx.arc(rx + 9, ry - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();            // head
            ctx.beginPath(); ctx.moveTo(rx + 13, ry - 3); ctx.lineTo(rx + 20, ry - 1); ctx.lineTo(rx + 13, ry + 1); ctx.stroke(); // beak
            ctx.beginPath();                                                                                  // wings
            ctx.moveTo(rx - 2, ry - 2); ctx.quadraticCurveTo(rx - 22, ry - 14 - rflap, rx - 34, ry - 4 - rflap);
            ctx.moveTo(rx - 2, ry - 2); ctx.quadraticCurveTo(rx + 14, ry - 14 + rflap * 0.4, rx + 22, ry - 6 + rflap * 0.4);
            ctx.moveTo(rx - 8, ry + 2); ctx.lineTo(rx - 22, ry + 8);                                          // tail
            ctx.stroke();
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(rx + 9, ry - 3, 2, 0, Math.PI * 2); ctx.fill(); // eye
            if (whip) {
                ctx.strokeStyle = 'rgba(255,0,51,0.8)'; ctx.lineWidth = 5; ctx.shadowBlur = 20; ctx.shadowColor = '#ff0033';
                ctx.beginPath(); ctx.arc(48, -52, 86, -0.25, 0.45 + Math.min(1, alpha.t / 0.32) * 0.8); ctx.stroke();
            }
        } else if (beast === 0) {
            // Serpent: animated spine segments ripple around the Tamer.
            let attacking = atk && (atk.type === 'beastSerpentBite' || atk.type === 'beastSerpentSwing' || atk.type === 'beastSerpentVenom');
            let swinging = (atk && atk.type === 'beastSerpentSwing') || this.beastSnakeSwingTimer > 0;
            let swingP = swinging ? Math.max(0, Math.min(1, 1 - (this.beastSnakeSwingTimer || 0) / 0.9)) : 0;
            let segs = swinging ? 22 : 13;
            let pts = [];
            for (let i = 0; i < segs; i++) {
                let u = i / (segs - 1);
                let sweep = attacking ? atkProgress * 54 : 0;
                let angle = t * 4.2 + u * 4.9;
                let radius = attacking ? 22 + u * 42 : 38 + Math.sin(t * 2 + u * 5) * 5;
                let x = Math.cos(angle) * radius + sweep * u;
                let y = -54 + Math.sin(angle) * 18 + Math.sin(t * 8 + u * 10) * 5;
                if (swinging) {
                    // a long swing-rope arcing high ahead; it lengthens as the Tamer rides it
                    let reach = 160 + swingP * 250;
                    let archH = 120 + swingP * 70;
                    x = 4 + u * reach;
                    y = -66 - Math.sin(u * Math.PI) * archH + Math.sin(t * 12 + u * 9) * (3 + u * 4);
                }
                pts.push({ x, y });
            }
            ctx.strokeStyle = '#fff'; ctx.lineWidth = swinging ? 5 : 3;
            ctx.beginPath();
            pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.stroke();
            if (swinging) {
                // red kick-sweep at the lashing tip of the long snake
                let tip = pts[pts.length - 1];
                ctx.strokeStyle = 'rgba(255,0,51,0.6)'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(tip.x, tip.y, 16 + swingP * 34, -2.2, 0.5); ctx.stroke();
            }
            ctx.fillStyle = '#fff';
            pts.forEach((p, i) => {
                let size = 3.8 - i * 0.15;
                ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.6, size), 0, Math.PI * 2); ctx.fill();
            });
            let head = pts[0];
            ctx.fillStyle = '#ff0033';
            ctx.beginPath(); ctx.arc(head.x + 3, head.y - 1, 2.2 + flash, 0, Math.PI * 2); ctx.fill();
        } else if (beast === 1) {
            // Brute: a big, heavy, horned & tailed stickman standing just IN FRONT of the
            // Tamer (so its specials read as the Brute itself attacking). Fully articulated.
            let rushP  = atk && atk.type === 'beastBruteRush'  ? Math.sin(atkProgress * Math.PI) : 0;
            let upperP = atk && atk.type === 'beastBruteUpper' ? Math.sin(atkProgress * Math.PI) : 0;
            let stompP = atk && atk.type === 'beastBruteStomp' ? Math.sin(atkProgress * Math.PI) : 0;
            let sway = Math.sin(t * 1.8), breathe = Math.sin(t * 2.2) * 2;
            let bx = 36 + sway * 3 + rushP * 78;                 // a little ahead; lunges on rush
            let by = -46 - upperP * 22 + stompP * 14 + breathe * 0.4; // pelvis
            let shY = by - 46, hY = by - 66;                      // shoulders / head
            let lean = rushP * 0.5 + stompP * 0.3;               // pitches into hits
            let leanX = Math.sin(lean) * 12;

            // local two-bone limb (matches the main fighter rig: 0 = down, +ang toward facing)
            const limb = (x0, y0, ang, bend, l1, l2) => {
                let ua = ang + bend, la = ang - bend;
                let jx = x0 + Math.sin(ua) * l1, jy = y0 + Math.cos(ua) * l1;
                let ex2 = jx + Math.sin(la) * l2, ey2 = jy + Math.cos(la) * l2;
                ctx.moveTo(x0, y0); ctx.lineTo(jx, jy); ctx.lineTo(ex2, ey2);
                return { ex: ex2, ey: ey2 };
            };

            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.shadowColor = '#ff0033'; ctx.shadowBlur = 9 + flash * 8;

            // tail (curls out behind, swaying) with a spade tip
            ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(bx - 14, by + 4);
            ctx.quadraticCurveTo(bx - 56, by + 6 + Math.sin(t * 4) * 8, bx - 50, by + 38 + Math.sin(t * 4 + 1) * 5);
            ctx.stroke();
            ctx.fillStyle = '#ff0033';
            ctx.beginPath(); ctx.moveTo(bx - 50, by + 31); ctx.lineTo(bx - 58, by + 44); ctx.lineTo(bx - 43, by + 44); ctx.closePath(); ctx.fill();

            // legs (thick two-bone, planted wide; lead leg drives on rush, brace on stomp)
            ctx.strokeStyle = '#dcdcdc'; ctx.lineWidth = 9;
            ctx.beginPath();
            limb(bx + 8, by + 4, 0.34 + lean + rushP * 0.45, 0.45, 24, 28);
            limb(bx - 8, by + 4, -0.34 + rushP * 0.18, 0.45, 24, 28);
            ctx.stroke();

            // torso spine + rotund belly
            ctx.lineWidth = 9;
            ctx.beginPath(); ctx.moveTo(bx + leanX * 0.4, by); ctx.lineTo(bx + leanX, shY); ctx.stroke();
            ctx.lineWidth = 5; ctx.fillStyle = 'rgba(10,10,10,0.55)';
            ctx.beginPath(); ctx.ellipse(bx + 6 + leanX * 0.6, by - 22, 18 + breathe * 0.4, 23, lean, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            // arms (thick two-bone): rush punches forward, upper swings overhead, stomp slams down
            ctx.strokeStyle = '#dcdcdc'; ctx.lineWidth = 9;
            ctx.beginPath();
            let fAng = 1.5 + rushP * 0.45 + upperP * 1.35 - stompP * 1.15;
            let fBend = -0.55 + rushP * 0.4 + stompP * 0.15;
            let fArm = limb(bx + leanX, shY, fAng, fBend, 20, 22);
            let rAng = -0.5 + rushP * 0.2 + stompP * 0.5 - upperP * 0.3;
            let rArm = limb(bx + leanX, shY, rAng, 0.55, 20, 22);
            ctx.stroke();
            ctx.fillStyle = '#dcdcdc';
            ctx.beginPath(); ctx.arc(fArm.ex, fArm.ey, 6.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(rArm.ex, rArm.ey, 6.5, 0, Math.PI * 2); ctx.fill();

            // head + curved horns + glowing eye
            let hx = bx + leanX * 1.1;
            ctx.strokeStyle = '#dcdcdc'; ctx.lineWidth = 6; ctx.fillStyle = '#070707';
            ctx.beginPath(); ctx.arc(hx, hY, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(hx - 10, hY - 11); ctx.quadraticCurveTo(hx - 27, hY - 24, hx - 15, hY - 34);
            ctx.moveTo(hx + 10, hY - 11); ctx.quadraticCurveTo(hx + 27, hY - 24, hx + 15, hY - 34);
            ctx.stroke();
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(hx + 6, hY - 1, 2.6 + flash, 0, Math.PI * 2); ctx.fill();

            if (stompP > 0) {
                ctx.strokeStyle = 'rgba(255,0,51,0.75)'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(bx, by + 52, 18 + stompP * 64, 0.12, Math.PI - 0.12); ctx.stroke();
            }
        } else {
            // Raven: scout that carries the Tamer aloft (Up) or dives at the foe and snaps back (Side).
            let lift = atk && atk.type === 'beastRavenLift';
            let carrying = lift || this.beastRavenGlideTimer > 0;
            let dive = Math.max(0, this.beastRavenDiveTimer || 0);
            let flap = Math.sin(t * 16) * 10;

            let rx, ry;
            if (dive > 0) {
                // launch out to the foe and snap straight back (0 -> 1 -> 0)
                let prog = 1 - dive / 0.46;
                let out = prog < 0.5 ? prog * 2 : (1 - prog) * 2;
                let tx = (this._beastRavenDiveX != null) ? this._beastRavenDiveX : 150;
                let ty = (this._beastRavenDiveY != null) ? this._beastRavenDiveY : -92;
                rx = 6 + (tx - 6) * out;
                ry = -104 + (ty + 104) * out;
                ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; // dive streak
                ctx.beginPath(); ctx.moveTo(6, -104); ctx.lineTo(rx, ry); ctx.stroke();
            } else if (carrying) {
                rx = 4 + Math.sin(t * 3) * 3;          // hovering right above the Tamer's hand
                ry = -142 + Math.cos(t * 8) * 4;
            } else {
                rx = -28 + Math.sin(t * 2.6) * 12;     // perched scout near the shoulder
                ry = -100 + Math.cos(t * 3.1) * 7;
            }

            // talons gripping down to the Tamer's raised hand while carrying
            if (carrying) {
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(rx - 5, ry + 8); ctx.lineTo(6, -96); ctx.moveTo(rx + 5, ry + 8); ctx.lineTo(10, -94); ctx.stroke();
            }

            // ---- the bird (faces the Tamer's facing direction = +x) ----
            ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = carrying ? 4 : 3;
            ctx.shadowColor = '#ff0033'; ctx.shadowBlur = carrying ? 12 : 6;
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath(); ctx.ellipse(rx, ry, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();          // body
            ctx.beginPath(); ctx.arc(rx + 9, ry - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();             // head
            ctx.beginPath(); ctx.moveTo(rx + 13, ry - 3); ctx.lineTo(rx + 20, ry - 1); ctx.lineTo(rx + 13, ry + 1); ctx.stroke(); // beak
            ctx.beginPath();                                                                                    // flapping wings
            ctx.moveTo(rx - 2, ry - 2); ctx.quadraticCurveTo(rx - 22, ry - 14 - flap, rx - 34, ry - 4 - flap);
            ctx.moveTo(rx - 2, ry - 2); ctx.quadraticCurveTo(rx + 14, ry - 14 + flap * 0.4, rx + 22, ry - 6 + flap * 0.4);
            ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx - 8, ry + 2); ctx.lineTo(rx - 22, ry + 8); ctx.stroke();             // tail
            ctx.beginPath();                                                                                    // talons
            ctx.moveTo(rx - 3, ry + 6); ctx.lineTo(rx - 5, ry + (carrying ? 14 : 11));
            ctx.moveTo(rx + 3, ry + 6); ctx.lineTo(rx + 5, ry + (carrying ? 14 : 11)); ctx.stroke();
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(rx + 9, ry - 3, 2 + flash, 0, Math.PI * 2); ctx.fill(); // eye
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    draw(ctx) {
        if (this.state === 'DEAD' && this._overkilled) return;
        // Time Skip — edited out of the timeline for a beat: just a streak, no body
        if (this._skipHide > 0) {
            ctx.save();
            ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.6; ctx.shadowBlur = 12; ctx.shadowColor = '#6fd0ff';
            ctx.beginPath(); ctx.moveTo(this.x, this.y - 14); ctx.lineTo(this.x - this.dir * 26, this.y - 78); ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.save();
        // The Telepath never touches the floor — she hovers while grounded, including
        // through her attacks. Only crouching / being hit / hanging keeps her down.
        let hoverTarget = 0;
        if (this.charType === 'TELEPATH' && this.y >= GROUND_Y) {
            let ca = this.currentAttack;
            let crouchAttack = this.state === 'ATTACK' && ca &&
                (ca.type === 'lowLight' || ca.type === 'lowHeavy');
            let grounded = this.state === 'CROUCH' || crouchAttack ||
                this.state === 'HITSTUN' || this.state === 'BLOCKBREAK' ||
                this.state === 'LEDGE' || this.state === 'DEAD';
            if (!grounded) hoverTarget = 26 + Math.sin(this.animTimer * 2.4) * 3;
        }
        if (this.charType === 'PHANTOM' && this.y >= GROUND_Y) {
            // a gentle spectral drift; he settles when crouching / hit / hanging
            let grounded = this.state === 'CROUCH' || this.state === 'HITSTUN' ||
                this.state === 'BLOCKBREAK' || this.state === 'LEDGE' || this.state === 'DEAD';
            if (!grounded) hoverTarget = 11 + Math.sin(this.animTimer * 2.0) * 3;
        }
        this._hover = (this._hover || 0) + (hoverTarget - (this._hover || 0)) * 0.2;
        ctx.translate(this.x, this.y - this._hover);
        ctx.scale(this.dir, 1); // Flip based on direction
        if (this.charType === 'LUMATROSSIA') ctx.scale(1.55, 1.55); // the summoned demon towers over the arena
        if (this.tumbleTimer > 0) { ctx.translate(0, -42); ctx.rotate(this._tumbleAngle); ctx.translate(0, 42); } // post-ult floor tumble

        ctx.strokeStyle = '#fff';
        if (this.charType === 'LUMATROSSIA') ctx.strokeStyle = '#e8e8e8';
        if (this.charType === 'CULT') ctx.strokeStyle = '#cfcfcf';
        if (this.state === 'HITSTUN') ctx.strokeStyle = '#f55'; // Red flash on hit
        if (this.overkillRed) ctx.strokeStyle = '#ff0033';
        ctx.lineWidth = (this.charType === 'BRAWLER') ? 6 : (this.charType === 'DARK_RULER') ? 7 : (this.charType === 'TELEPATH') ? 3.5 : (this.charType === 'BEAST_TAMER') ? 4.5 : (this.charType === 'PHANTOM') ? 3.4 : (this.charType === 'LUMATROSSIA') ? 5 : 4; // bigger = thicker
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Phantom — spectral body: translucent and flickering, fainter when faded out.
        if (this.charType === 'PHANTOM' && this.state !== 'DEAD') {
            let flicker = 0.74 + Math.sin(this.animTimer * 13) * 0.06 + Math.sin(this.animTimer * 4.3) * 0.05;
            ctx.globalAlpha = this._fadeIntangible ? 0.3 : flicker;
            if (!this.overkillRed && this.state !== 'HITSTUN') ctx.strokeStyle = '#dfe4f2';
        }

        if (this.beastMarkedTimer > 0) {
            let pulse = 1 + Math.sin(this.animTimer * 10) * 0.12;
            ctx.save();
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#ff0033';
            ctx.strokeStyle = '#ff0033';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -58, 16 * pulse, -0.4, Math.PI * 2 - 0.4);
            ctx.moveTo(-12, -72); ctx.lineTo(12, -46);
            ctx.moveTo(12, -72); ctx.lineTo(-12, -46);
            ctx.stroke();
            ctx.restore();
        }
        if (this.burnTimer > 0) {
            ctx.save();
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#ff5a2a';
            ctx.fillStyle = 'rgba(255,90,42,0.85)';
            for (let i = 0; i < 5; i++) {
                let a = this.animTimer * 5 + i * 1.4;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 18, -44 + Math.sin(a * 1.3) * 24, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        if (this.venomTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.fillStyle = 'rgba(255,0,51,0.65)';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#fff';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                let a = this.animTimer * 4 + i * Math.PI * 0.5;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 16, -28 + Math.sin(a * 1.4) * 18, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }
        if (this.slowTimer > 0 && (this.slowFactor || 1) < 0.3) {
            ctx.save();
            ctx.strokeStyle = 'rgba(127,216,255,0.85)';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#7fd8ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, -42, 23, 42, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Procedural Animation Variables
        let t = this.animTimer;
        let headY = -75;
        let crouchDrop = 0; // how far the hips (and whole upper body) sink down
        let leftArmAngle = 0.5; let rightArmAngle = -0.5;
        let leftLegAngle = 0.2; let rightLegAngle = -0.2;
        let leftArmBend = 0.75; let rightArmBend = -0.75;
        let leftLegBend = -0.25; let rightLegBend = 0.25;
        let torsoLean = 0;
        let walkPhase = Math.sin(t * 12);
        let walkLift = Math.abs(walkPhase);
        let isWalkingForward = Math.sign(this.vx || this.dir) === this.dir;

        // Animation States mapping
        if (this.state === 'IDLE') {
            if (this.charType === 'BRAWLER') {
                let bounce = Math.sin(t * 9);
                headY += bounce * 3; // Fast boxer bounce
                leftArmAngle = -1.25 + Math.sin(t * 9) * 0.16;
                rightArmAngle = 1.18 + Math.cos(t * 9) * 0.14; // Fists up
                leftArmBend = 1.3; rightArmBend = -1.3;
                leftLegAngle = 0.52 + Math.sin(t * 4.5) * 0.06;
                rightLegAngle = -0.5 - Math.sin(t * 4.5) * 0.05;
                leftLegBend = -0.18; rightLegBend = 0.18;
                torsoLean = 0.12 + bounce * 0.02;
            } else if (this.charType === 'SWORDSMAN') {
                let breath = Math.sin(t * 2.6);
                headY += breath * 1; // Calm breathing
                leftArmAngle = -0.28 + breath * 0.04;
                rightArmAngle = -1.48 + Math.sin(t * 1.8) * 0.07; // Blade held composed
                leftArmBend = 0.45; rightArmBend = 0.9;
                leftLegAngle = 0.48; rightLegAngle = -0.44; // Wide low stance
                leftLegBend = -0.55; rightLegBend = 0.55;
                torsoLean = -0.03;
            } else if (this.charType === 'MAGE') {
                let hover = Math.sin(t * 3.8);
                headY += hover * 5 - 7; // Hovering slightly
                leftArmAngle = 0.62 + Math.sin(t * 2.3) * 0.18;
                rightArmAngle = -0.72 + Math.cos(t * 2.1) * 0.16;
                leftArmBend = -0.5 + hover * 0.15; rightArmBend = 0.45 - hover * 0.15;
                leftLegAngle = 0.08 + hover * 0.08;
                rightLegAngle = -0.16 - hover * 0.06; // Legs dangling
                leftLegBend = 0.45; rightLegBend = -0.35;
                torsoLean = Math.sin(t * 1.7) * 0.05;
            } else if (this.charType === 'RANGER') {
                let scan = Math.sin(t * 4.5);
                headY += scan * 1.8;
                leftArmAngle = 0.35 + Math.sin(t * 3) * 0.1;
                rightArmAngle = 1.38 + Math.cos(t * 2.4) * 0.12; // Knife/gun hand ready
                leftArmBend = 0.72; rightArmBend = -1.05;
                leftLegAngle = 0.26; rightLegAngle = -0.18;
                leftLegBend = -0.28; rightLegBend = 0.34;
                torsoLean = -0.08 + scan * 0.02;
            } else if (this.charType === 'TELEPATH') {
                // Levitating serenely: gentle hover, one hand poised at the temple,
                // the other drifting at her side. Legs hang relaxed (she floats).
                let hover = Math.sin(t * 2.4);
                let w1 = Math.sin(t * 2.1), w2 = Math.sin(t * 1.5 + 1.2); // hands weave telekinetically
                headY += -6 + hover * 4;                 // floats above the ground, bobbing
                rightArmAngle = 1.85 + w1 * 0.38; rightArmBend = -0.4 + w1 * 0.18;
                leftArmAngle = 0.75 + w2 * 0.4; leftArmBend = 0.35 + w2 * 0.18;
                leftLegAngle = -0.12 + hover * 0.05; rightLegAngle = 0.14 + hover * 0.05; // dangling
                leftLegBend = 0.1; rightLegBend = 0.14;
                torsoLean = Math.sin(t * 1.7) * 0.03;
            } else if (this.charType === 'BEAST_TAMER') {
                let command = Math.sin(t * 3.2);
                headY += command * 1.5;
                leftArmAngle = 1.15 + command * 0.14;
                rightArmAngle = -0.38 + Math.cos(t * 2.6) * 0.1;
                leftArmBend = -0.72; rightArmBend = 0.32;
                leftLegAngle = 0.34; rightLegAngle = -0.3;
                leftLegBend = -0.34; rightLegBend = 0.34;
                torsoLean = -0.04 + command * 0.02;
            } else if (this.charType === 'PHANTOM') {
                // Looming and weightless: hunched forward, long claws hanging open, drifting
                let drift = Math.sin(t * 2.0), reach = Math.sin(t * 1.3 + 0.6);
                headY += -3 + drift * 2;
                leftArmAngle = 1.35 + reach * 0.18; leftArmBend = 0.5 + reach * 0.12;   // claws splayed low
                rightArmAngle = -1.15 + Math.cos(t * 1.7) * 0.16; rightArmBend = -0.5;
                leftLegAngle = 0.12 + drift * 0.05; rightLegAngle = -0.16 - drift * 0.05; // legs trail, barely planted
                leftLegBend = 0.3; rightLegBend = -0.22;
                torsoLean = 0.12 + drift * 0.03;
            } else if (this.charType === 'ZOMBIE') {
                let sway = Math.sin(t * 1.9);
                headY += 11 + sway * 3; // Slouched
                leftArmAngle = 1.22 + sway * 0.13;
                rightArmAngle = 1.44 + Math.cos(t * 1.4) * 0.15; // Arms reaching limply
                leftArmBend = -0.35 + sway * 0.1; rightArmBend = 0.32 - sway * 0.1;
                leftLegAngle = 0.18 + sway * 0.08;
                rightLegAngle = -0.1 + Math.cos(t * 1.1) * 0.05;
                leftLegBend = -0.15; rightLegBend = 0.65;
                torsoLean = 0.34 + sway * 0.05; // Heavy forward lean
            } else if (this.charType === 'COPYCAT') {
                // Got a GROOVE to them — bopping to a beat: head bounces, arms swing
                // loose, shoulders roll. (the knee-bounce is added in the leg stance)
                let beat = Math.sin(t * 6), roll = Math.sin(t * 3);
                headY += beat * 4 - 1;
                leftArmAngle = 0.85 + Math.sin(t * 6 + 0.5) * 0.5;
                rightArmAngle = -0.85 + Math.sin(t * 6 - 0.5) * 0.5;
                leftArmBend = 0.85 + beat * 0.28; rightArmBend = -0.85 - beat * 0.28;
                torsoLean = roll * 0.07;
            } else if (this.charType === 'CULT') {
                if (this.isPreview) {
                    // character-select pose: a beckoning recruiter — one hand extended to
                    // welcome you to the flock, the other raised in a slow ritual sign
                    let sway = Math.sin(t * 1.5);
                    headY += sway * 2;
                    leftArmAngle = 1.5 + sway * 0.06; leftArmBend = 0.12;   // hand offered forward, palm up
                    rightArmAngle = 2.55 + Math.sin(t * 1.5 + 1) * 0.08; rightArmBend = -0.4; // ritual sign raised
                    leftLegAngle = -0.28; rightLegAngle = 0.3; leftLegBend = 0.32; rightLegBend = 0.3;
                    torsoLean = 0.05 + sway * 0.03;
                } else {
                    // ominous chant — hands clasped low in front, hood swaying to the ritual
                    let sway = Math.sin(t * 1.8), breath = Math.sin(t * 2.4);
                    headY += breath * 1.5;
                    leftArmAngle = 1.16 + sway * 0.05; leftArmBend = 0.72;   // hands meet in prayer
                    rightArmAngle = 1.0 - sway * 0.05; rightArmBend = 0.55;
                    torsoLean = 0.07 + sway * 0.03;
                }
            } else if (this.charType === 'LUMATROSSIA') {
                // a towering, heaving menace — slow breath, heavy claws hanging wide
                let breath = Math.sin(t * 1.6);
                headY += breath * 2;
                leftArmAngle = 0.66 + breath * 0.06; leftArmBend = 0.5;
                rightArmAngle = -0.66 - breath * 0.06; rightArmBend = -0.5;
                torsoLean = 0.04 + breath * 0.02;
            } else if (this.charType === 'TWINS') {
                if (this.isPreview) {
                    // character-select pose: a confident synchronized stance, forearms folded across
                    let bob = Math.sin(t * 2);
                    headY += bob * 1.5;
                    leftArmAngle = 1.55; leftArmBend = -1.25; rightArmAngle = 1.55; rightArmBend = 1.25; // crossed over the chest
                    leftLegAngle = -0.3; rightLegAngle = 0.32; leftLegBend = 0.32; rightLegBend = 0.3;
                    torsoLean = 0.02;
                } else {
                    // agile, alert bounce — light on the feet, fists loosely up and ready
                    let bounce = Math.sin(t * 6);
                    headY += bounce * 2.5;
                    leftArmAngle = -0.9 + bounce * 0.06; leftArmBend = 1.0;
                    rightArmAngle = 0.9 - bounce * 0.06; rightArmBend = -1.0;
                    torsoLean = 0.02;
                }
            } else if (this.charType === 'TRAVELER') {
                if (this.isPreview) {
                    // character-select pose: checking the holo-watch, utterly unbothered — he's
                    // already seen you pick him
                    let glance = Math.sin(t * 1.4);
                    headY += 2 + glance * 1;
                    rightArmAngle = 1.05; rightArmBend = 1.35;   // wrist raised to eye level, reading the time
                    leftArmAngle = -0.2; leftArmBend = 0.15;     // off-hand slack in a pocket-slouch
                    leftLegAngle = -0.38; rightLegAngle = 0.2;   // weight kicked back on the rear leg
                    leftLegBend = 0.2; rightLegBend = 0.55;
                    torsoLean = -0.06 + glance * 0.02;
                } else {
                    // relaxed future-cool idle — loose sway, one hand idly flicking the holo-watch
                    let sway = Math.sin(t * 2.2), flick = Math.sin(t * 1.1);
                    headY += sway * 1.5;
                    rightArmAngle = 0.85 + flick * 0.12; rightArmBend = 0.95;  // wrist drifting up toward a glance
                    leftArmAngle = -0.45 + sway * 0.05; leftArmBend = 0.35;    // off-arm loose at his side
                    torsoLean = -0.02 + sway * 0.02;
                }
            } else {
                headY += Math.sin(t * 5) * 2;
            }
        } else if (this.state === 'WIN') {
            // ---- VICTORY ANIMATIONS (unique per character) ----
            let wt = this.stateTimer;       // seconds into the celebration (one-shots)
            let pump = Math.sin(t * 8);     // looping flourish
            if (this.charType === 'BRAWLER') {
                // double-biceps flex, bouncing on the balls of the feet
                headY += -6 + Math.abs(pump) * 4;
                leftArmAngle = -1.5; rightArmAngle = 1.5;
                leftArmBend = 1.7 + pump * 0.12; rightArmBend = -1.7 - pump * 0.12; // flex pulse
                leftLegAngle = 0.5; rightLegAngle = -0.5;
                leftLegBend = -0.32; rightLegBend = 0.32;
                torsoLean = -0.04;
            } else if (this.charType === 'SWORDSMAN') {
                // a swift blade flourish that settles into a sword raised to the sky
                let flo = wt < 0.7 ? Math.sin(wt * 13) : 0;
                let raise = Math.min(1, Math.max(0, (wt - 0.6) / 0.5));
                rightArmAngle = -1.3 + flo * 1.3 - raise * 1.05; rightArmBend = 0.6 + flo * 0.4;
                leftArmAngle = 0.95; leftArmBend = 1.15; // free hand on hip
                leftLegAngle = 0.5; rightLegAngle = -0.46;
                leftLegBend = -0.55; rightLegBend = 0.55;
                torsoLean = -0.05 + flo * 0.05;
                headY += -2;
            } else if (this.charType === 'MAGE') {
                // ascend, robes adrift, arms thrown wide casting victory sparks
                let hover = Math.sin(t * 3);
                headY += -18 + hover * 4;
                leftArmAngle = 1.5 + Math.sin(t * 2) * 0.2; rightArmAngle = -1.5 - Math.sin(t * 2) * 0.2;
                leftArmBend = -0.3; rightArmBend = 0.3;
                leftLegAngle = 0.1 + hover * 0.06; rightLegAngle = -0.14 - hover * 0.05;
                leftLegBend = 0.4; rightLegBend = -0.3;
                torsoLean = Math.sin(t * 1.6) * 0.04;
            } else if (this.charType === 'RANGER') {
                // twirl the sidearm, then rest it cockily by the head
                if (wt < 0.8) { rightArmAngle = (t * 16) % (Math.PI * 2) - Math.PI; rightArmBend = -0.4; }
                else { rightArmAngle = 1.7 + Math.sin(t * 3) * 0.05; rightArmBend = -1.4; }
                leftArmAngle = 0.5; leftArmBend = 1.2;  // hand on hip
                leftLegAngle = 0.28; rightLegAngle = -0.2;
                leftLegBend = -0.3; rightLegBend = 0.34;
                torsoLean = -0.06; headY += Math.sin(t * 3) * 1.5;
            } else if (this.charType === 'DARK_RULER') {
                // hoist the greatsword overhead, dark power trembling off the blade
                let tremor = Math.sin(t * 18) * 0.03;
                headY += -3;
                rightArmAngle = -2.5 + tremor; rightArmBend = -0.5; // sword high
                leftArmAngle = 1.35; leftArmBend = 0.4;             // claw outstretched
                leftLegAngle = 0.52; rightLegAngle = -0.5;
                leftLegBend = -0.35; rightLegBend = 0.4;
                torsoLean = -0.12;
            } else if (this.charType === 'TELEPATH') {
                // serene ascension, arms spread, the mind unfurling
                let hover = Math.sin(t * 2.2);
                headY += -16 + hover * 4;
                leftArmAngle = 1.7 + Math.sin(t * 1.8) * 0.25; rightArmAngle = -1.7 - Math.sin(t * 1.8 + 1) * 0.25;
                leftArmBend = 0.2; rightArmBend = -0.2;
                leftLegAngle = -0.1 + hover * 0.05; rightLegAngle = 0.12 + hover * 0.05;
                leftLegBend = 0.12; rightLegBend = 0.14;
                torsoLean = Math.sin(t * 1.5) * 0.03;
            } else if (this.charType === 'BEAST_TAMER') {
                let flourish = Math.sin(t * 7);
                headY += -3 + Math.abs(flourish) * 2;
                leftArmAngle = 1.95 + flourish * 0.12; leftArmBend = -0.65;
                rightArmAngle = -1.1 + flourish * 0.25; rightArmBend = 0.35;
                leftLegAngle = 0.46; rightLegAngle = -0.38;
                leftLegBend = -0.42; rightLegBend = 0.38;
                torsoLean = -0.08;
            } else if (this.charType === 'PHANTOM') {
                // rises and spreads his claws wide, soul energy pouring off him
                let rise = Math.sin(t * 2.2);
                headY += -14 + rise * 4;
                leftArmAngle = 1.95 + Math.sin(t * 1.8) * 0.2; rightArmAngle = -1.95 - Math.sin(t * 1.8 + 1) * 0.2;
                leftArmBend = 0.35; rightArmBend = -0.35;
                leftLegAngle = 0.12 + rise * 0.05; rightLegAngle = -0.16 - rise * 0.05;
                leftLegBend = 0.2; rightLegBend = -0.18;
                torsoLean = Math.sin(t * 1.5) * 0.03;
            } else if (this.charType === 'CULT') {
                // both arms raised high to the heavens in triumphant worship, swaying
                let sway = Math.sin(t * 2.2);
                headY += -6 + sway * 2;               // head tilted back to the sky
                leftArmAngle = 2.9 + Math.sin(t * 2) * 0.12; rightArmAngle = 3.1 - Math.sin(t * 2 + 1) * 0.12;
                leftArmBend = -0.25; rightArmBend = 0.25;
                leftLegAngle = -0.3; rightLegAngle = 0.32; leftLegBend = 0.3; rightLegBend = 0.3;
                torsoLean = sway * 0.05;
            } else if (this.charType === 'LUMATROSSIA') {
                // throws its arms wide and high and roars, towering over the arena
                let roar = Math.sin(t * 5);
                headY += -4 + roar * 2;
                leftArmAngle = 2.2 + roar * 0.1; rightArmAngle = -2.2 - roar * 0.1; // flung wide & up
                leftArmBend = -0.4; rightArmBend = 0.4;
                leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.28; rightLegBend = 0.28; // wide planted
                torsoLean = -0.06;
            } else if (this.charType === 'TWINS') {
                // synchronized celebration — both twins throw an inner arm up to meet in a high-five, bouncing
                let hop = Math.abs(Math.sin(t * 6));
                headY += -4 + hop * 4;
                rightArmAngle = 2.45 + Math.sin(t * 4) * 0.08; rightArmBend = -0.3; // inner arm up toward the partner
                leftArmAngle = 0.6; leftArmBend = 1.2;                              // outer hand on hip
                leftLegAngle = 0.4; rightLegAngle = -0.4; leftLegBend = -0.3; rightLegBend = 0.3;
                torsoLean = 0.04;
            } else if (this.charType === 'TRAVELER') {
                // taps the holo-watch, then leans back smug with arms spread — "right on schedule"
                let wt2 = this.stateTimer;
                if (wt2 < 1.0) { // checking the time on the win
                    rightArmAngle = 1.05; rightArmBend = 1.35;  // wrist up to the visor
                    leftArmAngle = -0.3; leftArmBend = 0.2;
                    leftLegAngle = -0.36; rightLegAngle = 0.2; leftLegBend = 0.2; rightLegBend = 0.5;
                    torsoLean = -0.05; headY += 2;
                } else { // ...then the lean-back flourish
                    let st2 = Math.min(1, (wt2 - 1.0) / 0.4), drift = Math.sin(t * 2.4);
                    rightArmAngle = 1.05 + (-1.4 - 1.05) * st2 + drift * 0.05; rightArmBend = 1.35 + (0.3 - 1.35) * st2;
                    leftArmAngle = -0.3 + (1.4 + 0.3) * st2 - drift * 0.05; leftArmBend = 0.2 + (-0.3 - 0.2) * st2;
                    leftLegAngle = -0.42; rightLegAngle = 0.3; leftLegBend = 0.18; rightLegBend = 0.5;
                    torsoLean = -0.05 + (-0.2 + 0.05) * st2; headY += 2 + (-3 - 2) * st2;
                }
            } else {
                // generic triumphant cheer (Zombie etc.)
                headY += -4 + Math.abs(pump) * 3;
                leftArmAngle = -1.7; rightArmAngle = 1.7;
                leftArmBend = 0.6; rightArmBend = -0.6;
                leftLegAngle = 0.4; rightLegAngle = -0.4;
            }
        } else if (this.state === 'WALK') {
            if (this.charType === 'BRAWLER') {
                walkPhase = Math.sin(t * 17);
                walkLift = Math.abs(walkPhase);
                headY += walkLift * 5;
                if (isWalkingForward) {
                    leftLegAngle = walkPhase * 1.08; rightLegAngle = -walkPhase * 1.08;
                    leftArmAngle = -1.08 + walkPhase * 0.18; rightArmAngle = 1.08 - walkPhase * 0.16;
                    leftLegBend = -0.45 - walkLift * 0.25; rightLegBend = 0.45 + walkLift * 0.25;
                    leftArmBend = 1.2; rightArmBend = -1.2;
                    torsoLean = 0.24; // Aggressive pressure step
                } else {
                    leftLegAngle = -0.42 + walkPhase * 0.45; rightLegAngle = 0.18 - walkPhase * 0.42;
                    leftArmAngle = -1.36 + walkPhase * 0.08; rightArmAngle = 1.32 - walkPhase * 0.08;
                    leftLegBend = -0.25 - walkLift * 0.15; rightLegBend = 0.5 + walkLift * 0.12;
                    leftArmBend = 1.4; rightArmBend = -1.4;
                    torsoLean = -0.18; // Guarded retreat shuffle
                    headY += 2;
                }
            } else if (this.charType === 'SWORDSMAN') {
                walkPhase = Math.sin(t * 10);
                headY += 2 + Math.abs(walkPhase) * 1.2; // Keep low
                if (isWalkingForward) {
                    leftLegAngle = 0.18 + walkPhase * 0.72; rightLegAngle = -0.24 - walkPhase * 0.72;
                    leftArmAngle = -0.18 + walkPhase * 0.08; rightArmAngle = -1.36 - walkPhase * 0.1;
                    leftLegBend = -0.5 - walkLift * 0.18; rightLegBend = 0.48 + walkLift * 0.18;
                    leftArmBend = 0.45; rightArmBend = 0.8;
                    torsoLean = 0.09; // Measured duel advance
                } else {
                    leftLegAngle = 0.55 - walkPhase * 0.34; rightLegAngle = -0.62 + walkPhase * 0.34;
                    leftArmAngle = -0.46; rightArmAngle = -1.82 + walkPhase * 0.08;
                    leftLegBend = -0.7; rightLegBend = 0.68;
                    leftArmBend = 0.85; rightArmBend = 1.05;
                    torsoLean = -0.16; // Blade covers the retreat
                    headY += 1;
                }
            } else if (this.charType === 'MAGE') {
                walkPhase = Math.sin(t * 5.2);
                headY += walkPhase * 3 - 11; // Floating drift
                if (isWalkingForward) {
                    leftLegAngle = 0.28 + Math.sin(t * 3) * 0.08;
                    rightLegAngle = 0.48 + Math.cos(t * 3) * 0.08; // Legs trail behind
                    leftArmAngle = 0.76 + walkPhase * 0.16; rightArmAngle = -1.1 + walkPhase * 0.12;
                    leftArmBend = -0.35; rightArmBend = 0.5;
                    leftLegBend = 0.55; rightLegBend = 0.45;
                    torsoLean = 0.18;
                } else {
                    leftLegAngle = -0.22 + walkPhase * 0.08;
                    rightLegAngle = -0.38 - walkPhase * 0.08; // Knees tuck during backward float
                    leftArmAngle = -0.62 + walkPhase * 0.18; rightArmAngle = -0.2 + Math.cos(t * 4) * 0.12;
                    leftArmBend = 0.55; rightArmBend = -0.45;
                    leftLegBend = 0.95; rightLegBend = -0.85;
                    torsoLean = -0.22;
                    headY -= 2;
                }
            } else if (this.charType === 'RANGER') {
                walkPhase = Math.sin(t * 14);
                headY += Math.abs(walkPhase) * 3;
                if (isWalkingForward) {
                    leftLegAngle = walkPhase * 0.92; rightLegAngle = -walkPhase * 0.92;
                    leftArmAngle = 1.1 - walkPhase * 0.18; rightArmAngle = 1.52 + walkPhase * 0.1;
                    leftLegBend = -0.42 - walkLift * 0.22; rightLegBend = 0.42 + walkLift * 0.22;
                    leftArmBend = -0.75; rightArmBend = -1.1;
                    torsoLean = 0.12; // Tactical jog
                } else {
                    leftLegAngle = -0.54 + walkPhase * 0.5; rightLegAngle = 0.34 - walkPhase * 0.5;
                    leftArmAngle = 0.82 + walkPhase * 0.1; rightArmAngle = 1.9 - walkPhase * 0.1;
                    leftLegBend = -0.72; rightLegBend = 0.64;
                    leftArmBend = -0.95; rightArmBend = -1.35;
                    torsoLean = -0.24; // Crouched backpedal
                    headY += 4;
                }
            } else if (this.charType === 'ZOMBIE') {
                walkPhase = Math.sin(t * 6);
                headY += 13 + Math.abs(walkPhase) * 2; // Very slouched
                if (isWalkingForward) {
                    leftLegAngle = walkPhase * 0.6; // Slow shamble
                    rightLegAngle = -walkPhase * 0.3 - 0.22; // Dragging right leg
                    leftArmAngle = 1.5 + Math.sin(t * 3) * 0.14;
                    rightArmAngle = 1.3 + Math.cos(t * 3) * 0.14;
                    leftLegBend = -0.08; rightLegBend = 0.78;
                    leftArmBend = -0.25; rightArmBend = 0.25;
                    torsoLean = 0.42;
                } else {
                    leftLegAngle = -0.22 + walkPhase * 0.22; // Awkward stumble backward
                    rightLegAngle = -0.52 - walkPhase * 0.18;
                    leftArmAngle = 1.0 + Math.sin(t * 2.5) * 0.18;
                    rightArmAngle = 1.7 + Math.cos(t * 2.2) * 0.22;
                    leftLegBend = 0.25; rightLegBend = 0.95;
                    leftArmBend = 0.45; rightArmBend = -0.3;
                    torsoLean = 0.12 - walkPhase * 0.08;
                    headY += 5;
                }
            } else if (this.charType === 'TELEPATH') {
                // Glides forward, hands held poised (temple + drifting off-hand)
                let drift = Math.sin(t * 3);
                rightArmAngle = 2.0 + drift * 0.05; rightArmBend = -0.55; // fingers at the temple
                leftArmAngle = 0.7 + drift * 0.08; leftArmBend = 0.4;     // off-hand trailing
            } else if (this.charType === 'PHANTOM') {
                // glides forward, legs trailing weightlessly, claws leading
                let gd = Math.sin(t * 4);
                headY += gd * 2;
                if (isWalkingForward) {
                    leftLegAngle = 0.22 + Math.sin(t * 3) * 0.06; rightLegAngle = 0.42 + Math.cos(t * 3) * 0.06;
                    leftLegBend = 0.5; rightLegBend = 0.42;
                    leftArmAngle = 1.4 + gd * 0.1; rightArmAngle = -0.9 + gd * 0.1;
                    leftArmBend = 0.4; rightArmBend = -0.45; torsoLean = 0.16;
                } else {
                    leftLegAngle = -0.24 + gd * 0.06; rightLegAngle = -0.4 - gd * 0.06;
                    leftLegBend = 0.6; rightLegBend = -0.5;
                    leftArmAngle = 1.2; rightArmAngle = -0.7; leftArmBend = 0.3; rightArmBend = -0.4;
                    torsoLean = -0.12;
                }
            } else {
                headY += Math.abs(Math.sin(t * 12)) * 5;
            }
        } else if (this.state === 'CROUCH') {
            // Actually sink the whole body: hips drop, head drops with them, knees
            // fold deeply (set in the leg-stance block) so the feet stay planted.
            crouchDrop = 14;
            headY += crouchDrop;
            if (this.charType === 'BEAST_TAMER') {
                // Feral low crouch — lead hand planted forward like a beast, whip arm coiled
                leftArmAngle = 1.75; leftArmBend = -0.45;  // planted low & forward
                rightArmAngle = 2.45; rightArmBend = -0.7; // whip coiled by the shoulder
                torsoLean = 0.16;
            } else if (this.charType === 'COPYCAT') {
                // a cat hunkered to pounce — both paws planted low in front, tail-end up
                leftArmAngle = 1.65 + Math.sin(t * 4) * 0.04; leftArmBend = -0.35;  // paws down & forward
                rightArmAngle = 1.5 + Math.sin(t * 4 + 0.5) * 0.04; rightArmBend = 0.25;
                headY += 2; torsoLean = 0.2;
            } else if (this.charType === 'CULT') {
                // huddled low under the robe, hands tucked together
                leftArmAngle = 1.3; leftArmBend = 0.5; rightArmAngle = 1.15; rightArmBend = 0.4;
                torsoLean = 0.14;
            } else if (this.charType === 'LUMATROSSIA') {
                // a giant crouching low, fists gathered to erupt
                leftArmAngle = 1.4; leftArmBend = -0.7; rightArmAngle = 1.6; rightArmBend = -0.7;
                torsoLean = 0.18;
            } else if (this.charType === 'TWINS') {
                // a low coiled crouch, fists up and ready to spring
                leftArmAngle = 1.7; leftArmBend = -0.95; rightArmAngle = 1.85; rightArmBend = -0.95;
                torsoLean = 0.1;
            } else if (this.charType === 'TRAVELER') {
                // a sprinter's set position — one hand planted to the floor, visor up and scanning
                rightArmAngle = 1.45 + Math.sin(t * 3) * 0.03; rightArmBend = -0.15; // fingertips to the ground
                leftArmAngle = -0.85; leftArmBend = 0.65;                            // rear arm cocked behind
                headY -= 1; torsoLean = 0.24;
            } else {
                leftArmAngle = 2.2; rightArmAngle = 2.0; // compact ducked guard
                leftArmBend = -0.85; rightArmBend = -0.85;
                torsoLean = 0.06;
            }
        } else if (this.state === 'JUMP' || this.state === 'FALL') {
            // Each fighter leaps in their own style. `rise` > 0 going up.
            let rise = this.vy < 0;
            if (this.charType === 'BRAWLER') {
                // Knees tucked high, fists kept up in a guard — a compact boxer leap
                leftLegAngle = -0.2; rightLegAngle = 0.35; leftLegBend = 1.05; rightLegBend = 1.0;
                leftArmAngle = 2.45; rightArmAngle = 2.3; leftArmBend = -1.0; rightArmBend = -1.0;
                torsoLean = rise ? 0.12 : -0.06;
            } else if (this.charType === 'SWORDSMAN') {
                // Graceful — one leg extended, trailing leg tucked, blade arm swept back
                leftLegAngle = -0.55; rightLegAngle = 0.15; leftLegBend = 0.3; rightLegBend = 0.8;
                rightArmAngle = 2.0; rightArmBend = -0.3; // blade arm swept up/back
                leftArmAngle = -1.4; leftArmBend = 0.4;
                torsoLean = rise ? 0.16 : 0.04;
            } else if (this.charType === 'MAGE') {
                // Floats — barely tucked, arms drifting out, robe-light hover
                let hover = Math.sin(t * 5) * 0.06;
                leftLegAngle = -0.1 + hover; rightLegAngle = 0.18 + hover; leftLegBend = 0.3; rightLegBend = 0.35;
                leftArmAngle = -0.9; rightArmAngle = 0.9; leftArmBend = -0.4; rightArmBend = 0.4;
                headY -= 4; torsoLean = hover;
            } else if (this.charType === 'RANGER') {
                // Athletic — one knee driven up, other leg trailing, arms balanced/ready
                leftLegAngle = 0.5; rightLegAngle = -0.25; leftLegBend = 1.1; rightLegBend = 0.35;
                leftArmAngle = -1.9; rightArmAngle = 1.4; leftArmBend = 0.4; rightArmBend = -0.7;
                torsoLean = rise ? 0.1 : -0.08;
            } else if (this.charType === 'DARK_RULER') {
                // Heavy descent — legs splayed wide bracing for impact, greatsword
                // hauled up over the shoulder, hunched forward (a falling juggernaut)
                leftLegAngle = -0.55; rightLegAngle = 0.55; leftLegBend = 0.5; rightLegBend = 0.55;
                rightArmAngle = -2.5 + Math.sin(t * 4) * 0.05; rightArmBend = -0.5; // blade reared back over shoulder
                leftArmAngle = 1.3; leftArmBend = 0.4;                              // off-hand thrust out for balance
                headY += 2; torsoLean = rise ? 0.2 : 0.28;
            } else if (this.charType === 'TELEPATH') {
                // Serene levitation: arms spread gracefully, legs together and pointed,
                // body upright whether rising or gliding down.
                let f = Math.sin(t * 3) * 0.06;
                leftLegAngle = -0.06 + f; rightLegAngle = 0.1 + f; leftLegBend = 0.12; rightLegBend = 0.14;
                leftArmAngle = -1.0 + f; rightArmAngle = 1.0 - f; leftArmBend = -0.45; rightArmBend = 0.45; // arms out, palms down
                headY += rise ? -2 : 0; torsoLean = rise ? 0.04 : -0.02;
            } else if (this.charType === 'BEAST_TAMER' && this.beastSnakeSwingTimer > 0) {
                // Mid-swing across the arena: both hands grip the snake overhead, lead leg kicking out.
                let sw = Math.sin(t * 6) * 0.05;
                leftArmAngle = 2.7 + sw; leftArmBend = -0.3;
                rightArmAngle = 2.5 - sw; rightArmBend = -0.35;
                leftLegAngle = 0.18 + sw; rightLegAngle = 0.62 + sw;
                leftLegBend = 0.3; rightLegBend = 0.16;
                headY -= 2; torsoLean = 0.2;
            } else if (this.charType === 'BEAST_TAMER' && this.beastRavenGlideTimer > 0) {
                // Raven carry: one arm hooked upward, body hanging beneath the bird.
                let hang = Math.sin(t * 5) * 0.05;
                leftArmAngle = 2.95 + hang; leftArmBend = -0.18;
                rightArmAngle = 1.0 - hang; rightArmBend = 0.32;
                leftLegAngle = -0.08 + hang; rightLegAngle = 0.16 + hang;
                leftLegBend = 0.2; rightLegBend = 0.28;
                headY -= 3; torsoLean = -0.04;
            } else if (this.charType === 'BEAST_TAMER') {
                // Agile commander's leap — lead knee driven up, whip arm cocked, free hand flung out
                leftLegAngle = 0.44; rightLegAngle = -0.3; leftLegBend = 1.05; rightLegBend = 0.42;
                rightArmAngle = 2.3 + Math.sin(t * 5) * 0.05; rightArmBend = -0.6; // whip hand up & back
                leftArmAngle = -1.5; leftArmBend = 0.4;                            // off-hand flung out for balance
                headY += rise ? -2 : 1; torsoLean = rise ? 0.12 : -0.05;
            } else if (this.charType === 'COPYCAT') {
                // a springy cat-leap: knees tucked tight rising, paws reaching out to land
                if (rise) {
                    leftLegAngle = 0.3; rightLegAngle = -0.25; leftLegBend = 1.15; rightLegBend = 1.1; // tucked
                    leftArmAngle = 1.4; rightArmAngle = -1.4; leftArmBend = 0.9; rightArmBend = -0.9;  // paws drawn in
                    torsoLean = 0.14;
                } else {
                    leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.55; rightLegBend = 0.5;  // splay to land
                    leftArmAngle = 1.5; rightArmAngle = -1.5; leftArmBend = 0.3; rightArmBend = -0.3;  // paws reach down
                    torsoLean = -0.06;
                }
                headY += rise ? -2 : 2;
            } else if (this.charType === 'CULT') {
                // robe billows — legs tucked, arms spread as if borne aloft by the flock
                leftLegAngle = -0.2; rightLegAngle = 0.4; leftLegBend = 0.8; rightLegBend = 0.7;
                leftArmAngle = 2.5; rightArmAngle = -2.5; leftArmBend = -0.3; rightArmBend = 0.3; // arms flared out, robe-light
                headY += rise ? -3 : 1; torsoLean = rise ? -0.04 : 0.06;
            } else if (this.charType === 'LUMATROSSIA') {
                // a heavy leap — legs splayed bracing, claws hauled wide
                leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.5; rightLegBend = 0.55;
                leftArmAngle = 1.1; rightArmAngle = -1.1; leftArmBend = 0.4; rightArmBend = -0.4;
                headY += 2; torsoLean = rise ? 0.16 : 0.24;
            } else if (this.charType === 'TWINS') {
                // an acrobatic tuck rising, legs reaching out to land
                if (rise) {
                    leftLegAngle = 0.3; rightLegAngle = -0.25; leftLegBend = 1.05; rightLegBend = 1.0;
                    leftArmAngle = -1.4; rightArmAngle = 1.4; leftArmBend = 0.7; rightArmBend = -0.7;
                    torsoLean = 0.1;
                } else {
                    leftLegAngle = -0.45; rightLegAngle = 0.45; leftLegBend = 0.5; rightLegBend = 0.5;
                    leftArmAngle = -1.6; rightArmAngle = 1.6; leftArmBend = 0.4; rightArmBend = -0.4;
                    torsoLean = -0.04;
                }
                headY += rise ? -2 : 2;
            } else if (this.charType === 'TRAVELER') {
                // a smooth, almost lazy glide — like he's skipping the boring frames of the jump.
                // Rising: body straight, one arm trailing. Falling: settles upright, hands pocketed low.
                if (rise) {
                    leftLegAngle = -0.42; rightLegAngle = 0.3; leftLegBend = 0.25; rightLegBend = 0.85; // one leg trailing straight, one stepping
                    rightArmAngle = 1.35; rightArmBend = 0.3;   // lead hand reaching the apex he already knows
                    leftArmAngle = -1.1; leftArmBend = -0.25;   // trailing arm swept back
                    torsoLean = 0.14; headY -= 2;
                } else {
                    leftLegAngle = -0.18; rightLegAngle = 0.2; leftLegBend = 0.3; rightLegBend = 0.34;  // upright, unhurried descent
                    rightArmAngle = 0.5; rightArmBend = 0.5;
                    leftArmAngle = -0.5; leftArmBend = -0.5;    // both hands relaxed at his sides
                    torsoLean = 0.0; headY += 1;
                }
            } else {
                leftLegAngle = -0.32; rightLegAngle = 0.46; leftLegBend = 0.85; rightLegBend = 0.75;
                leftArmAngle = -2.5; rightArmAngle = 2.5; leftArmBend = 0.5; rightArmBend = -0.5;
            }
        } else if (this.state === 'BLOCK') {
            let brace = Math.sin(t * 18) * 0.04;
            headY += 8;
            if (this.charType === 'BEAST_TAMER') {
                // Brace behind a raised forearm, whip arm coiled low to retaliate
                leftArmAngle = 2.5 + brace; leftArmBend = -1.0;    // lead forearm shielding the face
                rightArmAngle = 1.5 - brace; rightArmBend = -0.5;  // whip hand low and ready
                leftLegAngle = -0.3; rightLegAngle = 0.4; leftLegBend = 0.5; rightLegBend = 0.5;
                torsoLean = -0.16;
            } else if (this.charType === 'SWORDSMAN') {
                // katana raised across the body as a parrying guard
                rightArmAngle = 1.95 - brace; rightArmBend = -0.45; // blade hand up & forward
                leftArmAngle = 2.25 + brace; leftArmBend = -0.7;    // off-hand braces the blade
                torsoLean = -0.06;
            } else if (this.charType === 'MAGE') {
                // one hand thrust forward casting a barrier, the other guards the face
                rightArmAngle = 1.5; rightArmBend = 0.12 + brace;   // palm out, conjuring
                leftArmAngle = 2.4; leftArmBend = -0.6;
                torsoLean = -0.05;
            } else if (this.charType === 'RANGER') {
                // crossed forearms, gun-hand braced across the body (no magic)
                rightArmAngle = 1.7 - brace; rightArmBend = -0.35;
                leftArmAngle = 2.0 + brace; leftArmBend = -0.85;
                torsoLean = -0.14;
            } else if (this.charType === 'DARK_RULER') {
                // an outstretched palm summons a wall of dark energy
                rightArmAngle = 1.55; rightArmBend = 0.08 + brace;
                leftArmAngle = 2.3; leftArmBend = -0.7;
                torsoLean = -0.04;
            } else if (this.charType === 'TELEPATH') {
                // both palms forward, projecting a psychic barrier as she hovers
                rightArmAngle = 1.5; rightArmBend = 0.15 + brace;
                leftArmAngle = 1.72; leftArmBend = 0.1 - brace;
                torsoLean = 0.0;
            } else if (this.charType === 'PHANTOM') {
                // arms drawn across the chest, shroud pulled forward like a veil
                leftArmAngle = 2.0 + brace; leftArmBend = -1.12;
                rightArmAngle = 2.5 - brace; rightArmBend = -1.12;
                torsoLean = -0.1;
            } else if (this.charType === 'COPYCAT') {
                // a hunched, hissing cat-guard — claws raised and crossed in front, ears low
                headY += 3;
                leftArmAngle = 1.85 + brace; leftArmBend = -1.05;   // forearms crossed up high
                rightArmAngle = 1.35 - brace; rightArmBend = -0.95;
                torsoLean = 0.16; // ducked forward and coiled
            } else if (this.charType === 'CULT') {
                // a warding ritual — one hand thrust up making a sign, the other clutched to
                // the chest, head bowed deep into the cowl (no boxer's guard here)
                headY += 9; // bow the head
                leftArmAngle = 2.75 + brace; leftArmBend = -0.35;  // warding hand raised high
                rightArmAngle = 1.25 - brace; rightArmBend = 0.55; // other clutched to the chest
                torsoLean = 0.2; // hunched forward over the ward
            } else if (this.charType === 'TWINS') {
                // a tight, synchronized boxer's cross-guard — lead forearm slashed across the
                // face, rear hand tucked guarding the body
                leftArmAngle = 1.9 + brace; leftArmBend = -1.15;
                rightArmAngle = 1.5 - brace; rightArmBend = -0.7;
                torsoLean = -0.06;
            } else if (this.charType === 'TRAVELER') {
                // one wrist held out projecting a clock-face barrier — body turned casually
                // side-on behind it, off-hand still slack (he barely respects the attack)
                rightArmAngle = 1.5; rightArmBend = 0.05 + brace;  // bracer arm extended, palm out
                leftArmAngle = -0.35; leftArmBend = 0.25;          // off-arm staying loose
                headY -= 1; torsoLean = -0.1;
            } else {
                // BRAWLER / default: both forearms raised high in front of the face (tight guard)
                leftArmAngle = 2.35 + brace; rightArmAngle = 2.58 - brace;
                leftArmBend = -0.95; rightArmBend = -0.95;
                torsoLean = -0.12;
            }
        } else if (this.state === 'HITSTUN') {
            headY += 5;
            leftArmAngle = -2; rightArmAngle = -2.5;
            leftArmBend = 0.5; rightArmBend = 0.35;
            // Legs stagger to catch the knockback, both knees forward
            leftLegAngle = -0.55; rightLegAngle = 0.35;
            leftLegBend = 0.4; rightLegBend = 0.55;
            ctx.rotate(-0.3); // lean back
        } else if (this.state === 'ATTACK') {
            let atk = this.currentAttack;
            let st = this.stateTimer;
            let s = atk.startup, a = atk.active, r = atk.recovery;
            let total = s + a + r;
            let p = st / total;
            // Strike curve: 0 = wound up, 1 = fully committed (impact), back to 0
            // through recovery. Smoothstepped for weight; the per-frame easing
            // layer further softens it.
            let ex = st < s ? (s > 0 ? st / s : 1)
                   : st < s + a ? 1
                   : Math.max(0, 1 - (st - s - a) / (r || 0.0001));
            ex = ex * ex * (3 - 2 * ex);
            let snap = Math.sin(Math.min(1, p) * Math.PI);
            const mix = (u, v, k) => u + (v - u) * k;

            let proj = atk.isProj;
            let gunShot  = proj && this.charType === 'RANGER';
            let castSpell = proj && this.charType === 'MAGE';
            let bladed = this.charType === 'SWORDSMAN' || (this.charType === 'DARK_RULER' && !proj) || (this.charType === 'RANGER' && !proj);

            // Default: planted lunge that drives into the strike, off-hand guarding.
            leftLegAngle = -0.42; leftLegBend = 0.32;
            rightLegAngle = mix(0.34, 0.52, ex); rightLegBend = 0.55;
            leftArmAngle = 2.25; leftArmBend = -0.95;
            torsoLean = 0.10 + ex * 0.10;

            if (atk.type === 'tagIn') {
                // Signature 2v2 entrance strike — unique per fighter.
                headY -= 2;
                if (this.charType === 'BRAWLER') {            // flying superman punch
                    rightArmAngle = mix(2.4, 1.3, ex); rightArmBend = mix(-0.7, -0.05, ex);
                    leftArmAngle = -1.3; leftArmBend = 0.5;
                    leftLegAngle = 0.5; rightLegAngle = -0.55; leftLegBend = 0.7; rightLegBend = 0.4;
                    torsoLean = 0.3;
                } else if (this.charType === 'SWORDSMAN') {   // dashing horizontal slash
                    rightArmAngle = mix(-0.5, 1.5, ex); rightArmBend = mix(-0.6, -0.1, ex);
                    leftArmAngle = 1.7; leftArmBend = 0.4;
                    leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.45; rightLegBend = 0.3;
                    torsoLean = mix(-0.1, 0.28, ex);
                } else if (this.charType === 'MAGE') {         // floats in, palm-out blast
                    rightArmAngle = mix(2.0, 1.4, ex); rightArmBend = mix(-0.5, 0.1, ex);
                    leftArmAngle = -1.0; leftArmBend = -0.3;
                    headY -= 8; leftLegAngle = 0.1; rightLegAngle = -0.16; leftLegBend = 0.4; rightLegBend = -0.3;
                    torsoLean = 0.12;
                } else if (this.charType === 'RANGER') {       // slide in low, gun thrust
                    rightArmAngle = mix(0.4, 1.45, ex); rightArmBend = -0.2;
                    leftArmAngle = 1.4; leftArmBend = -1.2;
                    leftLegAngle = -0.6; rightLegAngle = 0.7; leftLegBend = 0.7; rightLegBend = 0.5;
                    torsoLean = 0.06; headY += 4;
                } else if (this.charType === 'DARK_RULER') {   // overhead greatsword cleave
                    rightArmAngle = mix(-2.4, 0.3, ex); rightArmBend = -0.4;
                    leftArmAngle = 1.3; leftArmBend = 0.4;
                    leftLegAngle = -0.5; rightLegAngle = 0.55; leftLegBend = 0.5; rightLegBend = 0.45;
                    torsoLean = mix(-0.18, 0.3, ex);
                } else if (this.charType === 'TELEPATH') {     // glides in, double palm shove
                    rightArmAngle = mix(2.2, 1.55, ex); rightArmBend = -0.15;
                    leftArmAngle = mix(2.0, 1.4, ex); leftArmBend = 0.15;
                    headY -= 10; leftLegAngle = -0.05; rightLegAngle = 0.12; leftLegBend = 0.12; rightLegBend = 0.14;
                    torsoLean = 0.1;
                } else if (this.charType === 'BEAST_TAMER') {  // whip-crack lunge
                    rightArmAngle = mix(2.65, 1.1, ex); rightArmBend = mix(-0.7, -0.08, ex);
                    leftArmAngle = 1.4; leftArmBend = -0.65;
                    leftLegAngle = -0.45; rightLegAngle = 0.55; leftLegBend = 0.4; rightLegBend = 0.5;
                    torsoLean = mix(-0.16, 0.26, ex);
                } else {
                    rightArmAngle = mix(2.4, 1.3, ex); rightArmBend = -0.2; torsoLean = 0.25;
                }
            } else if (atk.type === 'soulSiphon') {
                // Soul Siphon — the long claw shoots dead-straight forward (horizontal)
                rightArmAngle = mix(2.2, 1.57, ex); rightArmBend = mix(-0.5, 0.0, ex);
                leftArmAngle = 1.5; leftArmBend = 0.4;
                leftLegAngle = -0.3; rightLegAngle = mix(0.2, 0.46, ex);
                leftLegBend = 0.3; rightLegBend = 0.42; torsoLean = mix(0.02, 0.1, ex);
                headY -= 1;
            } else if (atk.type === 'mistClaw' || atk.type === 'scytheLash' || atk.type === 'graveDrag') {
                // Phantom — a long spectral claw whips out forward
                rightArmAngle = mix(2.5, 1.12, ex); rightArmBend = mix(-0.7, 0.06, ex);
                leftArmAngle = 1.5; leftArmBend = 0.4;
                leftLegAngle = -0.3; rightLegAngle = mix(0.2, 0.5, ex);
                leftLegBend = 0.3; rightLegBend = 0.42; torsoLean = mix(0.02, 0.22, ex);
                headY -= 1;
            } else if (atk.type === 'graveGrasp') {
                // hunches low and slams both claws down — hands erupt from the floor
                rightArmAngle = mix(2.0, 0.45, ex); rightArmBend = -0.3;
                leftArmAngle = mix(-2.0, -0.45, ex); leftArmBend = 0.3;
                headY += 6;
                leftLegAngle = -0.4; rightLegAngle = 0.4; leftLegBend = 0.7; rightLegBend = 0.7;
                torsoLean = 0.18;
            } else if (atk.type === 'wraithRise') {
                // rising spectral grab — claws thrust overhead as he floats up
                rightArmAngle = mix(1.2, 3.1, ex); rightArmBend = mix(-0.4, -0.05, ex);
                leftArmAngle = mix(0.8, 2.7, ex); leftArmBend = -0.5;
                leftLegAngle = -0.15; rightLegAngle = 0.18; leftLegBend = 0.3; rightLegBend = 0.35;
                headY -= ex * 3; torsoLean = -0.06;
            } else if (atk.type === 'catDash') {
                // pouncing lunge — claws thrown forward, body stretched into the dash
                rightArmAngle = mix(2.2, 1.35, ex); rightArmBend = mix(-0.5, 0.1, ex);
                leftArmAngle = mix(2.0, 1.5, ex); leftArmBend = mix(0.4, 0.0, ex);
                leftLegAngle = -0.6; rightLegAngle = 0.55; leftLegBend = 0.4; rightLegBend = 0.5;
                torsoLean = mix(0.1, 0.4, ex); headY += 3;
            } else if (atk.type === 'pianoDrop') {
                // springs up and sweeps both arms down, conjuring the piano above the foe
                rightArmAngle = mix(3.0, 1.5, ex); rightArmBend = -0.2;
                leftArmAngle = mix(3.0, 1.6, ex); leftArmBend = 0.2;
                leftLegAngle = -0.2; rightLegAngle = 0.22; leftLegBend = 0.45; rightLegBend = 0.45;
                headY -= 2; torsoLean = -0.04;
            } else if (atk.type === 'agility') {
                // a low, coiled ready-stance as the counter-mark sets
                rightArmAngle = 1.7; rightArmBend = 0.3;
                leftArmAngle = 1.95; leftArmBend = 0.35;
                leftLegAngle = -0.4; rightLegAngle = 0.4; leftLegBend = 0.7; rightLegBend = 0.66;
                headY += 4; torsoLean = 0.08;
            } else if (atk.type === 'catClaw' || atk.type === 'catSlash' || atk.type === 'copyClaw') {
                // raking claw swipe
                rightArmAngle = mix(2.4, 1.2, ex); rightArmBend = mix(-0.55, 0.08, ex);
                leftArmAngle = 1.6; leftArmBend = 0.35;
                leftLegAngle = -0.3; rightLegAngle = mix(0.2, 0.5, ex); leftLegBend = 0.32; rightLegBend = 0.42;
                torsoLean = mix(0.04, 0.24, ex); headY -= 1;
            } else if (atk.type === 'twinJab') {
                // a crisp straight jab inward
                rightArmAngle = mix(2.0, 1.45, ex); rightArmBend = mix(-0.5, 0.08, ex);
                leftArmAngle = 1.9; leftArmBend = -0.8; // rear guard
                leftLegAngle = -0.3; rightLegAngle = mix(0.2, 0.46, ex); leftLegBend = 0.3; rightLegBend = 0.4;
                torsoLean = mix(0.04, 0.18, ex);
            } else if (atk.type === 'twinClap') {
                // a committed two-step swing
                rightArmAngle = mix(2.6, 1.2, ex); rightArmBend = mix(-0.8, 0.1, ex);
                leftArmAngle = mix(2.0, 1.5, ex); leftArmBend = -0.5;
                leftLegAngle = -0.4; rightLegAngle = mix(0.3, 0.58, ex); leftLegBend = 0.4; rightLegBend = 0.5;
                torsoLean = mix(0.05, 0.26, ex); headY -= 1;
            } else if (atk.type === 'crossover') {
                // a scissoring slash as the twins dash through each other
                rightArmAngle = mix(2.5, 1.0, ex); rightArmBend = mix(-0.4, 0.1, ex);
                leftArmAngle = mix(-1.0, 1.3, ex); leftArmBend = mix(0.4, -0.1, ex);
                leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.4; rightLegBend = 0.5;
                torsoLean = mix(0.0, 0.3, ex);
            } else if (atk.type === 'fastball') {
                // overhand throw — winds back and hurls the partner forward
                rightArmAngle = mix(2.7, 0.9, ex); rightArmBend = mix(-0.6, 0.1, ex);
                leftArmAngle = mix(1.0, 1.7, ex); leftArmBend = 0.3;
                leftLegAngle = -0.45; rightLegAngle = mix(0.3, 0.62, ex); leftLegBend = 0.4; rightLegBend = 0.5;
                torsoLean = mix(-0.1, 0.28, ex); headY -= ex * 2;
            } else if (atk.type === 'mirrorVolley') {
                // both palms thrust forward to loose the bolt inward
                rightArmAngle = mix(2.0, 1.5, ex); rightArmBend = 0.1;
                leftArmAngle = mix(1.7, 1.4, ex); leftArmBend = 0.15;
                leftLegAngle = -0.28; rightLegAngle = 0.34; leftLegBend = 0.32; rightLegBend = 0.36;
                torsoLean = 0.06; headY -= 1;
            } else if (atk.type === 'twinTether') {
                // crouch and plant the wire along the ground
                rightArmAngle = mix(1.6, 1.05, ex); rightArmBend = 0.3;
                leftArmAngle = mix(1.5, 1.1, ex); leftArmBend = 0.3;
                leftLegAngle = -0.34; rightLegAngle = 0.34; leftLegBend = 0.7; rightLegBend = 0.66;
                headY += 5; torsoLean = 0.14;
            } else if (atk.type === 'phaseJab') {
                // TWO jabs in one press — the arm teleports from a high strike to a low one
                // with the travel between them edited out; the body shunts forward on the snap
                let ph = ex < 0.12 ? -1 : ex < 0.55 ? 0 : 1; // windup keyframe → jab A → jab B
                if (ph === -1) {
                    rightArmAngle = 1.95; rightArmBend = -0.4;           // cocked
                    rightLegAngle = 0.16; torsoLean = 0.0;
                } else if (ph === 0) {
                    rightArmAngle = 1.7; rightArmBend = 0.02;            // high jab, at the chin
                    rightLegAngle = 0.32; torsoLean = 0.1; headY -= 1;
                } else {
                    rightArmAngle = 1.4; rightArmBend = 0.02;            // snapped to the low jab, at the ribs
                    rightLegAngle = 0.46; torsoLean = 0.16; headY += 1;
                }
                leftArmAngle = -0.4 + (ph > -1 ? 0.18 : 0); leftArmBend = 0.3; // off-hand slack — pure economy
                leftLegAngle = -0.32; leftLegBend = 0.26; rightLegBend = 0.36;
            } else if (atk.type === 'flashKick') {
                // the kick exists in exactly THREE frames — chamber, impact, follow-through —
                // a flipbook with the travel cut out
                let f = ex < 0.38 ? 0 : ex < 0.82 ? 1 : 2;
                rightLegAngle = [-0.3, 1.5, 1.95][f]; rightLegBend = [1.05, 0.08, 0.28][f];
                leftLegAngle = [-0.3, -0.36, -0.46][f]; leftLegBend = [0.34, 0.3, 0.42][f];
                rightArmAngle = [0.9, 0.32, 0.06][f]; rightArmBend = 0.4;
                leftArmAngle = [-0.9, -0.58, -0.36][f]; leftArmBend = -0.4;
                torsoLean = [-0.02, -0.2, -0.32][f]; headY += [0, 2, 4][f];
            } else if (atk.type === 'timeVortex') {
                // two hands wind a sphere of churning time, then shove it loose
                rightArmAngle = mix(1.1, 1.55, ex); rightArmBend = mix(0.6, 0.1, ex);
                leftArmAngle = mix(0.8, 1.4, ex); leftArmBend = mix(0.7, 0.15, ex);
                leftLegAngle = -0.34; rightLegAngle = 0.3; leftLegBend = 0.3; rightLegBend = 0.36;
                torsoLean = mix(-0.06, 0.1, ex); headY -= 1;
            } else if (atk.type === 'tachyonEcho') {
                // a wrist-cannon shot — arm levelled dead straight off the bracer
                rightArmAngle = mix(1.2, 1.57, ex); rightArmBend = 0.0;
                leftArmAngle = 1.05; leftArmBend = 1.3; // off-hand steadying the bracer wrist
                leftLegAngle = -0.4; rightLegAngle = 0.22; leftLegBend = 0.22; rightLegBend = 0.45;
                torsoLean = -0.04; headY -= 1;
            } else if (atk.type === 'rewind') {
                // a backwards hand-sweep, like wiping the last three seconds off a screen
                rightArmAngle = mix(1.6, 2.5, ex); rightArmBend = mix(0.1, -0.5, ex);
                leftArmAngle = -0.3; leftArmBend = 0.2;
                leftLegAngle = -0.3; rightLegAngle = 0.26; leftLegBend = 0.3; rightLegBend = 0.32;
                torsoLean = mix(0.02, -0.12, ex); headY -= 1;
            } else if (atk.type === 'uppercut') {
                // Crouch-load, then a rising fist straight overhead
                rightArmAngle = mix(1.5, 3.05, ex); rightArmBend = mix(-0.5, -0.05, ex);
                leftArmAngle  = mix(0.8, 2.6, ex);  leftArmBend  = -0.6;
                leftLegAngle = -0.25; rightLegAngle = 0.25;
                leftLegBend = mix(0.75, 0.15, ex); rightLegBend = mix(0.85, 0.2, ex);
                headY -= ex * 2; torsoLean = -0.05;
            } else if (atk.type === 'risingSlash' || atk.type === 'risingEdge') {
                // Rising sweep: blade carves a vertical half-circle, low-front up overhead
                rightArmAngle = mix(0.75, 3.2, ex); rightArmBend = mix(-0.18, -0.05, ex);
                leftArmAngle = 1.7; leftArmBend = 0.3;
                leftLegAngle = -0.3; rightLegAngle = 0.26; leftLegBend = 0.5; rightLegBend = 0.45;
                headY -= ex * 4; torsoLean = mix(0.08, -0.12, ex);
            } else if (atk.type === 'abyssalGrab') {
                // Dark Ruler grab: lunge with both arms thrown forward to seize the foe
                rightArmAngle = mix(2.2, 1.45, ex); rightArmBend = mix(-0.6, 0.2, ex);
                leftArmAngle  = mix(2.1, 1.5, ex);  leftArmBend  = mix(0.6, -0.2, ex);
                leftLegAngle = -0.45; rightLegAngle = mix(0.3, 0.6, ex); leftLegBend = 0.4; rightLegBend = 0.5;
                torsoLean = mix(-0.05, 0.28, ex); headY += 4;
            } else if (atk.type === 'darkBolt') {
                // Sorcery, not a swing: sword dropped low/back, off-hand thrust
                // forward palm-out to conjure and hurl the void orb.
                leftArmAngle = mix(1.9, 1.45, ex); leftArmBend = mix(-0.55, 0.1, ex); // casting hand drives forward
                rightArmAngle = -1.7; rightArmBend = -0.4;                            // greatsword held back, low
                leftLegAngle = -0.36; rightLegAngle = 0.42; leftLegBend = 0.44; rightLegBend = 0.44;
                headY -= 2; torsoLean = mix(-0.1, 0.14, ex);
            } else if (atk.type === 'haymaker') {
                // Deep wind-up of a single committed armored straight
                rightArmAngle = mix(2.55, 1.42, ex); rightArmBend = mix(-1.35, 0.05, ex);
                leftArmAngle = 2.25; leftArmBend = -0.95; // guard stays up
                leftLegAngle = -0.5; rightLegAngle = mix(0.3, 0.6, ex); rightLegBend = 0.5;
                torsoLean = mix(-0.12, 0.26, ex); // rock back then drive in
            } else if (atk.type === 'shoulderRush') {
                // Lowered shoulder, both arms tucked, charging forward
                leftArmAngle = 2.5; rightArmAngle = 2.6; leftArmBend = -1.1; rightArmBend = -1.1;
                leftLegAngle = mix(-0.2, -0.7, ex); rightLegAngle = mix(0.5, 0.2, ex);
                leftLegBend = 0.4; rightLegBend = 0.5;
                headY += 6; torsoLean = 0.34; // committed forward lean
            } else if (atk.type === 'updraftShot') {
                // Point the gun straight down and ride the blast upward
                rightArmAngle = mix(0.4, 0.05, ex); rightArmBend = 0.1; // aim down
                leftArmAngle = 2.0; leftArmBend = -0.6;
                leftLegAngle = -0.3; rightLegAngle = 0.35; leftLegBend = 0.7; rightLegBend = 0.65;
                torsoLean = -0.04;
            } else if (atk.type === 'combatRoll') {
                // Tuck into a forward roll
                let spin = ex * 1.4;
                leftArmAngle = 2.4; rightArmAngle = 2.5; leftArmBend = -1.2; rightArmBend = -1.2;
                leftLegAngle = -0.2; rightLegAngle = 0.4; leftLegBend = 1.1; rightLegBend = 1.1;
                headY += 16 * Math.sin(ex * Math.PI); // duck down through the roll
                torsoLean = 0.5 + spin;
            } else if (atk.type === 'blink') {
                // Hands thrown up as the body destabilizes into the teleport
                let v = Math.sin(Math.min(1, p) * Math.PI);
                leftArmAngle = 2.7; rightArmAngle = 2.7; leftArmBend = -0.7; rightArmBend = -0.7;
                leftLegAngle = -0.2; rightLegAngle = 0.2; leftLegBend = 0.5; rightLegBend = 0.5;
                headY -= 4 + v * 4; torsoLean = 0;
            } else if (atk.type === 'arcaneRoulette') {
                // Sweep both hands across the body to sling the random spell
                rightArmAngle = mix(2.4, 1.3, ex); rightArmBend = mix(-0.6, -0.1, ex);
                leftArmAngle  = mix(2.2, 1.5, ex); leftArmBend  = mix(-0.5, 0.1, ex);
                leftLegAngle = -0.3; rightLegAngle = 0.35; leftLegBend = 0.45; rightLegBend = 0.4;
                headY -= 3; torsoLean = mix(-0.08, 0.16, ex);
            } else if (atk.type === 'runeTrap') {
                // Kneel and press the rune into the ground
                crouchDrop = mix(0, 12, ex);
                rightArmAngle = mix(1.6, 1.1, ex); rightArmBend = mix(-0.5, 0.2, ex); // hand goes down to the floor
                leftArmAngle = 0.8; leftArmBend = 0.4;
                leftLegAngle = -0.45; rightLegAngle = 0.45; leftLegBend = 0.7; rightLegBend = 0.7;
                torsoLean = mix(0.05, 0.2, ex);
            } else if (atk.type === 'groundSlam') {
                // Raise overhead, then smash down to the ground
                rightArmAngle = mix(3.0, 1.45, ex); rightArmBend = mix(-0.4, -0.05, ex);
                leftArmAngle  = mix(3.0, 1.55, ex); leftArmBend  = mix(0.4, 0.05, ex);
                leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.5; rightLegBend = 0.5;
                headY += ex * 8; torsoLean = 0.05 + ex * 0.15;
            } else if (atk.type === 'darkNova') {
                // Two-handed plunge: drive the greatsword tip straight into the floor,
                // then erupt — a wide kneeling stance, both hands ramming down.
                rightArmAngle = mix(2.9, 1.55, ex); rightArmBend = mix(-0.3, 0.0, ex);
                leftArmAngle  = mix(2.9, 1.55, ex); leftArmBend  = mix(0.3, 0.0, ex);
                leftLegAngle = -0.62; rightLegAngle = 0.62;          // braced wide
                leftLegBend = mix(0.4, 0.95, ex); rightLegBend = mix(0.4, 0.95, ex);
                crouchDrop = ex * 16; headY += ex * 6; torsoLean = 0.05; // sinks down as he rams it in
            } else if (atk.type === 'parry') {
                // Sword raised in a steady two-hand defensive guard
                rightArmAngle = 2.45; rightArmBend = -0.45;
                leftArmAngle = 1.65;  leftArmBend = 0.35;
                torsoLean = -0.05;
            } else if (gunShot) {
                // Keep the pistol in the same hand and lower/straighten that arm into the shot.
                let recoil = snap * 0.18;
                leftArmAngle = 1.38 - recoil;
                leftArmBend = -0.08 - recoil * 0.25;
                rightArmAngle = 0.28;
                rightArmBend = -0.1;
                torsoLean = -0.08;
            } else if (castSpell) {
                // Push the staff hand forward to release the spell; legs float
                rightArmAngle = mix(2.0, 1.35, ex); rightArmBend = mix(-0.7, -0.1, ex);
                leftArmAngle  = mix(0.9, 0.6, ex);  leftArmBend  = 0.45;
                leftLegAngle = 0.1; rightLegAngle = 0.35; leftLegBend = 0.5; rightLegBend = 0.4;
                headY -= 3; torsoLean = mix(-0.05, 0.12, ex);
            } else if (this.charType === 'TELEPATH') {
                // Telekinetic gestures — she never physically swings; her hands project force.
                // Legs stay floaty (set lightly here; she rarely plants hard).
                leftLegAngle = -0.18; rightLegAngle = 0.2; leftLegBend = 0.25; rightLegBend = 0.25;
                if (atk.type === 'psiBarrier') {
                    // Both palms thrust forward, fingers spread, raising the barrier
                    rightArmAngle = 1.55; rightArmBend = 0.2; leftArmAngle = 1.62; leftArmBend = -0.2;
                    torsoLean = -0.06; headY -= 2;
                } else if (atk.type === 'psiLift') {
                    // Sweep an open palm skyward to hurl them up
                    rightArmAngle = mix(1.4, 3.0, ex); rightArmBend = mix(0.1, -0.1, ex);
                    leftArmAngle = 1.9; leftArmBend = -0.3; headY -= ex * 4; torsoLean = -0.06;
                } else if (atk.type === 'teleCrash') {
                    // Both palms drive downward (slamming them / the ground)
                    rightArmAngle = mix(2.9, 1.45, ex); rightArmBend = mix(-0.2, 0.15, ex);
                    leftArmAngle  = mix(2.9, 1.45, ex); leftArmBend  = mix(0.2, -0.15, ex);
                    headY += ex * 6; torsoLean = 0.06;
                } else if (atk.type === 'mindGrip') {
                    // Extend a clawing hand forward, fingers grasping the tether
                    rightArmAngle = mix(2.1, 1.45, ex); rightArmBend = mix(-0.3, 0.35, ex);
                    leftArmAngle = 2.0; leftArmBend = -0.45; // other hand at temple
                    torsoLean = mix(-0.04, 0.14, ex);
                } else if (atk.type === 'psyBlade' || atk.name === 'heavy') {
                    // A wide horizontal hand-sweep summoning the psy-blade arc
                    rightArmAngle = mix(2.4, 1.2, ex); rightArmBend = mix(-0.5, -0.2, ex);
                    leftArmAngle = 0.8; leftArmBend = 0.3; torsoLean = mix(0.16, -0.1, ex);
                } else {
                    // Light psiJab: a quick palm-thrust forward
                    rightArmAngle = mix(1.9, 1.45, ex); rightArmBend = mix(-0.2, 0.25, ex);
                    leftArmAngle = 0.8; leftArmBend = 0.3; torsoLean = mix(0.0, 0.1, ex);
                }
            } else if (this.charType === 'DARK_RULER') {
                let overhead = atk.name === 'heavy' || atk.combo === 'LLH' || atk.combo === 'HLL' || atk.combo === 'LHL';
                if (overhead) {
                    // HEAVY: a colossal two-handed overhead slam — reared straight up,
                    // crashing down to the ground as he drops his whole weight in.
                    rightArmAngle = mix(3.5, 0.8, ex); rightArmBend = mix(-0.3, 0.05, ex);
                    leftArmAngle  = mix(3.15, 1.0, ex); leftArmBend  = mix(0.35, -0.05, ex); // both hands on the hilt
                    leftLegAngle = -0.55; rightLegAngle = mix(0.28, 0.66, ex);
                    leftLegBend = 0.5; rightLegBend = mix(0.4, 0.78, ex);
                    headY += ex * 12; torsoLean = mix(-0.3, 0.46, ex); // big rear-load, then heave down
                } else {
                    // LIGHT: a fast one-handed HORIZONTAL cleave sweeping across the body,
                    // off-hand kept low — completely different shape from the overhead.
                    rightArmAngle = mix(2.25, 1.25, ex); rightArmBend = mix(-0.75, -0.5, ex); // stays near level
                    leftArmAngle = 0.7; leftArmBend = 0.35;
                    leftLegAngle = -0.42; rightLegAngle = 0.46; leftLegBend = 0.42; rightLegBend = 0.46;
                    torsoLean = mix(0.2, -0.14, ex); // torso whips around with the sweep
                }
            } else if (bladed) {
                // Slash family — each move has its own arc [windAng, strikeAng, windBend, strikeBend, lean]
                let k = [2.7, 1.05, -0.55, -0.12, 0.16];                  // default overhead diagonal
                if (atk.name === 'light')        k = [2.35, 1.25, -0.40, -0.10, 0.12]; // quick flick slash
                else if (atk.combo === 'LLL')    k = [2.85, 0.90, -0.50, -0.08, 0.24]; // strong downward finish
                else if (atk.combo === 'LH')     k = [2.20, 1.75, -0.75, -0.25, 0.20]; // horizontal cross-slash
                else if (atk.combo === 'LLH')    k = [1.55, 3.00, -0.30, -0.10,-0.06]; // rising upward slash
                else if (atk.combo === 'LHL')    k = [2.95, 1.00, -0.30, -0.05, 0.22]; // overhead chop
                else if (atk.combo === 'HLL')    k = [2.85, 1.10, -0.50, -0.10, 0.28]; // wide power slash
                else if (atk.name === 'heavy')   k = [2.95, 0.95, -0.45, -0.08, 0.26]; // big overhead
                else if (atk.type === 'dashSlash') k = [2.30, 1.45, -0.55, 0.00, 0.18]; // forward lunging thrust
                else if (atk.type === 'knifeRush') k = [2.55, 1.25, -0.50, -0.12, 0.22];// rapid stabs
                else if (atk.type === 'vacuumSlash') k = [2.65, 1.10, -0.60, -0.05, 0.26]; // big draw-cut
                rightArmAngle = mix(k[0], k[1], ex); rightArmBend = mix(k[2], k[3], ex);
                leftArmAngle  = mix(1.9, 1.2, ex);   leftArmBend  = 0.2;
                torsoLean = mix(-0.05, k[4], ex);
            } else {
                // Punch family — each move has its own throw [windAng, strikeAng, windBend, strikeBend, lean, headLift]
                let k = [2.3, 1.45, -1.15, 0.05, 0.18, 0];                // default straight
                if (atk.name === 'light')        k = [2.05, 1.55, -0.80, 0.05, 0.10, 0]; // fast jab
                else if (atk.combo === 'LLL')    k = [2.55, 1.42, -1.20, 0.00, 0.24, 0]; // hard straight finish
                else if (atk.combo === 'LH')     k = [2.80, 1.20, -0.55,-0.35, 0.32, 0]; // looping hook
                else if (atk.combo === 'LLH')    k = [1.40, 3.00, -0.50,-0.05,-0.05,-3]; // rising launcher
                else if (atk.combo === 'LHL')    k = [2.95, 1.10, -0.45, 0.00, 0.22, 0]; // overhead smash
                else if (atk.combo === 'HLL')    k = [2.60, 1.48, -1.10, 0.00, 0.30, 0]; // heavy finisher
                else if (atk.name === 'heavy')   k = [2.60, 1.40, -1.25, 0.00, 0.24, 0]; // big cross
                rightArmAngle = mix(k[0], k[1], ex); rightArmBend = mix(k[2], k[3], ex);
                torsoLean = mix(-0.04, k[4], ex); headY += k[5] * ex;
            }

            // Stance overrides for crouching / airborne strikes
            if (atk.type === 'lowLight' || atk.type === 'lowHeavy') {
                crouchDrop = 14; headY += crouchDrop; // strike from a real low crouch
                leftLegAngle = -0.5; rightLegAngle = 0.5; leftLegBend = 0.9; rightLegBend = 0.9;
                let big = atk.type === 'lowHeavy';
                rightArmAngle = mix(big ? 2.3 : 1.7, big ? 0.8 : 1.05, ex); // sweep vs quick poke
                rightArmBend = mix(-0.55, -0.05, ex);
                leftArmAngle = 1.4; leftArmBend = 0.3;
                torsoLean = -0.05;
            } else if (atk.type === 'airLight' || atk.type === 'airHeavy') {
                leftLegAngle = -0.35; rightLegAngle = 0.5; leftLegBend = 0.7; rightLegBend = 0.6;
                torsoLean = 0.2 + ex * 0.1;
            }

            // The Brawler's heavy is a front kick, not a punch
            if (atk.name === 'heavy' && this.charType === 'BRAWLER') {
                rightArmAngle = 2.2; rightArmBend = -0.9; // fists stay up to guard
                leftArmAngle = 2.3; leftArmBend = -0.9;
                rightLegAngle = mix(-0.4, 1.35, ex); rightLegBend = mix(1.1, 0.1, ex); // chamber then snap out
                leftLegAngle = -0.3; leftLegBend = 0.35;
                torsoLean = mix(-0.05, -0.18, ex);
            }
        } else if (this.state === 'BLOCKBREAK') {
            // Guard shattered — staggered, arms flung open, off balance
            headY -= 4; torsoLean = -0.32;
            leftArmAngle = -2.4; rightArmAngle = 2.4; leftArmBend = -0.3; rightArmBend = -0.3;
            leftLegAngle = -0.5; rightLegAngle = 0.4; leftLegBend = 0.4; rightLegBend = 0.5;
        } else if (this.state === 'ULT') {
            let u = this.ult || {};
            let dec = u.phase === 'declare';
            // planted base stance
            leftLegAngle = -0.32; rightLegAngle = 0.36; leftLegBend = 0.42; rightLegBend = 0.42;
            if (this.charType === 'BRAWLER') {
                if (u.phase === 'grab' || u.phase === 'slam') {
                    rightArmAngle = 1.45; rightArmBend = 0.05; leftArmAngle = 2.3; leftArmBend = -0.9; torsoLean = 0.26;
                } else { // counter stance, coiled
                    leftArmAngle = 2.4; rightArmAngle = 2.55; leftArmBend = -1.0; rightArmBend = -1.0;
                    torsoLean = 0.12 + Math.sin(t * 9) * 0.03;
                }
            } else if (this.charType === 'SWORDSMAN') {
                rightArmAngle = dec ? 2.65 : 1.05; rightArmBend = -0.2; leftArmAngle = 1.25; leftArmBend = 0.2;
                torsoLean = dec ? -0.05 : 0.2;
            } else if (this.charType === 'MAGE') {
                let spin = Math.sin(t * 18);
                rightArmAngle = 1.6 + spin * 0.6; rightArmBend = -0.3;
                leftArmAngle = 2.2 - spin * 0.4; leftArmBend = -0.4;
                headY -= 5; torsoLean = Math.sin(t * 6) * 0.06;
            } else if (this.charType === 'RANGER') {
                if (u.phase === 'execute') { // aiming straight down from above
                    rightArmAngle = 0.1; rightArmBend = 0.05; leftArmAngle = 2.0; leftArmBend = -0.5; torsoLean = 0;
                    leftLegAngle = -0.2; rightLegAngle = 0.4; leftLegBend = 0.7; rightLegBend = 0.7;
                } else {
                    rightArmAngle = dec ? 2.6 : 1.5; rightArmBend = -0.3; leftArmAngle = 2.0; leftArmBend = -0.5; torsoLean = 0.12;
                }
            } else if (this.charType === 'DARK_RULER') {
                if (dec) { // wind the greatsword way back overhead
                    rightArmAngle = 3.25; rightArmBend = -0.4; leftArmAngle = 3.0; leftArmBend = 0.4;
                    leftLegAngle = -0.5; rightLegAngle = 0.3; torsoLean = -0.22; headY -= 2;
                } else { // explosive two-handed downward cleave that hurls the slash
                    let sw = Math.min(1, u.t / 0.35);
                    rightArmAngle = 3.25 - sw * 2.2; rightArmBend = -0.1;
                    leftArmAngle = 3.0 - sw * 1.7; leftArmBend = -0.1;
                    leftLegAngle = -0.55; rightLegAngle = 0.6; leftLegBend = 0.45; rightLegBend = 0.5;
                    headY += sw * 6; torsoLean = -0.22 + sw * 0.55;
                }
            } else if (this.charType === 'TELEPATH') {
                if (u.phase === 'vice') { // one hand clenched toward the foe, fingers crushing
                    let q = Math.sin(t * 14) * 0.05;
                    rightArmAngle = 1.5 + q; rightArmBend = 0.3;   // clawed hand projecting the vice
                    leftArmAngle = 2.0; leftArmBend = -0.4;        // other hand to the temple
                    leftLegAngle = -0.2; rightLegAngle = 0.2; leftLegBend = 0.3; rightLegBend = 0.3;
                    headY -= 6; torsoLean = 0.06;
                } else { // fingers to the temple, reading them, before the snare
                    rightArmAngle = 2.05; rightArmBend = -0.5;     // hand at temple
                    leftArmAngle = dec ? 1.7 : 1.4; leftArmBend = -0.2;
                    leftLegAngle = -0.22; rightLegAngle = 0.22; leftLegBend = 0.3; rightLegBend = 0.3;
                    headY -= 4; torsoLean = -0.04;
                }
            } else if (this.charType === 'BEAST_TAMER') {
                if (dec || u.phase === 'snare') {
                    leftArmAngle = 1.95; leftArmBend = -0.7;
                    rightArmAngle = 2.35; rightArmBend = -0.75;
                    torsoLean = -0.08; headY -= 2;
                } else if (u.phase === 'alphaWhip') {
                    let crack = Math.min(1, u.t / 0.32);
                    rightArmAngle = 2.85 - crack * 1.8; rightArmBend = -0.7 + crack * 0.55;
                    leftArmAngle = 1.25; leftArmBend = -0.6;
                    rightLegAngle = 0.58; leftLegAngle = -0.44;
                    torsoLean = -0.18 + crack * 0.42;
                } else {
                    leftArmAngle = 1.7; leftArmBend = -0.75;
                    rightArmAngle = 1.2; rightArmBend = 0.1;
                    torsoLean = 0.12; headY -= 1;
                }
            } else if (this.charType === 'PHANTOM') {
                if (dec) { // claw drawn back, soul energy gathering
                    rightArmAngle = 2.5; rightArmBend = -0.6; leftArmAngle = 1.6; leftArmBend = -0.3;
                    torsoLean = -0.12; headY -= 2;
                } else if (u.phase === 'rush' || u.phase === 'seize' || u.phase === 'shatter') {
                    // stand upright and thrust ONE arm straight out to grab — held the whole time
                    rightArmAngle = 1.5; rightArmBend = 0.0;
                    leftArmAngle = 0.35; leftArmBend = 0.2;
                    leftLegAngle = -0.28; rightLegAngle = 0.32; leftLegBend = 0.3; rightLegBend = 0.34;
                    torsoLean = 0.02; headY -= 1;
                } else if (u.phase === 'smash') { // hurling them down into the new arena
                    let s = Math.min(1, (u.t || 0) / 0.32);
                    rightArmAngle = 1.0 + s; rightArmBend = 0.1; leftArmAngle = 2.0 - s * 0.6; leftArmBend = -0.3;
                    torsoLean = 0.1 + s * 0.3; headY += s * 4;
                } else { // void — arms outstretched, dragging the soul through space
                    rightArmAngle = 1.5 + Math.sin(t * 5) * 0.1; rightArmBend = 0.0;
                    leftArmAngle = 1.3; leftArmBend = -0.2; torsoLean = 0.15;
                }
            } else if (this.charType === 'COPYCAT') {
                // mimicking the stolen power — a generic dynamic casting stance
                if (dec) { rightArmAngle = 2.4; rightArmBend = -0.5; leftArmAngle = 1.7; leftArmBend = -0.2; torsoLean = -0.06; headY -= 2; }
                else {
                    rightArmAngle = 1.5 + Math.sin(t * 8) * 0.12; rightArmBend = 0.0;
                    leftArmAngle = 1.7; leftArmBend = 0.1;
                    leftLegAngle = -0.3; rightLegAngle = 0.34; leftLegBend = 0.34; rightLegBend = 0.36;
                    torsoLean = 0.1; headY -= 1;
                }
            } else if (this.charType === 'TRAVELER') {
                if (dec || u.phase === 'stance') {
                    // the come-on: weight back, one hand beckoning — swing at me, I dare you
                    let beck = Math.sin(t * 5);
                    rightArmAngle = 1.45; rightArmBend = 0.45 + beck * 0.18; // fingers curling "come here"
                    leftArmAngle = -0.4; leftArmBend = 0.2;
                    leftLegAngle = -0.46; rightLegAngle = 0.18; leftLegBend = 0.2; rightLegBend = 0.5;
                    torsoLean = -0.12; headY += 1;
                } else if (u.phase === 'dodges') {
                    // five distinct dodges, one per incoming swing
                    let d = u.dodgeIdx || 0;
                    if (d === 0) {        // duck low under it
                        headY += 16; torsoLean = 0.3;
                        leftLegAngle = -0.4; rightLegAngle = 0.4; leftLegBend = 0.95; rightLegBend = 0.9;
                        leftArmAngle = 1.8; leftArmBend = -0.8; rightArmAngle = 1.6; rightArmBend = -0.6;
                    } else if (d === 1) { // lean back, hands staying lazily down
                        headY += 2; torsoLean = -0.42;
                        leftLegAngle = -0.55; rightLegAngle = 0.4; leftLegBend = 0.2; rightLegBend = 0.6;
                        leftArmAngle = -0.5; leftArmBend = -0.2; rightArmAngle = 0.5; rightArmBend = 0.2;
                    } else if (d === 2) { // twist aside, arm sweeping the blow past
                        torsoLean = 0.18; headY += 3;
                        leftLegAngle = -0.2; rightLegAngle = 0.5; leftLegBend = 0.4; rightLegBend = 0.5;
                        rightArmAngle = 2.2; rightArmBend = -0.6; leftArmAngle = -0.7; leftArmBend = 0.3;
                    } else if (d === 3) { // the deep matrix-bend
                        headY += 6; torsoLean = -0.6;
                        leftLegAngle = -0.7; rightLegAngle = 0.5; leftLegBend = 0.35; rightLegBend = 0.75;
                        leftArmAngle = -1.3; leftArmBend = -0.3; rightArmAngle = -1.0; rightArmBend = 0.3;
                    } else {              // a neat little hop over the low swing
                        headY -= 6;
                        leftLegAngle = -0.2; rightLegAngle = 0.3; leftLegBend = 1.0; rightLegBend = 0.95;
                        leftArmAngle = -0.8; leftArmBend = 0.4; rightArmAngle = 0.8; rightArmBend = -0.4;
                        torsoLean = 0.05;
                    }
                } else if (u.phase === 'freeze') {
                    if ((u.hits || 0) === 0) { // the outstretched hand — TIME, STOP
                        rightArmAngle = 1.57; rightArmBend = 0.0;
                        leftArmAngle = -0.3; leftArmBend = 0.2;
                        leftLegAngle = -0.36; rightLegAngle = 0.24; leftLegBend = 0.26; rightLegBend = 0.4;
                        torsoLean = 0.06; headY -= 1;
                    } else if (u.strikeAlt) { // frozen flurry — alternating straight punch...
                        rightArmAngle = 1.5; rightArmBend = 0.05;
                        leftArmAngle = 1.9; leftArmBend = -0.8;
                        leftLegAngle = -0.4; rightLegAngle = 0.45; leftLegBend = 0.3; rightLegBend = 0.45;
                        torsoLean = 0.2;
                    } else {                  // ...and snapped side-kick
                        rightLegAngle = 1.45; rightLegBend = 0.1; leftLegAngle = -0.3; leftLegBend = 0.4;
                        rightArmAngle = 0.5; rightArmBend = 0.4; leftArmAngle = -1.0; leftArmBend = -0.3;
                        torsoLean = -0.16; headY += 2;
                    }
                } else if (u.phase === 'slide') {
                    // the low slide past — heel out front, fingertips skimming the floor
                    headY += 14; torsoLean = -0.34;
                    leftLegAngle = 1.2; leftLegBend = 0.08; rightLegAngle = -0.4; rightLegBend = 1.0;
                    rightArmAngle = 1.5; rightArmBend = -0.2; leftArmAngle = -1.2; leftArmBend = -0.2;
                } else if (u.phase === 'wave') {
                    // the dismissive hand-wave that lets all of it finally land
                    let wv = Math.min(1, u.t / 0.3);
                    rightArmAngle = 2.0 + Math.sin(wv * Math.PI) * 0.6; rightArmBend = -0.3;
                    leftArmAngle = -0.4; leftArmBend = 0.2;
                    leftLegAngle = -0.4; rightLegAngle = 0.2; leftLegBend = 0.22; rightLegBend = 0.45;
                    torsoLean = -0.08; headY += 1;
                }
            }
        } else if (this.state === 'LEDGE') {
            // Hanging from a stage lip. dir faces into the stage, so +x (local)
            // points toward the platform; hands reach up to grip the edge.
            let sway = Math.sin(t * 3) * 0.05;
            if (this.charType === 'BRAWLER') {
                // Two-fisted power grip, body hanging, legs swinging
                leftArmAngle = 2.62; rightArmAngle = 2.82; leftArmBend = -0.5; rightArmBend = -0.5;
                leftLegAngle = -0.12 + sway; rightLegAngle = 0.2 + sway; leftLegBend = 0.5; rightLegBend = 0.55;
                headY = -70; torsoLean = 0.05;
            } else if (this.charType === 'SWORDSMAN') {
                // Off-hand grips the lip; sword hand stays low and ready
                leftArmAngle = 2.74; leftArmBend = -0.45;
                rightArmAngle = 1.45; rightArmBend = -0.25;
                leftLegAngle = -0.1 + sway; rightLegAngle = 0.22 + sway; leftLegBend = 0.4; rightLegBend = 0.45;
                headY = -72; torsoLean = 0.03;
            } else if (this.charType === 'MAGE') {
                // Barely holding on, floating upright, legs limp
                let bob = Math.sin(t * 4) * 0.06;
                leftArmAngle = 2.82 + bob; rightArmAngle = 2.5 + bob; leftArmBend = -0.3; rightArmBend = -0.4;
                leftLegAngle = 0.05 + sway; rightLegAngle = 0.2 + sway; leftLegBend = 0.2; rightLegBend = 0.25;
                headY = -74 + bob * 4; torsoLean = 0;
            } else if (this.charType === 'RANGER') {
                // One hand grips; knife stays out; one boot braced on the wall
                leftArmAngle = 2.76; leftArmBend = -0.4;
                rightArmAngle = 1.7; rightArmBend = -0.5;
                leftLegAngle = 0.0 + sway; rightLegAngle = 0.5; leftLegBend = 0.4; rightLegBend = 0.85;
                headY = -72; torsoLean = 0.07;
            } else {
                leftArmAngle = 2.7; rightArmAngle = 2.7; leftArmBend = -0.4; rightArmBend = -0.4;
                leftLegAngle = 0.05 + sway; rightLegAngle = 0.2; leftLegBend = 0.3; rightLegBend = 0.3;
                headY = -72;
            }
        } else if (this.state === 'DEAD') {
            torsoLean = Math.PI / 2; // lie flat
            leftArmAngle = -0.5; rightArmAngle = 0.5;
            leftArmBend = 0.2; rightArmBend = -0.2;
            leftLegBend = -0.1; rightLegBend = 0.1;
        }

        if (this.state === 'ATTACK' && this.charType === 'BRAWLER') {
            ctx.lineWidth = 7; // heavier, weightier strikes
        }

        // --- LEG STANCE & GAIT (grounded, anatomically forward knees) ---
        // angle: 0 = straight down, +angle swings the foot toward the facing dir.
        // bend: POSITIVE pushes the knee toward the facing dir (forward = natural).
        // The rear (left) leg sits behind the body, the lead (right) leg ahead,
        // giving a staggered fighter stance with both feet under the torso.
        const rearStance  = { BRAWLER: -0.30, SWORDSMAN: -0.34, MAGE: -0.16, RANGER: -0.26, DARK_RULER: -0.40, TELEPATH: -0.12, BEAST_TAMER: -0.28, ZOMBIE: -0.20 };
        const leadStance  = { BRAWLER:  0.34, SWORDSMAN:  0.40, MAGE:  0.18, RANGER:  0.30, DARK_RULER:  0.44, TELEPATH:  0.14, BEAST_TAMER: 0.34, ZOMBIE:  0.16 };
        const rearAng = rearStance[this.charType] ?? -0.26;
        const leadAng = leadStance[this.charType] ?? 0.30;
        if (this.state === 'IDLE') {
            let breathe = Math.sin(t * 3) * 0.02;
            leftLegAngle = rearAng - breathe;
            rightLegAngle = leadAng + breathe;
            if (this.charType === 'TELEPATH') { leftLegBend = 0.3; rightLegBend = 0.6; leftLegAngle += 0.08; } // knees tucked as she floats, one bent more
            else if (this.charType === 'COPYCAT') {
                // bob the knees alternately to the beat — that's the groove
                let beat = Math.sin(t * 6);
                leftLegBend = 0.34 + Math.max(0, beat) * 0.26;
                rightLegBend = 0.30 + Math.max(0, -beat) * 0.26;
            }
            else if (this.charType === 'LUMATROSSIA') { // a wide, planted colossus stance
                leftLegAngle = rearAng - 0.16; rightLegAngle = leadAng + 0.16;
                leftLegBend = 0.26; rightLegBend = 0.26;
            }
            else { leftLegBend = 0.34; rightLegBend = 0.30; }
        } else if (this.state === 'BLOCK') {
            if (this.charType === 'COPYCAT') {
                // a low feral guard-crouch, weight coiled on the back leg
                leftLegAngle = rearAng - 0.2; rightLegAngle = leadAng + 0.26;
                leftLegBend = 0.7; rightLegBend = 0.62;
            } else if (this.charType === 'CULT') {
                // settled into a robed huddle
                leftLegAngle = rearAng - 0.08; rightLegAngle = leadAng + 0.06;
                leftLegBend = 0.56; rightLegBend = 0.5;
            } else {
                leftLegAngle = rearAng - 0.12;
                rightLegAngle = leadAng + 0.10;
                leftLegBend = 0.50; rightLegBend = 0.46;
            }
        } else if (this.state === 'CROUCH') {
            if (this.charType === 'COPYCAT') {
                // hunkered right down on all-four readiness, haunches gathered to pounce
                leftLegAngle = rearAng - 0.34; rightLegAngle = leadAng + 0.34;
                leftLegBend = 1.05; rightLegBend = 1.02;
            } else if (this.charType === 'CULT') {
                // sinks low beneath the robe
                leftLegAngle = rearAng - 0.18; rightLegAngle = leadAng + 0.18;
                leftLegBend = 0.92; rightLegBend = 0.9;
            } else {
                leftLegAngle = rearAng - 0.22;
                rightLegAngle = leadAng + 0.22;
                leftLegBend = 0.88; rightLegBend = 0.86; // deep fold, feet stay planted
            }
        } else if (this.state === 'WALK') {
            if (this.charType === 'TELEPATH') {
                // She doesn't walk — she glides, legs trailing the direction of travel
                let drift = Math.sin(t * 3);
                if (isWalkingForward) {
                    // gliding forward: legs sweep BACK behind her, softly bent
                    leftLegAngle = -0.34 + drift * 0.05; rightLegAngle = -0.2 + Math.cos(t * 3) * 0.05;
                    leftLegBend = 0.34; rightLegBend = 0.28;
                } else {
                    // gliding backward: legs sweep forward (already looked right)
                    leftLegAngle = 0.22 + drift * 0.05; rightLegAngle = 0.34 + Math.cos(t * 3) * 0.05;
                    leftLegBend = 0.22; rightLegBend = 0.2;
                }
                headY += drift * 3 - 4; torsoLean = isWalkingForward ? 0.12 : -0.1;
            } else if (this.charType === 'CULT') {
                // A gliding processional — tiny shuffling steps under the robe, the body
                // floating, and the hands kept clasped in the ritual posture while it moves.
                let glide = Math.sin(t * 5), bob = Math.sin(t * 2.5);
                leftLegAngle = -0.1 + glide * 0.1; rightLegAngle = 0.12 - glide * 0.1;
                leftLegBend = 0.32 + Math.max(0, glide) * 0.16; rightLegBend = 0.30 + Math.max(0, -glide) * 0.16;
                headY += bob * 2.5 - 2; torsoLean = isWalkingForward ? 0.05 : -0.03;
                leftArmAngle = 1.16; leftArmBend = 0.72;    // hands stay clasped, gliding forward
                rightArmAngle = 1.0; rightArmBend = 0.55;
            } else if (this.charType === 'TWINS') {
                // a nimble side-shuffle — quick light steps, fists loosely up and ready
                let step = Math.sin(t * 13);
                leftLegAngle = -0.06 + step * 0.4; rightLegAngle = -0.06 - step * 0.4;
                leftLegBend = 0.3 + Math.max(0, step) * 0.5; rightLegBend = 0.3 + Math.max(0, -step) * 0.5;
                headY += Math.abs(step) * 3;
                leftArmAngle = -0.85 + step * 0.1; rightArmAngle = 0.85 - step * 0.1;
                leftArmBend = 0.9; rightArmBend = -0.9;
                torsoLean = 0.03;
            } else if (this.charType === 'TRAVELER') {
                // STOP-MOTION stride — the legs animate in discrete time-sliced keyframes (no
                // smooth travel between them) while the body glides forward, like a man
                // rendered at five frames a second. One hand keeps the holo-watch raised
                // mid-stroll: he's pacing himself against a schedule only he can see.
                let stride = Math.round(Math.sin(t * 9) * 2) / 2; // quantised: snaps between 5 leg keyframes
                leftLegAngle = -0.05 + stride * 0.5; rightLegAngle = -0.05 - stride * 0.5;
                leftLegBend = 0.26 + Math.max(0, stride) * 0.48; rightLegBend = 0.26 + Math.max(0, -stride) * 0.48;
                // zero bob — the upper body floats dead level over the flickbook legs
                rightArmAngle = 1.05 + stride * 0.04; rightArmBend = 1.35;   // watch held up at eye level
                leftArmAngle = -0.5 + stride * 0.3; leftArmBend = -0.4;      // off arm swings in the same chopped frames
                torsoLean = isWalkingForward ? 0.08 : -0.05;
            } else {
                // Alternating gait: the two legs swing in OPPOSITE phase around a
                // near-vertical centre, and each knee bends as that foot lifts/swings.
                let heavy = this.charType === 'DARK_RULER' || this.charType === 'LUMATROSSIA';
                let cadence = this.charType === 'ZOMBIE' ? 6 : this.charType === 'MAGE' ? 7
                            : this.charType === 'LUMATROSSIA' ? 5.5 : heavy ? 7.5 : 12;
                let phase = Math.sin(t * cadence);
                let swing = phase * (heavy ? 0.66 : 0.5);
                let liftL = Math.max(0, phase);            // left foot in swing phase
                let liftR = Math.max(0, -phase);           // right foot in swing phase
                leftLegAngle = -0.04 + swing;
                rightLegAngle = -0.04 - swing;
                leftLegBend = 0.30 + liftL * (heavy ? 0.78 : 0.55);
                rightLegBend = 0.30 + liftR * (heavy ? 0.78 : 0.55);
                if (heavy) { headY += Math.abs(phase) * 9; torsoLean = 0.17; }   // lumbering trudge
            }
        }

        if (this.stageSeat && this.charType === 'DARK_RULER') {
            let breathe = Math.sin(t * 1.4) * 0.025;
            headY = -80 + Math.sin(t * 1.8) * 1.2;
            crouchDrop = 15;
            torsoLean = -0.03 + breathe;
            leftArmAngle = 1.1; leftArmBend = 0.3;       // hand resting on throne arm
            rightArmAngle = 2.05; rightArmBend = -0.55;  // forearm draped down to the planted sword
            leftLegAngle = -1.72; rightLegAngle = 1.72;  // legs spread wide, seated on the throne
            leftLegBend = 0.28; rightLegBend = 0.28;
        }

        // --- ARM CARRIAGE & SWING (natural fighter's guard) ---
        // Like the legs, the hand position is set by the angle and the elbow is
        // bowed by the bend. Hands ride up and forward with the elbows hanging
        // BELOW them (both bends the same sign, never mirrored), so the arms
        // read as a ready guard instead of a T-pose. The Mage (casting) and
        // Zombie (reaching) keep their own characterful arm poses.
        const meleeGuard = this.charType === 'BRAWLER' || this.charType === 'SWORDSMAN' || this.charType === 'RANGER' || this.charType === 'DARK_RULER' || this.charType === 'BEAST_TAMER';
        if (meleeGuard && !this.stageSeat && (this.state === 'IDLE' || this.state === 'WALK')) {
            // Each fighter carries their arms differently. Hands ride up/forward
            // with elbows bowing below (consistent direction), but the height,
            // symmetry and rhythm are unique per character.
            let armSwing = (this.state === 'WALK') ? Math.sin(t * 12) * 0.18 : 0;
            if (this.charType === 'BRAWLER') {
                // High, tight peek-a-boo boxer guard: fists up by the face, elbows
                // folded forward and down, with a quick bob.
                let b = Math.sin(t * 9) * 0.05;
                leftArmAngle  = 2.25 + b - armSwing;
                rightArmAngle = 2.12 + b + armSwing;
                leftArmBend  = -1.05; rightArmBend = -1.05;
            } else if (this.charType === 'SWORDSMAN') {
                // Both hands together on the hilt, blade held at a low ready angle.
                // (No opposite swing so the hands stay joined on the grip.)
                let s = Math.sin(t * 2.6) * 0.03;
                rightArmAngle = 1.05 + s; rightArmBend = -0.15; // lead hand, drives the blade
                leftArmAngle  = 0.95 + s; leftArmBend  =  0.15; // off-hand on the pommel
            } else if (this.charType === 'RANGER') {
                // Gun arm (left): upper arm down, forearm up -> pistol held high.
                // Knife arm (right): hangs straight down.
                let r = Math.sin(t * 4.5) * 0.04;
                leftArmAngle  = 1.50 + r;  leftArmBend  = -1.45;
                rightArmAngle = 0.12 + r;  rightArmBend = -0.05;
            } else if (this.charType === 'DARK_RULER') {
                // Greatsword hoisted to rest over the shoulder — slow, menacing sway
                let s = Math.sin(t * 1.9) * 0.05;
                rightArmAngle = -2.42 + s; rightArmBend = -0.55; // hand by the shoulder, blade up & back
                leftArmAngle  = 0.7 + s;   leftArmBend  = 0.4;   // off-hand relaxed at the side
            } else if (this.charType === 'BEAST_TAMER') {
                let c = Math.sin(t * 3.2) * 0.08;
                leftArmAngle = 1.32 + c - armSwing * 0.4; leftArmBend = -0.75;
                rightArmAngle = -0.18 + c + armSwing * 0.25; rightArmBend = 0.38;
            }
        }

        // Dark Ruler grab-and-throw: grip the foe, then heave them away
        if (this.throwHold) {
            if (this.throwHold.t < 0.32) { // clamped grip, holding them out front
                rightArmAngle = 1.5; rightArmBend = 0.1;
                leftArmAngle = 1.45; leftArmBend = -0.1;
                leftLegAngle = -0.4; rightLegAngle = 0.42; leftLegBend = 0.45; rightLegBend = 0.45;
                torsoLean = 0.08; headY += 2;
            } else { // explosive release, arms hurled across
                rightArmAngle = 2.5; rightArmBend = -0.4;
                leftArmAngle = 2.55; leftArmBend = -0.4;
                torsoLean = -0.2; headY += 2;
            }
        }

        // Frame-to-frame easing: blend each limb value toward its target so the
        // attack keyframes (and state changes) read as fluid motion instead of
        // snapping. Hit/death reactions ease faster so they still feel sharp.
        if (!this.pose) {
            this.pose = { la:leftArmAngle, ra:rightArmAngle, lab:leftArmBend, rab:rightArmBend,
                          ll:leftLegAngle, rl:rightLegAngle, llb:leftLegBend, rlb:rightLegBend,
                          hy:headY, tl:torsoLean, cd:crouchDrop };
        }
        let sm = this.state === 'ATTACK' ? 0.7                              // snappy strikes
               : (this.state === 'HITSTUN' || this.state === 'DEAD') ? 0.55
               : 0.4;
        let P = this.pose;
        P.la  += (leftArmAngle  - P.la)  * sm; leftArmAngle  = P.la;
        P.ra  += (rightArmAngle - P.ra)  * sm; rightArmAngle = P.ra;
        P.lab += (leftArmBend   - P.lab) * sm; leftArmBend   = P.lab;
        P.rab += (rightArmBend  - P.rab) * sm; rightArmBend  = P.rab;
        P.ll  += (leftLegAngle  - P.ll)  * sm; leftLegAngle  = P.ll;
        P.rl  += (rightLegAngle - P.rl)  * sm; rightLegAngle = P.rl;
        P.llb += (leftLegBend   - P.llb) * sm; leftLegBend   = P.llb;
        P.rlb += (rightLegBend  - P.rlb) * sm; rightLegBend  = P.rlb;
        P.hy  += (headY - P.hy) * sm; headY = P.hy;
        P.tl  += (torsoLean - P.tl) * sm; torsoLean = P.tl;
        P.cd  += (crouchDrop - P.cd) * sm; crouchDrop = P.cd;
        ctx.rotate(torsoLean);

        if (this.charType === 'BEAST_TAMER') this.drawBeastCompanion(ctx);

        // --- DRAWING ---
        ctx.beginPath();
        
        // Torso (neck below the head, hips sink when crouching)
        let neckY = headY + 12;
        let pelvisY = -35 + crouchDrop;
        ctx.moveTo(0, neckY);
        ctx.lineTo(0, pelvisY);

        // Two-bone limb with real, fixed-length bones. `angle` is the overall
        // reach direction (0 = straight down, +angle = toward the facing side),
        // `bend` flexes the joint: the upper bone rotates by +bend and the lower
        // by -bend, so a positive bend points the knee/elbow toward the facing
        // direction (anatomically forward) and lets the limb truly fold.
        function limbEnd(startX, startY, angle, bend, upperLen, lowerLen) {
            let ua = angle + bend; // upper bone (shoulder/hip -> joint)
            let la = angle - bend; // lower bone (joint -> hand/foot)
            let jointX = startX + Math.sin(ua) * upperLen;
            let jointY = startY + Math.cos(ua) * upperLen;
            let endX = jointX + Math.sin(la) * lowerLen;
            let endY = jointY + Math.cos(la) * lowerLen;
            return { jointX, jointY, endX, endY };
        }
        function drawBentLimb(startX, startY, angle, bend, upperLen, lowerLen) {
            let limb = limbEnd(startX, startY, angle, bend, upperLen, lowerLen);
            ctx.moveTo(startX, startY);
            ctx.lineTo(limb.jointX, limb.jointY);
            ctx.lineTo(limb.endX, limb.endY);
            return limb;
        }

        // Arms and legs both branch straight from the spine (no hip/shoulder
        // bars): arms from the shoulder point, legs from the base of the spine.
        let shoulderY = neckY + 5;

        // Legs
        // A real knee is a hinge that only folds one way: keep both knees
        // pointing toward the facing direction so legs never bend backward,
        // regardless of which pose set the bend value.
        leftLegBend = Math.abs(leftLegBend);
        rightLegBend = Math.abs(rightLegBend);
        const upperLegLen = 19;
        const lowerLegLen = 20;
        let leftLeg = drawBentLimb(0, pelvisY, leftLegAngle, leftLegBend, upperLegLen, lowerLegLen);
        let rightLeg = drawBentLimb(0, pelvisY, rightLegAngle, rightLegBend, upperLegLen, lowerLegLen);

        // Arms (shoulder at neckY + 5)
        const upperArmLen = 16;
        const lowerArmLen = 17;
        let leftArm = drawBentLimb(0, shoulderY, leftArmAngle, leftArmBend, upperArmLen, lowerArmLen);

        // Phantom — his mist limbs stretch unnaturally: the front claw reaches far on
        // Soul Siphon (and stays fully extended through the Soul Train grab).
        let rUp = upperArmLen, rLow = lowerArmLen;
        if (this.charType === 'PHANTOM') {
            let stretch = 0;
            let ca = this.currentAttack;
            if (this.state === 'ATTACK' && ca) {
                let prog = Math.max(0, Math.min(1, (this.stateTimer - ca.startup) / Math.max(0.01, ca.active + ca.recovery)));
                let reach = Math.sin(Math.min(1, prog) * Math.PI); // 0 -> 1 -> 0
                if (ca.type === 'soulSiphon') stretch = reach * 50;
                else if (ca.type === 'scytheLash') stretch = reach * 20;
                else if (ca.type === 'mistClaw') stretch = reach * 12;
            } else if (this.state === 'ULT' && this.ult && (this.ult.phase === 'rush' || this.ult.phase === 'seize' || this.ult.phase === 'shatter')) {
                stretch = 44; // long grab arm, held out
            }
            rUp += stretch * 0.5; rLow += stretch * 0.5;
        }

        // Draw weapon/effect on right arm (front arm)
        let rightArm = drawBentLimb(0, shoulderY, rightArmAngle, rightArmBend, rUp, rLow);
        let rHandX = rightArm.endX;
        let rHandY = rightArm.endY;
        ctx.stroke();

        ctx.fillStyle = ctx.strokeStyle;
        [leftLeg, rightLeg, leftArm, rightArm].forEach(joint => {
            ctx.beginPath();
            ctx.arc(joint.jointX, joint.jointY, Math.max(2.2, ctx.lineWidth * 0.42), 0, Math.PI * 2);
            ctx.fill();
        });

        // Head
        ctx.beginPath();
        ctx.arc(0, headY, 12, 0, Math.PI*2);
        ctx.stroke();
        if (this.team === 1 && currentMode !== 'PVE') {
            // slight indicator for P2
            ctx.fillStyle = '#333';
            ctx.fill();
        }

        // Distinct Character Visuals (Accessories / Traits)
        if (this.charType === 'BRAWLER') {
            // Red Headband
            ctx.fillStyle = '#ff0033';
            ctx.fillRect(-12, headY - 4, 24, 4);
            ctx.beginPath(); ctx.moveTo(-12, headY-2); ctx.lineTo(-24, headY+4); ctx.lineWidth = 3; ctx.strokeStyle = '#ff0033'; ctx.stroke();
        } else if (this.charType === 'PHANTOM') {
            // hollow, glowing eyes
            ctx.save();
            ctx.shadowBlur = 8; ctx.shadowColor = '#ff3355'; ctx.fillStyle = '#ff2a44';
            ctx.beginPath(); ctx.arc(-4, headY - 1, 2.1, 0, Math.PI * 2); ctx.arc(5, headY - 1, 2.1, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // tattered shroud trailing off the head
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-12, headY + 5); ctx.quadraticCurveTo(-17, headY + 24, -9 + Math.sin(t * 4) * 3, headY + 42);
            ctx.moveTo(12, headY + 5); ctx.quadraticCurveTo(17, headY + 24, 9 + Math.sin(t * 4 + 1) * 3, headY + 42);
            ctx.stroke();
            // ambient soul wisps rising off him
            let wa = ctx.globalAlpha; ctx.globalAlpha = wa * 0.5; ctx.fillStyle = ctx.strokeStyle;
            for (let i = 0; i < 3; i++) {
                let wy = headY + 10 - ((t * 40 + i * 30) % 60);
                let wx = (i - 1) * 14 + Math.sin(t * 3 + i) * 5;
                ctx.beginPath(); ctx.arc(wx, wy, 2.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = wa;
            // Grave Grasp — clawed spectral hands erupt from the ground in front of him
            if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'graveGrasp') {
                let ca = this.currentAttack;
                let prog = Math.max(0, Math.min(1, (this.stateTimer - ca.startup) / Math.max(0.01, ca.active)));
                let rise = Math.sin(Math.min(1, prog) * Math.PI); // erupt then sink
                let gY = (GROUND_Y - this.y) + (this._hover || 0); // local ground line
                ctx.save();
                ctx.globalAlpha = wa * 0.95;
                ctx.strokeStyle = '#cfd8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.shadowBlur = 8; ctx.shadowColor = '#9aa6c8';
                [26, 62, 100, 138].forEach((hx, k) => {
                    let topY = gY - (30 + (k % 2) * 12) * rise;
                    ctx.beginPath(); ctx.moveTo(hx, gY + 8); ctx.lineTo(hx, topY); ctx.stroke();       // straight forearm
                    ctx.beginPath();                                                                    // symmetric gripping fingers
                    ctx.moveTo(hx, topY); ctx.lineTo(hx - 8, topY - 9);
                    ctx.moveTo(hx, topY); ctx.lineTo(hx, topY - 12);
                    ctx.moveTo(hx, topY); ctx.lineTo(hx + 8, topY - 9);
                    ctx.stroke();
                });
                ctx.restore();
            }
        } else if (this.charType === 'MAGE') {
            // Wizard hat
            ctx.beginPath(); ctx.moveTo(-16, headY - 8); ctx.lineTo(16, headY - 8); ctx.lineTo(0, headY - 35); ctx.closePath();
            ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        } else if (this.charType === 'RANGER') {
            ctx.save();
            // --- Fedora ---
            let brimY = headY - 7;
            ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
            // crown — pinched dome with a slight front dent, drawn first so the brim overlaps its base
            ctx.beginPath();
            ctx.moveTo(-11, brimY);
            ctx.quadraticCurveTo(-11, headY - 24, -4, headY - 25);
            ctx.quadraticCurveTo(0, headY - 20, 4, headY - 25); // center pinch
            ctx.quadraticCurveTo(11, headY - 24, 12, brimY);
            ctx.closePath(); ctx.fill();
            // hat band — pale gray so it still reads on the white felt
            ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-10, brimY - 1); ctx.lineTo(12, brimY - 1); ctx.stroke();
            // brim — wide flat ellipse snapped slightly down at the front
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(1, brimY + 1, 22, 4.5, 0.06, 0, Math.PI * 2); ctx.fill();

            // --- Cigarette in the mouth, ember + rising smoke ---
            let cigX = 10, cigY = headY + 4;
            ctx.strokeStyle = '#f2ede0'; ctx.lineWidth = 2.4; ctx.lineCap = 'butt';
            ctx.beginPath(); ctx.moveTo(cigX, cigY); ctx.lineTo(cigX + 9, cigY + 1.6); ctx.stroke();
            let emX = cigX + 9, emY = cigY + 1.6;
            ctx.fillStyle = '#ff5a22'; ctx.shadowBlur = 6; ctx.shadowColor = '#ff3300';
            ctx.beginPath(); ctx.arc(emX + 1, emY + 0.2, 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // smoke curling up off the ember
            ctx.strokeStyle = 'rgba(205,205,210,0.45)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(emX + 1, emY);
            for (let i = 1; i <= 6; i++) {
                let yy = emY - i * 5;
                let xx = emX + 1 + Math.sin(t * 3 + i * 0.8) * 3 + i * 0.6;
                ctx.lineTo(xx, yy);
            }
            ctx.stroke();
            ctx.restore();
        } else if (this.charType === 'SWORDSMAN') {
            // Topknot / Ronin hair
            ctx.beginPath(); ctx.moveTo(0, headY - 12); ctx.lineTo(6, headY - 22); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
            // Wheat straw clenched in his teeth — a stalk poking forward with little grains at the tip
            ctx.save();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            let mx = 9, my = headY + 4;            // corner of the mouth
            let tx = mx + 13, ty = my + 4;          // tip, angled downward and forward
            ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
            // tiny sticks fanning out of the end (the wheat head)
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tx, ty); ctx.lineTo(tx + 5, ty - 4);
            ctx.moveTo(tx, ty); ctx.lineTo(tx + 6, ty + 1);
            ctx.moveTo(tx, ty); ctx.lineTo(tx + 5, ty + 5);
            ctx.moveTo(tx, ty); ctx.lineTo(tx + 2, ty + 6);
            ctx.stroke();
            ctx.restore();
        } else if (this.charType === 'DARK_RULER') {
            // Dark crown sitting on the head (black with a faint red rim + red gem)
            let cy0 = headY - 10;
            ctx.fillStyle = '#000'; ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 2;
            ctx.shadowBlur = 6; ctx.shadowColor = '#ff0033';
            ctx.beginPath();
            ctx.moveTo(-12, cy0);
            ctx.lineTo(-12, cy0 - 6); ctx.lineTo(-6, cy0 - 1); ctx.lineTo(0, cy0 - 10);
            ctx.lineTo(6, cy0 - 1); ctx.lineTo(12, cy0 - 6); ctx.lineTo(12, cy0);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ff0033';
            ctx.beginPath(); ctx.arc(0, cy0 - 2, 2, 0, Math.PI * 2); ctx.fill();
            // Floating black halo above (faint red glow so it reads on the dark stage)
            let hy0 = headY - 28 + Math.sin(t * 2) * 1.6;
            ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.shadowBlur = 9; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.ellipse(0, hy0, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (this.charType === 'TELEPATH') {
            // Glowing third eye + a slim psychic diadem, wrapped in a soft aura
            ctx.fillStyle = '#9be3ff'; ctx.shadowBlur = 12; ctx.shadowColor = '#6fd0ff';
            ctx.beginPath(); ctx.arc(0, headY - 4, 2.6, 0, Math.PI * 2); ctx.fill();   // third eye
            ctx.strokeStyle = '#bfeeff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, headY, 12, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); // diadem band
            ctx.shadowBlur = 0;
            // faint psychic aura
            ctx.strokeStyle = 'rgba(155,227,255,0.22)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, headY + 4, 26 + Math.sin(t * 2.4) * 2, 0, Math.PI * 2); ctx.stroke();
        } else if (this.charType === 'BEAST_TAMER') {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-10, headY - 8); ctx.lineTo(10, headY - 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-9, headY - 11); ctx.lineTo(-17, headY - 15); ctx.moveTo(9, headY - 11); ctx.lineTo(17, headY - 15); ctx.stroke();
        } else if (this.charType === 'COPYCAT') {
            ctx.save();
            ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            // Cat ears — two pointed triangles atop the head
            ctx.beginPath(); ctx.moveTo(-11, headY - 6); ctx.lineTo(-2, headY - 8); ctx.lineTo(-8, headY - 22); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(11, headY - 6); ctx.lineTo(2, headY - 8); ctx.lineTo(8, headY - 22); ctx.closePath(); ctx.fill();
            // whiskers off the muzzle (front of the face = +x)
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(5, headY + 2); ctx.lineTo(17, headY + 0);
            ctx.moveTo(5, headY + 4); ctx.lineTo(17, headY + 6);
            ctx.stroke();
            // Tail — curls up behind (away from the facing direction), swishing
            let sway = Math.sin(t * 4) * 6;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-6, -26);
            ctx.quadraticCurveTo(-24, -30, -27, -48 + sway);
            ctx.quadraticCurveTo(-29, -62 + sway, -19, -64 + sway);
            ctx.stroke();
            // Agility counter-mark — a spinning star hovering over the head
            if (this.agilityTimer > 0) {
                ctx.save();
                ctx.translate(0, headY - 30); ctx.rotate(t * 4);
                ctx.fillStyle = '#ffd23f'; ctx.shadowBlur = 8; ctx.shadowColor = '#ffd23f';
                for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, -6, 2.0, 0, Math.PI * 2); ctx.fill(); }
                ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            // Nine Lives — an expanding golden ring as the cat shrugs off a lethal ult
            if (this._nineLivesFx > 0) {
                ctx.globalAlpha = Math.min(1, this._nineLivesFx);
                ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.shadowBlur = 14; ctx.shadowColor = '#ffd23f';
                ctx.beginPath(); ctx.arc(0, headY + 36, 26 + (1.1 - this._nineLivesFx) * 46, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        } else if (this.charType === 'CULT') {
            ctx.save();
            // robe / cloak draped over the lower body
            let hem = Math.sin(t * 2) * 1.5;
            ctx.fillStyle = '#1c1c1c'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-7, -42); ctx.lineTo(7, -42);
            ctx.lineTo(13 + hem, -4); ctx.lineTo(-13 - hem, -4);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // large pointed hood / cowl framing the head and shoulders
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.moveTo(-18, headY + 12);
            ctx.quadraticCurveTo(-20, headY - 22, 0, headY - 42); // peak
            ctx.quadraticCurveTo(20, headY - 22, 18, headY + 12);
            ctx.quadraticCurveTo(0, headY + 4, -18, headY + 12); // inner brow
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // the leader's big unique mask filling the cowl
            if (typeof drawCultMask === 'function') drawCultMask(ctx, 3, headY + 2, this.maskId || 0, 2.0);
            // Devotion embers rising as Congregation builds
            if (this.devotion > 33) {
                ctx.fillStyle = '#ff0033'; ctx.globalAlpha = 0.5;
                for (let i = 0; i < (this.devotion >= 66 ? 3 : 2); i++) {
                    let py = headY - 14 - ((t * 30 + i * 18) % 30);
                    ctx.beginPath(); ctx.arc((i - 1) * 8, py, 1.6, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        } else if (this.charType === 'LUMATROSSIA') {
            ctx.save();
            // curved devil horns
            ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-7, headY - 7); ctx.quadraticCurveTo(-17, headY - 19, -10, headY - 31);
            ctx.moveTo(7, headY - 7); ctx.quadraticCurveTo(17, headY - 19, 10, headY - 31);
            ctx.stroke();
            // burning eyes
            ctx.fillStyle = '#ff0033'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.arc(-4, headY - 1, 1.8, 0, Math.PI * 2); ctx.arc(5, headY - 1, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // a low infernal aura while summoned (and flares on (de)summon)
            ctx.globalAlpha = 0.25 + (this._lumFx > 0 ? this._lumFx * 0.4 : 0);
            ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 3; ctx.shadowBlur = 16; ctx.shadowColor = '#ff0033';
            ctx.beginPath(); ctx.ellipse(0, -2, 26, 8, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        } else if (this.charType === 'TWINS') {
            ctx.save();
            // one twin wears a blue headband, the other an orange one
            let bandCol = this.isPartner ? '#ff8a1e' : '#2f6fed';
            ctx.fillStyle = bandCol; ctx.strokeStyle = bandCol; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.fillRect(-12, headY - 6, 24, 5); // band across the forehead
            ctx.lineWidth = 3;                   // knot + trailing tails off the side
            ctx.beginPath();
            ctx.moveTo(-12, headY - 2); ctx.lineTo(-23, headY + 4);
            ctx.moveTo(-12, headY + 1); ctx.lineTo(-22, headY + 10);
            ctx.stroke();
            // Symmetry aura — a glow ring while the pincer is balanced and the buff is live
            if (this.symBuff > 0.05) {
                ctx.globalAlpha = this.symBuff * 0.6;
                ctx.strokeStyle = bandCol; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = bandCol;
                ctx.beginPath(); ctx.arc(0, headY + 6, 26, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        } else if (this.charType === 'TRAVELER') {
            ctx.save();
            // VISOR — an actual angular lens wrapping the front of the face, not a band:
            // dark glass with a glowing cyan rim and a sliding glint
            ctx.fillStyle = 'rgba(8, 26, 36, 0.92)';
            ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
            ctx.shadowBlur = 9; ctx.shadowColor = '#6fd0ff';
            ctx.beginPath();
            ctx.moveTo(-9, headY - 7);
            ctx.lineTo(10, headY - 7);
            ctx.lineTo(14, headY - 3);   // pointed leading edge over the eyes
            ctx.lineTo(10, headY + 3);
            ctx.lineTo(-9, headY + 3);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; // the glint sweeping across the glass
            let gl = (Math.sin(t * 1.6) * 0.5 + 0.5) * 14 - 7;
            ctx.beginPath(); ctx.moveTo(gl - 2, headY - 5); ctx.lineTo(gl + 2, headY + 1); ctx.stroke();
            // glowing tech seams down the torso
            ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
            ctx.beginPath(); ctx.moveTo(-2, -56); ctx.lineTo(-2, -36); ctx.moveTo(2, -52); ctx.lineTo(2, -40); ctx.stroke();
            ctx.globalAlpha = 1;
            // holo-watch — a small cyan ring at the right wrist
            if (typeof rHandX === 'number') {
                ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = '#6fd0ff';
                ctx.beginPath(); ctx.arc(rHandX, rHandY, 4.4, 0, Math.PI * 2); ctx.stroke();
            }
            // TEMPORAL SLIP CLOCK — a big halo ring encircling the head, its hands always
            // turning; the rim fills with the recharge and blazes when the slip is ready
            let slipFrac = 1 - Math.max(0, this.slipCd) / 6;
            let ringR = 19;
            ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(111,208,255,0.3)';
            ctx.beginPath(); ctx.arc(0, headY, ringR, 0, Math.PI * 2); ctx.stroke(); // faint full dial
            for (let i = 0; i < 12; i++) { // tick marks
                let a = i / 12 * Math.PI * 2;
                ctx.beginPath(); ctx.moveTo(Math.cos(a) * (ringR - 2.5), headY + Math.sin(a) * (ringR - 2.5));
                ctx.lineTo(Math.cos(a) * ringR, headY + Math.sin(a) * ringR); ctx.stroke();
            }
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = slipFrac >= 1 ? '#6fd0ff' : 'rgba(111,208,255,0.55)';
            ctx.shadowBlur = slipFrac >= 1 ? 12 : 0; ctx.shadowColor = '#6fd0ff';
            ctx.beginPath(); ctx.arc(0, headY, ringR, -Math.PI / 2, -Math.PI / 2 + slipFrac * Math.PI * 2); ctx.stroke(); // recharge rim
            ctx.shadowBlur = 0;
            // the hands, always turning — a quick minute hand and a slow hour hand
            ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(111,208,255,0.8)'; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, headY); ctx.lineTo(Math.cos(t * 2.6) * (ringR - 5), headY + Math.sin(t * 2.6) * (ringR - 5)); ctx.stroke();
            ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(0, headY); ctx.lineTo(Math.cos(t * 0.4) * (ringR - 10), headY + Math.sin(t * 0.4) * (ringR - 10)); ctx.stroke();
            // Rewind's after-echo is drawn in world space (engine) at the 3s-old position
            ctx.restore();
        } else if (this.charType === 'ZOMBIE') {
            // Missing eye / exposed skull detail
            ctx.fillStyle = '#ff0033';
            ctx.beginPath(); ctx.arc(-4, headY-2, 3, 0, Math.PI*2); ctx.fill();
        }

        // Restore stroke style for weapons just in case
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;

        // WEAPONS — drawn in local space (+x = facing direction). Each weapon is
        // built from a few strokes so it reads as a real sword / gun / knife, and
        // is aligned to the forearm (elbow->hand) so it looks gripped and swings
        // naturally during attacks.
        let lHandX = leftArm.endX, lHandY = leftArm.endY;
        let rForeAng = Math.atan2(rHandY - rightArm.jointY, rHandX - rightArm.jointX);
        let lForeAng = Math.atan2(lHandY - leftArm.jointY, lHandX - leftArm.jointX);

        function drawSword(hx, hy, ang) {
            let dx = Math.cos(ang), dy = Math.sin(ang);
            let px = -dy, py = dx; // perpendicular (crossguard line)
            // grip behind the hand
            ctx.strokeStyle = '#777'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(hx - dx*8, hy - dy*8); ctx.lineTo(hx + dx*2, hy + dy*2); ctx.stroke();
            // crossguard
            ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(hx + dx*2 - px*7, hy + dy*2 - py*7);
            ctx.lineTo(hx + dx*2 + px*7, hy + dy*2 + py*7);
            ctx.stroke();
            // blade
            ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(hx + dx*3, hy + dy*3); ctx.lineTo(hx + dx*50, hy + dy*50); ctx.stroke();
        }
        function drawBigSword(hx, hy, ang) {
            let dx = Math.cos(ang), dy = Math.sin(ang);
            let px = -dy, py = dx;
            // long heavy grip behind the hand
            ctx.strokeStyle = '#666'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(hx - dx*14, hy - dy*14); ctx.lineTo(hx + dx*4, hy + dy*4); ctx.stroke();
            // wide jagged crossguard
            ctx.strokeStyle = '#333'; ctx.lineWidth = 5; ctx.shadowBlur = 8; ctx.shadowColor = '#ff0033';
            ctx.beginPath();
            ctx.moveTo(hx + dx*4 - px*13, hy + dy*4 - py*13);
            ctx.lineTo(hx + dx*4 + px*13, hy + dy*4 + py*13);
            ctx.stroke();
            // huge broad blade (dark steel with a glowing red edge)
            let tipx = hx + dx*86, tipy = hy + dy*86;
            let basex = hx + dx*6, basey = hy + dy*6;
            ctx.fillStyle = '#9a9aa2'; ctx.shadowBlur = 12; ctx.shadowColor = '#ff0033';
            ctx.beginPath();
            ctx.moveTo(basex - px*9, basey - py*9);
            ctx.lineTo(basex + px*9, basey + py*9);
            ctx.lineTo(tipx + px*2, tipy + py*2);
            ctx.lineTo(tipx, tipy);
            ctx.lineTo(basex - px*9, basey - py*9);
            ctx.closePath(); ctx.fill();
            // black fuller line down the centre + red edge glow
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.moveTo(basex, basey); ctx.lineTo(tipx, tipy); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        function drawKnife(hx, hy, ang) {
            let dx = Math.cos(ang), dy = Math.sin(ang);
            let px = -dy, py = dx;
            // handle
            ctx.strokeStyle = '#777'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(hx - dx*5, hy - dy*5); ctx.lineTo(hx + dx*1, hy + dy*1); ctx.stroke();
            // small guard
            ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx + dx*1 - px*3, hy + dy*1 - py*3);
            ctx.lineTo(hx + dx*1 + px*3, hy + dy*1 + py*3);
            ctx.stroke();
            // blade
            ctx.strokeStyle = '#eee'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(hx + dx*2, hy + dy*2); ctx.lineTo(hx + dx*17, hy + dy*17); ctx.stroke();
        }
        function drawGun(hx, hy, ang) {
            let dx = Math.cos(ang), dy = Math.sin(ang);
            let ux = dy, uy = -dx;              // "up" relative to the barrel
            if (uy > 0) { ux = -ux; uy = -uy; } // keep the grip hanging downward
            // slide / barrel
            ctx.strokeStyle = '#bbb'; ctx.lineWidth = 5; ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(hx - dx*3 + ux*2, hy - dy*3 + uy*2);
            ctx.lineTo(hx + dx*16 + ux*2, hy + dy*16 + uy*2);
            ctx.stroke();
            // grip (down and back)
            ctx.strokeStyle = '#777'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(hx + ux*1, hy + uy*1);
            ctx.lineTo(hx - dx*3 - ux*9, hy - dy*3 - uy*9);
            ctx.stroke();
            ctx.lineCap = 'round';
        }
        function drawWhip(hx, hy, ang) {
            let dx = Math.cos(ang), dy = Math.sin(ang);
            ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(hx - dx * 6, hy - dy * 6);
            ctx.lineTo(hx + dx * 12, hy + dy * 12);
            ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx + dx * 8, hy + dy * 8);
            ctx.quadraticCurveTo(hx + dx * 28 + dy * 14, hy + dy * 28 - dx * 14, hx + dx * 56, hy + dy * 30);
            ctx.stroke();
        }

        if (this.charType === 'TELEPATH') {
            // Telekinetic energy glows at both palms; attacks project psychic constructs.
            ctx.save();
            ctx.fillStyle = '#9be3ff'; ctx.shadowBlur = 12; ctx.shadowColor = '#6fd0ff';
            ctx.beginPath(); ctx.arc(rHandX, rHandY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(lHandX, lHandY, 3.4, 0, Math.PI * 2); ctx.fill();
            let atkNow = this.state === 'ATTACK' ? this.currentAttack : null;
            if (atkNow) {
                let pr = Math.max(0, Math.min(1, (this.stateTimer - atkNow.startup) / Math.max(0.01, atkNow.active)));
                ctx.shadowBlur = 16; ctx.shadowColor = '#6fd0ff';
                if (atkNow.type === 'psiBarrier') {
                    // a shimmering hexagonal barrier out front
                    ctx.strokeStyle = 'rgba(155,227,255,0.8)'; ctx.lineWidth = 3;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) { let a = i * Math.PI / 3 - Math.PI / 2; let px = 30 + Math.cos(a) * 16, py = -46 + Math.sin(a) * 40; (i ? ctx.lineTo : ctx.moveTo).call(ctx, px, py); }
                    ctx.closePath(); ctx.stroke();
                } else if ((atkNow.type === 'psyBlade' || atkNow.name === 'heavy') && pr > 0) {
                    // a crescent psy-blade arc in front of her sweep
                    ctx.strokeStyle = 'rgba(155,227,255,0.85)'; ctx.lineWidth = 5;
                    ctx.beginPath(); ctx.arc(rHandX, rHandY, 26, -1.0, 1.0); ctx.stroke();
                } else if (atkNow.type === 'psiLift' && pr > 0) {
                    ctx.strokeStyle = 'rgba(155,227,255,0.8)'; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.arc(18, -50, 40, 0.4, 2.2); ctx.stroke(); // upward burst arc
                } else if (atkNow.type === 'teleCrash' && this._diving) {
                    ctx.fillStyle = 'rgba(155,227,255,0.5)';
                    ctx.beginPath(); ctx.ellipse(0, 6, 26, 8, 0, 0, Math.PI * 2); ctx.fill(); // downward pressure under her
                }
            }
            ctx.restore();
        } else if (this.charType === 'DARK_RULER') {
            if (this.stageSeat) {
                drawBigSword(rHandX + 9, rHandY + 54, -Math.PI / 2);
            } else {
                drawBigSword(rHandX, rHandY, rForeAng);
            }
        } else if (this.charType === 'SWORDSMAN') {
            drawSword(rHandX, rHandY, rForeAng);
            // Rising Crescent: trace the vertical half-circle the blade sweeps
            if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'risingSlash') {
                let a = this.currentAttack;
                let pr = Math.max(0, Math.min(1, (this.stateTimer - a.startup) / Math.max(0.01, a.active)));
                if (pr > 0) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 5;
                    ctx.shadowBlur = 18; ctx.shadowColor = '#fff';
                    ctx.beginPath();
                    ctx.arc(20, -46, 72, 1.4, 1.4 - 3.0 * pr, true); // low-front sweeping overhead
                    ctx.stroke();
                    ctx.restore();
                }
            }
        } else if (this.charType === 'RANGER') {
            // Dual wield: gun + knife are always both shown. The firing hand holds
            // the gun during gun attacks; otherwise the lead hand slashes the knife.
            drawKnife(rHandX, rHandY, rForeAng);
            drawGun(lHandX, lHandY, lForeAng);
        } else if (this.charType === 'TRAVELER' && this.state === 'ATTACK' && this.currentAttack &&
                   (this.currentAttack.type === 'phaseJab' || this.currentAttack.type === 'flashKick')) {
            // Skipped-frame ghosts: the strike positions he edited out, hanging in the air
            let caG = this.currentAttack;
            let prG = (this.stateTimer - caG.startup) / Math.max(0.01, caG.active + caG.recovery * 0.4);
            if (prG > 0 && prG < 1) {
                ctx.save();
                ctx.strokeStyle = '#6fd0ff'; ctx.lineCap = 'round'; ctx.shadowBlur = 10; ctx.shadowColor = '#6fd0ff';
                if (caG.type === 'phaseJab') {
                    // both jab positions linger as ghost fists with speed dashes between
                    ctx.globalAlpha = 0.55;
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(34, -56, 3.4, 0, Math.PI * 2); ctx.stroke(); // the high jab
                    ctx.beginPath(); ctx.arc(36, -44, 3.4, 0, Math.PI * 2); ctx.stroke(); // the low jab
                    ctx.globalAlpha = 0.35; ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(14, -55); ctx.lineTo(26, -56);
                    ctx.moveTo(15, -47); ctx.lineTo(28, -45);
                    ctx.stroke();
                } else {
                    // the three kick frames traced as ghost shins fanning through the arc
                    [[0.45, 0.3], [0.95, 0.45], [1.5, 0.6]].forEach(([a, al], i) => {
                        ctx.globalAlpha = al;
                        ctx.lineWidth = 2.4;
                        ctx.beginPath();
                        ctx.moveTo(0, -36);
                        ctx.lineTo(Math.sin(a) * 40, -36 + Math.cos(a) * 40);
                        ctx.stroke();
                    });
                }
                ctx.restore();
            }
        } else if (this.charType === 'TRAVELER' && this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'tachyonEcho') {
            // Tachyon Echo is fired from a high-tech blaster that materialises in his hand
            ctx.save();
            let dx = Math.cos(rForeAng), dy = Math.sin(rForeAng);
            let ux = dy, uy = -dx;
            if (uy > 0) { ux = -ux; uy = -uy; } // keep the grip hanging downward
            // angular alloy body
            ctx.strokeStyle = '#cfd8de'; ctx.lineWidth = 6; ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(rHandX - dx * 4 + ux * 2, rHandY - dy * 4 + uy * 2);
            ctx.lineTo(rHandX + dx * 19 + ux * 2, rHandY + dy * 19 + uy * 2);
            ctx.stroke();
            // glowing tachyon core running the barrel
            ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = '#6fd0ff';
            ctx.beginPath();
            ctx.moveTo(rHandX + dx * 1 + ux * 2, rHandY + dy * 1 + uy * 2);
            ctx.lineTo(rHandX + dx * 18 + ux * 2, rHandY + dy * 18 + uy * 2);
            ctx.stroke();
            // muzzle emitter ring
            ctx.beginPath(); ctx.arc(rHandX + dx * 22 + ux * 2, rHandY + dy * 22 + uy * 2, 3.6, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            // top fin + grip
            ctx.strokeStyle = '#9aa6ad'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(rHandX + dx * 8 + ux * 5, rHandY + dy * 8 + uy * 5);
            ctx.lineTo(rHandX + dx * 14 + ux * 5, rHandY + dy * 14 + uy * 5);
            ctx.stroke();
            ctx.strokeStyle = '#5a666c'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(rHandX + ux * 1, rHandY + uy * 1);
            ctx.lineTo(rHandX - dx * 3 - ux * 9, rHandY - dy * 3 - uy * 9);
            ctx.stroke();
            // muzzle flash during the active frames
            let ca2 = this.currentAttack;
            let pr2 = (this.stateTimer - ca2.startup) / Math.max(0.01, ca2.active);
            if (pr2 > 0 && pr2 < 1) {
                ctx.fillStyle = '#6fd0ff'; ctx.shadowBlur = 16; ctx.shadowColor = '#6fd0ff'; ctx.globalAlpha = 0.85;
                ctx.beginPath();
                let mx2 = rHandX + dx * 26 + ux * 2, my2 = rHandY + dy * 26 + uy * 2;
                ctx.moveTo(mx2, my2 - 5); ctx.lineTo(mx2 + dx * 12, my2); ctx.lineTo(mx2, my2 + 5); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        } else if (this.charType === 'BEAST_TAMER') {
            drawWhip(rHandX, rHandY, rForeAng);
            ctx.strokeStyle = '#888'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(lHandX, lHandY - 13); ctx.lineTo(lHandX, lHandY + 15); ctx.stroke();
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(lHandX, lHandY - 15, 3, 0, Math.PI * 2); ctx.fill();
        } else if (this.charType === 'MAGE') {
            // Staff/Wand
            ctx.beginPath();
            ctx.strokeStyle = '#888';
            ctx.moveTo(rHandX, rHandY - 20);
            ctx.lineTo(rHandX, rHandY + 20);
            ctx.stroke();
            // Glow
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(rHandX, rHandY - 22, 4, 0, Math.PI*2); ctx.fill();
        }

        if (this.state === 'BLOCK') {
            if (this.charType === 'MAGE') {
                // hexagonal arcane shield, slowly spinning
                ctx.save();
                ctx.translate(20, -46); ctx.rotate(t * 0.6);
                let pulse = 1 + Math.sin(t * 10) * 0.05;
                ctx.strokeStyle = 'rgba(201,139,255,0.85)'; ctx.lineWidth = 2.5;
                ctx.shadowBlur = 12; ctx.shadowColor = '#c98bff';
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) { let a = i / 6 * Math.PI * 2, r = 26 * pulse; let fx = Math.cos(a) * r, fy = Math.sin(a) * r; i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); }
                ctx.closePath(); ctx.stroke();
                ctx.globalAlpha = 0.16; ctx.fillStyle = '#c98bff'; ctx.fill(); ctx.globalAlpha = 1;
                ctx.restore();
            } else if (this.charType === 'TELEPATH') {
                // psychic bubble — concentric shimmering rings
                ctx.save();
                ctx.strokeStyle = 'rgba(155,227,255,0.8)'; ctx.shadowBlur = 12; ctx.shadowColor = '#9be3ff';
                for (let k = 0; k < 3; k++) { ctx.lineWidth = 2.5 - k * 0.6; ctx.beginPath(); ctx.arc(18, -46, 20 + k * 6 + Math.sin(t * 8 + k) * 1.5, -1.1, 1.1); ctx.stroke(); }
                ctx.globalAlpha = 0.12; ctx.fillStyle = '#9be3ff'; ctx.beginPath(); ctx.arc(18, -46, 24, -1.1, 1.1); ctx.fill(); ctx.globalAlpha = 1;
                ctx.restore();
            } else if (this.charType === 'DARK_RULER') {
                // a jagged wall of dark energy rimmed in red
                ctx.save();
                ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 2.5; ctx.shadowBlur = 10; ctx.shadowColor = '#ff0033';
                ctx.beginPath();
                let bx = 22; ctx.moveTo(bx, -74);
                for (let i = 1; i <= 7; i++) { let yy = -74 + i * 9; let jag = (i % 2 ? 8 : -2) + Math.sin(t * 12 + i) * 1.5; ctx.lineTo(bx + jag, yy); }
                ctx.stroke();
                ctx.restore();
            } else if (this.charType === 'PHANTOM') {
                // a ghostly mist veil drifting in front
                ctx.save();
                ctx.strokeStyle = 'rgba(223,228,242,0.7)'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = '#dfe4f2';
                for (let k = 0; k < 3; k++) { ctx.globalAlpha = 0.6 - k * 0.15; ctx.beginPath(); ctx.arc(16, -46, 22 + k * 5, -1.0 + Math.sin(t * 4 + k) * 0.1, 1.0 + Math.sin(t * 4 + k) * 0.1); ctx.stroke(); }
                ctx.globalAlpha = 1; ctx.restore();
            } else if (this.charType === 'TRAVELER') {
                // a projected clock-face barrier — ring, tick marks, and a fast-spinning hand
                ctx.save();
                ctx.translate(26, -50);
                ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 2.4; ctx.shadowBlur = 14; ctx.shadowColor = '#6fd0ff';
                ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke();
                ctx.lineWidth = 1.4;
                for (let i = 0; i < 12; i++) { let a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 15.5, Math.sin(a) * 15.5); ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); ctx.stroke(); }
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 9) * 13, Math.sin(t * 9) * 13); ctx.stroke(); // the hand, spinning wildly
                ctx.globalAlpha = 0.14; ctx.fillStyle = '#6fd0ff'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            } else if (this.charType === 'CULT') {
                // a warding sigil — a glowing ritual rune conjured in front of the cowl
                ctx.save();
                ctx.translate(18, -50); ctx.rotate(Math.sin(t * 4) * 0.08);
                let pulse = 0.85 + Math.sin(t * 9) * 0.1;
                ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = '#ff0033';
                ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.stroke();          // ring
                ctx.beginPath();                                                                   // inscribed triangle
                for (let i = 0; i <= 3; i++) { let a = -Math.PI / 2 + i * Math.PI * 2 / 3; let fx = Math.cos(a) * 16 * pulse, fy = Math.sin(a) * 16 * pulse; i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); }
                ctx.stroke();
                ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff0033'; ctx.fill(); ctx.globalAlpha = 1;
                ctx.restore();
            } else if (this.charType === 'BRAWLER') {
                // the original guard arcs — Brawler keeps his signature block
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(0, -46, 34 + Math.sin(t * 18) * 2, -0.9, 0.9); ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 0, 51, 0.55)';
                ctx.beginPath(); ctx.arc(0, -46, 42, -0.65, 0.65); ctx.stroke();
            }
            // SWORDSMAN / RANGER / BEAST_TAMER / ZOMBIE guard with body + weapon (their pose), no energy overlay
        } else if (this.state === 'BLOCKBREAK') {
            // The guard SHATTERS: shards burst outward, then dazed stars circle the head.
            if (this._guardBreakFx > 0) {
                let p = 1 - this._guardBreakFx / 0.5; // 0 -> 1 over the burst
                ctx.save();
                ctx.strokeStyle = this.guardColor(); ctx.globalAlpha = Math.max(0, 1 - p); ctx.lineWidth = 2;
                ctx.shadowBlur = 8; ctx.shadowColor = this.guardColor();
                for (let i = 0; i < 8; i++) {
                    let a = i / 8 * Math.PI * 2, r0 = 10 + p * 10, r1 = 18 + p * 46;
                    ctx.beginPath();
                    ctx.moveTo(16 + Math.cos(a) * r0, -46 + Math.sin(a) * r0);
                    ctx.lineTo(16 + Math.cos(a) * r1, -46 + Math.sin(a) * r1);
                    ctx.stroke();
                }
                ctx.restore();
            }
            // dazed stars spinning over the head for the whole stagger (reads as stunned)
            ctx.save();
            ctx.fillStyle = '#ffd23f'; ctx.shadowBlur = 6; ctx.shadowColor = '#ffd23f';
            for (let i = 0; i < 3; i++) {
                let a = t * 6 + i * (Math.PI * 2 / 3);
                ctx.beginPath(); ctx.arc(Math.cos(a) * 12, headY - 14 + Math.sin(a) * 4, 2.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        ctx.restore();

        // Draw Buff effects
        if (this.parryBuffTimer > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath(); ctx.arc(this.x, this.y - 40, 50, 0, Math.PI*2); ctx.stroke();
        }
    }
}
