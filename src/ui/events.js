import * as dom from "./dom.js";
import { handleKeyDown, handleKeyUp, handleTouchStart, handleTouchEnd } from "../game/input.js";

export function bindInput(state) {
  document.addEventListener("keydown", (e) => handleKeyDown(state, e));
  document.addEventListener("keyup", (e) => handleKeyUp(state, e));
  document.addEventListener("touchstart", (e) => handleTouchStart(state, e), { passive: false });
  document.addEventListener("touchend", (e) => handleTouchEnd(state, e));
}

export function bindButtons(onStart, onPause, onResume, onHints, onHintsBack, onHintsResume, onExit, onExitCancel, onExitConfirm) {
  dom.pauseBtn?.addEventListener("click", (e) => { e.stopPropagation(); dom.pauseBtn?.blur(); onPause(); });
  dom.resumeBtn?.addEventListener("click", (e) => { e.stopPropagation(); dom.resumeBtn?.blur(); onResume(); });
  dom.hintsBtn?.addEventListener("click", (e) => { e.stopPropagation(); dom.hintsBtn?.blur(); onHints(); });
  dom.hintsBackBtn?.addEventListener("click", (e) => { e.stopPropagation(); dom.hintsBackBtn?.blur(); onHintsBack(); });
  dom.hintsResumeBtn?.addEventListener("click", (e) => { e.stopPropagation(); dom.hintsResumeBtn?.blur(); onHintsResume(); });
  dom.exitBtn?.addEventListener("click", (e) => { e.stopPropagation(); dom.exitBtn?.blur(); onExit(); });
  dom.exitConfirmCancel?.addEventListener("click", (e) => { e.stopPropagation(); dom.exitConfirmCancel?.blur(); onExitCancel(); });
  dom.exitConfirmYes?.addEventListener("click", (e) => { e.stopPropagation(); dom.exitConfirmYes?.blur(); onExitConfirm(); });
  dom.startBtn?.addEventListener("click", (e) => { e.preventDefault(); dom.startBtn?.blur(); onStart(); });
}

export function bindGlobalKeys(getState, togglePause, onStart) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (dom.hintsOverlay && !dom.hintsOverlay.classList.contains("hidden")) {
        dom.hintsOverlay.classList.add("hidden");
      } else {
        togglePause();
      }
      return;
    }
    if (e.key === "Enter" && getState().gameState === "MENU") {
      e.preventDefault();
      dom.startBtn?.blur();
      onStart();
      return;
    }
  });
}
