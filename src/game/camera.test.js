import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "./state.js";
import { updateCameraFromPlayer } from "./camera.js";

describe("updateCameraFromPlayer", () => {
  let state;

  beforeEach(() => {
    state = createInitialState();
  });

  it("sets camera targetX and targetZ from player position", () => {
    state.player.position.x = 5;
    state.player.position.z = 10;
    updateCameraFromPlayer(state);
    expect(state.camera.targetX).toBe(5);
    expect(state.camera.targetZ).toBe(18);
  });

  it("sets camera lookAt from player position", () => {
    state.player.position.x = 3;
    state.player.position.y = 1;
    state.player.position.z = -2;
    updateCameraFromPlayer(state);
    expect(state.camera.lookAt.x).toBe(3);
    expect(state.camera.lookAt.y).toBe(1);
    expect(state.camera.lookAt.z).toBe(-7);
  });

  it("uses offset for targetZ (pos.z + 8)", () => {
    state.player.position.z = 0;
    updateCameraFromPlayer(state);
    expect(state.camera.targetZ).toBe(8);
  });

  it("uses offset for lookAt.z (pos.z - 5)", () => {
    state.player.position.z = 0;
    updateCameraFromPlayer(state);
    expect(state.camera.lookAt.z).toBe(-5);
  });
});
