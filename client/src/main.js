import * as THREE from 'three';
import { createCharacter, animateCharacter, triggerLandSquash, triggerJumpStretch, triggerBackflip } from './character.js';
import { initInput, updateInput, input, requestGyroPermission, getChargeRatio } from './input.js';
import { createCamera, updateCamera, triggerShake, getCamera } from './camera.js';
import { generatePlatforms, getPlatforms, updatePlatforms, triggerCrumble, getBounciness, isSpiked, cullPlatformsBelowY, extendPlatformsIfNeeded } from './platforms.js';
import { initVHS, updateVHS, triggerGlitch, renderVHS, setMobileMode } from './vhs.js';
import { initAudio, resumeAudio, playJump, playLand, playWallBounce, playCombo, playCrumble, playElimination, playRoundStart, startMusic, stopMusic, setMusicIntensity } from './audio.js';
import {
  TOWER_WIDTH, HALF_WIDTH, GRAVITY, BASE_JUMP_VELOCITY, MAX_JUMP_VELOCITY,
  CHARGED_JUMP_BONUS, CHARGE_TIME,
  MOMENTUM_JUMP_SCALE, MAX_HORIZONTAL_SPEED, HORIZONTAL_ACCEL,
  GROUND_FRICTION, AIR_FRICTION, WALL_BOUNCE_FACTOR, WALL_BOUNCE_BOOST,
  CHAR_WIDTH, PLATFORM_HEIGHT,
  BIOMES, WALL_COLOR,
  CAMERA_SCROLL_START, CAMERA_SCROLL_ACCEL, CAMERA_SCROLL_INTERVAL, CAMERA_SCROLL_MAX,
  COMBO_TIERS, CAMERA_DISTANCE, LAYER_SPACING,
} from './constants.js';

// --- Renderer ---
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1410);
const isMobile = navigator.maxTouchPoints > 0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xFFB7A5, 0.008);

// Flat lighting
const ambient = new THREE.AmbientLight(0xFFFFFF, 0.85);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xFFF0E0, 0.3);
dirLight.position.set(3, 10, 5);
scene.add(dirLight);

const camera = createCamera();
const vhsComposer = initVHS(renderer, scene, camera);
if (isMobile) setMobileMode();

// --- Walls ---
const wallGeo = new THREE.BoxGeometry(0.5, 1200, 1.5);
let wallMatL, wallMatR, wallL, wallR;
function createWalls(color) {
  if (wallL) { scene.remove(wallL); scene.remove(wallR); }
  wallMatL = new THREE.MeshBasicMaterial({ color });
  wallMatR = new THREE.MeshBasicMaterial({ color });
  wallL = new THREE.Mesh(wallGeo, wallMatL);
  wallL.position.set(-HALF_WIDTH - 0.25, 600, 0);
  scene.add(wallL);
  wallR = new THREE.Mesh(wallGeo, wallMatR);
  wallR.position.set(HALF_WIDTH + 0.25, 600, 0);
  scene.add(wallR);
}
createWalls(WALL_COLOR);

// Ground
const groundGeo = new THREE.BoxGeometry(TOWER_WIDTH, 0.5, 2);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x8BBF7A });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.set(0, -0.25, 0);
scene.add(ground);

// Sky
const skyGeo = new THREE.SphereGeometry(180, 16, 8);
const skyMat = new THREE.MeshBasicMaterial({ color: 0xFFB7A5, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Platforms
let gameSeed = Math.floor(Math.random() * 0xFFFFFFFF);
generatePlatforms(scene, gameSeed);

// Player — feet on ground (ground top = 0, character origin is at feet)
const player = createCharacter(0);
player.position.set(0, 0, 0);
scene.add(player);

// Shadow
const shadowGeo = new THREE.PlaneGeometry(0.8, 0.4);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
const shadow = new THREE.Mesh(shadowGeo, shadowMat);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// --- State ---
const state = {
  x: 0, y: 0, vx: 0, vy: 0,
  isGrounded: true, lastGroundY: 0,
  alive: true, maxHeight: 0,
  combo: 0, bestCombo: 0,
  currentPlatform: null,
  points: 0,
};

// Death line — follows player, not linear
const deathLine = {
  y: -5,
  started: false,
  gameTime: 0,
};

let currentBiomeIdx = 0;
let gameStarted = false; // start screen dismissed

// --- UI refs ---
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const pointsEl = document.getElementById('points');
const comboEl = document.getElementById('combo-container');
const splashEl = document.getElementById('combo-splash');
const biomeNameEl = document.getElementById('biome-name');
const momentumEl = document.getElementById('momentum-label');
const speedLinesEl = document.getElementById('speed-lines');
const chargeBar = document.getElementById('charge-bar');
const chargeFill = document.getElementById('charge-fill');
const gameOverEl = document.getElementById('game-over');
const goHeightEl = document.getElementById('go-height');
const goPointsEl = document.getElementById('go-points');
const goComboEl = document.getElementById('go-combo');
const goBestEl = document.getElementById('go-best');
const lbList = document.getElementById('lb-list');
const nameInput = document.getElementById('name-input');
const submitBtn = document.getElementById('submit-score');
const submitStatus = document.getElementById('submit-status');

let splashTimeout = null;

const API_URL = 'https://tower-tumble-leaderboard.aicursus.workers.dev';

// Restore saved name
nameInput.value = localStorage.getItem('tt-name') || '';

// --- Global Leaderboard ---
async function fetchLeaderboard() {
  lbList.textContent = 'LOADING...';
  try {
    const res = await fetch(`${API_URL}/scores`);
    const scores = await res.json();
    if (scores.length === 0) {
      lbList.textContent = 'NO SCORES YET';
      return;
    }
    lbList.innerHTML = scores.slice(0, 10).map((entry, i) => {
      const medal = i === 0 ? '♛' : i === 1 ? '♕' : i === 2 ? '���' : `${i + 1}.`;
      return `<div>${medal} ${entry.name} — ${entry.points} PTS (FL ${entry.floor})</div>`;
    }).join('');
  } catch {
    lbList.textContent = 'OFFLINE';
  }
}

async function submitScore(name, points, floor, combo) {
  submitBtn.disabled = true;
  submitStatus.classList.remove('hidden');
  submitStatus.textContent = 'SUBMITTING...';
  try {
    const res = await fetch(`${API_URL}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points, floor, combo }),
    });
    const data = await res.json();
    submitStatus.textContent = `RANK #${data.rank}!`;
    localStorage.setItem('tt-name', name);
    // Refresh leaderboard
    await fetchLeaderboard();
  } catch {
    submitStatus.textContent = 'SUBMIT FAILED';
    submitBtn.disabled = false;
  }
}

// Local high score tracking
function getLocalBest() {
  return parseInt(localStorage.getItem('tt-best') || '0', 10);
}
function setLocalBest(pts) {
  localStorage.setItem('tt-best', String(pts));
}

// --- Combo splash ---
function showComboSplash(combo) {
  let tier = null;
  for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
    if (combo >= COMBO_TIERS[i].min) { tier = COMBO_TIERS[i]; break; }
  }
  if (!tier) return;
  splashEl.textContent = `${tier.label} x${combo}`;
  splashEl.style.color = tier.color;
  splashEl.classList.remove('show');
  void splashEl.offsetWidth;
  splashEl.classList.add('show');
  clearTimeout(splashTimeout);
  splashTimeout = setTimeout(() => splashEl.classList.remove('show'), 700);
}

function showBiomeName(name) {
  biomeNameEl.textContent = name;
  biomeNameEl.classList.remove('show');
  void biomeNameEl.offsetWidth;
  biomeNameEl.classList.add('show');
}

// --- Input ---
initInput(canvas);

// --- Start screen ---
startScreen.addEventListener('pointerdown', () => {
  if (gameStarted) return;
  gameStarted = true;
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  initAudio();
  resumeAudio();
});

// --- Resize ---
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (vhsComposer) vhsComposer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game loop ---
let lastTime = performance.now();

function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updateVHS(dt);

  // Before game starts — just render scene behind start screen
  if (!gameStarted) {
    renderVHS() || renderer.render(scene, camera);
    return;
  }

  if (!state.alive) {
    renderVHS() || renderer.render(scene, camera);
    return;
  }

  updateInput(dt);

  // First real input starts the death line
  if (!deathLine.started && (input.horizontal !== 0 || input.jump || input.jumpHeld)) {
    deathLine.started = true;
    requestGyroPermission();
    playRoundStart();
    startMusic();
  }

  // --- Death line — always creeping up, faster the higher you are ---
  if (deathLine.started) {
    deathLine.gameTime += dt;

    // Base speed increases over time
    const speedUps = Math.floor(deathLine.gameTime / CAMERA_SCROLL_INTERVAL);
    const timeSpeed = Math.min(CAMERA_SCROLL_MAX, CAMERA_SCROLL_START + speedUps * CAMERA_SCROLL_ACCEL);

    // Height bonus: the higher you are, the faster the death line moves
    const heightSpeed = state.maxHeight * 0.008;

    // Combined: always pushing up relentlessly
    const totalSpeed = timeSpeed + heightSpeed;
    deathLine.y += totalSpeed * dt;

    // Death line can never be more than 10 units below player (tight leash)
    deathLine.y = Math.max(deathLine.y, state.maxHeight - 10);

    // Death: fall below death line
    if (state.y < deathLine.y) {
      showGameOver();
      return;
    }
  }

  // --- Platforms — generate ahead based on max of player and camera ---
  extendPlatformsIfNeeded(Math.max(state.y, getCamera().position.y));
  updatePlatforms(dt, deathLine.gameTime);

  // --- Biome transitions ---
  const biome = getCurrentBiome(state.y);
  const biomeIdx = BIOMES.indexOf(biome);
  if (biomeIdx !== currentBiomeIdx) {
    currentBiomeIdx = biomeIdx;
    showBiomeName(biome.name);
  }
  lerpSceneColors(biome, dt);

  // --- Movement ---
  const speedRatio = Math.abs(state.vx) / MAX_HORIZONTAL_SPEED;
  state.vx += input.horizontal * HORIZONTAL_ACCEL * dt;
  state.vx *= state.isGrounded ? GROUND_FRICTION : AIR_FRICTION;
  state.vx = Math.max(-MAX_HORIZONTAL_SPEED, Math.min(MAX_HORIZONTAL_SPEED, state.vx));

  // Momentum feedback
  if (speedRatio > 0.8) {
    momentumEl.classList.remove('hidden');
    speedLinesEl.style.opacity = (speedRatio - 0.8) * 3;
  } else {
    momentumEl.classList.add('hidden');
    speedLinesEl.style.opacity = 0;
  }

  // --- Charge bar ---
  if (input.jumpHeld && state.isGrounded) {
    chargeBar.classList.add('visible');
    const ratio = getChargeRatio();
    chargeFill.style.width = (ratio * 100) + '%';
    chargeFill.classList.toggle('full', ratio >= 0.95);
  } else {
    chargeBar.classList.remove('visible');
  }

  // --- Jump (tap = instant, hold = charge for bigger jump) ---
  if (input.consumeJump() && state.isGrounded) {
    const chargeRatio = getChargeRatio();
    let jumpVel = BASE_JUMP_VELOCITY + (MAX_JUMP_VELOCITY - BASE_JUMP_VELOCITY) * speedRatio * MOMENTUM_JUMP_SCALE;
    if (chargeRatio > 0.1) {
      jumpVel += chargeRatio * CHARGED_JUMP_BONUS;
    }
    if (state.currentPlatform) {
      jumpVel *= getBounciness(state.currentPlatform);
    }
    state.vy = jumpVel;
    state.isGrounded = false;
    state.lastGroundY = state.y;
    state.currentPlatform = null;
    triggerJumpStretch(player);
    playJump(speedRatio);
    input.chargeTime = 0;
  }

  // Gravity
  if (!state.isGrounded) state.vy += GRAVITY * dt;

  // Move
  state.x += state.vx * dt;
  state.y += state.vy * dt;

  // --- Wall bounce ---
  const halfChar = CHAR_WIDTH / 2;
  if (state.x - halfChar < -HALF_WIDTH) {
    state.x = -HALF_WIDTH + halfChar;
    state.vx = Math.abs(state.vx) * WALL_BOUNCE_FACTOR + WALL_BOUNCE_BOOST;
    triggerShake(0.12);
    playWallBounce();
  } else if (state.x + halfChar > HALF_WIDTH) {
    state.x = HALF_WIDTH - halfChar;
    state.vx = -(Math.abs(state.vx) * WALL_BOUNCE_FACTOR + WALL_BOUNCE_BOOST);
    triggerShake(0.12);
    playWallBounce();
  }

  // --- Platform collision ---
  const platforms = getPlatforms();
  let landed = false;

  if (state.vy <= 0) {
    // Ground (only if death line hasn't passed it)
    if (state.y <= 0 && deathLine.y < -1) {
      state.y = 0;
      if (!state.isGrounded) onLand(0, null);
      state.vy = 0;
      state.isGrounded = true;
      state.currentPlatform = null;
      landed = true;
    }

    if (!landed) {
      for (const p of platforms) {
        if (!p.active) continue;
        if (Math.abs(p.y - state.y) > 2) continue;

        const pLeft = p.x - p.width / 2;
        const pRight = p.x + p.width / 2;
        const pTop = p.y + PLATFORM_HEIGHT / 2;

        if (state.x + halfChar > pLeft && state.x - halfChar < pRight) {
          if (state.y >= pTop - 0.35 && state.y <= pTop + 0.5) {
            const prevY = state.y - state.vy * dt;
            if (prevY >= pTop - 0.1) {
              state.y = pTop;
              if (!state.isGrounded) onLand(p.y, p);
              state.vy = 0;
              state.isGrounded = true;
              state.currentPlatform = p;
              landed = true;
              triggerCrumble(p);
              // Spike = instant death
              if (isSpiked(p)) {
                showGameOver();
                return;
              }
              break;
            }
          }
        }
      }
    }

    // Walk-off-edge
    if (!landed && state.isGrounded) {
      let onPlatform = false;
      if (state.y <= 0.1 && deathLine.y < -1) {
        onPlatform = true;
      } else if (state.currentPlatform && state.currentPlatform.active) {
        const p = state.currentPlatform;
        if (state.x + halfChar > p.x - p.width / 2 && state.x - halfChar < p.x + p.width / 2) {
          onPlatform = true;
          state.y = p.y + PLATFORM_HEIGHT / 2;
        }
      }
      if (!onPlatform) {
        state.isGrounded = false;
        state.currentPlatform = null;
      }
    }
  } else {
    state.isGrounded = false;
  }

  // --- Score & Points ---
  const floorNum = Math.floor(state.y / LAYER_SPACING);
  if (state.y > state.maxHeight) {
    // Award points for new height
    const oldFloor = Math.floor(state.maxHeight / LAYER_SPACING);
    const newFloor = floorNum;
    if (newFloor > oldFloor) {
      state.points += (newFloor - oldFloor) * 10;
    }
    state.maxHeight = state.y;
  }
  scoreEl.textContent = `FLOOR ${floorNum}`;
  pointsEl.textContent = `${state.points} PTS`;

  if (state.combo > 1) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = `COMBO x${state.combo}`;
  } else {
    comboEl.classList.add('hidden');
  }

  // --- Character ---
  player.position.set(state.x, state.y, 0);
  animateCharacter(player, dt, state.vx, state.vy, state.isGrounded);

  // Shadow
  const groundY = findGroundBelow(state.x, state.y, platforms);
  shadow.position.set(state.x, groundY + 0.01, 0.5);
  shadow.material.opacity = Math.max(0.03, 0.15 - (state.y - groundY) * 0.008);

  // Camera tracks death line + player — whichever pushes higher
  // This means camera constantly creeps up, creating urgency
  const cameraTarget = Math.max(deathLine.y + 8, state.y);
  updateCamera(cameraTarget, state.x, dt);
  sky.position.y = getCamera().position.y;

  // Cull platforms — show well ahead of camera so nothing is invisible
  cullPlatformsBelowY(deathLine.y, getCamera().position.y);

  // Music intensity
  if (deathLine.started) {
    const intensity = Math.min(1, deathLine.gameTime / 90);
    setMusicIntensity(intensity);
  }

  input.resetFrame();
  renderVHS() || renderer.render(scene, camera);
}

function onLand(platformY, platform) {
  state.isGrounded = true;
  triggerLandSquash(player);
  playLand();

  const floorsClimbed = Math.floor((platformY - state.lastGroundY) / LAYER_SPACING);
  if (floorsClimbed > 1) {
    state.combo = floorsClimbed;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;

    // Points: combo multiplier
    state.points += state.combo * state.combo * 5;

    comboEl.classList.add('pop');
    setTimeout(() => comboEl.classList.remove('pop'), 120);

    if (state.combo >= 2) {
      showComboSplash(state.combo);
      playCombo(state.combo);
      triggerGlitch(0.5 + state.combo * 0.1);
      triggerBackflip(player, state.combo);
    }
    if (state.combo >= 4) triggerShake(0.15);
    if (state.combo >= 8) triggerShake(0.3);
  } else {
    state.combo = 0;
  }

  if (platform && platform.type === 1 && platform.crumbleTimer >= 0) {
    playCrumble();
  }

  state.lastGroundY = platformY;
}

function findGroundBelow(x, y, platforms) {
  let best = Math.max(0, deathLine.y);
  const halfChar = CHAR_WIDTH / 2;
  for (const p of platforms) {
    if (!p.active) continue;
    if (p.y < y && p.y > best) {
      if (x + halfChar > p.x - p.width / 2 && x - halfChar < p.x + p.width / 2) best = p.y;
    }
  }
  return best;
}

function getCurrentBiome(height) {
  for (const b of BIOMES) { if (height < b.maxY) return b; }
  return BIOMES[BIOMES.length - 1];
}

const _targetSky = new THREE.Color();
const _targetFog = new THREE.Color();
const _targetWall = new THREE.Color();

function lerpSceneColors(biome, dt) {
  const speed = 2.0 * dt;
  _targetSky.setHex(biome.sky);
  _targetFog.setHex(biome.fog);
  _targetWall.setHex(biome.wall);
  skyMat.color.lerp(_targetSky, speed);
  scene.fog.color.lerp(_targetFog, speed);
  if (wallMatL) wallMatL.color.lerp(_targetWall, speed);
  if (wallMatR) wallMatR.color.lerp(_targetWall, speed);
}

function showGameOver() {
  state.alive = false;
  triggerShake(0.5);
  triggerGlitch(1.5);
  playElimination();
  stopMusic();

  const floorNum = Math.floor(state.maxHeight / LAYER_SPACING);
  const oldBest = getLocalBest();
  const isNewBest = state.points > oldBest;
  if (isNewBest) setLocalBest(state.points);

  goHeightEl.textContent = `FLOOR ${floorNum}`;
  goPointsEl.textContent = `${state.points} PTS`;
  goComboEl.textContent = `BEST COMBO: x${state.bestCombo}`;

  if (isNewBest && state.points > 0) {
    goBestEl.classList.remove('hidden');
  } else {
    goBestEl.classList.add('hidden');
  }

  // Reset submit UI
  submitBtn.disabled = false;
  submitStatus.classList.add('hidden');

  // Fetch global leaderboard
  fetchLeaderboard();
  gameOverEl.classList.remove('hidden');

  // Submit score handler
  const onSubmit = () => {
    const name = nameInput.value.trim().toUpperCase();
    if (!name) {
      submitStatus.classList.remove('hidden');
      submitStatus.textContent = 'ENTER NAME TO SUBMIT';
      submitStatus.style.color = '#ff6b6b';
      nameInput.focus();
      return;
    }
    submitStatus.style.color = '#b8e0d2';
    submitScore(name, state.points, floorNum, state.bestCombo);
  };
  submitBtn.onclick = onSubmit;
  nameInput.onkeydown = (e) => { if (e.key === 'Enter') onSubmit(); };

  // Restart on tap (but not on the input/button area)
  const restart = (e) => {
    // Don't restart if tapping input, button, leaderboard, or links
    if (e.target === nameInput || e.target === submitBtn) return;
    if (e.target.closest('#name-input-row') || e.target.closest('#go-leaderboard')) return;
    if (e.target.closest('.go-links') || e.target.tagName === 'A') return;

    gameOverEl.classList.add('hidden');
    gameOverEl.removeEventListener('pointerdown', restart);
    submitBtn.onclick = null;
    nameInput.onkeydown = null;

    state.x = 0; state.y = 0; state.vx = 0; state.vy = 0;
    state.isGrounded = true; state.alive = true;
    state.maxHeight = 0; state.combo = 0; state.bestCombo = 0;
    state.lastGroundY = 0; state.currentPlatform = null;
    state.points = 0;
    player.position.set(0, 0, 0);

    deathLine.y = -5; deathLine.gameTime = 0; deathLine.started = false;
    currentBiomeIdx = 0;

    gameSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    generatePlatforms(scene, gameSeed);
  };
  gameOverEl.addEventListener('pointerdown', restart);
}

requestAnimationFrame(gameLoop);
