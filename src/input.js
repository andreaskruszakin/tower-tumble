import { GYRO_DEAD_ZONE, GYRO_MAX_ANGLE, GYRO_SMOOTHING, MAX_HORIZONTAL_SPEED } from './constants.js';

// Unified input system: gyroscope (mobile) + keyboard (desktop) + touch fallback
// Exposes: input.horizontal (-1 to 1), input.jump (boolean, consumed on read)

export const input = {
  horizontal: 0,     // -1 (left) to 1 (right)
  jump: false,        // true for one frame when jump pressed
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

// --- State ---
let gyroAvailable = false;
let gyroPermissionGranted = false;
let gyroNeutral = null;       // calibration offset
let gyroSmoothed = 0;
let keysDown = new Set();
let touchSide = 0;            // -1 left, 0 none, 1 right
let isMobile = navigator.maxTouchPoints > 0;
let inputInitialized = false;

// --- Public ---
export function initInput(canvas) {
  if (inputInitialized) return;
  inputInitialized = true;

  // Keyboard
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Touch / click for jump
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  // Prevent context menu
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Try gyroscope
  if (isMobile) {
    requestGyro();
  }
}

// Called each frame to update input.horizontal
export function updateInput() {
  if (gyroAvailable && gyroPermissionGranted) {
    // Gyroscope drives horizontal
    input.horizontal = gyroSmoothed;
  } else if (isMobile && touchSide !== 0) {
    // Touch fallback: left/right halves
    input.horizontal = touchSide;
  } else {
    // Keyboard
    let h = 0;
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) h -= 1;
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) h += 1;
    input.horizontal = h;
  }
}

export function isGyroActive() {
  return gyroAvailable && gyroPermissionGranted;
}

// --- Gyroscope ---
async function requestGyro() {
  // iOS requires permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        enableGyro();
      } else {
        console.log('Gyro permission denied, using touch fallback');
      }
    } catch (e) {
      console.log('Gyro permission error, using touch fallback');
    }
  } else if ('DeviceOrientationEvent' in window) {
    // Android / non-permission browsers
    enableGyro();
  }
}

function enableGyro() {
  gyroAvailable = true;
  gyroPermissionGranted = true;
  window.addEventListener('deviceorientation', onDeviceOrientation);
}

function onDeviceOrientation(e) {
  // gamma: left-right tilt (-90 to 90)
  let gamma = e.gamma || 0;

  // Calibrate neutral position on first reading
  if (gyroNeutral === null) {
    gyroNeutral = gamma;
  }

  // Subtract neutral offset
  let tilt = gamma - gyroNeutral;

  // Dead zone
  if (Math.abs(tilt) < GYRO_DEAD_ZONE) {
    tilt = 0;
  } else {
    // Remap: dead_zone..max_angle → 0..1
    const sign = Math.sign(tilt);
    const magnitude = Math.abs(tilt) - GYRO_DEAD_ZONE;
    const range = GYRO_MAX_ANGLE - GYRO_DEAD_ZONE;
    tilt = sign * Math.min(1, magnitude / range);
  }

  // Exponential moving average smoothing
  gyroSmoothed += (tilt - gyroSmoothed) * GYRO_SMOOTHING;
}

// Allow recalibration
export function recalibrateGyro() {
  gyroNeutral = null;
}

// --- Keyboard ---
function onKeyDown(e) {
  keysDown.add(e.code);

  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    input.jump = true;
    input._jumpConsumed = false;
  }
}

function onKeyUp(e) {
  keysDown.delete(e.code);
}

// --- Touch / Pointer ---
function onPointerDown(e) {
  e.preventDefault();

  // Jump on any tap
  input.jump = true;
  input._jumpConsumed = false;

  // If gyro not available, use touch position for direction
  if (!gyroAvailable || !gyroPermissionGranted) {
    const x = e.clientX / window.innerWidth;
    touchSide = x < 0.5 ? -1 : 1;
  }
}

function onPointerUp(e) {
  touchSide = 0;
}

// iOS gyroscope requires user gesture to request permission
// Call this on first tap if on iOS
export function requestGyroPermission() {
  if (isMobile && !gyroPermissionGranted) {
    requestGyro();
  }
}
