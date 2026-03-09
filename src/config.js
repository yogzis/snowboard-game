/** Convert hex color (e.g. 0x20b2aa) to CSS string (#20b2aa) for DOM use. */
export function hexToCss(hex) {
  const h = Number(hex).toString(16).padStart(6, "0");
  return "#" + h;
}

/** Convert hex color to RGB components in 0–1 range. Use with Babylon Color3(r, g, b). */
export function hexToRgb(hex) {
  const value = Number(hex);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

/** Returns config value if defined, otherwise fallback. Use for optional CONFIG overrides. */
export function getConfigValue(obj, key, fallback) {
  const value = obj?.[key];
  return value != null ? value : fallback;
}

export const PHYSICS_CONSTANTS = {
  spinOutDecelFactor: 0.3,
  spinOutSpeedThreshold: 0.02,
  spinOutAngleEpsilon: 1e-3,
  boostInterpolationFactor: 0.12,
  marginFriction: 0.97,
  turnRatioStopDriftFriction: 0.98,
  overMaxSpeedFriction: 0.99,
  angleMagnitudeBase: 1.6,
  angleMagnitudeExponent: 1.2,
  angleMagnitudeMin: 0.2,
  steerInterpolationSpeed: 0.15,
  leanBackInterpolation: 0.12,
  invincibleFadeStartSeconds: 2,
  invincibleFlickerStartSeconds: 5,
  shieldOpacityMax: 0.3,
  shieldFlickerPhaseIncrement: 0.2,
  shieldOpacityMin: 0.05,
  dynamiteExplosionParticleCount: 30,
  boostTrailSpawnIntervalFrames: 4,
  boostTrailMinSpeed: 0.1,
  boostTrailHeight: 0.01,
  snowSprayAngleThreshold: 0.3,
  snowSpraySpeedThreshold: 0.2,
  worldGroundOffset: 20,
  dynamiteDefuseJumpCount: 2,
  dynamiteOffsetFromPlayer: 1.6,
  dynamiteSparkVelocitySpread: 0.15,
  dynamiteSparkVelocityYMin: 0.05,
  dynamiteSparkVelocityYRange: 0.12,
  dynamiteSparkPositionJitter: 0.2,
  snowSprayVelocitySpread: 0.2,
  speedThresholdMoving: 0.001,
  boxBreakBounceVelocity: 0.3,
  damageSpeedMultiplier: 0.5,
  damagePositionBump: 0.2,
  lifeLostInvincibleDuration: 2,
  lifeLostShieldPulseTime: 0.25,
  treeRockObstacleDespawnOffset: 10,
};

export const OBSTACLE_CONSTANTS = {
  spawnWeightRampCombo: 0.95,
  spawnWeightBox: 0.78,
  spawnWeightBoost: 0.72,
  spawnWeightRock: 0.42,
  floatingBoxProbability: 0.5,
  rampSlotProbability: 0.7,
  boostSlotProbability: 0.25,
  treeOrRockProbability: 0.5,
  chunkSlotJitter: 8,
  chunkZOffsetRange: 6,
  chunkSlots: 5,
  spawnChunkDistanceThreshold: 90,
  spawnChunkBaseOffset: 18,
  spawnChunkRandomOffset: 8,
  despawnObstacleOffset: 10,
  obstacleHitRadiusPadding: 0.3,
  rampComboBoxZOffset: 24,
  rampComboBoxY: 6.5,
  elevatedBoxBreakHeight: 6.0,
  groundBoxHitHeight: 0.5,
  boxBreakBounceVelocity: 0.3,
  obstacleDamageAmount: 20,
  shieldHitSpeedMultiplier: 0.5,
  shieldHitPositionBump: 0.2,
  shieldHitPulseDuration: 15,
};

export const PARTICLE_CONSTANTS = {
  decayRate: 0.05,
  effectScaleRate: 0.2,
  effectOpacityDecay: 0.05,
  boostTrailDecayRate: 0.02,
  dynamiteSparkDecayRate: 0.08,
};

export const SPAWN_CONSTANTS = {
  initialChunkCount: 25,
  chunkSpacing: 10,
};

export const CONFIG = {
  colors: {
    sky: 0x87ceeb,
    snow: 0xffffff,
    tree: 0x2d3436,
    rock: 0x808080,
    jacket: 0xd4a017,
    pants: 0x1a1a1a,
    helmet: 0xffffff,
    goggles: 0x111111,
    backpack: 0x333333,
    box: 0xf1c40f,
    elevatedBox: 0xffd700,
    boost: 0x2ecc71,
    shield: 0x00ffff,
    ramp: 0x95a5a6,
    glideIndicator: 0x9b59b6,
    glideSurface: 0x20b2aa,
  },
  physics: {
    maxSpeed: 0.85,
    boostSpeed: 1.05,
    acceleration: 0.0045,
    friction: 0.98,
    carveFriction: 0.997,
    carveMaxSpeedFrac: 0.75,
    carveAccelScale: 0.25,
    carveTurnInterpolation: 0.25,
    steerNoUpFriction: 0.998,
    steerNoUpMinSpeed: 0.35,
    steerOnlyMaxSpeedFrac: 0.75,
    steerDownFriction: 0.97,
    steerDownMinSpeed: 0.01,
    steerDownLeanBack: 0.55,
    steerDownExtraTurnRad: Math.PI / 4,
    steerDownOnlyAccel: 0.002,
    steerNoUpTurnScale: 0.5,
    accelNoUpScale: 0.55,
    accelUpOnlyScale: 0.88,
    accelDownOnlyScale: 1.0,
    straightLineFriction: 0.997,
    gravity: 0.02,
    jumpForceShort: 0.22,
    jumpChargeDurationMs: 600,
    jumpForceMax: 0.5,
    /** Charge ratio (0–1) required to count as "charged jump" for floating boxes. */
    jumpChargeThresholdForFloating: 0.5,
    rampForce: 0.4,
    rampAssistWindow: 50 / 60,
    rampAssistBoost: 0.32,
    spinOutThreshold: 1.5,
    /** Total time (seconds) we consider the player to be in a spin-out state. */
    spinOutDuration: 1,
    /** Angular speed (radians per 1/60 frame) for spin-out; smaller divisor = faster 360°. */
    spinOutSpinSpeed: (2 * Math.PI) / 20,
    /** Duration of the fall phase after the spin completes (seconds). */
    spinOutFallDuration: 0.8,
    /** Gravity multiplier when gliding (slower fall). */
    glideGravityScale: 0.6,
  },
  game: {
    maxHP: 100,
    maxLives: 3,
    invincibleTime: 10,
    dynamiteTime: 5,
    dynamiteDamage: 85,
    boostDuration: 3,
    baseSpawnRate: 0.2,
    /** Seconds of cumulative air time with reduced gravity when glide prize is won. */
    glideDuration: 5,
  },
  world: {
    playAreaWidth: 72,
    obstacleZoneMargin: 8,
    floatingBoxHeight: 3.5,
    floatingBoxBreakHeight: 3.0,
  },
  // Set to { logCharacterLoad: true } to log character load/apply diagnostics.
  debug: { logCharacterLoad: true },
  /** Optional rendering overrides. Omit or set fog.enabled: false to reduce fog so HDR sky is dominant. */
  rendering: {
    /** Roll (tilt) applied when steering: container rotation.z = -playerAngle * steeringTiltScale. Increase for more lean, decrease for subtler tilt (e.g. 0.2–0.5). */
    steeringTiltScale: -0.3,
    fog: {
      enabled: true,
      start: 50,
      end: 120,
      /** Hex fog color (defaults to colors.sky when not set). */
      color: 0x87ceeb,
    },
  },
  // Asset URLs (served from public/). Omit or set to "" to use procedural fallback.
  assets: {
    basePath: "/assets",
    /** Scale applied to the glTF character. Use 1 for meter-based models (e.g. Onirix), 0.01 for cm-based. */
    characterScale: 55,
    /** Pipeline test: when set, used instead of character for loading (lets you keep character: "" for procedural). Duck from Khronos glTF Sample Models. */
    characterTest: "/assets/character/snowboarder.glb",
    character: "/assets/character/snowboarder.glb",
    sky: "/assets/sky/rocky_ridge_puresky_4k.hdr",
    terrain: {
      heightmap: "",
      snowAlbedo: "",
      snowNormal: "",
      snowRoughness: "",
    },
    obstacles: {
      tree: "/assets/obstacles/tree.glb",
      rock: "/assets/obstacles/rock.glb",
      box: "/assets/obstacles/box.glb",
      ramp: "/assets/obstacles/ramp.glb",
    },
  },
};
