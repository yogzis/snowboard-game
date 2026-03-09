import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "./state.js";
import { mergeAdditions, updateParticles } from "./particles.js";
import { PARTICLE_CONSTANTS } from "../config.js";
import { REF_FPS } from "./state.js";

describe("mergeAdditions", () => {
  let state;

  beforeEach(() => {
    state = createInitialState();
  });

  it("moves particles from particlesToAdd to particles with correct structure", () => {
    state.particlesToAdd.push({
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 0, y: 1, z: 0 },
      life: 0.5,
      color: 0xff0000,
    });
    mergeAdditions(state);
    expect(state.particlesToAdd).toHaveLength(0);
    expect(state.particles).toHaveLength(1);
    expect(state.particles[0].position).toEqual({ x: 1, y: 2, z: 3 });
    expect(state.particles[0].velocity).toEqual({ x: 0, y: 1, z: 0 });
    expect(state.particles[0].life).toBe(0.5);
    expect(state.particles[0].color).toBe(0xff0000);
    expect(state.particles[0].id).toBe(1);
  });

  it("uses defaults for missing life and color", () => {
    state.particlesToAdd.push({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    });
    mergeAdditions(state);
    expect(state.particles[0].life).toBe(1);
    expect(state.particles[0].color).toBe(0xffffff);
  });

  it("moves effects from effectsToAdd to effects", () => {
    state.effectsToAdd.push({
      type: "ring",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      opacity: 0.8,
    });
    mergeAdditions(state);
    expect(state.effectsToAdd).toHaveLength(0);
    expect(state.effects).toHaveLength(1);
    expect(state.effects[0].type).toBe("ring");
    expect(state.effects[0].scale).toBe(1);
    expect(state.effects[0].opacity).toBe(0.8);
    expect(state.effects[0].id).toBe(1);
  });

  it("moves boost trail from boostTrailToAdd to boostTrail", () => {
    state.boostTrailToAdd.push({
      position: { x: 1, y: 0, z: 2 },
      life: 1,
      angle: 0.5,
    });
    mergeAdditions(state);
    expect(state.boostTrailToAdd).toHaveLength(0);
    expect(state.boostTrail).toHaveLength(1);
    expect(state.boostTrail[0].position).toEqual({ x: 1, y: 0, z: 2 });
    expect(state.boostTrail[0].angle).toBe(0.5);
  });

  it("moves dynamite sparks from dynamiteSparksToAdd to dynamiteSparks", () => {
    state.dynamiteSparksToAdd.push({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      life: 1,
    });
    mergeAdditions(state);
    expect(state.dynamiteSparksToAdd).toHaveLength(0);
    expect(state.dynamiteSparks).toHaveLength(1);
    expect(state.dynamiteSparks[0].id).toBe(1);
  });
});

describe("updateParticles", () => {
  let state;

  beforeEach(() => {
    state = createInitialState();
  });

  it("decays particle life and updates position", () => {
    state.particles.push({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 1, y: 2, z: 3 },
      life: 1,
      color: 0xffffff,
      id: 1,
    });
    const dt = 1 / REF_FPS;
    updateParticles(dt, state);
    expect(state.particles[0].life).toBe(1 - PARTICLE_CONSTANTS.decayRate);
    expect(state.particles[0].position.x).toBeCloseTo(1 * dt);
    expect(state.particles[0].position.y).toBeCloseTo(2 * dt);
    expect(state.particles[0].position.z).toBeCloseTo(3 * dt);
  });

  it("removes particles when life reaches zero", () => {
    state.particles.push({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      life: 0.01,
      color: 0xffffff,
      id: 1,
    });
    const dt = 1 / REF_FPS;
    updateParticles(dt, state);
    expect(state.particles).toHaveLength(0);
  });

  it("decays effect opacity and scale", () => {
    state.effects.push({
      type: "ring",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      opacity: 0.8,
      id: 1,
    });
    const dt = 1 / REF_FPS;
    updateParticles(dt, state);
    expect(state.effects[0].opacity).toBe(0.8 - PARTICLE_CONSTANTS.effectOpacityDecay);
    expect(state.effects[0].scale).toBe(1 + PARTICLE_CONSTANTS.effectScaleRate);
  });

  it("removes effects when opacity reaches zero", () => {
    state.effects.push({
      type: "ring",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      opacity: 0.02,
      id: 1,
    });
    const dt = 1 / REF_FPS;
    updateParticles(dt, state);
    expect(state.effects).toHaveLength(0);
  });

  it("removes boost trail when life reaches zero", () => {
    state.boostTrail.push({
      position: { x: 0, y: 0, z: 0 },
      life: 0.01,
      angle: 0,
      id: 1,
    });
    const dt = 1 / REF_FPS;
    updateParticles(dt, state);
    expect(state.boostTrail).toHaveLength(0);
  });

  it("updates dynamite spark position and decays life", () => {
    state.dynamiteSparks.push({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      life: 1,
      id: 1,
    });
    const dt = 1 / REF_FPS;
    updateParticles(dt, state);
    expect(state.dynamiteSparks[0].position.x).toBeCloseTo(1 * dt);
    expect(state.dynamiteSparks[0].life).toBeLessThan(1);
  });
});
