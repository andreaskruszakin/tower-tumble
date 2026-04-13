import * as THREE from 'three';

// Vibe Jam 2026 portal system
// Entry: ?portal=true → skip name, instant play, sky-drop entrance
// Exit: glowing doorframe at ground → redirects to vibej.am/portal/2026

const params = new URLSearchParams(window.location.search);
export const isPortalEntry = params.get('portal') === 'true';
export const portalUsername = params.get('username') || '';
export const portalColor = params.get('color') || '';
export const portalRef = params.get('ref') || '';

let exitPortalMesh = null;
let entryPortalMesh = null;

const _box = new THREE.BoxGeometry(1, 1, 1);

// Create the exit portal (always present, leads to next game)
export function createExitPortal(scene, x = 3, y = 0.5) {
  const group = new THREE.Group();
  group.name = 'exitPortal';

  // Doorframe — two pillars + top bar
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x44DDFF });
  const pillarL = new THREE.Mesh(_box, frameMat);
  pillarL.scale.set(0.3, 2.5, 0.3);
  pillarL.position.set(-0.8, 1.25, 0);
  group.add(pillarL);

  const pillarR = new THREE.Mesh(_box, frameMat);
  pillarR.scale.set(0.3, 2.5, 0.3);
  pillarR.position.set(0.8, 1.25, 0);
  group.add(pillarR);

  const topBar = new THREE.Mesh(_box, frameMat);
  topBar.scale.set(1.9, 0.3, 0.3);
  topBar.position.set(0, 2.5, 0);
  group.add(topBar);

  // Inner glow
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x22AAFF,
    transparent: true,
    opacity: 0.3,
  });
  const inner = new THREE.Mesh(_box, glowMat);
  inner.scale.set(1.3, 2.2, 0.1);
  inner.position.set(0, 1.2, 0);
  inner.name = 'portalGlow';
  group.add(inner);

  // Label
  // (handled by HTML UI overlay instead)

  group.position.set(x, y, 0.5);
  scene.add(group);
  exitPortalMesh = group;
  return group;
}

// Create entry portal (only when ?ref= is present — leads back to previous game)
export function createEntryPortal(scene, x = -3, y = 0.5) {
  if (!portalRef) return null;

  const group = new THREE.Group();
  group.name = 'entryPortal';

  const frameMat = new THREE.MeshBasicMaterial({ color: 0xFF8844 });
  const pillarL = new THREE.Mesh(_box, frameMat);
  pillarL.scale.set(0.3, 2.5, 0.3);
  pillarL.position.set(-0.8, 1.25, 0);
  group.add(pillarL);

  const pillarR = new THREE.Mesh(_box, frameMat);
  pillarR.scale.set(0.3, 2.5, 0.3);
  pillarR.position.set(0.8, 1.25, 0);
  group.add(pillarR);

  const topBar = new THREE.Mesh(_box, frameMat);
  topBar.scale.set(1.9, 0.3, 0.3);
  topBar.position.set(0, 2.5, 0);
  group.add(topBar);

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xFF6622,
    transparent: true,
    opacity: 0.3,
  });
  const inner = new THREE.Mesh(_box, glowMat);
  inner.scale.set(1.3, 2.2, 0.1);
  inner.position.set(0, 1.2, 0);
  inner.name = 'portalGlow';
  group.add(inner);

  group.position.set(x, y, 0.5);
  scene.add(group);
  entryPortalMesh = group;
  return group;
}

// Animate portal glow
export function updatePortals(dt, gameTime) {
  const pulse = 0.25 + Math.sin(gameTime * 3) * 0.1;

  if (exitPortalMesh) {
    const glow = exitPortalMesh.getObjectByName('portalGlow');
    if (glow) glow.material.opacity = pulse;
  }
  if (entryPortalMesh) {
    const glow = entryPortalMesh.getObjectByName('portalGlow');
    if (glow) glow.material.opacity = pulse;
  }
}

// Check if player is touching the exit portal
export function checkExitPortal(playerX, playerY) {
  if (!exitPortalMesh) return false;
  const px = exitPortalMesh.position.x;
  const py = exitPortalMesh.position.y;
  return Math.abs(playerX - px) < 1.2 && Math.abs(playerY - py) < 1.5;
}

// Check if player is touching the entry portal (back to ref game)
export function checkEntryPortal(playerX, playerY) {
  if (!entryPortalMesh) return false;
  const px = entryPortalMesh.position.x;
  const py = entryPortalMesh.position.y;
  return Math.abs(playerX - px) < 1.2 && Math.abs(playerY - py) < 1.5;
}

// Navigate to exit portal destination
export function navigateExitPortal(playerName, playerColor) {
  const url = new URL('https://vibej.am/portal/2026');
  if (playerName) url.searchParams.set('username', playerName);
  if (playerColor) url.searchParams.set('color', playerColor);
  url.searchParams.set('ref', window.location.origin + window.location.pathname);
  window.location.href = url.toString();
}

// Navigate back to referring game
export function navigateEntryPortal() {
  if (!portalRef) return;
  const url = new URL(portalRef.startsWith('http') ? portalRef : `https://${portalRef}`);
  url.searchParams.set('portal', 'true');
  if (portalUsername) url.searchParams.set('username', portalUsername);
  if (portalColor) url.searchParams.set('color', portalColor);
  url.searchParams.set('ref', window.location.origin + window.location.pathname);
  window.location.href = url.toString();
}

// Get display name (from portal or localStorage)
export function getPlayerName() {
  if (portalUsername) return portalUsername;
  return localStorage.getItem('tt-name') || 'Player' + Math.floor(Math.random() * 999);
}

export function setPlayerName(name) {
  localStorage.setItem('tt-name', name);
}
