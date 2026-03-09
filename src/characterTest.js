/**
 * Character test page: scenario-based testing.
 * Uses the game's full rendering pipeline. Character stands still; selected scenario
 * drives state so animations and visuals (steer, jump, spin-out, glide, shield, etc.) are testable.
 */
import { createInitialState } from "./game/state.js";
import * as renderer from "./rendering/babylonScene.js";
import {
  ANIMATION_SCENARIOS,
  getScenarioById,
  getDefaultScenario,
} from "./game/scenarioAnimations.js";

const container = document.getElementById("game-container");
if (!container) throw new Error("Missing #game-container");

let state = createInitialState();

const selectEl = document.getElementById("scenario-select");
const descriptionEl = document.getElementById("scenario-description");

ANIMATION_SCENARIOS.forEach((sc) => {
  const opt = document.createElement("option");
  opt.value = sc.id;
  opt.textContent = sc.label;
  selectEl.appendChild(opt);
});

function getSelectedScenario() {
  const selectedId = selectEl.value;
  const scenario = getScenarioById(selectedId);
  return scenario || getDefaultScenario();
}

function onScenarioChange() {
  state = createInitialState();
  const sc = getSelectedScenario();
  if (descriptionEl) descriptionEl.textContent = sc.description || "";
  renderer.resetCharacterAnimationState();
}

selectEl.addEventListener("change", onScenarioChange);

renderer.init(container);
onScenarioChange();

function loop() {
  const sc = getSelectedScenario();
  sc.applyState(state);
  renderer.syncFromState(state);
  renderer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.addEventListener("resize", () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});
