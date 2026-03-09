import { REF_FPS } from "./state.js";
import { PARTICLE_CONSTANTS } from "../config.js";

function clonePosition(position) {
  return position && typeof position.x === "number" ? { x: position.x, y: position.y, z: position.z } : { x: 0, y: 0, z: 0 };
}

export function mergeAdditions(state) {
  while (state.particlesToAdd.length) {
    const particle = state.particlesToAdd.shift();
    state.particles.push({
      position: clonePosition(particle.position),
      velocity: clonePosition(particle.velocity),
      life: particle.life ?? 1,
      color: particle.color ?? 0xffffff,
      id: state.nextParticleId++,
    });
  }
  while (state.effectsToAdd.length) {
    const effect = state.effectsToAdd.shift();
    state.effects.push({
      ...effect,
      position: clonePosition(effect.position),
      id: state.nextEffectId++,
    });
  }
  while (state.boostTrailToAdd.length) {
    const trailMark = state.boostTrailToAdd.shift();
    state.boostTrail.push({
      position: clonePosition(trailMark.position),
      life: trailMark.life ?? 1,
      angle: trailMark.angle ?? 0,
      id: state.nextParticleId++,
    });
  }
  while (state.dynamiteSparksToAdd.length) {
    const spark = state.dynamiteSparksToAdd.shift();
    state.dynamiteSparks.push({
      position: clonePosition(spark.position),
      velocity: clonePosition(spark.velocity),
      life: spark.life ?? 1,
      id: state.nextParticleId++,
    });
  }
}

export function updateParticles(dt, state) {
  const dt60 = dt * REF_FPS;
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    particle.life -= PARTICLE_CONSTANTS.decayRate * dt60;
    particle.position.x += particle.velocity.x * dt;
    particle.position.y += particle.velocity.y * dt;
    particle.position.z += particle.velocity.z * dt;
    if (particle.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const effect = state.effects[i];
    effect.scale += PARTICLE_CONSTANTS.effectScaleRate * dt60;
    effect.opacity -= PARTICLE_CONSTANTS.effectOpacityDecay * dt60;
    if (effect.opacity <= 0) state.effects.splice(i, 1);
  }
  for (let i = state.boostTrail.length - 1; i >= 0; i--) {
    const trailMark = state.boostTrail[i];
    trailMark.life -= PARTICLE_CONSTANTS.boostTrailDecayRate * dt60;
    if (trailMark.life <= 0) state.boostTrail.splice(i, 1);
  }
  for (let i = state.dynamiteSparks.length - 1; i >= 0; i--) {
    const spark = state.dynamiteSparks[i];
    spark.life -= PARTICLE_CONSTANTS.dynamiteSparkDecayRate * dt60;
    spark.position.x += spark.velocity.x * dt;
    spark.position.y += spark.velocity.y * dt;
    spark.position.z += spark.velocity.z * dt;
    if (spark.life <= 0) state.dynamiteSparks.splice(i, 1);
  }
}
