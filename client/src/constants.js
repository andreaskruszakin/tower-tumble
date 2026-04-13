// Tower Tumble — Shared game constants

export const TOWER_WIDTH = 8;
export const HALF_WIDTH = TOWER_WIDTH / 2;

// Physics
export const GRAVITY = -26;
export const BASE_JUMP_VELOCITY = 8;
export const MAX_JUMP_VELOCITY = 16;
export const CHARGED_JUMP_BONUS = 5;
export const CHARGE_TIME = 0.4;
export const MOMENTUM_JUMP_SCALE = 1.0;
export const MAX_HORIZONTAL_SPEED = 10;
export const HORIZONTAL_ACCEL = 28;
export const GROUND_FRICTION = 0.88;
export const AIR_FRICTION = 0.98;
export const WALL_BOUNCE_FACTOR = 1.05;
export const WALL_BOUNCE_BOOST = 3.0;

// Character
export const CHAR_WIDTH = 0.8;
export const CHAR_HEIGHT = 1.4;

// Platforms
export const PLATFORM_HEIGHT = 0.35;
export const PLATFORM_MIN_WIDTH = 1.0;
export const PLATFORM_MAX_WIDTH = 5.0;
export const LAYER_SPACING = 0.95;
export const MAX_PLATFORMS_PER_LAYER = 2;
export const TOTAL_LAYERS = 600;
export const GENERATE_AHEAD = 120;

// Platform types
export const PLATFORM_STATIC = 0;
export const PLATFORM_CRUMBLE = 1;
export const PLATFORM_BOUNCY = 2;
export const PLATFORM_MOVING = 3;
export const PLATFORM_SPIKE = 4;        // new: spikes — landing = death

export const CRUMBLE_TIME = 1.0;
export const CRUMBLE_RESPAWN = 5.0;
export const BOUNCY_MULTIPLIER = 2.0;
export const MOVING_AMPLITUDE = 1.8;
export const MOVING_PERIOD = 3.0;

// Camera auto-scroll
export const CAMERA_SCROLL_START = 0.6;
export const CAMERA_SCROLL_ACCEL = 0.12;
export const CAMERA_SCROLL_INTERVAL = 10;
export const CAMERA_SCROLL_MAX = 6.0;

// Combo
export const COMBO_BASE = 1;
export const COMBO_SKIP_THRESHOLD = 1;

// Camera
export const CAMERA_LERP = 0.08;
export const CAMERA_OFFSET_Y = 3;
export const CAMERA_DISTANCE = 14;

// Gyroscope
export const GYRO_DEAD_ZONE = 5;
export const GYRO_MAX_ANGLE = 30;
export const GYRO_SMOOTHING = 0.15;

// Player colors
export const PLAYER_COLORS = [
  0xE8A87C, 0x95B8D1, 0xB8E0D2, 0xD6A2E8, 0xEAB8B8,
  0xA8D8EA, 0xC1D37F, 0xF0C987, 0xC9B1FF, 0xD5C4A1,
];

// 8 Biomes — progressively harder and more distinct
export const BIOMES = [
  {
    maxY: 40,
    name: 'Sunrise Garden',
    sky: 0xFFB7A5, fog: 0xFFF0E0,
    wall: 0xC4A882,
    platStatic: 0x8BBF7A, platCrumble: 0xC4A060,
    platBouncy: 0xF0A0B8, platMoving: 0x7AB5CC, platSpike: 0xCC3333,
    density: 1.0,       // full platform density
    spikeChance: 0,     // no spikes
  },
  {
    maxY: 80,
    name: 'Crystal Caves',
    sky: 0x4A6A8A, fog: 0x2A3A4A,
    wall: 0x5A6A7A,
    platStatic: 0x6A9AB0, platCrumble: 0x8A7060,
    platBouncy: 0xC070E0, platMoving: 0x50B090, platSpike: 0x8040A0,
    density: 0.85,
    spikeChance: 0,
  },
  {
    maxY: 120,
    name: 'Lava Depths',
    sky: 0x4A2020, fog: 0x2A1010,
    wall: 0x6A3030,
    platStatic: 0x8A6040, platCrumble: 0xA04020,
    platBouncy: 0xE08020, platMoving: 0xC04040, platSpike: 0xDD2200,
    density: 0.75,
    spikeChance: 0.08,  // spikes start appearing
  },
  {
    maxY: 170,
    name: 'Sky Temple',
    sky: 0x1A0A30, fog: 0x100520,
    wall: 0x4A3A6A,
    platStatic: 0xC0B0E0, platCrumble: 0x8070A0,
    platBouncy: 0xE0D060, platMoving: 0x60C0E0, platSpike: 0xFF3366,
    density: 0.65,
    spikeChance: 0.12,
  },
  {
    maxY: 230,
    name: 'Frozen Peaks',
    sky: 0xC0D8E8, fog: 0xE0F0FF,
    wall: 0xA0B8C8,
    platStatic: 0xD0E4F0, platCrumble: 0x90A8B8,
    platBouncy: 0x70D0FF, platMoving: 0x88C8E0, platSpike: 0x4488CC,
    density: 0.55,
    spikeChance: 0.15,
  },
  {
    maxY: 300,
    name: 'Neon City',
    sky: 0x0A0A1A, fog: 0x050510,
    wall: 0x1A1A2A,
    platStatic: 0x33FF88, platCrumble: 0x888844,
    platBouncy: 0xFF33CC, platMoving: 0x3388FF, platSpike: 0xFF1144,
    density: 0.45,      // very sparse
    spikeChance: 0.18,
  },
  {
    maxY: 400,
    name: 'Void Realm',
    sky: 0x050005, fog: 0x020002,
    wall: 0x200020,
    platStatic: 0x8844AA, platCrumble: 0x553366,
    platBouncy: 0xCC66FF, platMoving: 0x6633CC, platSpike: 0xFF0066,
    density: 0.35,      // extremely sparse
    spikeChance: 0.22,
  },
  {
    maxY: 9999,
    name: 'THE BEYOND',
    sky: 0x000000, fog: 0x000000,
    wall: 0x111111,
    platStatic: 0xFFFFFF, platCrumble: 0x888888,
    platBouncy: 0xFFDD00, platMoving: 0xFF4400, platSpike: 0xFF0000,
    density: 0.25,      // barely any platforms
    spikeChance: 0.25,  // 1 in 4 platforms has spikes
  },
];

export const WALL_COLOR = 0xC4A882;
export const FLOOR_COLOR = 0xCC4444;

// Combo tiers
export const COMBO_TIERS = [
  { min: 2, label: 'NICE!',       color: '#ffe8c8' },
  { min: 4, label: 'GREAT!',      color: '#ffb870' },
  { min: 6, label: 'AMAZING!',    color: '#ff8844' },
  { min: 8, label: 'INCREDIBLE!', color: '#ff4488' },
  { min: 12, label: 'LEGENDARY!', color: '#ff22ff' },
];
