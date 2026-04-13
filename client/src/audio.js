// Procedural lo-fi audio — all Web Audio API, zero files
// Everything goes through a low-pass "CRT speaker" filter

let ctx = null;
let masterGain = null;
let lofiFilter = null;
let musicGain = null;
let initialized = false;

// Pentatonic scale for generative music (C major pentatonic)
const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
let musicInterval = null;
let musicSpeed = 500; // ms between notes

export function initAudio() {
  if (initialized) return;

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master chain: source → lofi filter → master gain → destination
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(ctx.destination);

    // Lo-fi CRT speaker filter
    lofiFilter = ctx.createBiquadFilter();
    lofiFilter.type = 'lowpass';
    lofiFilter.frequency.value = 3500; // muffled warmth
    lofiFilter.Q.value = 0.7;
    lofiFilter.connect(masterGain);

    // Music gain (separate volume)
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(lofiFilter);

    initialized = true;
  } catch (e) {
    console.warn('Audio init failed:', e);
  }
}

// Must call on first user gesture
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

// --- Sound effects ---

export function playJump(speedRatio = 0) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180 + speedRatio * 120, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(400 + speedRatio * 200, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(lofiFilter);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

export function playLand() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 80;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(lofiFilter);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

export function playWallBounce() {
  if (!ctx) return;
  // Snappy noise pop
  const bufSize = ctx.sampleRate * 0.04;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.18;
  src.connect(gain);
  gain.connect(lofiFilter);
  src.start(ctx.currentTime);
}

export function playCombo(level = 2) {
  if (!ctx) return;
  // Ascending chime — pitch rises with combo level
  const baseFreq = 400 + level * 60;
  for (let i = 0; i < Math.min(level, 5); i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const t = ctx.currentTime + i * 0.06;
    osc.frequency.value = baseFreq + i * 80;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(lofiFilter);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

export function playCrumble() {
  if (!ctx) return;
  const bufSize = ctx.sampleRate * 0.25;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / bufSize;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  const gain = ctx.createGain();
  gain.gain.value = 0.12;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(lofiFilter);
  src.start(ctx.currentTime);
}

export function playElimination() {
  if (!ctx) return;
  // Static burst + low drone
  const bufSize = ctx.sampleRate * 0.4;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / bufSize;
    data[i] = (Math.random() * 2 - 1) * (1 - t * 0.8);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  src.connect(gain);
  gain.connect(lofiFilter);
  src.start(ctx.currentTime);

  // Low drone
  const osc = ctx.createOscillator();
  const dGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55;
  dGain.gain.setValueAtTime(0.2, ctx.currentTime);
  dGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(dGain);
  dGain.connect(lofiFilter);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

export function playRoundStart() {
  if (!ctx) return;
  // 3-note ascending chime
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const t = ctx.currentTime + i * 0.12;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain);
    gain.connect(lofiFilter);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

// --- Generative background music ---

export function startMusic() {
  if (!ctx || musicInterval) return;
  let noteIdx = 0;

  musicInterval = setInterval(() => {
    if (ctx.state !== 'running') return;
    const freq = PENTA[noteIdx % PENTA.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    // Occasional bass note
    if (noteIdx % 4 === 0) {
      const bass = ctx.createOscillator();
      const bGain = ctx.createGain();
      bass.type = 'sine';
      bass.frequency.value = freq / 4;
      bGain.gain.setValueAtTime(0.1, ctx.currentTime);
      bGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      bass.connect(bGain);
      bGain.connect(musicGain);
      bass.start(ctx.currentTime);
      bass.stop(ctx.currentTime + 0.6);
    }

    noteIdx++;
  }, musicSpeed);
}

export function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

// Speed up music as game gets more intense
export function setMusicIntensity(intensity) {
  // intensity: 0 (calm) to 1 (max tension)
  musicSpeed = Math.max(180, 500 - intensity * 300);
  if (musicGain) {
    musicGain.gain.value = 0.12 + intensity * 0.08;
  }
  if (lofiFilter) {
    // Open up the filter as intensity increases
    lofiFilter.frequency.value = 3500 + intensity * 2000;
  }

  // Restart with new speed
  if (musicInterval) {
    stopMusic();
    startMusic();
  }
}
