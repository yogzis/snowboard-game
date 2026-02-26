import { CONFIG } from "../config.js";

export function handleKeyDown(state, e) {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
    if (e.repeat) return;
    e.preventDefault();
  }
  if (e.key === "ArrowLeft") state.input.left = true;
  if (e.key === "ArrowRight") state.input.right = true;
  if (e.key === "ArrowUp") state.input.up = true;
  if (e.key === "ArrowDown") state.input.down = true;
  if (e.key === " ") {
    if (state.jumpPressStartedAt == null) state.jumpPressStartedAt = performance.now();
  }
}

export function handleKeyUp(state, e) {
  if (e.key === "ArrowLeft") state.input.left = false;
  if (e.key === "ArrowRight") state.input.right = false;
  if (e.key === "ArrowUp") state.input.up = false;
  if (e.key === "ArrowDown") state.input.down = false;
  if (e.key === " ") {
    if (state.jumpPressStartedAt != null) {
      const holdDuration = performance.now() - state.jumpPressStartedAt;
      const chargeDuration = CONFIG.physics.jumpChargeDurationMs ?? 400;
      state.input.jump = true;
      state.input.jumpCharge = Math.min(1, holdDuration / chargeDuration);
    }
    state.jumpPressStartedAt = null;
  }
}

export function handleTouchStart(state, e) {
  if (state.gameState !== "PLAYING") return;
  for (let i = 0; i < e.touches.length; i++) {
    const x = e.touches[i].clientX;
    const w = window.innerWidth;
    if (x < w * 0.3) state.input.left = true;
    else if (x > w * 0.7) state.input.right = true;
    else if (state.jumpPressStartedAt == null) state.jumpPressStartedAt = performance.now();
  }
}

export function handleTouchEnd(state, e) {
  if (state.jumpPressStartedAt != null) {
    const holdDuration = performance.now() - state.jumpPressStartedAt;
    const chargeDuration = CONFIG.physics.jumpChargeDurationMs ?? 400;
    state.input.jump = true;
    state.input.jumpCharge = Math.min(1, holdDuration / chargeDuration);
    state.jumpPressStartedAt = null;
  }
  state.input.left = false;
  state.input.right = false;
}
