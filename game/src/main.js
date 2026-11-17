// Hollow Vault — boot and the one loop. Input is polled each frame, the world advances in fixed
// 1/60 s steps, the renderer paints the current state. Four screens: title, play, paused, game over.
//
// ?seed=N fixes the intruder pattern. ?shot=start|play|end stages a deterministic scene and sets
// window.__shotReady after two paints so a browser can capture a genuine frame of the game.
import { DEFAULT_SEED, BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_NOVA, EVENT_OVER, EVENT_SHOOT, EVENT_WAVE } from './world.js';
import {
  ACTION_CONFIRM, ACTION_FIRE_UP, ACTION_NOVA, ACTION_PAUSE, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import {
  soundFire, soundHit, soundKill, soundNova, soundWave, toggleMute, unlock,
} from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function saveBest(v) {
  try { window.localStorage.setItem(BEST_KEY, String(v)); }
  catch { /* storage may be disabled; best then lasts this visit only */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // Screenshot capture: force the canvas backing store to the full 1280x720 logical field and
  // export it into an <img>. Headless Chrome reliably captures DOM images (unlike a canvas layer),
  // so this yields a crisp, whole-frame render of the game's own code at the exact target size.
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  canvas.width = 1280;
  canvas.height = 720;
  renderer.resize();
  renderer.draw(world.state, scene.screen, scene.best);
  const capture = document.getElementById('capture');
  capture.src = canvas.toDataURL('image/jpeg', 0.94);
  capture.style.display = 'block';
  canvas.style.display = 'none';
  window.__shotReady = true;
  status.textContent = 'SHOT ' + name + ' READY score=' + world.state.score + ' enemies=' + world.state.enemies.length;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(msg) { status.textContent = msg; }
  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    unlock();
    announce('Playing. Three vault shields.');
  }
  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
    announce(`Vault fallen. Score ${world.state.score}. Best ${best}.`);
  }

  function controlFrame() {
    const a = input.takeActions();
    return {
      turn: input.turn(),
      radial: input.radial(),
      pointer: input.pointer(),
      firing: input.isFiring(),
      fireUp: !!(a & ACTION_FIRE_UP),
      nova: !!(a & ACTION_NOVA),
      confirm: !!(a & ACTION_CONFIRM),
      pause: !!(a & ACTION_PAUSE),
      actions: a,
    };
  }

  function step(control) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { turn: 0, radial: 0, pointer: null, firing: false }, false);
      return;
    }
    const events = world.step(STEP, {
      turn: control.turn, radial: control.radial, pointer: control.pointer,
      firing: control.firing, fireUp: control.fireUp, nova: control.nova,
    }, false);
    if (events & EVENT_SHOOT) soundFire(world.state.turret.recoil > 0.8);
    if (events & EVENT_KILL) soundKill(false);
    if (events & EVENT_HIT) { soundHit(); announce(`Vault hit. ${world.state.vault.shields} shields left.`); }
    if (events & EVENT_NOVA) soundNova();
    if (events & EVENT_WAVE) { soundWave(); announce(`Wave ${world.state.wave}.`); }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const control = controlFrame();

    if (control.confirm && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (control.pause) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }

    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_PLAY) { step(control); accumulator -= STEP; }
    } else if (screen === SCREEN_TITLE) {
      accumulator += dt;
      while (accumulator >= STEP) { step(control); accumulator -= STEP; }
    } else accumulator = 0;

    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) announce(toggleMute() ? 'Sound off.' : 'Sound on.');
  });

  announce('Hollow Vault. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
