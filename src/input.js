import { GYRO_DEAD_ZONE, GYRO_MAX_ANGLE, GYRO_SMOOTHING, MAX_HORIZONTAL_SPEED, CHARGE_TIME } from './constants.js';

// Unified input system: gyroscope (mobile) + keyboard (desktop) + touch fallback
// Exposes: input.horizontal (-1 to 1), input.jump (boolean, consumed on read)

export const input = {
  horizontal: 0,       // -1 (left) to 1 (right)
  jump: false,          // true for one frame when jump released
  jumpHeld: false,      // true while jump button is held
  chargeTime: 0,        // how long jump was held (seconds, 0 to CHARGE_TIME)
  autoJump: false,      // auto-jump mode: tap once to toggle, character jumps on landing
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

// Called each frame to update input.horizontal and charge timer
export function updateInput(dt) {
  if (gyroAvailable && gyroPermissionGranted) {
    input.horizontal = gyroSmoothed;
  } else if (isMobile && touchSide !== 0) {
    input.horizontal = touchSide;
  } else {
    let h = 0;
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) h -= 1;
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) h += 1;
    input.horizontal = h;
  }

  // Charge jump while held
  if (input.jumpHeld && dt) {
    input.chargeTime = Math.min(CHARGE_TIME, input.chargeTime + dt);
  }
}

// Get charge ratio 0..1
export function getChargeRatio() {
  return Math.min(1, input.chargeTime / CHARGE_TIME);
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
  // Portrait mode (phone held upright):
  // gamma = left-right tilt (-90 to 90) — this is what we want
  // beta = front-back tilt (0 to 180 when upright)
  //
  // Problem: when beta is near 90 (phone vertical), gamma gets unstable
  // and can jump. We use gamma directly but with heavy smoothing and
  // a running calibration that adapts over time.

  const gamma = e.gamma;
  if (gamma === null || gamma === undefined) return;

  // Calibrate: average first 10 readings for a stable neutral
  if (gyroNeutral === null) {
    if (!gyroCalibrationSamples) gyroCalibrationSamples = [];
    gyroCalibrationSamples.push(gamma);
    if (gyroCalibrationSamples.length >= 10) {
      // Use median instead of average to ignore outliers
      const sorted = [...gyroCalibrationSamples].sort((a, b) => a - b);
      gyroNeutral = sorted[Math.floor(sorted.length / 2)];
      gyroCalibrationSamples = null;
    }
    return;
  }

  let tilt = gamma - gyroNeutral;

  // Clamp: ignore crazy values from gimbal lock
  if (Math.abs(tilt) > 50) return;

  // Dead zone
  if (Math.abs(tilt) < GYRO_DEAD_ZONE) {
    tilt = 0;
  } else {
    const sign = Math.sign(tilt);
    const magnitude = Math.abs(tilt) - GYRO_DEAD_ZONE;
    const range = GYRO_MAX_ANGLE - GYRO_DEAD_ZONE;
    tilt = sign * Math.min(1, magnitude / range);
  }

  // Heavy smoothing to prevent jitter
  gyroSmoothed += (tilt - gyroSmoothed) * GYRO_SMOOTHING;

  // Slow drift correction: if player isn't touching and tilt is consistently
  // off-center, nudge neutral toward current gamma (adapts to how they hold it)
  gyroNeutral += (gamma - gyroNeutral) * 0.001;
}

let gyroCalibrationSamples = null;

// Allow recalibration
export function recalibrateGyro() {
  gyroNeutral = null;
  gyroCalibrationSamples = null;
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

// --- Touch / Pointer ---
function onPointerDown(e) {
  e.preventDefault();

  // Start charging jump
  input.jumpHeld = true;
  input.chargeTime = 0;

  // If gyro not available, use touch position for direction
  if (!gyroAvailable || !gyroPermissionGranted) {
    const x = e.clientX / window.innerWidth;
    touchSide = x < 0.5 ? -1 : 1;
  }
}

function onPointerUp(e) {
  touchSide = 0;

  // Release = jump with accumulated charge
  if (input.jumpHeld) {
    input.jumpHeld = false;
    input.jump = true;
    input._jumpConsumed = false;
  }
}

// iOS gyroscope requires user gesture to request permission
// Call this on first tap if on iOS
export function requestGyroPermission() {
  if (isMobile && !gyroPermissionGranted) {
    requestGyro();
  }
}
