const REF_FPS = 60;
const DT_MAX = 1 / 30;

export function createInitialState() {
  return {
    REF_FPS,
    DT_MAX,
    lastFrameTime: 0,
    frameId: null,

    player: {
      position: { x: 0, y: 0, z: 0 },
      angle: 0,
      /** Visual-only spin angle used during spin-outs so we can spin the rider without affecting gameplay direction. */
      visualSpinAngle: 0,
      velocity: { x: 0, y: 0, z: 0 },
      leanBack: 0,
    },
    speed: 0,
    playerStats: {
      hp: 100,
      lives: 3,
      isJumping: false,
      didJumpThisAirtime: false,
      rampLaunchFramesAgo: null,
      canRampAssistJump: false,
      invincibleTimer: 0,
      dynamiteTimer: 0,
      dynamiteJumpCount: 0,
      hasDynamite: false,
      boostTimer: 0,
      boostTargetSpeed: 0,
      _lastDynamiteSecShown: 0,
    },
    obstacles: [],
    particles: [],
    effects: [],
    boostTrail: [],
    dynamiteSparks: [],
    particlesToAdd: [],
    effectsToAdd: [],
    boostTrailToAdd: [],
    dynamiteSparksToAdd: [],

    world: { groundX: 0, groundZ: 0 },
    cameraShake: { x: 0, y: 0, intensity: 0 },
    camera: { targetX: 0, targetZ: 0, position: { x: 0, y: 6, z: 12 }, lookAt: { x: 0, y: 0, z: -5 } },

    gameState: "MENU",
    score: 0,
    turnDuration: 0,
    steerOnlyDuration: 0,
    lastSteerDir: 0,
    /** Legacy flags used by older code paths; kept for compatibility but now driven from spinOut.* */
    isSpinningOut: false,
    spinOutTimer: 0,
    /** Structured spin-out state so we can model phases (spin, fall, recover) and precise rotation. */
    spinOut: {
      active: false,
      /** "SPINNING" | "FALLING" | "RECOVERED" | null */
      phase: null,
      /** Accumulated spin angle in radians (0 → 2π for one full rotation). */
      angleAccum: 0,
      /** Direction of spin: +1 or -1. */
      direction: 1,
      /** Generic timer used for fall duration / recovery delays (seconds). */
      timer: 0,
    },

    input: {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpCharge: 0,
    },
    jumpPressStartedAt: null,
    boostTrailSpawnAccum: 0,

    visuals: {
      shieldPulseTime: 0,
      shieldFlickerPhase: 0,
      shieldOpacity: 0,
    },

    nextObstacleId: 1,
    nextParticleId: 1,
    nextEffectId: 1,

    playerRotationX: 0,
  };
}

export { REF_FPS, DT_MAX };
