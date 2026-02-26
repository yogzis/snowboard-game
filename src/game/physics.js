import { CONFIG } from "../config.js";
import { REF_FPS } from "./state.js";

export function updatePhysics(dt, state, callbacks) {
  if (state.gameState !== "PLAYING") return;

  const dt60 = dt * REF_FPS;
  const p = state.player;
  const pos = p.position;
  const vel = p.velocity;
  const stats = state.playerStats;

  // Ensure spinOut structure exists even for older saved states.
  if (!state.spinOut) {
    state.spinOut = {
      active: false,
      phase: null,
      angleAccum: 0,
      direction: 1,
      timer: 0,
    };
  }

  const spinOut = state.spinOut;
  const spinSpinSpeed =
    CONFIG.physics.spinOutSpinSpeed != null
      ? CONFIG.physics.spinOutSpinSpeed
      : (2 * Math.PI) / 45;

  // Handle active spin-out phases (SPINNING → FALLING → RECOVERED).
  if (spinOut.active) {
    const decelFactor = 0.3;
    state.speed += (0 - state.speed) * decelFactor * dt60;
    if (Math.abs(state.speed) < 0.02) state.speed = 0;
    state.speed = Math.max(0, state.speed);

    if (spinOut.phase === "SPINNING") {
      const remaining = Math.max(0, 2 * Math.PI - spinOut.angleAccum);
      const step = Math.min(spinSpinSpeed * dt60, remaining);
      spinOut.angleAccum += step;
      // Visual-only spin (gameplay angle kept at 0 so we don't affect movement direction).
      p.visualSpinAngle = spinOut.angleAccum * (spinOut.direction || 1);
      p.angle = 0;

      // Advance directly forward while spinning, then slow to a stop.
      if (state.speed > 0.001) {
        vel.z = -state.speed;
        vel.x = 0;
        pos.z += vel.z * dt60;
      } else {
        vel.z = 0;
      }

      if (spinOut.angleAccum >= 2 * Math.PI - 1e-3) {
        spinOut.phase = "FALLING";
        spinOut.timer =
          CONFIG.physics.spinOutFallDuration != null
            ? CONFIG.physics.spinOutFallDuration
            : 0.8;
        // Once spinning is done, align board forward; Fall animation will handle body motion.
        p.visualSpinAngle = 0;
      }
    } else if (spinOut.phase === "FALLING") {
      p.visualSpinAngle = 0;
      p.angle = 0;

      if (state.speed > 0.001) {
        vel.z = -state.speed;
        vel.x = 0;
        pos.z += vel.z * dt60;
      } else {
        vel.z = 0;
      }

      spinOut.timer -= dt;
      if (spinOut.timer <= 0 && state.speed === 0) {
        spinOut.phase = "RECOVERED";
      }
    } else if (spinOut.phase === "RECOVERED") {
      // Final cleanup: reset steering and fully exit spin-out.
      p.visualSpinAngle = 0;
      p.angle = 0;
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

    if (state.cameraShake.intensity > 0)
      state.cameraShake.intensity *= Math.pow(0.9, dt60);
    updateCameraFromPlayer(state);
    return;
  }

  let isSteering = state.input.left || state.input.right;
  const steerDir = state.input.left ? 1 : state.input.right ? -1 : 0;
  if (steerDir !== state.lastSteerDir && state.lastSteerDir !== 0) {
    state.turnDuration = 0;
    state.steerOnlyDuration = 0;
  }
  state.lastSteerDir = steerDir;

  if (isSteering) state.turnDuration += dt;
  else state.turnDuration = 0;
  if (isSteering && !state.input.up && !state.input.down && !stats.isJumping) state.steerOnlyDuration += dt;
  else state.steerOnlyDuration = 0;

  let steerOnlyRatio = Math.min(state.steerOnlyDuration / CONFIG.physics.spinOutThreshold, 1.0);
  if (steerOnlyRatio >= 1.0) {
    spinOut.active = true;
    spinOut.phase = "SPINNING";
    spinOut.angleAccum = 0;
    spinOut.direction = state.input.left ? -1 : 1;
    spinOut.timer =
      CONFIG.physics.spinOutDuration != null
        ? CONFIG.physics.spinOutDuration
        : 1;
    state.isSpinningOut = true;
    state.spinOutTimer = spinOut.timer;
    // Deactivate speed boost on spin-out; player must get another from a pad.
    if (stats.boostTimer > 0) {
      stats.boostTimer = 0;
      stats.boostTargetSpeed = 0;
    }
    callbacks.triggerNotification("Hold a turn too long (~1.5 s) and you spin out.", "#e67e22");
  }

  let turnRatio = Math.min(state.turnDuration / CONFIG.physics.spinOutThreshold, 1.0);
  let angleMagnitude = 1.6 * Math.pow(turnRatio, 1.2);
  if (angleMagnitude < 0.2) angleMagnitude = 0.2;
  if (!state.input.up && isSteering) angleMagnitude *= CONFIG.physics.steerNoUpTurnScale != null ? CONFIG.physics.steerNoUpTurnScale : 0.5;
  if (state.input.down && isSteering) angleMagnitude += CONFIG.physics.steerDownExtraTurnRad != null ? CONFIG.physics.steerDownExtraTurnRad : Math.PI / 4;

  let targetAngle = 0;
  if (state.input.left) targetAngle = -angleMagnitude;
  if (state.input.right) targetAngle = angleMagnitude;

  const interpolationSpeed = isSteering && state.input.up
    ? (CONFIG.physics.carveTurnInterpolation != null ? CONFIG.physics.carveTurnInterpolation : 0.25)
    : 0.15;
  state.player.angle += (targetAngle - state.player.angle) * interpolationSpeed * dt60;

  let stopDrift = false;
  if (turnRatio >= 1.0) {
    stopDrift = true;
    state.speed *= Math.pow(0.98, dt60);
  }

  const facingDirZ = -Math.cos(state.player.angle);
  const facingDirX = -Math.sin(state.player.angle);

  let accel = 0;
  if (isSteering && state.input.up) {
    accel = CONFIG.physics.acceleration * (CONFIG.physics.carveAccelScale != null ? CONFIG.physics.carveAccelScale : 0.25);
  } else if (isSteering && state.input.down) {
    accel = 0;
  } else if (!isSteering && state.input.up) {
    accel = CONFIG.physics.acceleration * (CONFIG.physics.accelUpOnlyScale != null ? CONFIG.physics.accelUpOnlyScale : 0.78);
  } else if (!isSteering && state.input.down) {
    accel = CONFIG.physics.acceleration * (CONFIG.physics.accelDownOnlyScale != null ? CONFIG.physics.accelDownOnlyScale : 1.0);
  } else {
    accel = CONFIG.physics.acceleration * (CONFIG.physics.accelNoUpScale != null ? CONFIG.physics.accelNoUpScale : 0.55);
  }

  const boostSpeed = CONFIG.physics.boostSpeed;
  if (stats.boostTimer > 0) {
    const target = stats.boostTargetSpeed || boostSpeed;
    state.speed += (target - state.speed) * 0.12 * dt60;
    state.speed = Math.min(state.speed, target);
    stats.boostTimer -= dt;
  } else if (state.speed > CONFIG.physics.maxSpeed) {
    state.speed *= Math.pow(0.99, dt60);
  } else {
    state.speed += accel * dt60;
    if (isSteering) {
      if (state.input.up) {
        state.speed *= Math.pow(CONFIG.physics.carveFriction != null ? CONFIG.physics.carveFriction : 0.985, dt60);
        const carveMax = CONFIG.physics.maxSpeed * (CONFIG.physics.carveMaxSpeedFrac != null ? CONFIG.physics.carveMaxSpeedFrac : 0.6);
        state.speed = Math.min(state.speed, carveMax);
      } else if (state.input.down) {
        const downFric = CONFIG.physics.steerDownFriction != null ? CONFIG.physics.steerDownFriction : 0.98;
        const downMin = CONFIG.physics.steerDownMinSpeed != null ? CONFIG.physics.steerDownMinSpeed : 0.01;
        state.speed *= Math.pow(downFric, dt60);
        if (state.speed < downMin) state.speed = downMin;
      } else {
        state.speed *= Math.pow(CONFIG.physics.steerNoUpFriction != null ? CONFIG.physics.steerNoUpFriction : 0.997, dt60);
        const steerOnlyMax = CONFIG.physics.maxSpeed * (CONFIG.physics.steerOnlyMaxSpeedFrac != null ? CONFIG.physics.steerOnlyMaxSpeedFrac : 0.75);
        state.speed = Math.min(state.speed, steerOnlyMax);
      }
    } else {
      if (!state.input.down) {
        const straightFric = CONFIG.physics.straightLineFriction != null ? CONFIG.physics.straightLineFriction : 0.997;
        state.speed *= Math.pow(straightFric, dt60);
      }
    }
    state.speed = Math.min(state.speed, CONFIG.physics.maxSpeed);
    const minFrac = CONFIG.physics.steerNoUpMinSpeed != null ? CONFIG.physics.steerNoUpMinSpeed : 0.3;
    const minSpeed = CONFIG.physics.maxSpeed * minFrac;
    const downMin = CONFIG.physics.steerDownMinSpeed != null ? CONFIG.physics.steerDownMinSpeed : 0.01;
    if (isSteering && !state.input.up && !state.input.down && state.speed < minSpeed) state.speed = minSpeed;
  }

  const halfWidth = CONFIG.world.playAreaWidth / 2;
  const margin = CONFIG.world.obstacleZoneMargin || 8;
  if (Math.abs(pos.x) > halfWidth - margin) state.speed *= Math.pow(0.97, dt60);

  const minFracDrift = CONFIG.physics.steerNoUpMinSpeed != null ? CONFIG.physics.steerNoUpMinSpeed : 0.3;
  const minSpeedDrift = CONFIG.physics.maxSpeed * minFracDrift;
  if (stopDrift && !state.input.down && state.speed < minSpeedDrift) state.speed = minSpeedDrift;
  vel.z = state.speed * facingDirZ;
  vel.x = state.speed * facingDirX;

  pos.x += vel.x * dt60;
  pos.z += vel.z * dt60;
  if (pos.x < -halfWidth) pos.x = -halfWidth;
  if (pos.x > halfWidth) pos.x = halfWidth;

  const leanBackTarget = state.input.down && !isSteering
    ? (CONFIG.physics.steerDownLeanBack != null ? CONFIG.physics.steerDownLeanBack : 0.55)
    : 0;
  state.player.leanBack += (leanBackTarget - state.player.leanBack) * 0.12 * dt60;

  if (stats.hasDynamite) {
    if (isSteering) stats.dynamiteJumpCount = 0;
    stats.dynamiteTimer -= dt;
    if (stats.dynamiteTimer <= 0) {
      stats.hasDynamite = false;
      state.dynamiteSparks.length = 0;
      callbacks.triggerDynamiteFlash();
      callbacks.takeDamage(CONFIG.game.dynamiteDamage != null ? CONFIG.game.dynamiteDamage : 85);
      callbacks.triggerNotification("BOOM!", "#ff0000");
      for (let i = 0; i < 30; i++) {
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
      const dynWorldX = pos.x + 1.6 * Math.sin(state.player.angle);
      const dynWorldZ = pos.z + 1.6 * Math.cos(state.player.angle);
      state.dynamiteSparksToAdd.push({
        position: { x: dynWorldX + (Math.random() - 0.5) * 0.2, y: pos.y + 1 + (Math.random() - 0.5) * 0.2, z: dynWorldZ + (Math.random() - 0.5) * 0.2 },
        velocity: {
          x: (Math.random() - 0.5) * 0.15 * REF_FPS,
          y: (Math.random() * 0.12 + 0.05) * REF_FPS,
          z: (Math.random() - 0.5) * 0.15 * REF_FPS,
        },
        life: 1,
      });
      if (Math.random() < 0.5) state.dynamiteSparksToAdd.push({
        position: { x: dynWorldX, y: pos.y + 1, z: dynWorldZ },
        velocity: { x: (Math.random() - 0.5) * 0.15 * REF_FPS, y: (Math.random() * 0.12 + 0.05) * REF_FPS, z: (Math.random() - 0.5) * 0.15 * REF_FPS },
        life: 1,
      });
      const secLeft = Math.ceil(stats.dynamiteTimer);
      if (secLeft > 0 && secLeft !== (stats._lastDynamiteSecShown || 0)) {
        callbacks.triggerDynamiteFlash();
        callbacks.triggerNotification(secLeft + "...", "#ff0000");
        stats._lastDynamiteSecShown = secLeft;
      }
    }
  }

  if (stats.invincibleTimer > 0) {
    stats.invincibleTimer -= dt;
    const pulseTime = state.visuals.shieldPulseTime;
    if (pulseTime > 0) {
      state.visuals.shieldPulseTime = Math.max(0, pulseTime - dt);
    }
    const t = stats.invincibleTimer;
    if (t <= 2) {
      state.visuals.shieldOpacity = (t / 2) * 0.3;
    } else if (t <= 5) {
      state.visuals.shieldFlickerPhase += 0.2 * dt60;
      state.visuals.shieldOpacity = 0.3 * (0.7 + 0.3 * Math.sin(state.visuals.shieldFlickerPhase));
      state.visuals.shieldOpacity = Math.max(0.05, state.visuals.shieldOpacity);
    } else {
      state.visuals.shieldOpacity = 0.3;
    }
    if (stats.invincibleTimer <= 0) state.visuals.shieldOpacity = 0;
  }

  const boostTrailInterval = 4 / REF_FPS;
  if (stats.boostTimer > 0 && !stats.isJumping && state.speed > 0.1) {
    state.boostTrailSpawnAccum += dt;
    while (state.boostTrailSpawnAccum >= boostTrailInterval) {
      state.boostTrailToAdd.push({
        position: { x: pos.x, y: 0.01, z: pos.z },
        life: 1,
        angle: state.player.angle,
      });
      state.boostTrailSpawnAccum -= boostTrailInterval;
    }
  } else {
    state.boostTrailSpawnAccum = 0;
  }

  if (state.input.jump && !stats.isJumping) {
    const shortF = CONFIG.physics.jumpForceShort != null ? CONFIG.physics.jumpForceShort : 0.32;
    const maxF = CONFIG.physics.jumpForceMax != null ? CONFIG.physics.jumpForceMax : 0.58;
    const c = Math.max(0, Math.min(1, state.input.jumpCharge));
    const force = shortF + (maxF - shortF) * c;
    stats.isJumping = true;
    stats.didJumpThisAirtime = true;
    stats.rampLaunchFramesAgo = null;
    stats.canRampAssistJump = false;
    vel.y = force * REF_FPS;
    state.input.jump = false;
    state.input.jumpCharge = 0;
  }
  const assistWindow = CONFIG.physics.rampAssistWindow != null ? CONFIG.physics.rampAssistWindow : 50 / 60;
  const assistBoost = CONFIG.physics.rampAssistBoost != null ? CONFIG.physics.rampAssistBoost : 0.32;
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
    vel.y -= CONFIG.physics.gravity * REF_FPS * REF_FPS * dt;
    if (pos.y <= 0) {
      pos.y = 0;
      stats.isJumping = false;
      stats.didJumpThisAirtime = false;
      stats.rampLaunchFramesAgo = null;
      stats.canRampAssistJump = false;
      vel.y = 0;
      if (stats.hasDynamite && !isSteering) {
        stats.dynamiteJumpCount++;
        if (stats.dynamiteJumpCount >= 2) {
          stats.hasDynamite = false;
          state.dynamiteSparks.length = 0;
          callbacks.triggerNotification("DYNAMITE DEFUSED!", "#2ecc71");
        }
      }
    }
  }

  if (!stats.isJumping && Math.abs(state.player.angle) > 0.3 && state.speed > 0.2) {
    const offsetZ = Math.cos(state.player.angle);
    const offsetX = Math.sin(state.player.angle);
    state.particlesToAdd.push({
      position: { x: pos.x + offsetX, y: pos.y, z: pos.z + offsetZ },
      velocity: {
        x: (Math.random() - 0.5) * 0.2 * REF_FPS,
        y: Math.random() * 0.2 * REF_FPS,
        z: (Math.random() - 0.5) * 0.2 * REF_FPS,
      },
      life: 1,
      color: 0xffffff,
    });
  }

  state.score += Math.abs(vel.z) * dt60;
  state.world.groundZ = pos.z - 20;
  state.world.groundX = pos.x;

  callbacks.updateUI(state);
}

function updateCameraFromPlayer(state) {
  const pos = state.player.position;
  state.camera.targetX = pos.x;
  state.camera.targetZ = pos.z + 8;
  state.camera.lookAt.x = pos.x;
  state.camera.lookAt.y = pos.y;
  state.camera.lookAt.z = pos.z - 5;
}
