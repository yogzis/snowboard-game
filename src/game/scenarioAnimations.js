export const ANIMATION_SCENARIOS = [
  {
    id: "idle",
    label: "Idle",
    description: "Default pose; no input or special state.",
    applyState(state) {
      // Nothing special: rely on default idle pose.
    },
  },
  {
    id: "steer-left",
    label: "Steer left",
    description: "Turning left; input.left and negative angle.",
    applyState(state) {
      state.input.left = true;
      state.input.right = false;
      state.player.angle = -0.4;
    },
  },
  {
    id: "steer-right",
    label: "Steer right",
    description: "Turning right; input.right and positive angle.",
    applyState(state) {
      state.input.left = false;
      state.input.right = true;
      state.player.angle = 0.4;
    },
  },
  {
    id: "jump-quick",
    label: "Jump (quick tap)",
    description: "Short hop; isJumping, low height, didJumpThisAirtime.",
    applyState(state) {
      state.playerStats.isJumping = true;
      state.playerStats.didJumpThisAirtime = true;
      state.player.position.y = 1.2;
    },
  },
  {
    id: "jump-loaded",
    label: "Jump (loaded force)",
    description: "Charged jump; higher height, didChargedJumpThisAirtime.",
    applyState(state) {
      state.playerStats.isJumping = true;
      state.playerStats.didJumpThisAirtime = true;
      state.playerStats.didChargedJumpThisAirtime = true;
      state.player.position.y = 2;
    },
  },
  {
    id: "jump-ramp",
    label: "Jump on ramp",
    description: "Ramp launch; rampLaunchFramesAgo, didJumpThisAirtime.",
    applyState(state) {
      state.playerStats.isJumping = true;
      state.playerStats.rampLaunchFramesAgo = 0.05;
      state.playerStats.didJumpThisAirtime = true;
      state.player.position.y = 2;
    },
  },
  {
    id: "break-left",
    label: "Break left",
    description:
      "Holding left + down (brake/carve); sharp turn, no spin-out.",
    applyState(state) {
      state.input.left = true;
      state.input.right = false;
      state.input.down = true;
      state.player.angle = -0.85;
    },
  },
  {
    id: "break-right",
    label: "Break right",
    description:
      "Holding right + down (brake/carve); sharp turn, no spin-out.",
    applyState(state) {
      state.input.left = false;
      state.input.right = true;
      state.input.down = true;
      state.player.angle = 0.85;
    },
  },
  {
    id: "spin-out-spinning",
    label: "Spin-out (spinning)",
    description: "Full spin-out SPINNING phase; Fall animation starts.",
    applyState(state) {
      state.spinOut.active = true;
      state.spinOut.phase = "SPINNING";
      state.spinOut.direction = -1;
      state.player.visualSpinAngle = Math.PI;
    },
  },
  {
    id: "spin-out-falling",
    label: "Spin-out (falling)",
    description: "Spin-out FALLING phase; character in fall pose.",
    applyState(state) {
      state.spinOut.active = true;
      state.spinOut.phase = "FALLING";
      state.player.visualSpinAngle = 0;
    },
  },
  {
    id: "lean-back",
    label: "Leaning back",
    description: "Player leanBack applied; board angle.",
    applyState(state) {
      state.player.leanBack = 0.5;
    },
  },
  {
    id: "glide",
    label: "Glide in bank",
    description:
      "hasGlide true; character should show purple until next ramp jump.",
    applyState(state) {
      state.playerStats.hasGlide = true;
    },
  },
  {
    id: "shield",
    label: "Shield active",
    description: "Invincibility; shield visible.",
    applyState(state) {
      state.playerStats.invincibleTimer = 5;
      state.visuals.shieldPulseTime = 0.25;
      state.visuals.shieldOpacity = 0.3;
    },
  },
  {
    id: "dynamite",
    label: "Dynamite",
    description: "Dynamite power-up active; stick visible on back.",
    applyState(state) {
      state.playerStats.hasDynamite = true;
      state.playerStats.dynamiteTimer = 5;
    },
  },
];

export function getScenarioById(id) {
  return ANIMATION_SCENARIOS.find((sc) => sc.id === id) || null;
}

export function getDefaultScenario() {
  return ANIMATION_SCENARIOS[0];
}
