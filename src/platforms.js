import * as THREE from 'three';
import { createRNG, rngRange } from './rng.js';
import {
  TOWER_WIDTH, HALF_WIDTH,
  PLATFORM_HEIGHT, PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH,
  LAYER_SPACING, TOTAL_LAYERS, GENERATE_AHEAD, MAX_PLATFORMS_PER_LAYER,
  PLATFORM_STATIC, PLATFORM_CRUMBLE, PLATFORM_BOUNCY, PLATFORM_MOVING,
  CRUMBLE_TIME, CRUMBLE_RESPAWN,
  MOVING_AMPLITUDE, MOVING_PERIOD,
  BIOMES,
} from './constants.js';

const _box = new THREE.BoxGeometry(1, 1, 1);

let platforms = [];
let platformGroup = null;
let highestLayer = 0;
let rngState = null; // persistent RNG for streaming generation
let currentScene = null;

export function getPlatforms() {
  return platforms;
}

// Get biome for a given height
function getBiome(y) {
  for (const b of BIOMES) {
    if (y < b.maxY) return b;
  }
  return BIOMES[BIOMES.length - 1];
}

// Get platform color based on type and biome
function getPlatColor(type, biome) {
  switch (type) {
    case PLATFORM_STATIC:  return biome.platStatic;
    case PLATFORM_CRUMBLE: return biome.platCrumble;
    case PLATFORM_BOUNCY:  return biome.platBouncy;
    case PLATFORM_MOVING:  return biome.platMoving;
    default: return biome.platStatic;
  }
}

export function generatePlatforms(scene, seed) {
  if (platformGroup) {
    scene.remove(platformGroup);
    platformGroup.traverse(child => {
      if (child.geometry && child.geometry !== _box) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }

  platformGroup = new THREE.Group();
  platformGroup.name = 'platforms';
  platforms = [];
  highestLayer = 0;
  currentScene = scene;

  rngState = createRNG(seed);

  for (let layer = 1; layer <= TOTAL_LAYERS; layer++) {
    const y = layer * LAYER_SPACING;
    const difficulty = Math.min(1, layer / 200);
    const biome = getBiome(y);

    const count = Math.max(1, Math.min(MAX_PLATFORMS_PER_LAYER, Math.round(1.5 + (1 - difficulty) * 0.8 + rngState() * 0.5)));
    const layerPlatforms = []; // track placed platforms to prevent overlap

    for (let i = 0; i < count; i++) {
      const type = pickType(rngState, layer, difficulty);
      const width = PLATFORM_MIN_WIDTH + (1 - difficulty * 0.5) * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) * rngState();
      const maxX = HALF_WIDTH - width / 2 - 0.2;

      // Try up to 8 times to find a non-overlapping position
      let x = rngRange(rngState, -maxX, maxX);
      let placed = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        let overlaps = false;
        for (const existing of layerPlatforms) {
          const gap = 0.4; // minimum gap between platforms
          const aLeft = x - width / 2 - gap;
          const aRight = x + width / 2 + gap;
          const bLeft = existing.x - existing.width / 2;
          const bRight = existing.x + existing.width / 2;
          if (aRight > bLeft && aLeft < bRight) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) { placed = true; break; }
        x = rngRange(rngState, -maxX, maxX); // try new position
      }
      if (!placed) continue; // skip this platform if we can't place it

      const yOffset = rngRange(rngState, -0.15, 0.15);
      const color = getPlatColor(type, biome);
      const platform = createPlatform(layer * 100 + i, x, y + yOffset, width, type, color, rngState);
      layerPlatforms.push({ x, width });
      platforms.push(platform);
      platformGroup.add(platform.mesh);
    }
    highestLayer = layer;
  }

  scene.add(platformGroup);
  return platforms;
}

// Stream more platforms as player approaches the top
export function extendPlatformsIfNeeded(playerY) {
  if (!rngState || !platformGroup || !currentScene) return;

  const highestY = highestLayer * LAYER_SPACING;
  if (playerY + GENERATE_AHEAD < highestY) return; // still have headroom

  // Generate 100 more layers
  const targetLayer = highestLayer + 100;
  for (let layer = highestLayer + 1; layer <= targetLayer; layer++) {
    const y = layer * LAYER_SPACING;
    const difficulty = Math.min(1, layer / 200);
    const biome = getBiome(y);
    const count = Math.max(1, Math.min(MAX_PLATFORMS_PER_LAYER, Math.round(1.5 + (1 - difficulty) * 0.8 + rngState() * 0.5)));
    const layerPlats = [];

    for (let i = 0; i < count; i++) {
      const type = pickType(rngState, layer, difficulty);
      const width = PLATFORM_MIN_WIDTH + (1 - difficulty * 0.5) * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) * rngState();
      const maxX = HALF_WIDTH - width / 2 - 0.2;

      let x = rngRange(rngState, -maxX, maxX);
      let placed = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        let overlaps = false;
        for (const existing of layerPlats) {
          const gap = 0.4;
          if (x + width / 2 + gap > existing.x - existing.width / 2 &&
              x - width / 2 - gap < existing.x + existing.width / 2) {
            overlaps = true; break;
          }
        }
        if (!overlaps) { placed = true; break; }
        x = rngRange(rngState, -maxX, maxX);
      }
      if (!placed) continue;

      const yOffset = rngRange(rngState, -0.15, 0.15);
      const color = getPlatColor(type, biome);
      const platform = createPlatform(layer * 100 + i, x, y + yOffset, width, type, color, rngState);
      layerPlats.push({ x, width });
      platforms.push(platform);
      platformGroup.add(platform.mesh);
    }
    highestLayer = layer;
  }
}

function pickType(rng, layer, difficulty) {
  const roll = rng();
  if (layer < 8) return PLATFORM_STATIC;
  if (layer < 12) return roll < 0.85 ? PLATFORM_STATIC : PLATFORM_BOUNCY;
  if (layer < 25) {
    if (roll < 0.55) return PLATFORM_STATIC;
    if (roll < 0.78) return PLATFORM_CRUMBLE;
    return PLATFORM_BOUNCY;
  }
  if (layer < 50) {
    if (roll < 0.35) return PLATFORM_STATIC;
    if (roll < 0.6) return PLATFORM_CRUMBLE;
    if (roll < 0.8) return PLATFORM_BOUNCY;
    return PLATFORM_MOVING;
  }
  if (roll < 0.15) return PLATFORM_STATIC;
  if (roll < 0.4) return PLATFORM_CRUMBLE;
  if (roll < 0.65) return PLATFORM_BOUNCY;
  return PLATFORM_MOVING;
}

function createPlatform(id, x, y, width, type, color, rng) {
  // Pixel art style: use MeshBasicMaterial for flat shading
  const mat = new THREE.MeshBasicMaterial({ color });

  const mesh = new THREE.Mesh(_box, mat.clone());
  mesh.scale.set(width, PLATFORM_HEIGHT, 1.2);
  mesh.position.set(x, y, 0);

  // Add a darker top edge for pixel depth
  const topMat = new THREE.MeshBasicMaterial({
    color: lightenHex(color, 0.12),
  });
  const top = new THREE.Mesh(_box, topMat);
  top.scale.set(1, 0.3, 1);
  top.position.y = 0.35;
  mesh.add(top);

  // Bottom shadow edge
  const bottomMat = new THREE.MeshBasicMaterial({
    color: darkenHex(color, 0.2),
  });
  const bottom = new THREE.Mesh(_box, bottomMat);
  bottom.scale.set(1, 0.15, 1);
  bottom.position.y = -0.42;
  mesh.add(bottom);

  // Type-specific visuals
  if (type === PLATFORM_BOUNCY) {
    mesh.scale.y = PLATFORM_HEIGHT * 0.8;
    const glow = new THREE.Mesh(_box, new THREE.MeshBasicMaterial({
      color: lightenHex(color, 0.25),
    }));
    glow.scale.set(0.85, 0.2, 0.85);
    glow.position.y = 0.4;
    mesh.add(glow);
  }

  if (type === PLATFORM_MOVING) {
    // Arrow dots on surface
    const dotMat = new THREE.MeshBasicMaterial({ color: lightenHex(color, 0.2) });
    for (let d = -0.3; d <= 0.3; d += 0.3) {
      const dot = new THREE.Mesh(_box, dotMat);
      dot.scale.set(0.06, 0.5, 0.06);
      dot.position.set(d, 0.3, 0.5);
      mesh.add(dot);
    }
  }

  return {
    id,
    x,
    baseX: x,
    y,
    width,
    type,
    mesh,
    active: true,
    crumbleTimer: -1,
    crumbleRespawnTimer: -1,
    phaseOffset: rng() * Math.PI * 2,
    bounceAnim: 0,
  };
}

export function updatePlatforms(dt, gameTime) {
  for (const p of platforms) {
    if (!p.active) {
      if (p.crumbleRespawnTimer > 0) {
        p.crumbleRespawnTimer -= dt;
        if (p.crumbleRespawnTimer <= 0) {
          p.active = true;
          p.crumbleTimer = -1;
          p.crumbleRespawnTimer = -1;
          p.mesh.visible = true;
          p.mesh.scale.y = PLATFORM_HEIGHT;
          p.mesh.material.opacity = 1;
          p.mesh.material.transparent = false;
        }
      }
      continue;
    }

    if (p.type === PLATFORM_MOVING) {
      const maxX = HALF_WIDTH - p.width / 2 - 0.2;
      p.x = p.baseX + Math.sin(gameTime / MOVING_PERIOD * Math.PI * 2 + p.phaseOffset) * MOVING_AMPLITUDE;
      p.x = Math.max(-maxX, Math.min(maxX, p.x));
      p.mesh.position.x = p.x;
    }

    if (p.type === PLATFORM_CRUMBLE && p.crumbleTimer >= 0) {
      p.crumbleTimer -= dt;
      const t = 1 - (p.crumbleTimer / CRUMBLE_TIME);
      p.mesh.position.x = p.x + (Math.random() - 0.5) * t * 0.4;
      p.mesh.material.transparent = true;
      p.mesh.material.opacity = 1 - t * 0.6;
      p.mesh.scale.y = PLATFORM_HEIGHT * (1 - t * 0.4);

      if (p.crumbleTimer <= 0) {
        p.active = false;
        p.mesh.visible = false;
        p.crumbleRespawnTimer = CRUMBLE_RESPAWN;
      }
    }

    if (p.type === PLATFORM_BOUNCY) {
      const squish = 1 + Math.sin(gameTime * 4 + p.phaseOffset) * 0.08;
      p.mesh.scale.y = PLATFORM_HEIGHT * 0.8 * squish;
    }

    if (p.type === PLATFORM_STATIC) {
      p.mesh.position.y = p.y + Math.sin(gameTime * 1.2 + p.phaseOffset) * 0.015;
    }
  }
}

export function triggerCrumble(platform) {
  if (platform.type === PLATFORM_CRUMBLE && platform.crumbleTimer < 0 && platform.active) {
    platform.crumbleTimer = CRUMBLE_TIME;
  }
}

export function getBounciness(platform) {
  if (platform.type === PLATFORM_BOUNCY) return 2.0;
  return 1;
}

export function cullPlatformsBelowY(minY) {
  for (const p of platforms) {
    p.mesh.visible = p.active && p.y > minY - 10 && p.y < minY + 80;
  }
}

function lightenHex(hex, amount) {
  const r = Math.min(255, ((hex >> 16) & 0xFF) + amount * 255);
  const g = Math.min(255, ((hex >> 8) & 0xFF) + amount * 255);
  const b = Math.min(255, (hex & 0xFF) + amount * 255);
  return (r << 16) | (g << 8) | b;
}

function darkenHex(hex, amount) {
  return lightenHex(hex, -amount);
}
