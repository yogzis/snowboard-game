import { createInitialState } from "./state.js";
import { updatePhysics } from "./physics.js";
import { updateObstacles, spawnChunk } from "./obstacles.js";
import { mergeAdditions, updateParticles } from "./particles.js";
import { updateCamera } from "./camera.js";
import { SPAWN_CONSTANTS, PHYSICS_CONSTANTS } from "../config.js";

let gameCallbacks = null;

export function init(cbs) {
  gameCallbacks = cbs;
}

export function tick(dt, state) {
  if (state.gameState === "PAUSED") return;
  if (state.gameState !== "PLAYING" && !state.isSpinningOut) return;

  mergeAdditions(state);
  updatePhysics(dt, state, gameCallbacks);
  updateObstacles(dt, state, gameCallbacks);
  updateParticles(dt, state);
  updateCamera(dt, state);
}

function resetPlayerPositionAndVelocity(state) {
  state.speed = 0;
  state.player.angle = 0;
  state.player.velocity.x = 0;
  state.player.velocity.y = 0;
  state.player.velocity.z = 0;
  state.player.position.x = 0;
  state.player.position.y = 0;
  state.player.position.z = 0;
  state.player.leanBack = 0;
  state.player.visualSpinAngle = 0;
}

function resetSpinOutState(state) {
  state.isSpinningOut = false;
  state.spinOutTimer = 0;
  if (state.spinOut) {
    state.spinOut.active = false;
    state.spinOut.phase = null;
    state.spinOut.angleAccum = 0;
    state.spinOut.direction = 1;
    state.spinOut.timer = 0;
  }
  state.turnDuration = 0;
  state.steerOnlyDuration = 0;
  state.lastSteerDir = 0;
}

function resetPlayerStats(state, fullReset) {
  if (fullReset) {
    state.playerStats.hp = 100;
    state.playerStats.lives = 3;
  }
  state.input.jump = false;
  state.input.jumpCharge = 0;
  state.jumpPressStartedAt = null;
  state.playerStats.isJumping = false;
  state.playerStats.hasDynamite = false;
  state.playerStats.didJumpThisAirtime = false;
  state.playerStats.didChargedJumpThisAirtime = false;
  state.playerStats.rampLaunchFramesAgo = null;
  state.playerStats.canRampAssistJump = false;
  state.playerStats.boostTimer = 0;
  state.playerStats.boostTargetSpeed = 0;
  state.playerStats.hasGlide = false;
  state.playerStats.glideActiveThisAirtime = false;
  state.playerStats.invincibleTimer = 0;
}

function clearDeferredArrays(state) {
  state.dynamiteSparks.length = 0;
  state.boostTrail.length = 0;
  state.boostTrailSpawnAccum = 0;
  state.obstacles.length = 0;
  state.particles.length = 0;
  state.effects.length = 0;
  state.particlesToAdd.length = 0;
  state.effectsToAdd.length = 0;
  state.boostTrailToAdd.length = 0;
  state.dynamiteSparksToAdd.length = 0;
}

function resetCamera(state) {
  state.visuals.shieldPulseTime = 0;
  state.visuals.shieldFlickerPhase = 0;
  state.visuals.shieldOpacity = 0;
  state.camera.position.x = 0;
  state.camera.position.y = 6;
  state.camera.position.z = 12;
  state.camera.targetX = 0;
  state.camera.targetZ = 8;
  state.camera.lookAt.x = 0;
  state.camera.lookAt.y = 0;
  state.camera.lookAt.z = -5;
  state.cameraShake.intensity = 0;
  state.playerRotationX = 0;
}

function spawnInitialChunks(state) {
  for (let i = 1; i < SPAWN_CONSTANTS.initialChunkCount; i++) {
    spawnChunk(-i * SPAWN_CONSTANTS.chunkSpacing, state);
  }
}

/**
 * @param {object} state - Game state to reset
 * @param {boolean} [fullReset=true] - If true, reset HP and lives; if false, keep them
 */
export function resetGameStateAndScene(state, fullReset = true) {
  state.score = 0;
  resetPlayerPositionAndVelocity(state);
  resetSpinOutState(state);
  resetPlayerStats(state, fullReset);
  clearDeferredArrays(state);
  resetCamera(state);
  spawnInitialChunks(state);
  if (gameCallbacks) gameCallbacks.updateUI(state);
}

/**
 * @param {number} amount - HP damage amount
 * @param {object} state - Game state
 */
export function takeDamage(amount, state) {
  if (state.playerStats.invincibleTimer > 0) return;
  state.playerStats.hp -= amount;
  state.speed *= PHYSICS_CONSTANTS.damageSpeedMultiplier;
  if (gameCallbacks) gameCallbacks.shakeCamera();
  state.player.position.y += PHYSICS_CONSTANTS.damagePositionBump;
  if (gameCallbacks) gameCallbacks.triggerNotification("OUCH!", "#e74c3c");
  if (state.playerStats.hp <= 0) {
    state.playerStats.lives--;
    if (state.playerStats.lives <= 0) {
      if (gameCallbacks) gameCallbacks.gameOver(state);
    } else {
      state.playerStats.hp = 100;
      state.playerStats.invincibleTimer = PHYSICS_CONSTANTS.lifeLostInvincibleDuration;
      state.visuals.shieldPulseTime = PHYSICS_CONSTANTS.lifeLostShieldPulseTime;
      state.visuals.shieldFlickerPhase = 0;
      if (gameCallbacks) gameCallbacks.triggerNotification("LIFE LOST!", "#ff0000");
    }
  }
  if (gameCallbacks) gameCallbacks.updateUI(state);
}
