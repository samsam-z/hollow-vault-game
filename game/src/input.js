// Keyboard and pointer input for Hollow Vault.
// The turret aims with the pointer or the A/D and arrow keys. Firing is a hold: pressing charges the
// shot and releasing fires it, so a light tap is a quick bolt and a held press is a heavy piercer.
// A separate key (or right click) spends a full charge meter on the screen-clearing nova.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOVA = 4;
export const ACTION_FIRE_DOWN = 8;
export const ACTION_FIRE_UP = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const NOVA = new Set(['KeyE', 'ShiftLeft', 'ShiftRight']);
const FIRE = new Set(['Space']);

export function createInput(target) {
  let left = false, right = false, up = false, down = false;
  let pointerX = null, pointerY = null;
  let actions = 0;
  let firing = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (NOVA.has(event.code)) { if (!event.repeat) actions |= ACTION_NOVA; }
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (FIRE.has(event.code)) {
      if (!event.repeat && !firing) { firing = true; actions |= ACTION_FIRE_DOWN; }
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (FIRE.has(event.code) && firing) { firing = false; actions |= ACTION_FIRE_UP; }
  });

  window.addEventListener('blur', () => {
    left = right = up = down = false;
    if (firing) { firing = false; actions |= ACTION_FIRE_UP; }
  });

  target.addEventListener('pointermove', (event) => {
    const r = target.getBoundingClientRect();
    pointerX = ((event.clientX - r.left) / r.width) * 1280;
    pointerY = ((event.clientY - r.top) / r.height) * 720;
  });
  target.addEventListener('pointerleave', () => { pointerX = null; pointerY = null; });
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (event.button === 2) { actions |= ACTION_NOVA; return; }
    if (!firing) { firing = true; actions |= ACTION_FIRE_DOWN; }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 2) return;
    if (firing) { firing = false; actions |= ACTION_FIRE_UP; }
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** -1 left, 1 right, 0 otherwise. */
    turn() { return (right ? 1 : 0) - (left ? 1 : 0); },
    /** -1 inward, 1 outward: nudges the orbit radius for dodging. */
    radial() { return (down ? 1 : 0) - (up ? 1 : 0); },
    /** Pointer position in logical coordinates, or null when the pointer is not on the canvas. */
    pointer() { return pointerX === null ? null : { x: pointerX, y: pointerY }; },
    isFiring() { return firing; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
