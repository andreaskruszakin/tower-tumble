// mulberry32 — fast 32-bit seeded PRNG
// Same seed = identical sequence on server and all clients

export function createRNG(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Utility: random float in range [min, max)
export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Utility: random int in range [min, max]
export function rngInt(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

// Utility: pick random element from array
export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
