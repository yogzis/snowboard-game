import { CONFIG } from "./config.js";
import { createInitialState } from "./game/state.js";
import { init as gameLoopInit, tick, resetGameStateAndScene, takeDamage as gameLoopTakeDamage } from "./game/gameLoop.js";
import * as renderer from "./rendering/babylonScene.js";
import * as dom from "./ui/dom.js";
import * as events from "./ui/events.js";

const state = createInitialState();
let lastFrameTime = 0;
let frameId = null;

function updateUI(state) {
  if (dom.hpBar) dom.hpBar.style.width = state.playerStats.hp + "%";
  if (dom.hpText) dom.hpText.innerText = state.playerStats.hp + "%";
  if (dom.livesVal) dom.livesVal.innerText = "❤️".repeat(Math.max(0, state.playerStats.lives));
  if (dom.scoreVal) dom.scoreVal.innerText = Math.floor(state.score);
  if (dom.speedVal) dom.speedVal.innerText = Math.floor(state.speed * 100);
}

function triggerNotification(text, color = "#f1c40f") {
  if (dom.notificationArea) {
    dom.notificationArea.innerText = text;
    dom.notificationArea.style.color = color;
    dom.notificationArea.style.opacity = 1;
    setTimeout(() => { if (dom.notificationArea) dom.notificationArea.style.opacity = 0; }, 2000);
  }
}

function triggerDynamiteFlash() {
  if (!dom.dynamiteFlashEl) return;
  dom.dynamiteFlashEl.classList.remove("flash");
  dom.dynamiteFlashEl.offsetHeight;
  dom.dynamiteFlashEl.classList.add("flash");
  setTimeout(() => dom.dynamiteFlashEl?.classList.remove("flash"), 350);
}

function shakeCamera() {
  state.cameraShake.intensity = 0.5;
}

function gameOver() {
  state.gameState = "GAMEOVER";
  if (dom.titleText) dom.titleText.innerText = "GAME OVER";
  if (dom.subText) dom.subText.innerText = `Final Distance: ${Math.floor(state.score)}m`;
  if (dom.startBtn) dom.startBtn.innerText = "Try Again";
  if (dom.menuOverlay) dom.menuOverlay.classList.remove("hidden");
  state.playerRotationX = -Math.PI / 2;
}

const callbacks = {
  updateUI,
  triggerNotification,
  triggerDynamiteFlash,
  shakeCamera,
  gameOver,
  takeDamage: (amount) => gameLoopTakeDamage(amount, state),
};

gameLoopInit(callbacks);

const container = document.body;
const { getCanvas } = renderer.init(container);
const canvas = getCanvas ? getCanvas() : null;

function togglePause() {
  if (state.gameState === "PLAYING") {
    state.gameState = "PAUSED";
    if (dom.pauseMenu) dom.pauseMenu.classList.remove("hidden");
    if (dom.pauseBtn) dom.pauseBtn.innerText = "▶";
  } else if (state.gameState === "PAUSED") {
    state.gameState = "PLAYING";
    if (dom.pauseMenu) dom.pauseMenu.classList.add("hidden");
    if (dom.pauseBtn) dom.pauseBtn.innerText = "||";
  }
}

function startGame() {
  resetGameStateAndScene(state, true);
  lastFrameTime = performance.now();
  state.gameState = "PLAYING";
  state.playerRotationX = 0;
  if (dom.menuOverlay) dom.menuOverlay.classList.add("hidden");
  if (dom.pauseMenu) dom.pauseMenu.classList.add("hidden");
  if (dom.exitConfirmOverlay) dom.exitConfirmOverlay.classList.add("hidden");
  if (canvas) canvas.style.pointerEvents = "auto";
  window.focus();
}

events.bindInput(state);
events.bindButtons(
  startGame,
  togglePause,
  togglePause,
  () => { if (dom.hintsOverlay) dom.hintsOverlay.classList.remove("hidden"); },
  () => { if (dom.hintsOverlay) dom.hintsOverlay.classList.add("hidden"); },
  () => { if (dom.hintsOverlay) dom.hintsOverlay.classList.add("hidden"); togglePause(); },
  () => { if (dom.exitConfirmOverlay) dom.exitConfirmOverlay.classList.remove("hidden"); },
  () => { if (dom.exitConfirmOverlay) dom.exitConfirmOverlay.classList.add("hidden"); },
  () => {
    if (dom.exitConfirmOverlay) dom.exitConfirmOverlay.classList.add("hidden");
    resetGameStateAndScene(state, true);
    state.gameState = "MENU";
    if (dom.pauseMenu) dom.pauseMenu.classList.add("hidden");
    if (dom.hintsOverlay) dom.hintsOverlay.classList.add("hidden");
    if (dom.menuOverlay) dom.menuOverlay.classList.remove("hidden");
    if (dom.pauseBtn) dom.pauseBtn.innerText = "||";
    if (canvas) canvas.style.pointerEvents = "none";
  }
);
events.bindGlobalKeys(() => state, togglePause, startGame);

if (dom.exitConfirmOverlay) dom.exitConfirmOverlay.classList.add("hidden");
if (dom.hintsOverlay) dom.hintsOverlay.classList.add("hidden");

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

if (dom.jumpChargeContainer && dom.jumpChargeBar) {
  const checkJumpCharge = () => {
    if (state.jumpPressStartedAt != null && !state.playerStats.isJumping) {
      const chargeDuration = CONFIG.physics.jumpChargeDurationMs ?? 400;
      const elapsed = performance.now() - state.jumpPressStartedAt;
      const charge = Math.min(1, elapsed / chargeDuration);
      dom.jumpChargeContainer.classList.add("visible");
      dom.jumpChargeBar.style.height = charge * 100 + "%";
    } else {
      dom.jumpChargeContainer.classList.remove("visible");
      dom.jumpChargeBar.style.height = "0%";
    }
    requestAnimationFrame(checkJumpCharge);
  };
  checkJumpCharge();
}

console.log("Game Initialized");
