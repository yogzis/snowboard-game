import { describe, it, expect } from "vitest";
import { createInitialState, REF_FPS, DT_MAX } from "./state.js";

describe("createInitialState", () => {
  it("returns object with expected shape", () => {
    const state = createInitialState();
    expect(state).toHaveProperty("player");
    expect(state).toHaveProperty("playerStats");
    expect(state).toHaveProperty("obstacles");
    expect(state).toHaveProperty("gameState");
    expect(state).toHaveProperty("spinOut");
    expect(state).toHaveProperty("input");
    expect(state).toHaveProperty("camera");
  });

  it("sets gameState to MENU", () => {
    const state = createInitialState();
    expect(state.gameState).toBe("MENU");
  });

  it("sets playerStats defaults", () => {
    const state = createInitialState();
    expect(state.playerStats.hp).toBe(100);
    expect(state.playerStats.lives).toBe(3);
  });

  it("sets spinOut.active to false", () => {
    const state = createInitialState();
    expect(state.spinOut.active).toBe(false);
    expect(state.spinOut.phase).toBe(null);
  });

  it("sets player position and velocity to zero", () => {
    const state = createInitialState();
    expect(state.player.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.player.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("initializes empty arrays for obstacles and particles", () => {
    const state = createInitialState();
    expect(state.obstacles).toEqual([]);
    expect(state.particles).toEqual([]);
    expect(state.effects).toEqual([]);
  });

  it("uses REF_FPS and DT_MAX constants", () => {
    const state = createInitialState();
    expect(state.REF_FPS).toBe(REF_FPS);
    expect(state.DT_MAX).toBe(DT_MAX);
  });
});
