// A small, fast, deterministic PRNG (mulberry32). The same seed always yields the same wave of
// intruders, which is what makes the staged screenshots reproducible frame for frame.
export function createRandom(seed) {
  let s = seed >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [lo, hi). */
    range(lo, hi) { return lo + next() * (hi - lo); },
    /** An integer in [lo, hi]. */
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    /** True with probability p. */
    chance(p) { return next() < p; },
    /** A random angle in radians. */
    angle() { return next() * Math.PI * 2; },
    /** Pick one element of an array. */
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
  };
}
