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

// --- Tilt detection using ACCELEROMETER (not gyroscope) ---
// DeviceOrientation gamma is broken in portrait mode (gimbal lock).
// Instead, use DeviceMotion accelerationIncludingGravity.x
// which directly gives us left-right tilt as a gravity component.
// Phone flat: x≈0. Tilt right: x>0. Tilt left: x<0.
// Phone upright in portrait: x still works for left-right tilt.

let accelNeutral = null;
let accelSamples = null;

async function requestGyro() {
  // iOS 13+ requires permission for BOTH orientation and motion
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      if (result === 'granted') {
        enableAccel();
      } else {
        console.log('Motion permission denied, using touch fallback');
      }
    } catch (e) {
      console.log('Motion permission error, using touch fallback');
    }
  } else if ('DeviceMotionEvent' in window) {
    enableAccel();
  }
}

function enableAccel() {
  gyroAvailable = true;
  gyroPermissionGranted = true;
  accelNeutral = null;
  accelSamples = [];
  window.addEventListener('devicemotion', onDeviceMotion);
}

function onDeviceMotion(e) {
  const accel = e.accelerationIncludingGravity;
  if (!accel || accel.x === null) return;

  // x-axis: positive = tilt right, negative = tilt left
  // Range is roughly -10 to 10 (m/s²), 9.8 = full sideways
  const rawX = accel.x;

  // Calibrate: median of first 15 samples
  if (accelNeutral === null) {
    accelSamples.push(rawX);
    if (accelSamples.length >= 15) {
      const sorted = [...accelSamples].sort((a, b) => a - b);
      accelNeutral = sorted[Math.floor(sorted.length / 2)];
      accelSamples = null;
    }
    return;
  }

  // Subtract neutral (accounts for how user naturally holds phone)
  let tilt = rawX - accelNeutral;

  // On some devices x is inverted — detect and flip if needed
  // (handled by the dead zone being symmetric)

  // Convert m/s² to -1..1 range
  // Dead zone: ~0.5 m/s² (small tilts ignored)
  // Max: ~4 m/s² (moderate tilt = full speed, don't need extreme angles)
  const deadZone = 0.5;
  const maxAccel = 4.0;

  if (Math.abs(tilt) < deadZone) {
    tilt = 0;
  } else {
    const sign = Math.sign(tilt);
    const magnitude = Math.abs(tilt) - deadZone;
    tilt = sign * Math.min(1, magnitude / (maxAccel - deadZone));
  }

  // Smooth heavily to prevent jitter from vibration
  gyroSmoothed += (tilt - gyroSmoothed) * 0.12;

  // Continuous drift correction: slowly nudge neutral toward current reading
  // This handles the phone being repositioned mid-game
  accelNeutral += (rawX - accelNeutral) * 0.002;
}

// Allow recalibration
export function recalibrateGyro() {
  accelNeutral = null;
  accelSamples = [];
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
