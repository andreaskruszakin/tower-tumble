import * as THREE from 'three';
import { CHAR_WIDTH, CHAR_HEIGHT, PLAYER_COLORS } from './constants.js';

const _box = new THREE.BoxGeometry(1, 1, 1);

// Build a chunky voxel character from merged box geometries
// Returns a THREE.Group with named children for animation
export function createCharacter(colorIndex = 0, isGhost = false) {
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  const group = new THREE.Group();
  group.name = 'character';

  // Material — flat shading for pixel art look
  const bodyMat = new THREE.MeshBasicMaterial({
    color,
    transparent: isGhost,
    opacity: isGhost ? 0.5 : 1,
  });
  const headMat = new THREE.MeshBasicMaterial({
    color: lighten(color, 0.15),
    transparent: isGhost,
    opacity: isGhost ? 0.5 : 1,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const shoeMat = new THREE.MeshBasicMaterial({
    color: darken(color, 0.3),
    transparent: isGhost,
    opacity: isGhost ? 0.5 : 1,
  });

  // Body
  const body = new THREE.Mesh(_box, bodyMat);
  body.scale.set(CHAR_WIDTH, 0.6, 0.5);
  body.position.y = 0.5;
  body.name = 'body';
  group.add(body);

  // Head
  const head = new THREE.Mesh(_box, headMat);
  head.scale.set(0.65, 0.65, 0.6);
  head.position.y = 1.15;
  head.name = 'head';
  group.add(head);

  // Eyes
  const eyeL = new THREE.Mesh(_box, eyeMat);
  eyeL.scale.set(0.12, 0.12, 0.1);
  eyeL.position.set(-0.15, 1.2, 0.31);
  group.add(eyeL);

  const eyeR = new THREE.Mesh(_box, eyeMat);
  eyeR.scale.set(0.12, 0.12, 0.1);
  eyeR.position.set(0.15, 1.2, 0.31);
  group.add(eyeR);

  // Arms
  const armL = new THREE.Mesh(_box, bodyMat);
  armL.scale.set(0.2, 0.5, 0.25);
  armL.position.set(-0.5, 0.55, 0);
  armL.name = 'armL';
  group.add(armL);

  const armR = new THREE.Mesh(_box, bodyMat);
  armR.scale.set(0.2, 0.5, 0.25);
  armR.position.set(0.5, 0.55, 0);
  armR.name = 'armR';
  group.add(armR);

  // Legs
  const legL = new THREE.Mesh(_box, shoeMat);
  legL.scale.set(0.3, 0.35, 0.3);
  legL.position.set(-0.18, 0.05, 0);
  legL.name = 'legL';
  group.add(legL);

  const legR = new THREE.Mesh(_box, shoeMat);
  legR.scale.set(0.3, 0.35, 0.3);
  legR.position.set(0.18, 0.05, 0);
  legR.name = 'legR';
  group.add(legR);

  // Store animation state
  group.userData = {
    colorIndex,
    isGrounded: true,
    scaleY: 1,
    targetScaleY: 1,
    armSwing: 0,
    legSwing: 0,
    facingRight: true,
  };

  return group;
}

// Animate character each frame
export function animateCharacter(group, dt, velocityX, velocityY, isGrounded) {
  const ud = group.userData;
  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const armL = group.getObjectByName('armL');
  const armR = group.getObjectByName('armR');
  const legL = group.getObjectByName('legL');
  const legR = group.getObjectByName('legR');

  if (!body) return;

  const speed = Math.abs(velocityX);
  const t = performance.now() * 0.001;

  // Face direction
  if (speed > 0.5) {
    ud.facingRight = velocityX > 0;
  }

  // --- Squash & stretch ---
  if (!isGrounded) {
    if (velocityY > 6) {
      // Rising fast — tall stretch
      ud.targetScaleY = 1.25;
    } else if (velocityY > 1) {
      // Rising — stretch
      ud.targetScaleY = 1.12;
    } else if (velocityY < -8) {
      // Falling fast — pancake stretch
      ud.targetScaleY = 1.2;
    } else if (velocityY < -2) {
      // Falling — mild stretch
      ud.targetScaleY = 1.08;
    } else {
      // Apex — brief wide squash
      ud.targetScaleY = 0.92;
    }
  } else {
    ud.targetScaleY = 1.0;
  }

  ud.scaleY += (ud.targetScaleY - ud.scaleY) * 0.25;
  const invScale = 1 / Math.max(0.7, ud.scaleY);

  body.scale.y = 0.6 * ud.scaleY;
  body.scale.x = CHAR_WIDTH * invScale;
  body.scale.z = 0.5 * invScale;
  head.scale.y = 0.65 * ud.scaleY;
  head.scale.x = 0.65 * invScale;

  // --- JUMPING ANIMATIONS ---
  if (!isGrounded) {
    if (velocityY > 5) {
      // LAUNCH POSE: arms up, legs tucked
      const lerpSpeed = 0.2;
      armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, -2.2, lerpSpeed);
      armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -2.2, lerpSpeed);
      armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, -0.4, lerpSpeed);
      armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0.4, lerpSpeed);
      legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0.5, lerpSpeed);
      legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0.5, lerpSpeed);
      // Head looks up
      head.position.y = THREE.MathUtils.lerp(head.position.y, 1.25, lerpSpeed);
    } else if (velocityY > -2) {
      // APEX POSE: arms spread wide, legs dangle
      const lerpSpeed = 0.15;
      armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, -1.2, lerpSpeed);
      armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -1.2, lerpSpeed);
      armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, -0.8, lerpSpeed);
      armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0.8, lerpSpeed);
      legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0.1, lerpSpeed);
      legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, -0.1, lerpSpeed);
      head.position.y = THREE.MathUtils.lerp(head.position.y, 1.15, lerpSpeed);
    } else if (velocityY > -10) {
      // FALLING POSE: arms flail up, legs kick
      const lerpSpeed = 0.15;
      const flail = Math.sin(t * 12) * 0.3;
      armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, -1.8 + flail, lerpSpeed);
      armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -1.8 - flail, lerpSpeed);
      armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, -0.5, lerpSpeed);
      armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0.5, lerpSpeed);
      legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, flail * 0.6, lerpSpeed);
      legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, -flail * 0.6, lerpSpeed);
      head.position.y = THREE.MathUtils.lerp(head.position.y, 1.15, lerpSpeed);
    } else {
      // FAST FALL PANIC: arms windmill, legs flail
      const lerpSpeed = 0.2;
      const windmill = t * 15;
      armL.rotation.x = Math.sin(windmill) * 1.5;
      armR.rotation.x = Math.sin(windmill + Math.PI) * 1.5;
      armL.rotation.z = -0.6;
      armR.rotation.z = 0.6;
      const kick = Math.sin(windmill * 0.7) * 0.5;
      legL.rotation.x = kick;
      legR.rotation.x = -kick;
      head.position.y = THREE.MathUtils.lerp(head.position.y, 1.1, lerpSpeed);
    }

    // Body tilt toward movement direction when airborne
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, velocityX * -0.03, 0.08);

    // Slight forward lean when moving fast in air
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, speed > 5 ? 0.15 : 0, 0.1);

  } else if (speed > 1.5) {
    // --- RUNNING ANIMATION ---
    ud.armSwing += dt * speed * 9;
    ud.legSwing += dt * speed * 9;
    const armAnim = Math.sin(ud.armSwing) * 0.5;
    const legAnim = Math.sin(ud.legSwing) * 0.4;
    armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, armAnim, 0.3);
    armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -armAnim, 0.3);
    armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, 0, 0.2);
    armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0, 0.2);
    legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, legAnim, 0.3);
    legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, -legAnim, 0.3);
    head.position.y = THREE.MathUtils.lerp(head.position.y, 1.15, 0.1);

    // Running bounce
    const bounce = Math.abs(Math.sin(ud.legSwing)) * 0.04;
    group.position.y += bounce;

    // Lean into run
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, 0.08, 0.1);
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, velocityX * -0.02, 0.1);

  } else {
    // --- IDLE ANIMATION ---
    const lerpSpeed = 0.1;
    const bob = Math.sin(t * 2.5) * 0.03;
    const breathe = Math.sin(t * 1.8) * 0.015;

    armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, breathe, lerpSpeed);
    armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -breathe, lerpSpeed);
    armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, 0, lerpSpeed);
    armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0, lerpSpeed);
    legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, lerpSpeed);
    legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, lerpSpeed);
    head.position.y = THREE.MathUtils.lerp(head.position.y, 1.15, lerpSpeed);
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, 0, lerpSpeed);
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, 0, lerpSpeed);

    group.position.y += bob;
  }
}

// Trigger landing squash
export function triggerLandSquash(group) {
  group.userData.scaleY = 0.75;
  group.userData.targetScaleY = 1.0;
}

// Trigger jump stretch
export function triggerJumpStretch(group) {
  group.userData.scaleY = 0.8;
  group.userData.targetScaleY = 1.15;
}

// Color utilities
function lighten(hex, amount) {
  const r = ((hex >> 16) & 0xFF) / 255;
  const g = ((hex >> 8) & 0xFF) / 255;
  const b = (hex & 0xFF) / 255;
  const nr = Math.min(1, r + amount);
  const ng = Math.min(1, g + amount);
  const nb = Math.min(1, b + amount);
  return ((nr * 255) << 16) | ((ng * 255) << 8) | (nb * 255);
}

function darken(hex, amount) {
  return lighten(hex, -amount);
}
