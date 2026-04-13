import * as THREE from 'three';
import { createCharacter, animateCharacter, triggerLandSquash, triggerJumpStretch } from './character.js';
import { initInput, updateInput, input, requestGyroPermission } from './input.js';
import { createCamera, updateCamera, triggerShake, getCamera } from './camera.js';
import { generatePlatforms, getPlatforms, updatePlatforms, triggerCrumble, getBounciness, cullPlatformsBelowY, extendPlatformsIfNeeded } from './platforms.js';
import { initVHS, updateVHS, triggerGlitch, renderVHS, setMobileMode } from './vhs.js';
import { initAudio, resumeAudio, playJump, playLand, playWallBounce, playCombo, playCrumble, playElimination, playRoundStart, startMusic, stopMusic, setMusicIntensity } from './audio.js';
import { isPortalEntry, portalRef, createExitPortal, createEntryPortal, updatePortals, checkExitPortal, checkEntryPortal, navigateExitPortal, navigateEntryPortal, getPlayerName, setPlayerName } from './portal.js';
import {
  TOWER_WIDTH, HALF_WIDTH, GRAVITY, BASE_JUMP_VELOCITY, MAX_JUMP_VELOCITY,
  MOMENTUM_JUMP_SCALE, MAX_HORIZONTAL_SPEED, HORIZONTAL_ACCEL,
  GROUND_FRICTION, AIR_FRICTION, WALL_BOUNCE_FACTOR, WALL_BOUNCE_BOOST,
  CHAR_WIDTH, CHAR_HEIGHT, PLATFORM_HEIGHT,
  BIOMES, WALL_COLOR, FLOOR_COLOR,
  CAMERA_SCROLL_START, CAMERA_SCROLL_ACCEL, CAMERA_SCROLL_INTERVAL, CAMERA_SCROLL_MAX,
  COMBO_TIERS, CAMERA_DISTANCE,
} from './constants.js';

// --- Renderer (pixelation handled by post-processing now) ---
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1410);
const isMobile = navigator.maxTouchPoints > 0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xFFB7A5, 0.008);

// Flat lighting for pixel art look
const ambient = new THREE.AmbientLight(0xFFFFFF, 0.85);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xFFF0E0, 0.3);
dirLight.position.set(3, 10, 5);
scene.add(dirLight);

// Camera
const camera = createCamera();

// VHS post-processing (pixelation + scanlines + grain + chromatic aberration)
const vhsComposer = initVHS(renderer, scene, camera);
if (isMobile) setMobileMode();

// --- Tower walls ---
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

// --- Ground platform ---
const groundGeo = new THREE.BoxGeometry(TOWER_WIDTH, 0.5, 2);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x8BBF7A });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.set(0, -0.25, 0);
scene.add(ground);

// --- Sky background ---
const skyGeo = new THREE.SphereGeometry(180, 16, 8);
const skyMat = new THREE.MeshBasicMaterial({ color: 0xFFB7A5, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// --- Death zone indicator (bottom of screen glow) ---
const deathGeo = new THREE.PlaneGeometry(TOWER_WIDTH + 4, 3);
const deathMat = new THREE.MeshBasicMaterial({
  color: FLOOR_COLOR,
  transparent: true,
  opacity: 0.4,
});
const deathPlane = new THREE.Mesh(deathGeo, deathMat);
deathPlane.position.z = 0.5;
scene.add(deathPlane);

// --- Generate platforms ---
let gameSeed = Math.floor(Math.random() * 0xFFFFFFFF);
generatePlatforms(scene, gameSeed);

// --- Portals ---
createExitPortal(scene, HALF_WIDTH - 1.5, 0);
createEntryPortal(scene, -HALF_WIDTH + 1.5, 0);
const playerName = getPlayerName();

// --- Player character ---
const player = createCharacter(0);
// Portal entry: start slightly higher for dramatic drop
if (isPortalEntry) {
  player.position.set(0, 8, 0);
} else {
  player.position.set(0, 0.2, 0);
}
scene.add(player);

// --- Shadow ---
const shadowGeo = new THREE.PlaneGeometry(0.8, 0.4);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
const shadow = new THREE.Mesh(shadowGeo, shadowMat);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// --- State ---
const state = {
  x: 0, y: isPortalEntry ? 8 : 0.2, vx: 0, vy: 0,
  isGrounded: !isPortalEntry, lastGroundY: 0,
  alive: true, maxHeight: 0,
  combo: 0, bestCombo: 0,
  currentPlatform: null,
};

// Camera auto-scroll state
const scroll = {
  y: -3,           // death line Y position
  speed: CAMERA_SCROLL_START,
  gameTime: 0,
  started: false,
};

// Biome tracking
let currentBiomeIdx = 0;

// --- UI ---
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo-container');
const splashEl = document.getElementById('combo-splash');
const hintEl = document.getElementById('hint');
const gameOverEl = document.getElementById('game-over');
const goHeightEl = document.getElementById('go-height');
const goComboEl = document.getElementById('go-combo');
const biomeNameEl = document.getElementById('biome-name');
const momentumEl = document.getElementById('momentum-label');
const speedLinesEl = document.getElementById('speed-lines');

let firstInput = false;
let splashTimeout = null;

function showComboSplash(combo) {
  // Find tier
  let tier = null;
  for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
    if (combo >= COMBO_TIERS[i].min) { tier = COMBO_TIERS[i]; break; }
  }
  if (!tier) return;

  splashEl.textContent = `${tier.label} x${combo}`;
  splashEl.style.color = tier.color;
  splashEl.classList.remove('show');
  void splashEl.offsetWidth; // reflow
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

  if (!state.alive) {
    renderVHS() || renderer.render(scene, camera);
    return;
  }

  updateInput();

  // First input starts the game (or portal auto-start)
  if (!firstInput && (input.horizontal !== 0 || input.jump || isPortalEntry)) {
    firstInput = true;
    hintEl.classList.add('hidden');
    requestGyroPermission();
    scroll.started = true;
    initAudio();
    resumeAudio();
    playRoundStart();
    startMusic();
  }

  // --- Auto-scrolling camera / death line ---
  if (scroll.started) {
    scroll.gameTime += dt;
    const speedUps = Math.floor(scroll.gameTime / CAMERA_SCROLL_INTERVAL);
    scroll.speed = Math.min(CAMERA_SCROLL_MAX, CAMERA_SCROLL_START + speedUps * CAMERA_SCROLL_ACCEL);
    scroll.y += scroll.speed * dt;

    // Death check: player below the scroll line
    if (state.y < scroll.y) {
      showGameOver();
      return;
    }
  }

  // Update death zone visual
  deathPlane.position.y = scroll.y + 0.5;
  deathMat.opacity = 0.3 + Math.sin(now * 0.004) * 0.1;

  // --- Platforms ---
  extendPlatformsIfNeeded(state.y);
  updatePlatforms(dt, scroll.gameTime);

  // --- Biome transitions ---
  const biome = getCurrentBiome(state.y);
  const biomeIdx = BIOMES.indexOf(biome);
  if (biomeIdx !== currentBiomeIdx) {
    currentBiomeIdx = biomeIdx;
    showBiomeName(biome.name);
  }
  // Smoothly transition colors
  lerpSceneColors(biome, dt);

  // --- Movement ---
  state.vx += input.horizontal * HORIZONTAL_ACCEL * dt;
  state.vx *= state.isGrounded ? GROUND_FRICTION : AIR_FRICTION;
  state.vx = Math.max(-MAX_HORIZONTAL_SPEED, Math.min(MAX_HORIZONTAL_SPEED, state.vx));

  // Momentum feedback
  const speedRatio = Math.abs(state.vx) / MAX_HORIZONTAL_SPEED;
  if (speedRatio > 0.8) {
    momentumEl.classList.remove('hidden');
    speedLinesEl.style.opacity = (speedRatio - 0.8) * 3;
  } else {
    momentumEl.classList.add('hidden');
    speedLinesEl.style.opacity = 0;
  }

  // --- Jump ---
  if (input.consumeJump() && state.isGrounded) {
    let jumpVel = BASE_JUMP_VELOCITY + (MAX_JUMP_VELOCITY - BASE_JUMP_VELOCITY) * speedRatio * MOMENTUM_JUMP_SCALE;
    if (state.currentPlatform) {
      jumpVel *= getBounciness(state.currentPlatform);
    }
    state.vy = jumpVel;
    state.isGrounded = false;
    state.lastGroundY = state.y;
    state.currentPlatform = null;
    triggerJumpStretch(player);
    playJump(speedRatio);
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
    // Ground (only if scroll hasn't passed it)
    if (state.y <= 0.2 && scroll.y < -1) {
      state.y = 0.2;
      if (!state.isGrounded) onLand(0, null);
      state.vy = 0;
      state.isGrounded = true;
      state.currentPlatform = null;
      landed = true;
    }

    if (!landed) {
      for (const p of platforms) {
        if (!p.active) continue;
        if (Math.abs(p.y - state.y) > 2.5) continue;

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
              break;
            }
          }
        }
      }
    }

    // Walk-off-edge
    if (!landed && state.isGrounded) {
      let onPlatform = false;
      if (state.y <= 0.3 && scroll.y < -1) {
        onPlatform = true;
      } else if (state.currentPlatform && state.currentPlatform.active) {
        const p = state.currentPlatform;
        const pLeft = p.x - p.width / 2;
        const pRight = p.x + p.width / 2;
        if (state.x + halfChar > pLeft && state.x - halfChar < pRight) {
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

  // --- Score ---
  const floorNum = Math.floor(state.y / 1.8);
  if (state.y > state.maxHeight) state.maxHeight = state.y;
  scoreEl.textContent = `FLOOR ${floorNum}`;

  // Combo display
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

  // Camera — auto-scrolls up, follows player if they're higher
  const cameraTarget = Math.max(scroll.y + 6, state.y);
  updateCamera(cameraTarget, state.x, dt);
  sky.position.y = getCamera().position.y;

  // Portals
  updatePortals(dt, scroll.gameTime);
  // Check portal collisions (only near ground level)
  if (state.y < 3 && state.isGrounded) {
    if (checkExitPortal(state.x, state.y)) {
      navigateExitPortal(playerName, '');
      return;
    }
    if (checkEntryPortal(state.x, state.y)) {
      navigateEntryPortal();
      return;
    }
  }

  // Cull far platforms
  cullPlatformsBelowY(scroll.y);

  // Music intensity scales with scroll speed
  if (scroll.started) {
    const intensity = Math.min(1, scroll.gameTime / 90);
    setMusicIntensity(intensity);
  }

  input.resetFrame();
  renderVHS() || renderer.render(scene, camera);
}

function onLand(platformY, platform) {
  state.isGrounded = true;
  triggerLandSquash(player);
  playLand();

  const floorsClimbed = Math.floor((platformY - state.lastGroundY) / 1.8);
  if (floorsClimbed > 1) {
    state.combo = floorsClimbed;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;

    comboEl.classList.add('pop');
    setTimeout(() => comboEl.classList.remove('pop'), 120);

    // Splash text + audio for combos
    if (state.combo >= 2) {
      showComboSplash(state.combo);
      playCombo(state.combo);
      triggerGlitch(0.5 + state.combo * 0.1);
    }
    if (state.combo >= 4) triggerShake(0.15);
    if (state.combo >= 8) triggerShake(0.3);
  } else {
    state.combo = 0;
  }

  // Trigger crumble audio
  if (platform && platform.type === 1 && platform.crumbleTimer >= 0) {
    playCrumble();
  }

  state.lastGroundY = platformY;
}

function findGroundBelow(x, y, platforms) {
  let best = Math.max(0, scroll.y);
  const halfChar = CHAR_WIDTH / 2;
  for (const p of platforms) {
    if (!p.active) continue;
    if (p.y < y && p.y > best) {
      const pLeft = p.x - p.width / 2;
      const pRight = p.x + p.width / 2;
      if (x + halfChar > pLeft && x - halfChar < pRight) best = p.y;
    }
  }
  return best;
}

function getCurrentBiome(height) {
  for (const b of BIOMES) {
    if (height < b.maxY) return b;
  }
  return BIOMES[BIOMES.length - 1];
}

// Smoothly transition scene colors to match biome
const _targetSky = new THREE.Color();
const _targetFog = new THREE.Color();
const _targetWall = new THREE.Color();

function lerpSceneColors(biome, dt) {
  const speed = 2.0 * dt; // transition speed
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

  const floorNum = Math.floor(state.maxHeight / 1.8);
  goHeightEl.textContent = `FLOOR ${floorNum}`;
  goComboEl.textContent = `BEST COMBO: x${state.bestCombo}`;
  gameOverEl.classList.remove('hidden');

  const restart = () => {
    gameOverEl.classList.add('hidden');
    gameOverEl.removeEventListener('pointerdown', restart);

    state.x = 0; state.y = 0.2; state.vx = 0; state.vy = 0;
    state.isGrounded = true; state.alive = true;
    state.maxHeight = 0; state.combo = 0; state.bestCombo = 0;
    state.lastGroundY = 0; state.currentPlatform = null;
    player.position.set(0, 0.2, 0);

    scroll.y = -3; scroll.speed = CAMERA_SCROLL_START;
    scroll.gameTime = 0; scroll.started = false;
    currentBiomeIdx = 0;
    firstInput = false;
    hintEl.classList.remove('hidden');

    gameSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    generatePlatforms(scene, gameSeed);
  };
  gameOverEl.addEventListener('pointerdown', restart);
}

requestAnimationFrame(gameLoop);
