// Tower Tumble — Shared game constants

export const TOWER_WIDTH = 8;
export const HALF_WIDTH = TOWER_WIDTH / 2;

// Physics
export const GRAVITY = -26;
export const BASE_JUMP_VELOCITY = 8;
export const MAX_JUMP_VELOCITY = 16;
export const CHARGED_JUMP_BONUS = 5;     // extra velocity from full charge
export const CHARGE_TIME = 0.4;           // seconds to full charge
export const MOMENTUM_JUMP_SCALE = 1.0;
export const MAX_HORIZONTAL_SPEED = 10;
export const HORIZONTAL_ACCEL = 28;
export const GROUND_FRICTION = 0.88;
export const AIR_FRICTION = 0.98;
export const WALL_BOUNCE_FACTOR = 1.05;   // retain + gain speed on wall bounce
export const WALL_BOUNCE_BOOST = 3.0;     // big horizontal kick off walls

// Character
export const CHAR_WIDTH = 0.8;
export const CHAR_HEIGHT = 1.4;

// Platforms — varied widths, very close vertically
export const PLATFORM_HEIGHT = 0.35;
export const PLATFORM_MIN_WIDTH = 1.0;    // tiny platforms exist
export const PLATFORM_MAX_WIDTH = 5.0;    // long platforms too
export const LAYER_SPACING = 0.95;        // very close — easy hop between
export const MAX_PLATFORMS_PER_LAYER = 2;
export const TOTAL_LAYERS = 600;
export const GENERATE_AHEAD = 60;

// Platform types
export const PLATFORM_STATIC = 0;
export const PLATFORM_CRUMBLE = 1;
export const PLATFORM_BOUNCY = 2;
export const PLATFORM_MOVING = 3;

export const CRUMBLE_TIME = 1.0;
export const CRUMBLE_RESPAWN = 5.0;
export const BOUNCY_MULTIPLIER = 2.0;
export const MOVING_AMPLITUDE = 1.8;
export const MOVING_PERIOD = 3.0;

// Camera auto-scroll (THIS is the death mechanic — no red line)
export const CAMERA_SCROLL_START = 0.6;    // slow start
export const CAMERA_SCROLL_ACCEL = 0.12;   // ramps faster
export const CAMERA_SCROLL_INTERVAL = 10;  // every 10 seconds
export const CAMERA_SCROLL_MAX = 6.0;      // gets very fast

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

// Biomes — distinct visual zones
export const BIOMES = [
  {
    maxY: 50,
    name: 'Sunrise Garden',
    sky: 0xFFB7A5, fog: 0xFFF0E0,
    wall: 0xC4A882,
    platStatic: 0x8BBF7A, platCrumble: 0xC4A060,
    platBouncy: 0xF0A0B8, platMoving: 0x7AB5CC,
  },
  {
    maxY: 110,
    name: 'Crystal Caves',
    sky: 0x4A6A8A, fog: 0x2A3A4A,
    wall: 0x5A6A7A,
    platStatic: 0x6A9AB0, platCrumble: 0x8A7060,
    platBouncy: 0xC070E0, platMoving: 0x50B090,
  },
  {
    maxY: 180,
    name: 'Lava Depths',
    sky: 0x4A2020, fog: 0x2A1010,
    wall: 0x6A3030,
    platStatic: 0x8A6040, platCrumble: 0xA04020,
    platBouncy: 0xE08020, platMoving: 0xC04040,
  },
  {
    maxY: 9999,
    name: 'Sky Temple',
    sky: 0x1A0A30, fog: 0x100520,
    wall: 0x4A3A6A,
    platStatic: 0xC0B0E0, platCrumble: 0x8070A0,
    platBouncy: 0xE0D060, platMoving: 0x60C0E0,
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
