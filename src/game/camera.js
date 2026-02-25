import { REF_FPS } from "./state.js";

export function updateCamera(dt, state) {
  const pos = state.player.position;
  state.camera.targetX = pos.x;
  state.camera.targetZ = pos.z + 8;
  let shakeX = 0, shakeY = 0;
  if (state.cameraShake.intensity > 0) {
    shakeX = (Math.random() - 0.5) * state.cameraShake.intensity;
    shakeY = (Math.random() - 0.5) * state.cameraShake.intensity;
    state.cameraShake.intensity *= Math.pow(0.9, dt * REF_FPS);
    if (state.cameraShake.intensity < 0.01) state.cameraShake.intensity = 0;
  }
  const cam = state.camera.position;
  cam.x += (state.camera.targetX - cam.x) * 0.1 * dt * REF_FPS + shakeX;
  cam.z = state.camera.targetZ;
  cam.y = pos.y + 5 + shakeY;
  state.camera.lookAt.x = pos.x;
  state.camera.lookAt.y = pos.y;
  state.camera.lookAt.z = pos.z - 5;
}
