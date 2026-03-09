import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInitialState } from "./state.js";
import { spawnObstacle, breakBox, updateObstacles } from "./obstacles.js";
import { CONFIG, OBSTACLE_CONSTANTS } from "../config.js";

function createMockCallbacks() {
  return {
    updateUI: vi.fn(),
    triggerNotification: vi.fn(),
    triggerDynamiteFlash: vi.fn(),
    shakeCamera: vi.fn(),
    takeDamage: vi.fn(),
  };
}

describe("spawnObstacle", () => {
  let state;

  beforeEach(() => {
    state = createInitialState();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("spawns box at specified position with typeOverride and xPosOverride", () => {
    spawnObstacle(100, 0, "box", state);
    expect(state.obstacles).toHaveLength(1);
    expect(state.obstacles[0].type).toBe("box");
    expect(state.obstacles[0].position.x).toBe(0);
    expect(state.obstacles[0].position.z).toBe(100);
    expect(state.obstacles[0].userData.radius).toBe(1.2);
  });

  it("spawns tree with correct userData", () => {
    spawnObstacle(50, 5, "tree", state);
    expect(state.obstacles[0].type).toBe("tree");
    expect(state.obstacles[0].position.y).toBe(0);
    expect(state.obstacles[0].userData).toEqual({ radius: 0.8, height: 3 });
  });

  it("spawns ramp_combo as ramp and elevated box", () => {
    spawnObstacle(80, 0, "ramp_combo", state);
    expect(state.obstacles).toHaveLength(2);
    expect(state.obstacles[0].type).toBe("ramp");
    expect(state.obstacles[1].type).toBe("box");
    expect(state.obstacles[1].userData.isElevated).toBe(true);
  });

  it("increments nextObstacleId", () => {
    const initialId = state.nextObstacleId;
    spawnObstacle(0, 0, "boost", state);
    expect(state.obstacles[0].id).toBe(initialId);
    expect(state.nextObstacleId).toBe(initialId + 1);
  });
});

describe("breakBox", () => {
  let state;
  let callbacks;

  beforeEach(() => {
    state = createInitialState();
    callbacks = createMockCallbacks();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes obstacle from state", () => {
    const obstacle = {
      id: 1,
      type: "box",
      position: { x: 0, y: 2, z: 10 },
      userData: { radius: 1.2, height: 2.5, isElevated: false },
    };
    state.obstacles.push(obstacle);
    breakBox(obstacle, state, callbacks);
    expect(state.obstacles).toHaveLength(0);
  });

  it("adds particles and effects to add queues", () => {
    const obstacle = {
      id: 1,
      type: "box",
      position: { x: 0, y: 2, z: 10 },
      userData: { radius: 1.2, height: 2.5, isElevated: false },
    };
    state.obstacles.push(obstacle);
    breakBox(obstacle, state, callbacks);
    expect(state.effectsToAdd.length).toBeGreaterThan(0);
    expect(state.particlesToAdd.length).toBeGreaterThan(0);
  });

  it("awards dynamite power-up when rand is below 0.18 for normal box", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const obstacle = {
      id: 1,
      type: "box",
      position: { x: 0, y: 2, z: 10 },
      userData: { radius: 1.2, height: 2.5, isElevated: false },
    };
    state.obstacles.push(obstacle);
    breakBox(obstacle, state, callbacks);
    expect(state.playerStats.hasDynamite).toBe(true);
    expect(state.playerStats.dynamiteTimer).toBe(CONFIG.game.dynamiteTime);
    expect(callbacks.triggerNotification).toHaveBeenCalledWith(
      "DYNAMITE! Jump x2 Straight to Remove!",
      "#e74c3c"
    );
  });

  it("awards boost power-up when rand is between 0.18 and 0.36 for normal box", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const obstacle = {
      id: 1,
      type: "box",
      position: { x: 0, y: 2, z: 10 },
      userData: { radius: 1.2, height: 2.5, isElevated: false },
    };
    state.obstacles.push(obstacle);
    breakBox(obstacle, state, callbacks);
    expect(state.playerStats.boostTimer).toBe(CONFIG.game.boostDuration);
    expect(state.playerStats.boostTargetSpeed).toBe(CONFIG.physics.boostSpeed);
    expect(callbacks.triggerNotification).toHaveBeenCalledWith("SPEED BOOST!");
  });

  it("awards shield power-up when rand is between 0.72 and 0.9 for normal box", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.8);
    const obstacle = {
      id: 1,
      type: "box",
      position: { x: 0, y: 2, z: 10 },
      userData: { radius: 1.2, height: 2.5, isElevated: false },
    };
    state.obstacles.push(obstacle);
    breakBox(obstacle, state, callbacks);
    expect(state.playerStats.invincibleTimer).toBe(CONFIG.game.invincibleTime);
    expect(callbacks.triggerNotification).toHaveBeenCalledWith("SHIELD ACTIVE!", "#00ffff");
  });
});

describe("updateObstacles", () => {
  let state;
  let callbacks;

  beforeEach(() => {
    state = createInitialState();
    callbacks = createMockCallbacks();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes obstacles behind player beyond despawn offset", () => {
    spawnObstacle(0, 0, "tree", state);
    expect(state.obstacles).toHaveLength(1);
    state.player.position.z = -100;
    state.obstacles[0].position.z = 0;
    updateObstacles(1 / 60, state, callbacks);
    expect(state.obstacles).toHaveLength(0);
  });

  it("updates rotation for obstacles with rotationVel", () => {
    spawnObstacle(50, 0, "box", state);
    const obstacle = state.obstacles[0];
    const initialRotationX = obstacle.rotation.x;
    updateObstacles(1 / 60, state, callbacks);
    expect(obstacle.rotation.x).toBeGreaterThan(initialRotationX);
  });
});
