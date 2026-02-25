import { REF_FPS } from "./state.js";

function clonePos(p) {
  return p && typeof p.x === "number" ? { x: p.x, y: p.y, z: p.z } : { x: 0, y: 0, z: 0 };
}

export function mergeAdditions(state) {
  while (state.particlesToAdd.length) {
    const p = state.particlesToAdd.shift();
    state.particles.push({
      position: clonePos(p.position),
      velocity: clonePos(p.velocity),
      life: p.life ?? 1,
      color: p.color ?? 0xffffff,
      id: state.nextParticleId++,
    });
  }
  while (state.effectsToAdd.length) {
    const e = state.effectsToAdd.shift();
    state.effects.push({
      ...e,
      position: clonePos(e.position),
      id: state.nextEffectId++,
    });
  }
  while (state.boostTrailToAdd.length) {
    const b = state.boostTrailToAdd.shift();
    state.boostTrail.push({
      position: clonePos(b.position),
      life: b.life ?? 1,
      angle: b.angle ?? 0,
      id: state.nextParticleId++,
    });
  }
  while (state.dynamiteSparksToAdd.length) {
    const d = state.dynamiteSparksToAdd.shift();
    state.dynamiteSparks.push({
      position: clonePos(d.position),
      velocity: clonePos(d.velocity),
      life: d.life ?? 1,
      id: state.nextParticleId++,
    });
  }
}

export function updateParticles(dt, state) {
  const dt60 = dt * REF_FPS;
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= 0.05 * dt60;
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.position.z += p.velocity.z * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const e = state.effects[i];
    e.scale += 0.2 * dt60;
    e.opacity -= 0.05 * dt60;
    if (e.opacity <= 0) state.effects.splice(i, 1);
  }
  for (let i = state.boostTrail.length - 1; i >= 0; i--) {
    const mark = state.boostTrail[i];
    mark.life -= 0.02 * dt60;
    if (mark.life <= 0) state.boostTrail.splice(i, 1);
  }
  for (let i = state.dynamiteSparks.length - 1; i >= 0; i--) {
    const s = state.dynamiteSparks[i];
    s.life -= 0.08 * dt60;
    s.position.x += s.velocity.x * dt;
    s.position.y += s.velocity.y * dt;
    s.position.z += s.velocity.z * dt;
    if (s.life <= 0) state.dynamiteSparks.splice(i, 1);
  }
}
