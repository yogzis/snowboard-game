import { CONFIG, PHYSICS_CONSTANTS, getConfigValue } from "../config.js";
import { REF_FPS } from "./state.js";
import { updateCameraFromPlayer } from "./camera.js";

function ensureSpinOutStructure(state) {
  if (!state.spinOut) {
    state.spinOut = {
      active: false,
      phase: null,
      angleAccum: 0,
      direction: 1,
      timer: 0,
    };
  }
}

function handleSpinOutPhase(dt, state, gameCallbacks) {
  const spinOut = state.spinOut;
  const spinSpinSpeed = getConfigValue(CONFIG.physics, "spinOutSpinSpeed", (2 * Math.PI) / 45);
  const player = state.player;
  const pos = player.position;
  const vel = player.velocity;

  state.speed += (0 - state.speed) * PHYSICS_CONSTANTS.spinOutDecelFactor * dt * REF_FPS;
  if (Math.abs(state.speed) < PHYSICS_CONSTANTS.spinOutSpeedThreshold) state.speed = 0;
  state.speed = Math.max(0, state.speed);

  if (spinOut.phase === "SPINNING") {
    const remaining = Math.max(0, 2 * Math.PI - spinOut.angleAccum);
    const step = Math.min(spinSpinSpeed * dt * REF_FPS, remaining);
    spinOut.angleAccum += step;
    player.visualSpinAngle = spinOut.angleAccum * (spinOut.direction || 1);
    player.angle = 0;

    if (state.speed > PHYSICS_CONSTANTS.speedThresholdMoving) {
      vel.z = -state.speed;
      vel.x = 0;
      pos.z += vel.z * dt * REF_FPS;
    } else {
      vel.z = 0;
    }

    if (spinOut.angleAccum >= 2 * Math.PI - PHYSICS_CONSTANTS.spinOutAngleEpsilon) {
      spinOut.phase = "FALLING";
      spinOut.timer = getConfigValue(CONFIG.physics, "spinOutFallDuration", 0.8);
      player.visualSpinAngle = 0;
    }
  } else if (spinOut.phase === "FALLING") {
    player.visualSpinAngle = 0;
    player.angle = 0;

    if (state.speed > PHYSICS_CONSTANTS.speedThresholdMoving) {
      vel.z = -state.speed;
      vel.x = 0;
      pos.z += vel.z * dt * REF_FPS;
    } else {
      vel.z = 0;
    }

    spinOut.timer -= dt;
    if (spinOut.timer <= 0 && state.speed === 0) {
      spinOut.phase = "RECOVERED";
    }
  } else if (spinOut.phase === "RECOVERED") {
    player.visualSpinAngle = 0;
    player.angle = 0;
    state.turnDuration = 0;
    state.steerOnlyDuration = 0;
    state.lastSteerDir = 0;
    spinOut.active = false;
    spinOut.phase = null;
    spinOut.angleAccum = 0;
    spinOut.direction = 1;
    spinOut.timer = 0;
  }

  state.isSpinningOut = spinOut.active;
  state.spinOutTimer = spinOut.timer;

  if (state.cameraShake.intensity > 0) {
    state.cameraShake.intensity *= Math.pow(0.9, dt * REF_FPS);
  }
  updateCameraFromPlayer(state);
}

function updateSteeringAndCheckSpinOutTrigger(state, gameCallbacks, dt) {
  const isSteering = state.input.left || state.input.right;
  const steerDir = state.input.left ? 1 : state.input.right ? -1 : 0;
  const stats = state.playerStats;

  if (steerDir !== state.lastSteerDir && state.lastSteerDir !== 0) {
    state.turnDuration = 0;
    state.steerOnlyDuration = 0;
  }
  state.lastSteerDir = steerDir;

  if (isSteering) state.turnDuration += dt;
  else state.turnDuration = 0;
  if (isSteering && !state.input.up && !state.input.down && !stats.isJumping) {
    state.steerOnlyDuration += dt;
  } else {
    state.steerOnlyDuration = 0;
  }

  const steerOnlyRatio = Math.min(state.steerOnlyDuration / CONFIG.physics.spinOutThreshold, 1.0);
  if (steerOnlyRatio >= 1.0) {
    state.spinOut.active = true;
    state.spinOut.phase = "SPINNING";
    state.spinOut.angleAccum = 0;
    state.spinOut.direction = state.input.left ? -1 : 1;
    state.spinOut.timer = getConfigValue(CONFIG.physics, "spinOutDuration", 1);
    state.isSpinningOut = true;
    state.spinOutTimer = state.spinOut.timer;
    if (stats.boostTimer > 0) {
      stats.boostTimer = 0;
      stats.boostTargetSpeed = 0;
    }
    gameCallbacks.triggerNotification("Hold a turn too long (~1.5 s) and you spin out.", "#e67e22");
  }

  return isSteering;
}

function computeAcceleration(state, isSteering) {
  if (isSteering && state.input.up) {
    return CONFIG.physics.acceleration * getConfigValue(CONFIG.physics, "carveAccelScale", 0.25);
  }
  if (isSteering && state.input.down) return 0;
  if (!isSteering && state.input.up) {
    return CONFIG.physics.acceleration * getConfigValue(CONFIG.physics, "accelUpOnlyScale", 0.78);
  }
  if (!isSteering && state.input.down) {
    return CONFIG.physics.acceleration * getConfigValue(CONFIG.physics, "accelDownOnlyScale", 1.0);
  }
  return CONFIG.physics.acceleration * getConfigValue(CONFIG.physics, "accelNoUpScale", 0.55);
}

function updateSpeedAndVelocity(state, accel, dt, dt60, isSteering, stopDrift) {
  const stats = state.playerStats;
  const pos = state.player.position;
  const vel = state.player.velocity;

  const boostSpeed = CONFIG.physics.boostSpeed;
  if (stats.boostTimer > 0) {
    const target = stats.boostTargetSpeed || boostSpeed;
    state.speed += (target - state.speed) * PHYSICS_CONSTANTS.boostInterpolationFactor * dt60;
    state.speed = Math.min(state.speed, target);
    stats.boostTimer -= dt;
  } else if (state.speed > CONFIG.physics.maxSpeed) {
    state.speed *= Math.pow(PHYSICS_CONSTANTS.overMaxSpeedFriction, dt60);
  } else {
    state.speed += accel * dt60;
    if (isSteering) {
      if (state.input.up) {
        state.speed *= Math.pow(getConfigValue(CONFIG.physics, "carveFriction", 0.985), dt60);
        const carveMax = CONFIG.physics.maxSpeed * getConfigValue(CONFIG.physics, "carveMaxSpeedFrac", 0.6);
        state.speed = Math.min(state.speed, carveMax);
      } else if (state.input.down) {
        const downFric = getConfigValue(CONFIG.physics, "steerDownFriction", 0.98);
        const downMin = getConfigValue(CONFIG.physics, "steerDownMinSpeed", 0.01);
        state.speed *= Math.pow(downFric, dt60);
        if (state.speed < downMin) state.speed = downMin;
      } else {
        state.speed *= Math.pow(getConfigValue(CONFIG.physics, "steerNoUpFriction", 0.997), dt60);
        const steerOnlyMax = CONFIG.physics.maxSpeed * getConfigValue(CONFIG.physics, "steerOnlyMaxSpeedFrac", 0.75);
        state.speed = Math.min(state.speed, steerOnlyMax);
      }
    } else {
      if (!state.input.down) {
        const straightFric = getConfigValue(CONFIG.physics, "straightLineFriction", 0.997);
        state.speed *= Math.pow(straightFric, dt60);
      }
    }
    state.speed = Math.min(state.speed, CONFIG.physics.maxSpeed);
    const minFrac = getConfigValue(CONFIG.physics, "steerNoUpMinSpeed", 0.3);
    const minSpeed = CONFIG.physics.maxSpeed * minFrac;
    const downMin = getConfigValue(CONFIG.physics, "steerDownMinSpeed", 0.01);
    if (isSteering && !state.input.up && !state.input.down && state.speed < minSpeed) {
      state.speed = minSpeed;
    }
  }

  const halfWidth = CONFIG.world.playAreaWidth / 2;
  const margin = CONFIG.world.obstacleZoneMargin || 8;
  if (Math.abs(pos.x) > halfWidth - margin) {
    state.speed *= Math.pow(PHYSICS_CONSTANTS.marginFriction, dt60);
  }

  const minFracDrift = getConfigValue(CONFIG.physics, "steerNoUpMinSpeed", 0.3);
  const minSpeedDrift = CONFIG.physics.maxSpeed * minFracDrift;
  if (stopDrift && !state.input.down && state.speed < minSpeedDrift) {
    state.speed = minSpeedDrift;
  }

  const facingDirZ = -Math.cos(state.player.angle);
  const facingDirX = -Math.sin(state.player.angle);
  vel.z = state.speed * facingDirZ;
  vel.x = state.speed * facingDirX;

  pos.x += vel.x * dt60;
  pos.z += vel.z * dt60;
  if (pos.x < -halfWidth) pos.x = -halfWidth;
  if (pos.x > halfWidth) pos.x = halfWidth;
}

function handleDynamite(state, gameCallbacks, isSteering, dt) {
  const stats = state.playerStats;
  const pos = state.player.position;

  if (!stats.hasDynamite) return;

  if (isSteering) stats.dynamiteJumpCount = 0;
  stats.dynamiteTimer -= dt;
  if (stats.dynamiteTimer <= 0) {
    stats.hasDynamite = false;
    state.dynamiteSparks.length = 0;
    gameCallbacks.triggerDynamiteFlash();
    gameCallbacks.takeDamage(getConfigValue(CONFIG.game, "dynamiteDamage", 85));
    gameCallbacks.triggerNotification("BOOM!", "#ff0000");
    for (let i = 0; i < PHYSICS_CONSTANTS.dynamiteExplosionParticleCount; i++) {
      state.particlesToAdd.push({
        position: { x: pos.x, y: pos.y, z: pos.z },
        velocity: {
          x: (Math.random() - 0.5) * 2 * REF_FPS,
          y: Math.random() * 2 * REF_FPS,
          z: (Math.random() - 0.5) * 2 * REF_FPS,
        },
        life: 1,
        color: 0xff0000,
      });
    }
  } else {
    const dynWorldX = pos.x + PHYSICS_CONSTANTS.dynamiteOffsetFromPlayer * Math.sin(state.player.angle);
    const dynWorldZ = pos.z + PHYSICS_CONSTANTS.dynamiteOffsetFromPlayer * Math.cos(state.player.angle);
    const sparkVelX = (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkVelocitySpread * REF_FPS;
    const sparkVelY = (Math.random() * PHYSICS_CONSTANTS.dynamiteSparkVelocityYRange + PHYSICS_CONSTANTS.dynamiteSparkVelocityYMin) * REF_FPS;
    const sparkVelZ = (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkVelocitySpread * REF_FPS;
    state.dynamiteSparksToAdd.push({
      position: {
        x: dynWorldX + (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkPositionJitter,
        y: pos.y + 1 + (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkPositionJitter,
        z: dynWorldZ + (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkPositionJitter,
      },
      velocity: { x: sparkVelX, y: sparkVelY, z: sparkVelZ },
      life: 1,
    });
    if (Math.random() < 0.5) {
      state.dynamiteSparksToAdd.push({
        position: { x: dynWorldX, y: pos.y + 1, z: dynWorldZ },
        velocity: {
          x: (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkVelocitySpread * REF_FPS,
          y: (Math.random() * PHYSICS_CONSTANTS.dynamiteSparkVelocityYRange + PHYSICS_CONSTANTS.dynamiteSparkVelocityYMin) * REF_FPS,
          z: (Math.random() - 0.5) * PHYSICS_CONSTANTS.dynamiteSparkVelocitySpread * REF_FPS,
        },
        life: 1,
      });
    }
    const secLeft = Math.ceil(stats.dynamiteTimer);
    if (secLeft > 0 && secLeft !== (stats._lastDynamiteSecShown || 0)) {
      gameCallbacks.triggerDynamiteFlash();
      gameCallbacks.triggerNotification(secLeft + "...", "#ff0000");
      stats._lastDynamiteSecShown = secLeft;
    }
  }
}

function handleInvincibility(state, dt, dt60) {
  const stats = state.playerStats;
  if (stats.invincibleTimer <= 0) return;

  stats.invincibleTimer -= dt;
  const pulseTime = state.visuals.shieldPulseTime;
  if (pulseTime > 0) {
    state.visuals.shieldPulseTime = Math.max(0, pulseTime - dt);
  }
  const t = stats.invincibleTimer;
  if (t <= PHYSICS_CONSTANTS.invincibleFadeStartSeconds) {
    state.visuals.shieldOpacity = (t / PHYSICS_CONSTANTS.invincibleFadeStartSeconds) * PHYSICS_CONSTANTS.shieldOpacityMax;
  } else if (t <= PHYSICS_CONSTANTS.invincibleFlickerStartSeconds) {
    state.visuals.shieldFlickerPhase += PHYSICS_CONSTANTS.shieldFlickerPhaseIncrement * dt60;
    state.visuals.shieldOpacity = PHYSICS_CONSTANTS.shieldOpacityMax * (0.7 + 0.3 * Math.sin(state.visuals.shieldFlickerPhase));
    state.visuals.shieldOpacity = Math.max(PHYSICS_CONSTANTS.shieldOpacityMin, state.visuals.shieldOpacity);
  } else {
    state.visuals.shieldOpacity = PHYSICS_CONSTANTS.shieldOpacityMax;
  }
  if (stats.invincibleTimer <= 0) state.visuals.shieldOpacity = 0;
}

function updateBoostTrail(state, dt) {
  const stats = state.playerStats;
  const pos = state.player.position;

  const boostTrailInterval = PHYSICS_CONSTANTS.boostTrailSpawnIntervalFrames / REF_FPS;
  if (stats.boostTimer > 0 && !stats.isJumping && state.speed > PHYSICS_CONSTANTS.boostTrailMinSpeed) {
    state.boostTrailSpawnAccum += dt;
    while (state.boostTrailSpawnAccum >= boostTrailInterval) {
      state.boostTrailToAdd.push({
        position: { x: pos.x, y: PHYSICS_CONSTANTS.boostTrailHeight, z: pos.z },
        life: 1,
        angle: state.player.angle,
      });
      state.boostTrailSpawnAccum -= boostTrailInterval;
    }
  } else {
    state.boostTrailSpawnAccum = 0;
  }
}

function handleJumpAndLanding(state, gameCallbacks, isSteering, dt) {
  const stats = state.playerStats;
  const pos = state.player.position;
  const vel = state.player.velocity;
  const dt60 = dt * REF_FPS;

  if (state.input.jump && !stats.isJumping) {
    const shortForce = getConfigValue(CONFIG.physics, "jumpForceShort", 0.32);
    const maxForce = getConfigValue(CONFIG.physics, "jumpForceMax", 0.58);
    const jumpCharge = Math.max(0, Math.min(1, state.input.jumpCharge));
    const force = shortForce + (maxForce - shortForce) * jumpCharge;
    const chargeThreshold = getConfigValue(CONFIG.physics, "jumpChargeThresholdForFloating", 0.5);
    stats.isJumping = true;
    stats.didJumpThisAirtime = true;
    stats.didChargedJumpThisAirtime = jumpCharge >= chargeThreshold;
    stats.rampLaunchFramesAgo = null;
    stats.canRampAssistJump = false;
    vel.y = force * REF_FPS;
    state.input.jump = false;
    state.input.jumpCharge = 0;
  }

  const assistWindow = getConfigValue(CONFIG.physics, "rampAssistWindow", 50 / 60);
  const assistBoost = getConfigValue(CONFIG.physics, "rampAssistBoost", 0.32);
  if (state.input.jump && stats.isJumping && stats.canRampAssistJump && stats.rampLaunchFramesAgo != null && stats.rampLaunchFramesAgo < assistWindow) {
    vel.y += assistBoost * REF_FPS;
    stats.didJumpThisAirtime = true;
    stats.canRampAssistJump = false;
    state.input.jump = false;
    state.input.jumpCharge = 0;
  }

  if (stats.isJumping) {
    if (stats.rampLaunchFramesAgo != null) stats.rampLaunchFramesAgo += dt;
    pos.y += vel.y * dt;
    const gravityScale = stats.glideActiveThisAirtime ? (CONFIG.physics.glideGravityScale ?? 0.25) : 1;
    vel.y -= CONFIG.physics.gravity * gravityScale * REF_FPS * REF_FPS * dt;
    if (pos.y <= 0) {
      pos.y = 0;
      stats.isJumping = false;
      stats.didJumpThisAirtime = false;
      stats.didChargedJumpThisAirtime = false;
      stats.glideActiveThisAirtime = false;
      stats.rampLaunchFramesAgo = null;
      stats.canRampAssistJump = false;
      vel.y = 0;
      if (stats.hasDynamite && !isSteering) {
        stats.dynamiteJumpCount++;
        if (stats.dynamiteJumpCount >= PHYSICS_CONSTANTS.dynamiteDefuseJumpCount) {
          stats.hasDynamite = false;
          state.dynamiteSparks.length = 0;
          gameCallbacks.triggerNotification("DYNAMITE DEFUSED!", "#2ecc71");
        }
      }
    }
  }
}

function addSnowSprayParticles(state) {
  const stats = state.playerStats;
  const pos = state.player.position;

  if (stats.isJumping) return;
  if (Math.abs(state.player.angle) <= PHYSICS_CONSTANTS.snowSprayAngleThreshold) return;
  if (state.speed <= PHYSICS_CONSTANTS.snowSpraySpeedThreshold) return;

  const offsetZ = Math.cos(state.player.angle);
  const offsetX = Math.sin(state.player.angle);
  state.particlesToAdd.push({
    position: { x: pos.x + offsetX, y: pos.y, z: pos.z + offsetZ },
    velocity: {
      x: (Math.random() - 0.5) * PHYSICS_CONSTANTS.snowSprayVelocitySpread * REF_FPS,
      y: Math.random() * PHYSICS_CONSTANTS.snowSprayVelocitySpread * REF_FPS,
      z: (Math.random() - 0.5) * PHYSICS_CONSTANTS.snowSprayVelocitySpread * REF_FPS,
    },
    life: 1,
    color: 0xffffff,
  });
}

/**
 * @param {number} dt - Delta time in seconds
 * @param {object} state - Game state
 * @param {object} gameCallbacks - Callbacks for UI, notifications, damage
 */
export function updatePhysics(dt, state, gameCallbacks) {
  if (state.gameState !== "PLAYING") return;

  const dt60 = dt * REF_FPS;
  const player = state.player;
  const pos = player.position;
  const vel = player.velocity;
  const stats = state.playerStats;

  ensureSpinOutStructure(state);
  const spinOut = state.spinOut;

  if (spinOut.active) {
    handleSpinOutPhase(dt, state, gameCallbacks);
    return;
  }

  const isSteering = updateSteeringAndCheckSpinOutTrigger(state, gameCallbacks, dt);

  const turnRatio = Math.min(state.turnDuration / CONFIG.physics.spinOutThreshold, 1.0);
  let angleMagnitude = PHYSICS_CONSTANTS.angleMagnitudeBase * Math.pow(turnRatio, PHYSICS_CONSTANTS.angleMagnitudeExponent);
  if (angleMagnitude < PHYSICS_CONSTANTS.angleMagnitudeMin) angleMagnitude = PHYSICS_CONSTANTS.angleMagnitudeMin;
  if (!state.input.up && isSteering) angleMagnitude *= getConfigValue(CONFIG.physics, "steerNoUpTurnScale", 0.5);
  if (state.input.down && isSteering) angleMagnitude += getConfigValue(CONFIG.physics, "steerDownExtraTurnRad", Math.PI / 4);

  let targetAngle = 0;
  if (state.input.left) targetAngle = -angleMagnitude;
  if (state.input.right) targetAngle = angleMagnitude;

  const interpolationSpeed = isSteering && state.input.up
    ? getConfigValue(CONFIG.physics, "carveTurnInterpolation", 0.25)
    : PHYSICS_CONSTANTS.steerInterpolationSpeed;
  player.angle += (targetAngle - player.angle) * interpolationSpeed * dt60;

  const stopDrift = turnRatio >= 1.0;
  if (stopDrift) {
    state.speed *= Math.pow(PHYSICS_CONSTANTS.turnRatioStopDriftFriction, dt60);
  }

  const accel = computeAcceleration(state, isSteering);
  updateSpeedAndVelocity(state, accel, dt, dt60, isSteering, stopDrift);

  const leanBackTarget = state.input.down && !isSteering
    ? getConfigValue(CONFIG.physics, "steerDownLeanBack", 0.55)
    : 0;
  player.leanBack += (leanBackTarget - player.leanBack) * PHYSICS_CONSTANTS.leanBackInterpolation * dt60;

  handleDynamite(state, gameCallbacks, isSteering, dt);
  handleInvincibility(state, dt, dt60);
  updateBoostTrail(state, dt);
  handleJumpAndLanding(state, gameCallbacks, isSteering, dt);
  addSnowSprayParticles(state);

  state.score += Math.abs(vel.z) * dt60;
  state.world.groundZ = pos.z - PHYSICS_CONSTANTS.worldGroundOffset;
  state.world.groundX = pos.x;

  gameCallbacks.updateUI(state);
}
