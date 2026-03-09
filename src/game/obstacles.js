import { CONFIG, hexToCss, OBSTACLE_CONSTANTS, getConfigValue } from "../config.js";
import { REF_FPS } from "./state.js";

const ELEVATED_BOX_POWER_UP_WEIGHTS = [
  { max: 0.1, type: "dynamite" },
  { max: 0.3, type: "megaBoost" },
  { max: 0.7, type: "extraLifeOrHeal" },
  { max: 0.85, type: "superShield" },
  { max: 1.0, type: "glide" },
];

const NORMAL_BOX_POWER_UP_WEIGHTS = [
  { max: 0.18, type: "dynamite" },
  { max: 0.36, type: "boost" },
  { max: 0.54, type: "hp" },
  { max: 0.72, type: "extraLifeOrHeal" },
  { max: 0.9, type: "shield" },
  { max: 1.0, type: "glide" },
];

function rollPowerUp(rand, powerUpWeights, stats, state, gameCallbacks) {
  for (const { max, type } of powerUpWeights) {
    if (rand >= max) continue;
    switch (type) {
      case "dynamite":
        if (!stats.hasDynamite) {
          stats.hasDynamite = true;
          stats.dynamiteTimer = CONFIG.game.dynamiteTime;
          stats.dynamiteJumpCount = 0;
          gameCallbacks.triggerNotification(
            powerUpWeights === ELEVATED_BOX_POWER_UP_WEIGHTS ? "TRAP! JUMP x2!" : "DYNAMITE! Jump x2 Straight to Remove!",
            "#e74c3c"
          );
          gameCallbacks.triggerDynamiteFlash();
        }
        return;
      case "megaBoost":
        stats.boostTimer = CONFIG.game.boostDuration;
        stats.boostTargetSpeed = CONFIG.physics.boostSpeed * 1.15;
        gameCallbacks.triggerNotification("MEGA BOOST!");
        return;
      case "boost":
        stats.boostTimer = CONFIG.game.boostDuration;
        stats.boostTargetSpeed = CONFIG.physics.boostSpeed;
        gameCallbacks.triggerNotification("SPEED BOOST!");
        return;
      case "hp":
        stats.hp = Math.min(stats.hp + 30, CONFIG.game.maxHP);
        gameCallbacks.updateUI(state);
        gameCallbacks.triggerNotification("+30 HP", "#2ecc71");
        return;
      case "extraLifeOrHeal":
        if (stats.lives < CONFIG.game.maxLives) {
          stats.lives++;
          gameCallbacks.updateUI(state);
          gameCallbacks.triggerNotification("EXTRA LIFE!", "#e67e22");
        } else {
          stats.hp = 100;
          gameCallbacks.updateUI(state);
          gameCallbacks.triggerNotification("FULL HEAL!", "#2ecc71");
        }
        return;
      case "superShield":
        stats.invincibleTimer = CONFIG.game.invincibleTime * 1.5;
        state.visuals.shieldPulseTime = 0;
        state.visuals.shieldFlickerPhase = 0;
        gameCallbacks.triggerNotification("SUPER SHIELD!", "#00ffff");
        return;
      case "shield":
        stats.invincibleTimer = CONFIG.game.invincibleTime;
        state.visuals.shieldPulseTime = 0;
        state.visuals.shieldFlickerPhase = 0;
        gameCallbacks.triggerNotification("SHIELD ACTIVE!", "#00ffff");
        return;
      case "glide":
        stats.hasGlide = true;
        gameCallbacks.triggerNotification("GLIDE!", hexToCss(CONFIG.colors?.glideSurface ?? 0x20b2aa));
        return;
    }
  }
}

/**
 * @param {number} zPos - Z position for the obstacle
 * @param {number} [xPosOverride] - Optional X position override
 * @param {string} [typeOverride] - Optional obstacle type override
 */
export function spawnObstacle(zPos, xPosOverride, typeOverride, state) {
  const rand = Math.random();
  let type = typeOverride;
  if (type === undefined) {
    if (rand > OBSTACLE_CONSTANTS.spawnWeightRampCombo) type = "ramp_combo";
    else if (rand > OBSTACLE_CONSTANTS.spawnWeightBox) type = "box";
    else if (rand > OBSTACLE_CONSTANTS.spawnWeightBoost) type = "boost";
    else if (rand > OBSTACLE_CONSTANTS.spawnWeightRock) type = "rock";
    else type = "tree";
  }

  const half = CONFIG.world.playAreaWidth / 2;
  const xPos = xPosOverride !== undefined ? xPosOverride : (Math.random() - 0.5) * CONFIG.world.playAreaWidth;

  if (type === "ramp_combo") {
    state.obstacles.push({
      id: state.nextObstacleId++,
      type: "ramp",
      position: { x: xPos, y: 0.5, z: zPos },
      rotation: { x: Math.PI / 8, y: 0, z: 0 },
      userData: { radius: 1.5, height: 0.5 },
    });
    state.obstacles.push({
      id: state.nextObstacleId++,
      type: "box",
      position: { x: xPos, y: OBSTACLE_CONSTANTS.rampComboBoxY, z: zPos - OBSTACLE_CONSTANTS.rampComboBoxZOffset },
      rotation: { x: 0, y: 0, z: 0 },
      userData: { radius: 2.0, height: 7.25, breakHeight: 6.0, isElevated: true },
      rotationVel: { x: 0.02, y: 0.03, z: 0 },
    });
    return;
  }

  const obstacle = {
    id: state.nextObstacleId++,
    type,
    position: { x: xPos, y: 0, z: zPos },
    rotation: { x: 0, y: 0, z: 0 },
    userData: {},
    rotationVel: null,
    arrowPhase: type === "boost" ? Math.random() * Math.PI * 2 : undefined,
    arrowZ: type === "boost" ? 0 : undefined,
    missedNotificationShown: false,
  };

  if (type === "tree") {
    obstacle.position.y = 0;
    obstacle.userData = { radius: 0.8, height: 3 };
  } else if (type === "rock") {
    obstacle.position.y = 0.4;
    obstacle.userData = { radius: 0.6, height: 1 };
  } else if (type === "boost") {
    obstacle.position.y = 0;
    obstacle.userData = { radius: 1.5, height: 0.1 };
  } else if (type === "box") {
    const isFloating = Math.random() < OBSTACLE_CONSTANTS.floatingBoxProbability;
    if (isFloating) {
      obstacle.position.y = getConfigValue(CONFIG.world, "floatingBoxHeight", 3.5);
      obstacle.userData = {
        radius: 1.2,
        height: 4,
        breakHeight: getConfigValue(CONFIG.world, "floatingBoxBreakHeight", 3.0),
        isFloating: true,
      };
    } else {
      obstacle.position.y = 2;
      obstacle.userData = { radius: 1.2, height: 2.5 };
    }
    obstacle.rotationVel = { x: 0.02, y: 0.03, z: 0 };
  }

  state.obstacles.push(obstacle);
}

function showMissedNotification(obstacle, gameCallbacks) {
  if (obstacle.missedNotificationShown) return;
  obstacle.missedNotificationShown = true;
  gameCallbacks.triggerNotification("Not this time...", "#95a5a6");
}

function handleBoostCollision(obstacle, state, gameCallbacks, obstacleIndex) {
  if (state.playerStats.isJumping) return;
  state.playerStats.boostTimer = CONFIG.game.boostDuration;
  state.playerStats.boostTargetSpeed = CONFIG.physics.boostSpeed;
  gameCallbacks.triggerNotification("BOOST!");
  state.obstacles.splice(obstacleIndex, 1);
}

function handleRampCollision(obstacle, state, gameCallbacks) {
  if (state.playerStats.isJumping) return;
  state.playerStats.isJumping = true;
  state.playerStats.didJumpThisAirtime = false;
  state.playerStats.rampLaunchFramesAgo = 0;
  state.playerStats.canRampAssistJump = true;
  if (state.playerStats.hasGlide) {
    state.playerStats.hasGlide = false;
    state.playerStats.glideActiveThisAirtime = true;
  }
  state.player.velocity.y = CONFIG.physics.rampForce * REF_FPS;
  gameCallbacks.triggerNotification("Sweet! That's an AIR TIME!");
}

function handleBoxCollision(obstacle, state, gameCallbacks) {
  const pos = state.player.position;
  const stats = state.playerStats;
  const isElevated = obstacle.userData.isElevated;
  const isFloating = obstacle.userData.isFloating;

  let hitHeight;
  if (isFloating) {
    hitHeight = obstacle.userData.breakHeight != null ? obstacle.userData.breakHeight : getConfigValue(CONFIG.world, "floatingBoxBreakHeight", 3.0);
  } else if (isElevated) {
    hitHeight = obstacle.userData.breakHeight != null ? obstacle.userData.breakHeight : OBSTACLE_CONSTANTS.elevatedBoxBreakHeight;
  } else {
    hitHeight = OBSTACLE_CONSTANTS.groundBoxHitHeight;
  }

  if (pos.y > hitHeight) {
    if (isFloating && !stats.didChargedJumpThisAirtime) {
      showMissedNotification(obstacle, gameCallbacks);
      return;
    }
    if (isElevated && !stats.didJumpThisAirtime) {
      showMissedNotification(obstacle, gameCallbacks);
      return;
    }
    breakBox(obstacle, state, gameCallbacks);
    state.player.velocity.y = OBSTACLE_CONSTANTS.boxBreakBounceVelocity * REF_FPS;
  } else {
    if (isFloating) {
      showMissedNotification(obstacle, gameCallbacks);
      return;
    }
    if (isElevated && !obstacle.missedNotificationShown) {
      showMissedNotification(obstacle, gameCallbacks);
      return;
    }
    breakBox(obstacle, state, gameCallbacks);
  }
}

function handleTreeRockCollision(obstacle, state, gameCallbacks, obstacleIndex) {
  const pos = state.player.position;
  const stats = state.playerStats;

  if (pos.y > obstacle.userData.height) {
    return;
  }

  state.obstacles.splice(obstacleIndex, 1);
  if (stats.invincibleTimer > 0) {
    state.speed *= OBSTACLE_CONSTANTS.shieldHitSpeedMultiplier;
    gameCallbacks.shakeCamera();
    pos.y += OBSTACLE_CONSTANTS.shieldHitPositionBump;
    state.visuals.shieldPulseTime = OBSTACLE_CONSTANTS.shieldHitPulseDuration / REF_FPS;
    gameCallbacks.triggerNotification("SHIELD!", "#00ffff");
  } else {
    gameCallbacks.takeDamage(OBSTACLE_CONSTANTS.obstacleDamageAmount);
  }
}

export function spawnChunk(zBase, state) {
  const half = CONFIG.world.playAreaWidth / 2;
  const slots = OBSTACLE_CONSTANTS.chunkSlots;
  const step = CONFIG.world.playAreaWidth / (slots + 1);
  const xSlots = [];
  for (let i = 0; i < slots; i++) {
    xSlots.push(-half + step * (i + 1) + (Math.random() - 0.5) * OBSTACLE_CONSTANTS.chunkSlotJitter);
  }
  const boxSlot = Math.floor(Math.random() * slots);
  const rampSlot = Math.random() > OBSTACLE_CONSTANTS.rampSlotProbability ? Math.floor(Math.random() * slots) : -1;
  const boostSlot = Math.random() < OBSTACLE_CONSTANTS.boostSlotProbability ? Math.floor(Math.random() * slots) : -1;
  for (let i = 0; i < slots; i++) {
    let type = Math.random() > OBSTACLE_CONSTANTS.treeOrRockProbability ? "tree" : "rock";
    if (i === boxSlot) type = "box";
    else if (i === rampSlot) type = "ramp_combo";
    else if (i === boostSlot) type = "boost";
    const zOffset = (Math.random() - 0.5) * OBSTACLE_CONSTANTS.chunkZOffsetRange;
    spawnObstacle(zBase + zOffset, xSlots[i], type, state);
  }
}

/**
 * @param {number} dt - Delta time in seconds
 * @param {object} state - Game state
 * @param {object} gameCallbacks - Callbacks for notifications, damage, etc.
 */
export function updateObstacles(dt, state, gameCallbacks) {
  const pos = state.player.position;
  const lastZ = state.obstacles.length > 0
    ? state.obstacles[state.obstacles.length - 1].position.z
    : pos.z;
  if (lastZ > pos.z - OBSTACLE_CONSTANTS.spawnChunkDistanceThreshold) {
    spawnChunk(lastZ - OBSTACLE_CONSTANTS.spawnChunkBaseOffset - Math.random() * OBSTACLE_CONSTANTS.spawnChunkRandomOffset, state);
  }

  const dt60 = dt * REF_FPS;
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const obstacle = state.obstacles[i];
    if (obstacle.rotationVel) {
      obstacle.rotation.x += obstacle.rotationVel.x * dt60;
      obstacle.rotation.y += obstacle.rotationVel.y * dt60;
    }
    if (obstacle.type === "boost" && obstacle.arrowPhase != null) {
      obstacle.arrowPhase += 0.04 * dt60;
      obstacle.arrowZ = (obstacle.arrowZ != null ? obstacle.arrowZ : 0) - 0.04 * dt60;
      if (obstacle.arrowZ < -3) obstacle.arrowZ += 6;
    }

    if (obstacle.position.z > pos.z + OBSTACLE_CONSTANTS.despawnObstacleOffset) {
      state.obstacles.splice(i, 1);
    } else {
      const dx = obstacle.position.x - pos.x;
      const dz = obstacle.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const hitRadius = obstacle.userData.radius + OBSTACLE_CONSTANTS.obstacleHitRadiusPadding;
      if (dist >= hitRadius) continue;

      if (obstacle.type === "boost") {
        handleBoostCollision(obstacle, state, gameCallbacks, i);
      } else if (obstacle.type === "ramp") {
        handleRampCollision(obstacle, state, gameCallbacks);
      } else if (obstacle.type === "box") {
        handleBoxCollision(obstacle, state, gameCallbacks);
      } else {
        handleTreeRockCollision(obstacle, state, gameCallbacks, i);
      }
    }
  }
}

export function breakBox(obstacle, state, gameCallbacks) {
  state.obstacles = state.obstacles.filter((o) => o.id !== obstacle.id);
  const isElevated = obstacle.userData.isElevated;
  const boxPos = obstacle.position;

  state.effectsToAdd.push({ type: "ring", position: { ...boxPos }, scale: 1, opacity: 0.8, inner: isElevated ? 1.2 : 1, outer: isElevated ? 1.8 : 1.5, color: isElevated ? 0xffd700 : 0xffff00 });
  if (isElevated) {
    state.effectsToAdd.push({ type: "ring", position: { ...boxPos }, scale: 1, opacity: 0.8, inner: 0.6, outer: 1.0, color: 0xffd700 });
  }
  const particleCount = isElevated ? 18 : 10;
  for (let i = 0; i < particleCount; i++) {
    state.particlesToAdd.push({
      position: { x: boxPos.x, y: boxPos.y, z: boxPos.z },
      velocity: {
        x: Math.random() - 0.5,
        y: Math.random() * (isElevated ? 1.2 : 1),
        z: Math.random() - 0.5,
      },
      life: 1,
      color: isElevated ? 0xffd700 : 0xffff00,
    });
  }

  const rand = Math.random();
  const stats = state.playerStats;
  const powerUpWeights = isElevated ? ELEVATED_BOX_POWER_UP_WEIGHTS : NORMAL_BOX_POWER_UP_WEIGHTS;
  rollPowerUp(rand, powerUpWeights, stats, state, gameCallbacks);
}
