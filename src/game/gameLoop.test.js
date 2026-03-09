import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInitialState } from "./state.js";
import { init, tick, takeDamage, resetGameStateAndScene } from "./gameLoop.js";
import { PHYSICS_CONSTANTS } from "../config.js";
import { REF_FPS } from "./state.js";

function createMockCallbacks() {
  return {
    updateUI: vi.fn(),
    triggerNotification: vi.fn(),
    shakeCamera: vi.fn(),
    gameOver: vi.fn(),
  };
}

describe("takeDamage", () => {
  let state;
  let callbacks;

  beforeEach(() => {
    state = createInitialState();
    callbacks = createMockCallbacks();
    init(callbacks);
  });

  it("reduces HP by damage amount", () => {
    state.gameState = "PLAYING";
    state.playerStats.hp = 100;
    takeDamage(30, state);
    expect(state.playerStats.hp).toBe(70);
  });

  it("applies damage speed multiplier", () => {
    state.speed = 1;
    takeDamage(10, state);
    expect(state.speed).toBe(1 * PHYSICS_CONSTANTS.damageSpeedMultiplier);
  });

  it("bumps player position", () => {
    state.player.position.y = 0;
    takeDamage(10, state);
    expect(state.player.position.y).toBe(PHYSICS_CONSTANTS.damagePositionBump);
  });

  it("calls shakeCamera and triggerNotification", () => {
    takeDamage(10, state);
    expect(callbacks.shakeCamera).toHaveBeenCalled();
    expect(callbacks.triggerNotification).toHaveBeenCalledWith("OUCH!", "#e74c3c");
  });

  it("does not apply damage when invincible", () => {
    state.playerStats.invincibleTimer = 5;
    state.playerStats.hp = 50;
    takeDamage(100, state);
    expect(state.playerStats.hp).toBe(50);
  });

  it("triggers game over when lives reach zero", () => {
    state.playerStats.hp = 50;
    state.playerStats.lives = 1;
    takeDamage(100, state);
    expect(state.playerStats.lives).toBe(0);
    expect(callbacks.gameOver).toHaveBeenCalledWith(state);
  });

  it("restores HP and applies invincibility when losing a life", () => {
    state.playerStats.hp = 50;
    state.playerStats.lives = 2;
    takeDamage(100, state);
    expect(state.playerStats.hp).toBe(100);
    expect(state.playerStats.lives).toBe(1);
    expect(state.playerStats.invincibleTimer).toBe(PHYSICS_CONSTANTS.lifeLostInvincibleDuration);
    expect(state.visuals.shieldPulseTime).toBe(PHYSICS_CONSTANTS.lifeLostShieldPulseTime);
    expect(callbacks.triggerNotification).toHaveBeenCalledWith("LIFE LOST!", "#ff0000");
  });
});

describe("resetGameStateAndScene", () => {
  let state;
  let callbacks;

  beforeEach(() => {
    state = createInitialState();
    callbacks = createMockCallbacks();
    init(callbacks);
  });

  it("resets score to zero", () => {
    state.score = 500;
    resetGameStateAndScene(state);
    expect(state.score).toBe(0);
  });

  it("resets player position and velocity", () => {
    state.player.position.x = 10;
    state.player.position.z = 20;
    state.player.velocity.y = 5;
    state.speed = 1;
    resetGameStateAndScene(state);
    expect(state.player.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.player.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.speed).toBe(0);
  });

  it("resets player stats with full reset", () => {
    state.playerStats.hp = 30;
    state.playerStats.lives = 1;
    state.playerStats.isJumping = true;
    resetGameStateAndScene(state, true);
    expect(state.playerStats.hp).toBe(100);
    expect(state.playerStats.lives).toBe(3);
    expect(state.playerStats.isJumping).toBe(false);
  });

  it("keeps HP and lives when fullReset is false", () => {
    state.playerStats.hp = 50;
    state.playerStats.lives = 2;
    resetGameStateAndScene(state, false);
    expect(state.playerStats.hp).toBe(50);
    expect(state.playerStats.lives).toBe(2);
  });

  it("clears obstacles and spawns initial chunks", () => {
    state.obstacles.push({ id: 1, type: "tree" });
    resetGameStateAndScene(state);
    expect(state.obstacles.length).toBeGreaterThan(0);
  });

  it("clears particles and effects", () => {
    state.particles.push({ id: 1 });
    state.effects.push({ id: 1 });
    resetGameStateAndScene(state);
    expect(state.particles).toHaveLength(0);
    expect(state.effects).toHaveLength(0);
  });

  it("calls updateUI when callbacks are set", () => {
    resetGameStateAndScene(state);
    expect(callbacks.updateUI).toHaveBeenCalledWith(state);
  });
});

describe("tick", () => {
  let state;
  let callbacks;

  beforeEach(() => {
    state = createInitialState();
    state.gameState = "PLAYING";
    callbacks = createMockCallbacks();
    init(callbacks);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("increases score over multiple frames", () => {
    state.input.up = true;
    state.speed = 0.5;
    const dt = 1 / REF_FPS;
    const initialScore = state.score;
    for (let i = 0; i < 60; i++) {
      tick(dt, state);
    }
    expect(state.score).toBeGreaterThan(initialScore);
  });

  it("updates player position over multiple frames", () => {
    state.input.up = true;
    const dt = 1 / REF_FPS;
    const initialZ = state.player.position.z;
    for (let i = 0; i < 120; i++) {
      tick(dt, state);
    }
    expect(state.player.position.z).not.toBe(initialZ);
  });

  it("does nothing when gameState is PAUSED", () => {
    state.gameState = "PAUSED";
    state.input.up = true;
    const initialScore = state.score;
    const initialZ = state.player.position.z;
    tick(1 / REF_FPS, state);
    expect(state.score).toBe(initialScore);
    expect(state.player.position.z).toBe(initialZ);
  });
});
