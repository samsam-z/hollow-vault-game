// Screenshot staging for Hollow Vault. For ?shot=start|play|end with a fixed seed, this drives the
// real rules forward under a simple pilot so every frame is a genuine moment of play and the same
// seed reproduces it exactly. No frame is edited or composited after capture.
//   start: the vault at rest under the title.
//   play:  a lively mid-game moment, many hostiles inbound, a healthy score and combo.
//   end:   the same rules played passively until the shields fall, showing the results and restart.
import { CHARGE, FIELD, STEP, TURRET } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PLAY_LIMIT = 90;
const END_LIMIT = 1200;
const PASSIVE = { turn: 0, radial: 0, pointer: null, firing: false, fireUp: false, nova: false };

/** Nearest active intruder to the turret. */
function nearest(s) {
  const t = s.turret;
  const px = FIELD.cx + Math.cos(t.angle) * t.orbit;
  const py = FIELD.cy + Math.sin(t.angle) * t.orbit;
  let best = null, bd = Infinity;
  for (const e of s.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** An aiming-and-firing pilot that never uses the nova and never dodges: it scores, but the vault
 *  will eventually fall. Used for both the lively play frame and the game-over frame. */
function combat(s, m) {
  const target = nearest(s);
  const px = FIELD.cx + Math.cos(s.turret.angle) * s.turret.orbit;
  const py = FIELD.cy + Math.sin(s.turret.angle) * s.turret.orbit;
  let aim = -Math.PI / 2;
  if (target) {
    const dist = Math.hypot(target.x - FIELD.cx, target.y - FIELD.cy);
    const travel = dist / TURRET.boltSpeed;
    aim = Math.atan2(target.y + target.vy * travel - py, target.x + target.vx * travel - px);
  }
  const control = {
    turn: 0, radial: 0,
    pointer: { x: px + Math.cos(aim) * 100, y: py + Math.sin(aim) * 100 },
    firing: false, fireUp: false, nova: false,
  };
  m.tick += 1;
  if (target) {
    if (!m.firing) { m.firing = true; m.hold = 0; }
    m.hold += STEP;
    control.firing = true;
    if (m.hold >= (m.heavy ? CHARGE.fullSeconds : 0.15)) {
      control.fireUp = true;
      m.firing = false;
      m.hold = 0;
      m.heavy = !m.heavy;
    }
  } else m.firing = false;
  return control;
}

/** Set the world to a staged scene; return the screen to draw and the score to show as best. */
export function stageShot(name, world) {
  const s = world.state;
  if (name === 'start') {
    for (let i = 0; i < 0.3 / STEP; i += 1) world.step(STEP, PASSIVE, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const m = { tick: 0, firing: false, hold: 0, heavy: false };
  if (name === 'end') {
    // Fight without dodging or novas: real score and kills accumulate, then the shields run out.
    for (let i = 0; i < END_LIMIT / STEP; i += 1) {
      if (world.step(STEP, combat(s, m), true) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: s.score };
  }
  // Play: stop at a dense, scoring moment with intruders that have closed into the middle of the
  // field, so the still shows real combat rather than enemies still off at the spawn edge.
  for (let i = 0; i < PLAY_LIMIT / STEP; i += 1) {
    if (world.step(STEP, combat(s, m), true) & EVENT_OVER) break;
    const live = s.enemies.filter((e) => e.active);
    const closing = live.filter((e) => Math.hypot(e.x - FIELD.cx, e.y - FIELD.cy) < 300).length;
    if (s.wave >= 2 && s.score >= 250 && closing >= 4 && live.length >= 8) break;
  }
  return { screen: s.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(s.score, 0) };
}
