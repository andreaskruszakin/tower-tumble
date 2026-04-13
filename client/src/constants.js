// Tower Tumble — Shared game constants
// Tuning these values is the difference between "meh" and "incredible"

export const TOWER_WIDTH = 8;            // narrower walls — more wall bouncing
export const HALF_WIDTH = TOWER_WIDTH / 2;

// Physics
export const GRAVITY = -26;             // units/s² (negative = down)
export const BASE_JUMP_VELOCITY = 8;    // standing still jump
export const MAX_JUMP_VELOCITY = 16;    // full sprint jump
export const MOMENTUM_JUMP_SCALE = 1.0; // how much horizontal speed boosts jump
export const MAX_HORIZONTAL_SPEED = 10; // movement cap
export const HORIZONTAL_ACCEL = 28;     // acceleration from input
export const GROUND_FRICTION = 0.88;    // per-frame multiplier when grounded
export const AIR_FRICTION = 0.98;       // per-frame multiplier in air
export const WALL_BOUNCE_FACTOR = 0.95; // speed retained on wall bounce
export const WALL_BOUNCE_BOOST = 2.0;   // extra horizontal push on bounce

// Character
export const CHAR_WIDTH = 0.8;
export const CHAR_HEIGHT = 1.4;

// Platforms
export const PLATFORM_HEIGHT = 0.35;
export const PLATFORM_MIN_WIDTH = 1.8;
export const PLATFORM_MAX_WIDTH = 4.0;
export const LAYER_SPACING = 1.6;       // tight spacing — always reachable
export const PLATFORMS_PER_LAYER_MIN = 1;
export const PLATFORMS_PER_LAYER_MAX = 4;
export const TOTAL_LAYERS = 500;        // initial batch
export const GENERATE_AHEAD = 80;       // generate new layers when player is within this distance of top

// Platform types
export const PLATFORM_STATIC = 0;
export const PLATFORM_CRUMBLE = 1;
export const PLATFORM_BOUNCY = 2;
export const PLATFORM_MOVING = 3;

export const CRUMBLE_TIME = 1.0;
export const CRUMBLE_RESPAWN = 5.0;
export const BOUNCY_MULTIPLIER = 2.0;
export const MOVING_AMPLITUDE = 1.8;    // less amplitude since walls are closer
export const MOVING_PERIOD = 3.0;

// Auto-scrolling camera (replaces rising floor as death mechanic)
export const CAMERA_SCROLL_START = 0.8; // units/s initial auto-scroll speed
export const CAMERA_SCROLL_ACCEL = 0.08; // additional units/s per interval
export const CAMERA_SCROLL_INTERVAL = 12; // seconds between speed increases
export const CAMERA_SCROLL_MAX = 4.5;

// Combo
export const COMBO_BASE = 1;
export const COMBO_SKIP_THRESHOLD = 1;

// Camera
export const CAMERA_LERP = 0.08;
export const CAMERA_OFFSET_Y = 3;
export const CAMERA_DISTANCE = 14;      // closer for narrower tower

// Gyroscope
export const GYRO_DEAD_ZONE = 5;
export const GYRO_MAX_ANGLE = 30;
export const GYRO_SMOOTHING = 0.15;

// Colors — warm muted pastels
export const PLAYER_COLORS = [
  0xE8A87C, // peach
  0x95B8D1, // dusty blue
  0xB8E0D2, // sage
  0xD6A2E8, // lilac
  0xEAB8B8, // blush
  0xA8D8EA, // sky
  0xC1D37F, // olive
  0xF0C987, // amber
  0xC9B1FF, // periwinkle
  0xD5C4A1, // sand
];

// Biomes — each has distinct sky, wall, platform, and fog colors
export const BIOMES = [
  {
    maxY: 50,
    name: 'Sunrise Garden',
    sky: 0xFFB7A5,
    fog: 0xFFF0E0,
    wall: 0xC4A882,     // warm sandstone
    platStatic: 0x8BBF7A,  // grass green
    platCrumble: 0xC4A060, // dry dirt
    platBouncy: 0xF0A0B8,  // pink mushroom
    platMoving: 0x7AB5CC,  // morning dew blue
  },
  {
    maxY: 110,
    name: 'Crystal Caves',
    sky: 0x4A6A8A,
    fog: 0x2A3A4A,
    wall: 0x5A6A7A,     // slate grey
    platStatic: 0x6A9AB0,  // ice blue
    platCrumble: 0x8A7060,  // cracked stone
    platBouncy: 0xC070E0,  // crystal purple
    platMoving: 0x50B090,  // emerald
  },
  {
    maxY: 180,
    name: 'Lava Depths',
    sky: 0x4A2020,
    fog: 0x2A1010,
    wall: 0x6A3030,     // dark red stone
    platStatic: 0x8A6040,  // charred brown
    platCrumble: 0xA04020,  // crumbling ember
    platBouncy: 0xE08020,  // magma orange
    platMoving: 0xC04040,  // lava red
  },
  {
    maxY: 9999,
    name: 'Sky Temple',
    sky: 0x1A0A30,
    fog: 0x100520,
    wall: 0x4A3A6A,     // cosmic purple
    platStatic: 0xC0B0E0,  // pale violet
    platCrumble: 0x8070A0,  // fading stone
    platBouncy: 0xE0D060,  // golden
    platMoving: 0x60C0E0,  // ethereal cyan
  },
];

// Wall color (default, overridden by biome)
export const WALL_COLOR = 0xC4A882;

// Rising floor color
export const FLOOR_COLOR = 0xCC4444;

// Combo tier thresholds and labels
export const COMBO_TIERS = [
  { min: 2, label: 'NICE!',       color: '#ffe8c8' },
  { min: 4, label: 'GREAT!',      color: '#ffb870' },
  { min: 6, label: 'AMAZING!',    color: '#ff8844' },
  { min: 8, label: 'INCREDIBLE!', color: '#ff4488' },
  { min: 12, label: 'LEGENDARY!', color: '#ff22ff' },
];
