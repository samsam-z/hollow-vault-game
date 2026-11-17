// Hollow Vault — the simulation. Pure stepping: give it a control snapshot and a fixed dt, it
// advances the world and returns event flags. It never touches the DOM, so the same rules drive a
// real player and the deterministic autopilot that stages the screenshots.
//
// The vault sits at the centre with three shields. The player orbits it with a turret, aiming with
// the pointer or keys and firing bolts outward. Four intruder types close in, each needing a
// different answer: runners rush straight, splitters break into three, shield-bearers block shots
// from their front so you must catch their flank, and drifters weave. Every fifth wave is a boss.
// Kills build a combo multiplier and charge a meter; a full meter spends on a clearing nova.

import {
  CHARGE, COMBO, ENEMY, FIELD, FX, TURRET, VAULT, WAVE,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_KILL = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE = 8;
export const EVENT_NOVA = 16;
export const EVENT_SHIELD = 32;
export const EVENT_SHOOT = 64;

const TAU = Math.PI * 2;
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

/** A fresh, empty world state. */
export function createWorld(rng) {
  const world = {
    rng,
    state: null,
    reset() {
      this.state = {
        rng: this.rng,
        time: 0,
        over: false,
        score: 0,
        bestCombo: 1,
        combo: 1,
        comboTimer: 0,
        energy: 0,
        wave: 0,
        waveTimer: WAVE.firstDelay,
        spawnLeft: 0,
        spawnTimer: 0,
        spawnedThisWave: 0,
        waveBudget: 0,
        vault: { shields: VAULT.shields, cooldown: 0, flash: 0 },
        turret: {
          angle: -Math.PI / 2,
          aim: -Math.PI / 2,
          orbit: TURRET.orbit,
          charge: 0,
          cooldown: 0,
          recoil: 0,
        },
        enemies: [],
        bolts: [],
        particles: [],
        rings: [],
        shake: 0,
        flash: 0,
        novaFlash: 0,
        kills: 0,
        shots: 0,
      };
    },
    /** Advance one fixed step. `control` supplies turn/radial/pointer/firing/edges from input. */
    step(dt, control, demo) {
      const s = this.state;
      let events = EVENT_NONE;
      if (s.over) {
        this._fx(dt, s);
        return events;
      }
      s.time += dt;
      s.vault.cooldown = Math.max(0, s.vault.cooldown - dt);
      s.vault.flash = Math.max(0, s.vault.flash - dt * 3);
      s.turret.cooldown = Math.max(0, s.turret.cooldown - dt);
      s.turret.recoil = Math.max(0, s.turret.recoil - dt * 6);

      // Combo decays if the player stops killing.
      if (s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 1;
      }

      this._turret(dt, s, control);

      // Fire edge: release a bolt whose weight follows how long the trigger was held.
      if (control && control.fireUp) {
        const t = s.turret;
        if (t.cooldown <= 0) {
          const held = clamp(t.charge / CHARGE.fullSeconds, 0, 1);
          const heavy = held >= 0.999;
          this._fire(s, t.aim, heavy, held);
          events |= EVENT_SHOOT;
          t.cooldown = TURRET.fireCooldown * (heavy ? 1.8 : 1);
        }
        t.charge = 0;
      } else if (control && control.firing) {
        s.turret.charge = clamp(s.turret.charge + dt, 0, CHARGE.fullSeconds);
      }

      // Nova: spend a full meter on a screen-wide clearing pulse.
      if (control && control.nova && s.energy >= CHARGE.novaCost) {
        s.energy = 0;
        events |= this._nova(s);
      }

      // Waves.
      if (s.spawnLeft > 0) {
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          this._spawnOne(s);
          s.spawnLeft -= 1;
          s.spawnedThisWave += 1;
          s.spawnTimer = Math.max(WAVE.minInterval, WAVE.spawnInterval - s.wave * WAVE.intervalPerWave);
        }
      } else if (s.enemies.length === 0) {
        s.waveTimer -= dt;
        if (s.waveTimer <= 0) {
          this._nextWave(s);
          events |= EVENT_WAVE;
        }
      }

      this._enemies(dt, s);
      this._bolts(dt, s, (killed, x, y, color, big) => {
        events |= EVENT_KILL;
        s.kills += 1;
        s.score += Math.round(killed.score * s.combo);
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.comboTimer = COMBO.window;
        s.combo = Math.min(COMBO.max, 1 + Math.floor(s.kills / COMBO.step) * 1);
        s.energy = clamp(s.energy + (big ? 0.12 : 0.045), 0, 1);
        this._burst(s, x, y, color, big ? FX.burstBoss : FX.burst);
      });
      this._fx(dt, s);
      return events;
    },

    _turret(dt, s, control) {
      const t = s.turret;
      const turn = control ? control.turn : 0;
      const radial = control ? control.radial : 0;
      t.angle += turn * TURRET.turnSpeed * dt;
      t.orbit = clamp(t.orbit + radial * 150 * dt, TURRET.orbit - 34, TURRET.orbit + 46);
      const px = FIELD.cx + Math.cos(t.angle) * t.orbit;
      const py = FIELD.cy + Math.sin(t.angle) * t.orbit;
      const pointer = control && control.pointer;
      let target;
      if (pointer) target = Math.atan2(pointer.y - py, pointer.x - px);
      else {
        // Aim outward from the centre along the turret's own position — the default posture —
        // plus the steering angle, so keyboard-only play still points where it moves.
        target = t.angle;
      }
      t.aim += angDiff(target, t.aim) * clamp(TURRET.aimLerp * dt * 60, 0, 1);
    },

    _fire(s, aim, heavy, held) {
      const t = s.turret;
      const px = FIELD.cx + Math.cos(t.angle) * t.orbit;
      const py = FIELD.cy + Math.sin(t.angle) * t.orbit;
      const weight = heavy ? CHARGE.heavyMultiplier : 1 + held * 0.5;
      const speed = TURRET.boltSpeed * (heavy ? 1.15 : 1);
      s.bolts.push({
        x: px + Math.cos(aim) * (TURRET.radius + 6),
        y: py + Math.sin(aim) * (TURRET.radius + 6),
        vx: Math.cos(aim) * speed,
        vy: Math.sin(aim) * speed,
        life: TURRET.boltLife,
        radius: TURRET.boltRadius * (heavy ? 2.1 : 1),
        damage: weight,
        heavy,
        pierce: heavy ? 3 : 0,
        trail: [],
      });
      s.shots += 1;
      t.recoil = 1;
      s.shake = Math.max(s.shake, heavy ? 6 : 2);
      this._burst(s, px, py, heavy ? '#fff3b0' : '#8ff6ff', heavy ? 10 : 4);
    },

    _nova(s) {
      s.novaFlash = 1;
      s.shake = 12;
      this._ring(s, FIELD.cx, FIELD.cy, CHARGE.novaRadius, '#eafcff');
      let cleared = 0;
      for (const e of s.enemies) {
        if (!e.active) continue;
        cleared += 1;
        this._damage(s, e, 999, e.x, e.y);
      }
      s.score += cleared * 8 * s.combo;
      return EVENT_NOVA;
    },

    _nextWave(s) {
      s.wave += 1;
      s.waveBudget = WAVE.baseBudget + s.wave * WAVE.budgetPerWave;
      s.spawnLeft = s.waveBudget;
      s.spawnedThisWave = 0;
      s.spawnTimer = 0.2;
      s.waveTimer = WAVE.between;
      // A shield pip is restored every few cleared waves, never past the maximum.
      if (s.wave > 1 && (s.wave - 1) % VAULT.regenEvery === 0 && s.vault.shields < VAULT.shields) {
        s.vault.shields += 1;
      }
      this._ring(s, FIELD.cx, FIELD.cy, 180, '#48e0d0');
    },

    _spawnOne(s) {
      const isBoss = s.wave % WAVE.bossEvery === 0 && s.spawnedThisWave === s.waveBudget - 1;
      let kind;
      if (isBoss) kind = 'boss';
      else {
        const roll = s.rng.next();
        const w = s.wave;
        kind = roll < 0.46 ? 'runner'
          : roll < 0.68 ? 'drifter'
          : roll < 0.86 && w >= 2 ? 'splitter'
          : w >= 3 ? 'shield' : 'runner';
      }
      const base = ENEMY[kind];
      const hpScale = 1 + Math.floor(s.wave / WAVE.hpEvery);
      const angle = s.rng.angle();
      const dist = 700 + s.rng.range(0, 90);
      const speed = base.speed * (1 + s.wave * WAVE.speedPerWave);
      s.enemies.push({
        active: true,
        kind,
        x: FIELD.cx + Math.cos(angle) * dist,
        y: FIELD.cy + Math.sin(angle) * dist,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        speed,
        radius: base.radius,
        hp: base.hp * (kind === 'boss' ? 1 : hpScale),
        maxHp: base.hp * (kind === 'boss' ? 1 : hpScale),
        score: base.score,
        spin: base.spin,
        rot: s.rng.angle(),
        wobble: base.wobble || 0,
        phase: s.rng.angle(),
        frontArc: base.frontArc || 0,
        hitFlash: 0,
        gen: 0,
      });
    },

    _enemies(dt, s) {
      const v = s.vault;
      for (const e of s.enemies) {
        if (!e.active) { e.deadTimer = Math.max(0, (e.deadTimer || 0) - dt); continue; }
        e.rot += e.spin * dt;
        e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
        let vx = e.vx, vy = e.vy;
        if (e.wobble) {
          // Perpendicular sine weave makes drifters hard to lead.
          const px = -e.vy, py = e.vx;
          const len = Math.hypot(px, py) || 1;
          const w = Math.sin(s.time * e.wobble + e.phase) * 0.75;
          vx += (px / len) * e.speed * w;
          vy += (py / len) * e.speed * w;
        }
        e.x += vx * dt;
        e.y += vy * dt;
        const dx = e.x - FIELD.cx, dy = e.y - FIELD.cy;
        const dist = Math.hypot(dx, dy) || 1;
        // Reaching the vault damages it; the intruder is consumed.
        if (dist < VAULT.radius + e.radius) {
          e.active = false;
          if (v.cooldown <= 0) {
            v.shields -= 1;
            v.cooldown = VAULT.hitCooldown;
            v.flash = 1;
            s.shake = 14;
            s.combo = 1;
            s.comboTimer = 0;
            this._ring(s, FIELD.cx, FIELD.cy, VAULT.radius + 40, '#ff5d73');
            this._burst(s, e.x, e.y, '#ff5d73', 18);
            if (v.shields <= 0) s.over = true;
          }
        }
      }
    },

    _bolts(dt, s, onKill) {
      for (const b of s.bolts) {
        if (b.life <= 0) continue;
        b.life -= dt;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > FX.trail) b.trail.shift();
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) { b.life = 0; continue; }
        for (const e of s.enemies) {
          if (!e.active) continue;
          const dx = e.x - b.x, dy = e.y - b.y;
          if (dx * dx + dy * dy > (e.radius + b.radius) ** 2) continue;
          // A shield-bearer deflects shots that arrive from the arc it faces.
          if (e.frontArc > 0) {
            const incoming = Math.atan2(-b.vy, -b.vx);
            const facing = Math.atan2(e.y - FIELD.cy, e.x - FIELD.cx) + Math.PI;
            if (Math.abs(angDiff(incoming, facing)) < e.frontArc && !b.heavy) {
              b.life = 0;
              this._burst(s, b.x, b.y, '#ffcf5c', 5);
              break;
            }
          }
          const wasAlive = e.hp > 0;
          this._damage(s, e, b.damage, b.x, b.y);
          if (b.pierce > 0) b.pierce -= 1;
          else b.life = 0;
          if (wasAlive && !e.active) {
            if (e.kind === 'splitter' && e.gen === 0) this._split(s, e);
            onKill(e, e.x, e.y, this._enemyColor(e.kind), e.kind === 'boss');
          }
          break;
        }
      }
      s.bolts = s.bolts.filter((b) => b.life > 0);
      s.enemies = s.enemies.filter((e) => e.active || e.deadTimer > 0);
    },

    _damage(s, e, amount, x, y) {
      e.hp -= amount;
      e.hitFlash = 1;
      this._burst(s, x, y, '#ffffff', 3);
      if (e.hp <= 0) {
        e.active = false;
        e.deadTimer = 0.01;
      }
    },

    _split(s, e) {
      const base = ENEMY.runner;
      for (let i = 0; i < ENEMY.splitter.splitInto; i += 1) {
        const a = i / ENEMY.splitter.splitInto * TAU + e.rot;
        const speed = e.speed * 1.25;
        s.enemies.push({
          active: true, kind: 'runner', gen: 1,
          x: e.x + Math.cos(a) * (e.radius + 4),
          y: e.y + Math.sin(a) * (e.radius + 4),
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          speed, radius: base.radius, hp: 1, maxHp: 1, score: Math.round(base.score / 2),
          spin: base.spin, rot: a, wobble: 0, phase: 0, frontArc: 0, hitFlash: 0, deadTimer: 0,
        });
      }
    },

    _enemyColor(kind) {
      switch (kind) {
        case 'splitter': return '#c08bff';
        case 'shield': return '#ffcf5c';
        case 'drifter': return '#5ff2a8';
        case 'boss': return '#ff7ad9';
        default: return '#ff5d73';
      }
    },

    _burst(s, x, y, color, n) {
      for (let i = 0; i < n; i += 1) {
        const a = s.rng.angle();
        const speed = s.rng.range(40, 260);
        s.particles.push({
          x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          life: s.rng.range(0.25, 0.7), maxLife: 0.7, color, radius: s.rng.range(1.2, 3.4),
        });
      }
    },

    _ring(s, x, y, radius, color) {
      s.rings.push({ x, y, r: 8, target: radius, life: 0.55, maxLife: 0.55, color });
    },

    _fx(dt, s) {
      for (const p of s.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
      }
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const r of s.rings) {
        r.life -= dt;
        r.r += (r.target - r.r) * Math.min(1, dt * 8);
      }
      s.rings = s.rings.filter((r) => r.life > 0);
      s.shake = Math.max(0, s.shake - FX.shakeDecay * dt * 12);
      s.flash = Math.max(0, s.flash - FX.flashDecay * dt);
      s.novaFlash = Math.max(0, s.novaFlash - dt * 2.2);
    },
  };
  world.reset();
  return world;
}
