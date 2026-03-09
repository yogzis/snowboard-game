import { CONFIG } from "../config.js";
import * as dom from "./dom.js";

export function startJumpChargeIndicator(gameState) {
  if (!dom.jumpChargeContainer || !dom.jumpChargeBar) return;

  function updateIndicator() {
    if (gameState.jumpPressStartedAt != null && !gameState.playerStats.isJumping) {
      const chargeDuration = CONFIG.physics.jumpChargeDurationMs ?? 400;
      const elapsed = performance.now() - gameState.jumpPressStartedAt;
      const charge = Math.min(1, elapsed / chargeDuration);
      dom.jumpChargeContainer.classList.add("visible");
      dom.jumpChargeBar.value = Math.round(charge * 100);
    } else {
      dom.jumpChargeContainer.classList.remove("visible");
      dom.jumpChargeBar.value = 0;
    }
    requestAnimationFrame(updateIndicator);
  }
  updateIndicator();
}
