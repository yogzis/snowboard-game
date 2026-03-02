/**
 * Character test page: scenario-based testing.
 * Uses the game's full rendering pipeline. Character stands still; selected scenario
 * drives state so animations and visuals (steer, jump, spin-out, glide, shield, etc.) are testable.
 */
import { createInitialState } from "./game/state.js";
import * as renderer from "./rendering/babylonScene.js";

const container = document.getElementById("game-container");
if (!container) throw new Error("Missing #game-container");

let state = createInitialState();

const scenarios = [
  {
    id: "idle",
    label: "Idle",
    description: "Default pose; no input or special state.",
    apply(s) {
      // nothing
    },
  },
  {
    id: "steer-left",
    label: "Steer left",
    description: "Turning left; input.left and negative angle.",
    apply(s) {
      s.input.left = true;
      s.input.right = false;
      s.player.angle = -0.4;
    },
  },
  {
    id: "steer-right",
    label: "Steer right",
    description: "Turning right; input.right and positive angle.",
    apply(s) {
      s.input.left = false;
      s.input.right = true;
      s.player.angle = 0.4;
    },
  },
  {
    id: "jump-quick",
    label: "Jump (quick tap)",
    description: "Short hop; isJumping, low height, didJumpThisAirtime.",
    apply(s) {
      s.playerStats.isJumping = true;
      s.playerStats.didJumpThisAirtime = true;
      s.player.position.y = 1.2;
    },
  },
  {
    id: "jump-loaded",
    label: "Jump (loaded force)",
    description: "Charged jump; higher height, didChargedJumpThisAirtime.",
    apply(s) {
      s.playerStats.isJumping = true;
      s.playerStats.didJumpThisAirtime = true;
      s.playerStats.didChargedJumpThisAirtime = true;
      s.player.position.y = 2;
    },
  },
  {
    id: "jump-ramp",
    label: "Jump on ramp",
    description: "Ramp launch; rampLaunchFramesAgo, didJumpThisAirtime.",
    apply(s) {
      s.playerStats.isJumping = true;
      s.playerStats.rampLaunchFramesAgo = 0.05;
      s.playerStats.didJumpThisAirtime = true;
      s.player.position.y = 2;
    },
  },
  {
    id: "break-left",
    label: "Break left",
    description: "Holding left + down (brake/carve); sharp turn, no spin-out.",
    apply(s) {
      s.input.left = true;
      s.input.right = false;
      s.input.down = true;
      s.player.angle = -0.85;
    },
  },
  {
    id: "break-right",
    label: "Break right",
    description: "Holding right + down (brake/carve); sharp turn, no spin-out.",
    apply(s) {
      s.input.left = false;
      s.input.right = true;
      s.input.down = true;
      s.player.angle = 0.85;
    },
  },
  {
    id: "spin-out-spinning",
    label: "Spin-out (spinning)",
    description: "Full spin-out SPINNING phase; Fall animation starts.",
    apply(s) {
      s.spinOut.active = true;
      s.spinOut.phase = "SPINNING";
      s.spinOut.direction = -1;
      s.player.visualSpinAngle = Math.PI;
    },
  },
  {
    id: "spin-out-falling",
    label: "Spin-out (falling)",
    description: "Spin-out FALLING phase; character in fall pose.",
    apply(s) {
      s.spinOut.active = true;
      s.spinOut.phase = "FALLING";
      s.player.visualSpinAngle = 0;
    },
  },
  {
    id: "lean-back",
    label: "Leaning back",
    description: "Player leanBack applied; board angle.",
    apply(s) {
      s.player.leanBack = 0.5;
    },
  },
  {
    id: "glide",
    label: "Glide in bank",
    description: "hasGlide true; character should show purple until next ramp jump.",
    apply(s) {
      s.playerStats.hasGlide = true;
    },
  },
  {
    id: "shield",
    label: "Shield active",
    description: "Invincibility; shield visible.",
    apply(s) {
      s.playerStats.invincibleTimer = 5;
      s.visuals.shieldPulseTime = 0.25;
      s.visuals.shieldOpacity = 0.3;
    },
  },
  {
    id: "dynamite",
    label: "Dynamite",
    description: "Dynamite power-up active; stick visible on back.",
    apply(s) {
      s.playerStats.hasDynamite = true;
      s.playerStats.dynamiteTimer = 5;
    },
  },
];

const selectEl = document.getElementById("scenario-select");
const descriptionEl = document.getElementById("scenario-description");

scenarios.forEach((sc, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = sc.label;
  selectEl.appendChild(opt);
});

function getSelectedScenario() {
  const idx = parseInt(selectEl.value, 10);
  return Number.isFinite(idx) && scenarios[idx] ? scenarios[idx] : scenarios[0];
}

function onScenarioChange() {
  state = createInitialState();
  const sc = getSelectedScenario();
  if (descriptionEl) descriptionEl.textContent = sc.description || "";
}

selectEl.addEventListener("change", onScenarioChange);

renderer.init(container);
onScenarioChange();

function loop() {
  const sc = getSelectedScenario();
  sc.apply(state);
  renderer.syncFromState(state);
  renderer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.addEventListener("resize", () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});
