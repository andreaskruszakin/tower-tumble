import { CHARGE_TIME } from './constants.js';

// Unified input: tilt (mobile) + keyboard (desktop) + touch fallback
// Priority: tilt > touch sides > keyboard

export const input = {
  horizontal: 0,
  jump: false,
  jumpHeld: false,
  chargeTime: 0,
  _jumpConsumed: false,

  consumeJump() {
    if (this.jump && !this._jumpConsumed) {
      this._jumpConsumed = true;
      return true;
    }
    return false;
  },

  resetFrame() {
    if (this._jumpConsumed) {
      this.jump = false;
      this._jumpConsumed = false;
    }
  }
};

// --- Internal state ---
let tiltValue = 0;          // smoothed tilt -1..1
let tiltActive = false;      // true once we get valid tilt data
let tiltMethod = 'none';     // 'orientation' | 'motion' | 'none'
let keysDown = new Set();
let touchSide = 0;
let isMobile = navigator.maxTouchPoints > 0;
let initialized = false;

// Calibration
let calibNeutral = null;
let calibSamples = [];
const CALIB_COUNT = 20;

// --- Public API ---

export function initInput(canvas) {
  if (initialized) return;
  initialized = true;

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // On Android, tilt works without permission — try immediately
  if (isMobile && !needsPermission()) {
    tryEnableTilt();
  }
}

// MUST be called from a user gesture (tap/click) for iOS Safari
export function requestTiltPermission() {
  if (!isMobile || tiltActive) return;
  requestPermissionAndEnable();
}

export function updateInput(dt) {
  // Tilt has priority over touch
  if (tiltActive) {
    input.horizontal = tiltValue;
  } else if (isMobile && touchSide !== 0) {
    input.horizontal = touchSide;
  } else {
    let h = 0;
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) h -= 1;
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) h += 1;
    input.horizontal = h;
  }

  if (input.jumpHeld && dt) {
    input.chargeTime = Math.min(CHARGE_TIME, input.chargeTime + dt);
  }
}

export function getChargeRatio() {
  return Math.min(1, input.chargeTime / CHARGE_TIME);
}

export function isGyroActive() {
  return tiltActive;
}

export function recalibrateGyro() {
  calibNeutral = null;
  calibSamples = [];
  tiltValue = 0;
}

// --- Permission detection ---

function needsPermission() {
  // iOS 13+ requires explicit permission
  return (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function');
}

async function requestPermissionAndEnable() {
  // Try DeviceOrientation first (more reliable for tilt angle)
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') {
        enableOrientation();
        return;
      }
    } catch (e) { /* fall through */ }
  }

  // Try DeviceMotion as fallback
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceMotionEvent.requestPermission();
      if (perm === 'granted') {
        enableMotion();
        return;
      }
    } catch (e) { /* fall through */ }
  }

  // No permission granted — use touch fallback
  console.log('Tilt: no permission, using touch fallback');
}

function tryEnableTilt() {
  // Android / non-permission browsers: just listen and see if data arrives
  // Try orientation first
  let gotData = false;

  const testOrientation = (e) => {
    if (e.gamma !== null && !gotData) {
      gotData = true;
      window.removeEventListener('deviceorientation', testOrientation);
      window.removeEventListener('devicemotion', testMotion);
      enableOrientation();
    }
  };

  const testMotion = (e) => {
    if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x !== null && !gotData) {
      gotData = true;
      window.removeEventListener('deviceorientation', testOrientation);
      window.removeEventListener('devicemotion', testMotion);
      enableMotion();
    }
  };

  window.addEventListener('deviceorientation', testOrientation);
  window.addEventListener('devicemotion', testMotion);

  // Timeout: if neither fires in 1 second, give up
  setTimeout(() => {
    if (!gotData) {
      window.removeEventListener('deviceorientation', testOrientation);
      window.removeEventListener('devicemotion', testMotion);
    }
  }, 1000);
}

// --- DeviceOrientation (gamma) ---

function enableOrientation() {
  tiltMethod = 'orientation';
  tiltActive = true;
  calibNeutral = null;
  calibSamples = [];
  window.addEventListener('deviceorientation', onOrientation);
  console.log('Tilt: using DeviceOrientation (gamma)');
}

function onOrientation(e) {
  const gamma = e.gamma;
  if (gamma === null || gamma === undefined) return;

  // Calibrate: collect samples, use median as neutral
  if (calibNeutral === null) {
    calibSamples.push(gamma);
    if (calibSamples.length >= CALIB_COUNT) {
      const sorted = [...calibSamples].sort((a, b) => a - b);
      calibNeutral = sorted[Math.floor(sorted.length / 2)];
      calibSamples = null;
    }
    return;
  }

  let tilt = gamma - calibNeutral;

  // Gimbal lock protection: if beta is near 0 or 180, gamma goes crazy
  // Just clamp hard and increase smoothing
  if (Math.abs(tilt) > 45) return; // reject wild values

  // Dead zone + normalize to -1..1
  const deadZone = 3;   // degrees
  const maxAngle = 25;  // degrees for full tilt

  if (Math.abs(tilt) < deadZone) {
    tilt = 0;
  } else {
    const sign = Math.sign(tilt);
    tilt = sign * Math.min(1, (Math.abs(tilt) - deadZone) / (maxAngle - deadZone));
  }

  // Smooth
  tiltValue += (tilt - tiltValue) * 0.15;

  // Drift correction: slowly adapt neutral
  calibNeutral += (gamma - calibNeutral) * 0.003;
}

// --- DeviceMotion (accelerometer) fallback ---

function enableMotion() {
  tiltMethod = 'motion';
  tiltActive = true;
  calibNeutral = null;
  calibSamples = [];
  window.addEventListener('devicemotion', onMotion);
  console.log('Tilt: using DeviceMotion (accelerometer)');
}

function onMotion(e) {
  const accel = e.accelerationIncludingGravity;
  if (!accel || accel.x === null) return;

  const rawX = accel.x;

  // Calibrate
  if (calibNeutral === null) {
    calibSamples.push(rawX);
    if (calibSamples.length >= CALIB_COUNT) {
      const sorted = [...calibSamples].sort((a, b) => a - b);
      calibNeutral = sorted[Math.floor(sorted.length / 2)];
      calibSamples = null;
    }
    return;
  }

  let tilt = rawX - calibNeutral;

  // Dead zone + normalize
  const deadZone = 0.5;  // m/s²
  const maxAccel = 4.0;  // m/s²

  if (Math.abs(tilt) < deadZone) {
    tilt = 0;
  } else {
    const sign = Math.sign(tilt);
    tilt = sign * Math.min(1, (Math.abs(tilt) - deadZone) / (maxAccel - deadZone));
  }

  tiltValue += (tilt - tiltValue) * 0.12;
  calibNeutral += (rawX - calibNeutral) * 0.002;
}

// --- Keyboard ---

function onKeyDown(e) {
  keysDown.add(e.code);
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!input.jumpHeld) {
      input.jumpHeld = true;
      input.chargeTime = 0;
    }
  }
}

function onKeyUp(e) {
  keysDown.delete(e.code);
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (input.jumpHeld) {
      input.jumpHeld = false;
      input.jump = true;
      input._jumpConsumed = false;
    }
  }
}

// --- Touch ---

function onPointerDown(e) {
  e.preventDefault();
  input.jumpHeld = true;
  input.chargeTime = 0;

  // Touch fallback for direction (only when tilt not active)
  if (!tiltActive) {
    const x = e.clientX / window.innerWidth;
    touchSide = x < 0.5 ? -1 : 1;
  }
}

function onPointerUp(e) {
  touchSide = 0;
  if (input.jumpHeld) {
    input.jumpHeld = false;
    input.jump = true;
    input._jumpConsumed = false;
  }
}

// Legacy export alias
export const requestGyroPermission = requestTiltPermission;
