import { CONFIG } from "./config.js";
import { createInitialState } from "./game/state.js";
import { init as gameLoopInit, tick, resetGameStateAndScene, takeDamage as gameLoopTakeDamage } from "./game/gameLoop.js";
import * as renderer from "./rendering/babylonScene.js";
import * as dom from "./ui/dom.js";
import * as events from "./ui/events.js";
import { startJumpChargeIndicator } from "./ui/jumpChargeIndicator.js";

const state = createInitialState();
let lastFrameTime = 0;
let frameId = null;

function createGameCallbacks(gameState) {
  return {
    updateUI(currentState) {
      const s = currentState ?? gameState;
      if (dom.hpBar) dom.hpBar.style.width = s.playerStats.hp + "%";
      if (dom.hpText) dom.hpText.innerText = s.playerStats.hp + "%";
      if (dom.livesVal) dom.livesVal.innerText = "❤️".repeat(Math.max(0, s.playerStats.lives));
      if (dom.scoreVal) dom.scoreVal.innerText = Math.floor(s.score);
      if (dom.speedVal) dom.speedVal.innerText = Math.floor(s.speed * 100);
    },
    triggerNotification(text, color = "#f1c40f") {
      if (dom.notificationArea) {
        dom.notificationArea.innerText = text;
        dom.notificationArea.style.color = color;
        dom.notificationArea.style.opacity = 1;
        setTimeout(() => { if (dom.notificationArea) dom.notificationArea.style.opacity = 0; }, 2000);
      }
    },
    triggerDynamiteFlash() {
      if (!dom.dynamiteFlashEl) return;
      dom.dynamiteFlashEl.classList.remove("flash");
      dom.dynamiteFlashEl.offsetHeight;
      dom.dynamiteFlashEl.classList.add("flash");
      setTimeout(() => dom.dynamiteFlashEl?.classList.remove("flash"), 350);
    },
    shakeCamera() {
      gameState.cameraShake.intensity = 0.5;
    },
    gameOver(currentState) {
      const s = currentState ?? gameState;
      s.gameState = "GAMEOVER";
      if (dom.titleText) dom.titleText.innerText = "GAME OVER";
      if (dom.subText) dom.subText.innerText = `Final Distance: ${Math.floor(s.score)}m`;
      if (dom.startBtn) dom.startBtn.innerText = "Try Again";
      dom.showElement(dom.menuOverlay);
      s.playerRotationX = -Math.PI / 2;
    },
    takeDamage(amount) {
      gameLoopTakeDamage(amount, gameState);
    },
  };
}

const gameCallbacks = createGameCallbacks(state);
gameLoopInit(gameCallbacks);

const container = document.body;
const { getCanvas } = renderer.init(container);
const canvas = getCanvas ? getCanvas() : null;

function togglePause() {
  if (state.gameState === "PLAYING") {
    state.gameState = "PAUSED";
    dom.showElement(dom.pauseMenu);
    if (dom.pauseBtn) dom.pauseBtn.innerText = "▶";
  } else if (state.gameState === "PAUSED") {
    state.gameState = "PLAYING";
    dom.hideElement(dom.pauseMenu);
    if (dom.pauseBtn) dom.pauseBtn.innerText = "||";
  }
}

function startGame() {
  resetGameStateAndScene(state, true);
  lastFrameTime = performance.now();
  state.gameState = "PLAYING";
  state.playerRotationX = 0;
  dom.hideElement(dom.menuOverlay);
  dom.hideElement(dom.pauseMenu);
  dom.hideElement(dom.exitConfirmOverlay);
  if (canvas) canvas.style.pointerEvents = "auto";
  window.focus();
}

events.bindInput(state);
events.bindButtons({
  onStart: startGame,
  onPause: togglePause,
  onResume: togglePause,
  onHints: () => dom.showElement(dom.hintsOverlay),
  onHintsBack: () => dom.hideElement(dom.hintsOverlay),
  onHintsResume: () => { dom.hideElement(dom.hintsOverlay); togglePause(); },
  onExit: () => dom.showElement(dom.exitConfirmOverlay),
  onExitCancel: () => dom.hideElement(dom.exitConfirmOverlay),
  onExitConfirm: () => {
    dom.hideElement(dom.exitConfirmOverlay);
    resetGameStateAndScene(state, true);
    state.gameState = "MENU";
    dom.hideElement(dom.pauseMenu);
    dom.hideElement(dom.hintsOverlay);
    dom.showElement(dom.menuOverlay);
    if (dom.pauseBtn) dom.pauseBtn.innerText = "||";
    if (canvas) canvas.style.pointerEvents = "none";
  },
});
events.bindGlobalKeys(() => state, togglePause, startGame);

dom.hideElement(dom.exitConfirmOverlay);
dom.hideElement(dom.hintsOverlay);

function animate() {
  frameId = requestAnimationFrame(animate);
  const now = performance.now();
  let dt = lastFrameTime > 0 ? (now - lastFrameTime) / 1000 : 1 / state.REF_FPS;
  dt = Math.min(dt, state.DT_MAX);
  lastFrameTime = now;

  if (state.gameState === "PAUSED") {
    renderer.syncFromState(state);
    renderer.render();
    return;
  }
  tick(dt, state);
  renderer.syncFromState(state);
  renderer.render();
}

window.addEventListener("resize", () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});

animate();

if (window.location.hash === "#play" || new URLSearchParams(window.location.search).get("autoplay") === "1") {
  requestAnimationFrame(() => setTimeout(startGame, 1200));
}

startJumpChargeIndicator(state);

console.log("Game Initialized");
