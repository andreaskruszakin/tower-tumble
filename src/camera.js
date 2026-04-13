import * as THREE from 'three';
import { CAMERA_LERP, CAMERA_OFFSET_Y, CAMERA_DISTANCE } from './constants.js';

let camera;
let shakeIntensity = 0;
const shakeDecay = 0.9;

export function createCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 400);
  camera.position.set(0, 5, CAMERA_DISTANCE);
  camera.lookAt(0, 5, 0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  return camera;
}

export function updateCamera(targetY, playerX, dt) {
  if (!camera) return;

  // Smooth vertical follow — always keeps up with auto-scroll or player
  const goalY = targetY + CAMERA_OFFSET_Y;
  camera.position.y += (goalY - camera.position.y) * CAMERA_LERP;

  // Slight horizontal tracking
  camera.position.x += (playerX * 0.25 - camera.position.x) * CAMERA_LERP * 0.4;

  // Shake
  if (shakeIntensity > 0.005) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity *= shakeDecay;
  } else {
    shakeIntensity = 0;
  }

  camera.lookAt(camera.position.x, camera.position.y - CAMERA_OFFSET_Y * 0.5, 0);
}

export function triggerShake(intensity = 0.3) {
  shakeIntensity = Math.max(shakeIntensity, intensity);
}

export function getCamera() {
  return camera;
}
