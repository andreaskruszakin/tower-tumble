import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

let composer = null;
let vhsPass = null;
let pixelPass = null;
let glitchTimer = 0;
let glitchActive = false;
let glitchDuration = 0;

// --- Pixelation shader ---
const PixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    pixelSize: { value: 4.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    varying vec2 vUv;

    void main() {
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy) + dxy * 0.5;
      gl_FragColor = texture2D(tDiffuse, coord);
    }
  `,
};

// --- VHS / CRT shader ---
const VHSShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    scanlineIntensity: { value: 0.08 },
    noiseIntensity: { value: 0.06 },
    chromaticAberration: { value: 1.5 },
    vignetteIntensity: { value: 0.35 },
    warmth: { value: 0.12 },
    glitchIntensity: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    uniform float scanlineIntensity;
    uniform float noiseIntensity;
    uniform float chromaticAberration;
    uniform float vignetteIntensity;
    uniform float warmth;
    uniform float glitchIntensity;
    varying vec2 vUv;

    // Simple hash noise
    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 uv = vUv;

      // --- VHS tracking glitch ---
      if (glitchIntensity > 0.0) {
        float glitchY = fract(time * 0.7);
        float band = smoothstep(0.0, 0.02, abs(uv.y - glitchY) - 0.03);
        float offset = (1.0 - band) * glitchIntensity * 0.08;
        uv.x += offset * sin(uv.y * 80.0 + time * 20.0);
      }

      // --- Chromatic aberration ---
      float aberration = chromaticAberration / resolution.x;
      float r = texture2D(tDiffuse, vec2(uv.x + aberration, uv.y)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, vec2(uv.x - aberration, uv.y)).b;
      vec3 col = vec3(r, g, b);

      // --- Scanlines ---
      float scanline = sin(vUv.y * resolution.y * 1.5) * 0.5 + 0.5;
      col -= scanline * scanlineIntensity;

      // --- Scrolling scanline band (subtle) ---
      float scrollLine = smoothstep(0.0, 0.005, abs(fract(vUv.y - time * 0.03) - 0.5) - 0.498);
      col -= (1.0 - scrollLine) * 0.04;

      // --- Film grain ---
      float noise = hash(vUv * resolution + time * 100.0);
      col += (noise - 0.5) * noiseIntensity;

      // --- Warm color grading ---
      col.r += warmth * 0.6;
      col.g += warmth * 0.2;
      col.b -= warmth * 0.3;
      // Slight desaturation
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 0.88);

      // --- Vignette ---
      vec2 vig = vUv * (1.0 - vUv);
      float vigFactor = vig.x * vig.y * 15.0;
      vigFactor = pow(vigFactor, vignetteIntensity);
      col *= vigFactor;

      // --- Subtle CRT barrel distortion on edges ---
      // (baked into the vignette — keeps it cheap)

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function initVHS(renderer, scene, camera) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Pixelation pass first
  pixelPass = new ShaderPass(PixelShader);
  updateResolution();
  composer.addPass(pixelPass);

  // VHS pass on top
  vhsPass = new ShaderPass(VHSShader);
  updateResolution();
  composer.addPass(vhsPass);

  window.addEventListener('resize', updateResolution);

  return composer;
}

function updateResolution() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (pixelPass) {
    pixelPass.uniforms.resolution.value.set(w, h);
    // Scale pixel size based on screen — bigger pixels on smaller screens
    pixelPass.uniforms.pixelSize.value = w < 600 ? 3.0 : 3.5;
  }
  if (vhsPass) {
    vhsPass.uniforms.resolution.value.set(w, h);
  }
  if (composer) {
    composer.setSize(w, h);
  }
}

export function updateVHS(dt) {
  if (!vhsPass) return;

  vhsPass.uniforms.time.value += dt;

  // Random glitch trigger
  glitchTimer -= dt;
  if (glitchTimer <= 0 && !glitchActive) {
    glitchTimer = 8 + Math.random() * 6; // every 8-14 seconds
    triggerGlitch();
  }

  // Glitch decay
  if (glitchActive) {
    glitchDuration -= dt;
    if (glitchDuration <= 0) {
      glitchActive = false;
      vhsPass.uniforms.glitchIntensity.value = 0;
    } else {
      // Fade out
      vhsPass.uniforms.glitchIntensity.value = glitchDuration / 0.3;
    }
  }
}

export function triggerGlitch(intensity = 1.0) {
  if (!vhsPass) return;
  glitchActive = true;
  glitchDuration = 0.25 + Math.random() * 0.15;
  vhsPass.uniforms.glitchIntensity.value = intensity;
}

export function renderVHS() {
  if (composer) {
    composer.render();
    return true;
  }
  return false;
}

// Adjust intensity for mobile
export function setMobileMode() {
  if (!vhsPass) return;
  vhsPass.uniforms.chromaticAberration.value = 0.5;
  vhsPass.uniforms.noiseIntensity.value = 0.03;
  vhsPass.uniforms.scanlineIntensity.value = 0.05;
  if (pixelPass) pixelPass.uniforms.pixelSize.value = 2.5;
}
