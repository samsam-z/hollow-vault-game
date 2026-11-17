// Procedural sound. Every effect is synthesised with the Web Audio API at the moment it happens:
// short oscillator blips and filtered noise bursts for shots, hits, kills, the nova and the vault
// being struck. No audio file is loaded, so the game stays a self-contained static page.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

/** A pitched blip with an exponential decay. */
function tone(freq, endFreq, duration, type, volume) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain); gain.connect(master);
  osc.start(t); osc.stop(t + duration + 0.02);
}

/** A short burst of white noise through a band-pass, for impacts and explosions. */
function noise(duration, center, volume) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = center;
  filter.Q.value = 0.8;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(filter); filter.connect(gain); gain.connect(master);
  src.start(t);
}

export function soundFire(heavy) {
  if (heavy) { tone(420, 120, 0.22, 'sawtooth', 0.18); noise(0.12, 900, 0.1); }
  else tone(680, 300, 0.08, 'square', 0.06);
}
export function soundKill(big) {
  if (big) { noise(0.5, 320, 0.3); tone(160, 40, 0.5, 'sawtooth', 0.2); }
  else { noise(0.16, 900, 0.12); tone(520, 220, 0.1, 'triangle', 0.07); }
}
export function soundHit() {
  tone(180, 60, 0.4, 'sawtooth', 0.25);
  noise(0.3, 200, 0.22);
}
export function soundNova() {
  tone(120, 900, 0.5, 'sine', 0.3);
  noise(0.6, 1600, 0.24);
}
export function soundWave() {
  tone(330, 660, 0.25, 'triangle', 0.12);
  tone(495, 990, 0.3, 'sine', 0.08);
}
export function toggleMute() { muted = !muted; return muted; }
