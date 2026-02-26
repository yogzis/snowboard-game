import { createInitialState } from "./state.js";
import { updatePhysics } from "./physics.js";
import { updateObstacles, spawnChunk } from "./obstacles.js";
import { mergeAdditions, updateParticles } from "./particles.js";
import { updateCamera } from "./camera.js";

let callbacks = null;

export function init(cbs) {
  callbacks = cbs;
}

export function tick(dt, state) {
  if (state.gameState === "PAUSED") return;
  if (state.gameState !== "PLAYING" && !state.isSpinningOut) return;

  mergeAdditions(state);
  updatePhysics(dt, state, callbacks);
  updateObstacles(dt, state, callbacks);
  updateParticles(dt, state);
  updateCamera(dt, state);
}

export function resetGameStateAndScene(state, fullReset = true) {
  state.score = 0;
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
  state.playerStats.rampLaunchFramesAgo = null;
  state.playerStats.canRampAssistJump = false;
  state.playerStats.boostTimer = 0;
  state.playerStats.boostTargetSpeed = 0;
  state.playerStats.invincibleTimer = 0;
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
  for (let i = 1; i < 25; i++) spawnChunk(-i * 10, state);
  if (callbacks) callbacks.updateUI(state);
}

export function takeDamage(amount, state) {
  if (state.playerStats.invincibleTimer > 0) return;
  state.playerStats.hp -= amount;
  state.speed *= 0.5;
  if (callbacks) callbacks.shakeCamera();
  state.player.position.y += 0.2;
  if (callbacks) callbacks.triggerNotification("OUCH!", "#e74c3c");
  if (state.playerStats.hp <= 0) {
    state.playerStats.lives--;
    if (state.playerStats.lives <= 0) {
      if (callbacks) callbacks.gameOver(state);
    } else {
      state.playerStats.hp = 100;
      state.playerStats.invincibleTimer = 2;
      state.visuals.shieldPulseTime = 0.25;
      state.visuals.shieldFlickerPhase = 0;
      if (callbacks) callbacks.triggerNotification("LIFE LOST!", "#ff0000");
    }
  }
  if (callbacks) callbacks.updateUI(state);
}
