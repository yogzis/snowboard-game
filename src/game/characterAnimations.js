export const CHARACTER_ANIMATION_CONFIG = {
  clips: {
    idle: "Idle",
    turnLeft: "Turn_Left",
    turnRight: "Turn_Right",
    fall: "Fall",
    brakeWave: "Start_Wave",
  },
  brakeWave: {
    speedThreshold: 0.08,
  },
  turn: {
    smoothing: 0.25,
    weightEpsilon: 0.001,
  },
  spinOut: {
    phases: {
      spinning: "SPINNING",
      falling: "FALLING",
    },
  },
};

export function createInitialAnimationRuntime() {
  return {
    prevInputLeft: false,
    prevInputRight: false,
    currentTurnLeftWeight: 0,
    currentTurnRightWeight: 0,
    targetTurnLeftWeight: 0,
    targetTurnRightWeight: 0,
    wasSpinningOutLastFrame: false,
    needsPostFallRealign: false,
    brakeWaveWasActive: false,
  };
}

export function deriveCharacterAnimationDirectives(
  state,
  runtime,
  spinOutOverride,
) {
  const nextRuntime = { ...runtime };

  const rawSpinOut = spinOutOverride ||
    state.spinOut || {
      active: state.isSpinningOut,
      phase: state.isSpinningOut
        ? CHARACTER_ANIMATION_CONFIG.spinOut.phases.spinning
        : null,
    };

  const spinningOut = !!rawSpinOut.active;
  const phase = rawSpinOut.phase;
  const inSpinPhase =
    phase === CHARACTER_ANIMATION_CONFIG.spinOut.phases.spinning;
  const inFallPhase =
    phase === CHARACTER_ANIMATION_CONFIG.spinOut.phases.falling;

  const canTurn = !state.playerStats?.isJumping && !spinningOut && !inFallPhase;

  const inputLeft = !!state.input?.left;
  const inputRight = !!state.input?.right;

  const justPressedLeft = canTurn && inputLeft && !nextRuntime.prevInputLeft;
  const justPressedRight = canTurn && inputRight && !nextRuntime.prevInputRight;

  if (justPressedLeft) {
    nextRuntime.targetTurnLeftWeight = 1;
  }
  if (justPressedRight) {
    nextRuntime.targetTurnRightWeight = 1;
  }

  if (!inputLeft) nextRuntime.targetTurnLeftWeight = 0;
  if (!inputRight) nextRuntime.targetTurnRightWeight = 0;

  const speedThreshold =
    CHARACTER_ANIMATION_CONFIG.brakeWave?.speedThreshold ?? 0.08;
  const brakingToStop =
    (state.input?.left || state.input?.right) &&
    !!state.input?.down &&
    typeof state.speed === "number" &&
    state.speed <= speedThreshold &&
    !spinningOut &&
    !state.playerStats?.isJumping;
  if (brakingToStop) {
    nextRuntime.targetTurnLeftWeight = 0;
    nextRuntime.targetTurnRightWeight = 0;
  }

  const brakeWaveJustStarted =
    brakingToStop && !nextRuntime.brakeWaveWasActive;
  const brakeWaveJustStopped =
    !brakingToStop && !!nextRuntime.brakeWaveWasActive;
  nextRuntime.brakeWaveWasActive = brakingToStop;

  nextRuntime.prevInputLeft = inputLeft;
  nextRuntime.prevInputRight = inputRight;

  const smoothing = CHARACTER_ANIMATION_CONFIG.turn.smoothing;
  const lerp = (current, target) => current + (target - current) * smoothing;

  nextRuntime.currentTurnLeftWeight = lerp(
    nextRuntime.currentTurnLeftWeight,
    nextRuntime.targetTurnLeftWeight,
  );
  nextRuntime.currentTurnRightWeight = lerp(
    nextRuntime.currentTurnRightWeight,
    nextRuntime.targetTurnRightWeight,
  );

  const eps = CHARACTER_ANIMATION_CONFIG.turn.weightEpsilon;
  if (Math.abs(nextRuntime.currentTurnLeftWeight) < eps)
    nextRuntime.currentTurnLeftWeight = 0;
  else if (nextRuntime.currentTurnLeftWeight > 1)
    nextRuntime.currentTurnLeftWeight = 1;

  if (Math.abs(nextRuntime.currentTurnRightWeight) < eps)
    nextRuntime.currentTurnRightWeight = 0;
  else if (nextRuntime.currentTurnRightWeight > 1)
    nextRuntime.currentTurnRightWeight = 1;

  const spinOutJustTriggered =
    spinningOut && !nextRuntime.wasSpinningOutLastFrame;
  const spinOutFinished = !spinningOut && nextRuntime.wasSpinningOutLastFrame;

  if (spinOutJustTriggered) {
    nextRuntime.needsPostFallRealign = true;
  }

  nextRuntime.wasSpinningOutLastFrame = spinningOut;

  const directives = {
    brakeWave: {
      active: brakingToStop,
      justStarted: brakeWaveJustStarted,
      justStopped: brakeWaveJustStopped,
    },
    turn: {
      startLeft: justPressedLeft,
      startRight: justPressedRight,
      leftWeight: nextRuntime.currentTurnLeftWeight,
      rightWeight: nextRuntime.currentTurnRightWeight,
    },
    fall: {
      start: spinOutJustTriggered,
      stop: spinOutFinished,
    },
    idle: {
      weight: spinningOut || brakingToStop ? 0 : 1,
    },
    postFall: {
      realignNow: !spinningOut && nextRuntime.needsPostFallRealign,
    },
    spinOut: rawSpinOut,
  };

  if (directives.postFall.realignNow) {
    nextRuntime.needsPostFallRealign = false;
    nextRuntime.currentTurnLeftWeight = 0;
    nextRuntime.currentTurnRightWeight = 0;
    nextRuntime.targetTurnLeftWeight = 0;
    nextRuntime.targetTurnRightWeight = 0;
  }

  return { directives, nextRuntime };
}
