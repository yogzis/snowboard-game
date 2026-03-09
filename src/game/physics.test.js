import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInitialState } from "./state.js";
import { updatePhysics } from "./physics.js";
import { CONFIG, PHYSICS_CONSTANTS } from "../config.js";
import { REF_FPS } from "./state.js";

function createMockCallbacks() {
  return {
    updateUI: vi.fn(),
    triggerNotification: vi.fn(),
    triggerDynamiteFlash: vi.fn(),
    shakeCamera: vi.fn(),
    takeDamage: vi.fn(),
    gameOver: vi.fn(),
  };
}

describe("updatePhysics", () => {
  let state;
  let callbacks;

  beforeEach(() => {
    state = createInitialState();
    state.gameState = "PLAYING";
    callbacks = createMockCallbacks();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("increases speed when holding up without steering", () => {
    state.input.up = true;
    const dt = 1 / REF_FPS;
    const initialSpeed = state.speed;
    updatePhysics(dt, state, callbacks);
    expect(state.speed).toBeGreaterThan(initialSpeed);
  });

  it("triggers spin-out when steering only for threshold duration", () => {
    state.input.left = true;
    state.input.up = false;
    state.input.down = false;
    state.playerStats.isJumping = false;
    const dt = 1 / REF_FPS;
    const spinOutThreshold = CONFIG.physics.spinOutThreshold;
    const framesToTrigger = Math.ceil(spinOutThreshold / dt) + 1;
    for (let i = 0; i < framesToTrigger; i++) {
      updatePhysics(dt, state, callbacks);
      if (state.spinOut.active) break;
    }
    expect(state.spinOut.active).toBe(true);
    expect(callbacks.triggerNotification).toHaveBeenCalledWith(
      "Hold a turn too long (~1.5 s) and you spin out.",
      "#e67e22"
    );
  });

  it("applies vertical velocity when jump is pressed", () => {
    state.input.jump = true;
    state.playerStats.isJumping = false;
    const dt = 1 / REF_FPS;
    updatePhysics(dt, state, callbacks);
    expect(state.playerStats.isJumping).toBe(true);
    expect(state.player.velocity.y).toBeGreaterThan(0);
  });

  it("does nothing when gameState is not PLAYING", () => {
    state.gameState = "MENU";
    state.input.up = true;
    const initialSpeed = state.speed;
    updatePhysics(1 / REF_FPS, state, callbacks);
    expect(state.speed).toBe(initialSpeed);
  });

  it("updates world.groundZ and world.groundX from player position", () => {
    state.player.position.x = 3;
    state.player.position.z = 10;
    updatePhysics(1 / REF_FPS, state, callbacks);
    expect(state.world.groundX).toBe(3);
    expect(state.world.groundZ).toBeCloseTo(10 - PHYSICS_CONSTANTS.worldGroundOffset);
  });

  it("calls updateUI", () => {
    updatePhysics(1 / REF_FPS, state, callbacks);
    expect(callbacks.updateUI).toHaveBeenCalledWith(state);
  });
});
