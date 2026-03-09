import { CONFIG, hexToCss } from "../config.js";
import { REF_FPS } from "./state.js";

export function spawnObstacle(zPos, xPosOverride, typeOverride, state) {
  const rand = Math.random();
  let type = typeOverride;
  if (type === undefined) {
    if (rand > 0.95) type = "ramp_combo";
    else if (rand > 0.78) type = "box";
    else if (rand > 0.72) type = "boost";
    else if (rand > 0.42) type = "rock";
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
      position: { x: xPos, y: 6.5, z: zPos - 24 },
      rotation: { x: 0, y: 0, z: 0 },
      userData: { radius: 2.0, height: 7.25, breakHeight: 6.0, isElevated: true },
      rotationVel: { x: 0.02, y: 0.03, z: 0 },
    });
    return;
  }

  const ob = {
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
    ob.position.y = 0;
    ob.userData = { radius: 0.8, height: 3 };
  } else if (type === "rock") {
    ob.position.y = 0.4;
    ob.userData = { radius: 0.6, height: 1 };
  } else if (type === "boost") {
    ob.position.y = 0;
    ob.userData = { radius: 1.5, height: 0.1 };
  } else if (type === "box") {
    const isFloating = Math.random() < 0.5;
    if (isFloating) {
      ob.position.y = CONFIG.world.floatingBoxHeight ?? 3.5;
      ob.userData = {
        radius: 1.2,
        height: 4,
        breakHeight: CONFIG.world.floatingBoxBreakHeight ?? 3.0,
        isFloating: true,
      };
    } else {
      ob.position.y = 2;
      ob.userData = { radius: 1.2, height: 2.5 };
    }
    ob.rotationVel = { x: 0.02, y: 0.03, z: 0 };
  }

  state.obstacles.push(ob);
}

export function spawnChunk(zBase, state) {
  const half = CONFIG.world.playAreaWidth / 2;
  const slots = 5;
  const step = CONFIG.world.playAreaWidth / (slots + 1);
  const xSlots = [];
  for (let i = 0; i < slots; i++) {
    xSlots.push(-half + step * (i + 1) + (Math.random() - 0.5) * 8);
  }
  const boxSlot = Math.floor(Math.random() * slots);
  const rampSlot = Math.random() > 0.7 ? Math.floor(Math.random() * slots) : -1;
  const boostSlot = Math.random() < 0.25 ? Math.floor(Math.random() * slots) : -1;
  for (let i = 0; i < slots; i++) {
    let type = Math.random() > 0.5 ? "tree" : "rock";
    if (i === boxSlot) type = "box";
    else if (i === rampSlot) type = "ramp_combo";
    else if (i === boostSlot) type = "boost";
    const zOffset = (Math.random() - 0.5) * 6;
    spawnObstacle(zBase + zOffset, xSlots[i], type, state);
  }
}

export function updateObstacles(dt, state, callbacks) {
  const pos = state.player.position;
  const lastZ = state.obstacles.length > 0
    ? state.obstacles[state.obstacles.length - 1].position.z
    : pos.z;
  if (lastZ > pos.z - 90) {
    spawnChunk(lastZ - 18 - Math.random() * 8, state);
  }

  const dt60 = dt * REF_FPS;
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const ob = state.obstacles[i];
    if (ob.rotationVel) {
      ob.rotation.x += ob.rotationVel.x * dt60;
      ob.rotation.y += ob.rotationVel.y * dt60;
    }
    if (ob.type === "boost" && ob.arrowPhase != null) {
      ob.arrowPhase += 0.04 * dt60;
      ob.arrowZ = (ob.arrowZ != null ? ob.arrowZ : 0) - 0.04 * dt60;
      if (ob.arrowZ < -3) ob.arrowZ += 6;
    }

    if (ob.position.z > pos.z + 10) {
      state.obstacles.splice(i, 1);
    } else {
      const dx = ob.position.x - pos.x;
      const dz = ob.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const hitRadius = ob.userData.radius + 0.3;
      if (dist < hitRadius) {
        if (ob.type === "boost") {
          state.playerStats.boostTimer = CONFIG.game.boostDuration;
          state.playerStats.boostTargetSpeed = CONFIG.physics.boostSpeed;
          callbacks.triggerNotification("BOOST!");
        } else if (ob.type === "ramp") {
          state.playerStats.isJumping = true;
          state.playerStats.didJumpThisAirtime = false;
          state.playerStats.rampLaunchFramesAgo = 0;
          state.playerStats.canRampAssistJump = true;
          if (state.playerStats.hasGlide) {
            state.playerStats.hasGlide = false;
            state.playerStats.glideActiveThisAirtime = true;
          }
          state.player.velocity.y = CONFIG.physics.rampForce * REF_FPS;
          callbacks.triggerNotification("Sweet! That's an AIR TIME!");
        } else if (ob.type === "box") {
          const isElevated = ob.userData.isElevated;
          const isFloating = ob.userData.isFloating;
          let hitHeight;
          if (isFloating) {
            hitHeight = ob.userData.breakHeight != null ? ob.userData.breakHeight : (CONFIG.world.floatingBoxBreakHeight ?? 3.0);
          } else if (isElevated) {
            hitHeight = ob.userData.breakHeight != null ? ob.userData.breakHeight : 6.0;
          } else {
            hitHeight = 2.0 - 1.5;
          }
          if (pos.y > hitHeight) {
            if (isFloating && !state.playerStats.didChargedJumpThisAirtime) {
              if (!ob.missedNotificationShown) {
                ob.missedNotificationShown = true;
                callbacks.triggerNotification("Not this time...", "#95a5a6");
              }
            } else if (isElevated && !state.playerStats.didJumpThisAirtime) {
              if (!ob.missedNotificationShown) {
                ob.missedNotificationShown = true;
                callbacks.triggerNotification("Not this time...", "#95a5a6");
              }
            } else {
              breakBox(ob, state, callbacks);
              state.player.velocity.y = 0.3 * REF_FPS;
            }
          } else {
            if (isFloating) {
              if (!ob.missedNotificationShown) {
                ob.missedNotificationShown = true;
                callbacks.triggerNotification("Not this time...", "#95a5a6");
              }
            } else if (isElevated && !ob.missedNotificationShown) {
              ob.missedNotificationShown = true;
              callbacks.triggerNotification("Not this time...", "#95a5a6");
            } else {
              breakBox(ob, state, callbacks);
            }
          }
        } else {
          if (pos.y > ob.userData.height) {
            // jumped over
          } else {
            state.obstacles.splice(i, 1);
            if (state.playerStats.invincibleTimer > 0) {
              state.speed *= 0.5;
              callbacks.shakeCamera();
              pos.y += 0.2;
              state.visuals.shieldPulseTime = 15 / REF_FPS;
              callbacks.triggerNotification("SHIELD!", "#00ffff");
            } else {
              callbacks.takeDamage(20);
            }
          }
        }
      }
    }
  }
}

export function breakBox(ob, state, callbacks) {
  state.obstacles = state.obstacles.filter((o) => o.id !== ob.id);
  const isElevated = ob.userData.isElevated;
  const boxPos = ob.position;

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

  if (isElevated) {
    if (rand < 0.1) {
      if (!stats.hasDynamite) {
        stats.hasDynamite = true;
        stats.dynamiteTimer = CONFIG.game.dynamiteTime;
        stats.dynamiteJumpCount = 0;
        callbacks.triggerNotification("TRAP! JUMP x2!", "#e74c3c");
        callbacks.triggerDynamiteFlash();
      }
    } else if (rand < 0.3) {
      stats.boostTimer = CONFIG.game.boostDuration;
      stats.boostTargetSpeed = CONFIG.physics.boostSpeed * 1.15;
      callbacks.triggerNotification("MEGA BOOST!");
    } else if (rand < 0.7) {
      if (stats.lives < CONFIG.game.maxLives) {
        stats.lives++;
        callbacks.updateUI(state);
        callbacks.triggerNotification("EXTRA LIFE!", "#e67e22");
      } else {
        stats.hp = 100;
        callbacks.updateUI(state);
        callbacks.triggerNotification("FULL HEAL!", "#2ecc71");
      }
    } else if (rand < 0.85) {
      stats.invincibleTimer = CONFIG.game.invincibleTime * 1.5;
      state.visuals.shieldPulseTime = 0;
      state.visuals.shieldFlickerPhase = 0;
      callbacks.triggerNotification("SUPER SHIELD!", "#00ffff");
    } else {
      stats.hasGlide = true;
      callbacks.triggerNotification("GLIDE!", hexToCss(CONFIG.colors?.glideSurface ?? 0x20b2aa));
    }
  } else {
    if (rand < 0.18) {
      if (!stats.hasDynamite) {
        stats.hasDynamite = true;
        stats.dynamiteTimer = CONFIG.game.dynamiteTime;
        stats.dynamiteJumpCount = 0;
        callbacks.triggerNotification("DYNAMITE! Jump x2 Straight to Remove!", "#e74c3c");
        callbacks.triggerDynamiteFlash();
      }
    } else if (rand < 0.36) {
      stats.boostTimer = CONFIG.game.boostDuration;
      stats.boostTargetSpeed = CONFIG.physics.boostSpeed;
      callbacks.triggerNotification("SPEED BOOST!");
    } else if (rand < 0.54) {
      stats.hp = Math.min(stats.hp + 30, CONFIG.game.maxHP);
      callbacks.updateUI(state);
      callbacks.triggerNotification("+30 HP", "#2ecc71");
    } else if (rand < 0.72) {
      if (stats.lives < CONFIG.game.maxLives) {
        stats.lives++;
        callbacks.updateUI(state);
        callbacks.triggerNotification("EXTRA LIFE!", "#e67e22");
      } else {
        stats.hp = 100;
        callbacks.updateUI(state);
        callbacks.triggerNotification("FULL HEAL!", "#2ecc71");
      }
    } else if (rand < 0.9) {
      stats.invincibleTimer = CONFIG.game.invincibleTime;
      state.visuals.shieldPulseTime = 0;
      state.visuals.shieldFlickerPhase = 0;
      callbacks.triggerNotification("SHIELD ACTIVE!", "#00ffff");
    } else {
      stats.hasGlide = true;
      callbacks.triggerNotification("GLIDE!", hexToCss(CONFIG.colors?.glideSurface ?? 0x20b2aa));
    }
  }
}
