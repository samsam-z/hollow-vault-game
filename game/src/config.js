// Hollow Vault — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer letterboxes it into the window, so
// no rule depends on the real screen size. The player orbits a central vault with a turret and
// fires bolts outward at geometric intruders that close in from all sides.

export const FIELD = { width: 1280, height: 720, cx: 640, cy: 360 };

/** Fixed simulation step (seconds). Rendering interpolates; rules never depend on frame rate. */
export const STEP = 1 / 60;

/** The vault at the centre and its three shield pips. */
export const VAULT = {
  radius: 46,
  shields: 3,
  hitCooldown: 1.1,   // seconds of grace after a hit
  regenEvery: 5,      // one shield regenerated every N waves cleared
};

/** The orbiting turret. */
export const TURRET = {
  orbit: 96,          // distance from the centre
  radius: 13,
  turnSpeed: 3.9,     // radians per second with a key held
  aimLerp: 0.28,      // how fast the aim follows the mouse each frame
  fireCooldown: 0.16, // seconds between bolts
  boltSpeed: 720,
  boltLife: 1.35,
  boltRadius: 4,
};

/** Charge weapon: hold fire to fill, release for a heavy piercing shot; full meter can unleash a nova. */
export const CHARGE = {
  fullSeconds: 0.85,
  heavyMultiplier: 2.7,
  novaCost: 1,
  novaRadius: 560,
};

/** Combo: consecutive kills within a window raise a score multiplier. */
export const COMBO = {
  window: 2.6,
  step: 4,        // every 4 hits raises the multiplier by one
  max: 8,
};

/** The four intruder archetypes. Values are bases; waves scale them. */
export const ENEMY = {
  runner:  { radius: 15, speed: 88,  hp: 1, score: 10, color: 'runner', spin: 2.2 },
  splitter:{ radius: 20, speed: 62,  hp: 2, score: 18, color: 'splitter', spin: 1.2, splitInto: 3 },
  shield:  { radius: 24, speed: 46,  hp: 4, score: 30, color: 'shield', spin: 0.8, frontArc: 1.1 },
  drifter: { radius: 13, speed: 70,  hp: 1, score: 14, color: 'drifter', spin: 3.0, wobble: 2.4 },
  boss:    { radius: 52, speed: 26,  hp: 48, score: 400, color: 'boss', spin: 0.5 },
};

/** Wave pacing. Each wave spawns a budget of enemies, faster and denser as waves climb. */
export const WAVE = {
  firstDelay: 1.1,
  between: 1.8,
  baseBudget: 8,
  budgetPerWave: 3,
  spawnInterval: 0.72,
  intervalPerWave: 0.045,
  minInterval: 0.24,
  speedPerWave: 0.09,
  hpEvery: 4,
  bossEvery: 5,
  maxWaves: 12,
};

/** Particle and feedback tuning. */
export const FX = {
  burst: 12,
  burstBoss: 46,
  trail: 6,
  shakeDecay: 5.5,
  flashDecay: 3.2,
};

/** The seeded PRNG's initial state. ?seed=N may override it for reproducible screenshots. */
export const DEFAULT_SEED = 0x9e3779b9;

/** Where the best score persists between visits (this browser only). */
export const BEST_KEY = 'hollow-vault.best';

/** Neon-on-indigo art direction. */
export const PALETTE = {
  space: '#080b18',
  space2: '#0e1428',
  grid: 'rgba(90,120,190,0.07)',
  vault: '#48e0d0',
  vaultGlow: 'rgba(72,224,208,0.22)',
  vaultCore: '#d7fff8',
  turret: '#bfe9ff',
  bolt: '#8ff6ff',
  heavyBolt: '#fff3b0',
  shield: '#7fe3ff',
  runner: '#ff5d73',
  splitter: '#c08bff',
  shieldEnemy: '#ffcf5c',
  drifter: '#5ff2a8',
  boss: '#ff7ad9',
  text: '#eaf2ff',
  muted: '#8aa0c4',
  dim: '#54688f',
  good: '#5ff2a8',
  warn: '#ffcf5c',
  panel: 'rgba(14,20,40,0.78)',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
