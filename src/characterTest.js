/**
 * Standalone glTF viewer for pipeline testing. Loads duck or snowboarder via ?model=duck|snowboarder.
 * Default model follows CONFIG.assets.characterTest when present (snowboarder vs duck).
 */
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  SceneLoader,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { CONFIG } from "./config.js";

const canvas = document.getElementById("render-canvas");
if (!canvas) throw new Error("Missing #render-canvas");

const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor.set(0.2, 0.4, 0.6, 1);

// PBR environment so snowboarder (and other PBR glTFs) render correctly
if (!scene.environmentTexture) {
  scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
}
if (scene.environmentIntensity === undefined) scene.environmentIntensity = 1;

const camera = new ArcRotateCamera(
  "camera",
  -Math.PI / 2,
  Math.PI / 2.5,
  8,
  Vector3.Zero(),
  scene
);
camera.attachControl(canvas, true);

new HemisphericLight(
  "light1",
  new Vector3(0, 1, 0),
  scene
);

const params = new URLSearchParams(window.location.search);
const configTest = CONFIG.assets?.characterTest || "";
const defaultFromConfig = (typeof configTest === "string" && configTest.indexOf("snowboarder") !== -1) ? "snowboarder" : "duck";
const model = params.get("model") || defaultFromConfig;
const path = model === "snowboarder"
  ? "/assets/character/snowboarder.glb"
  : "/assets/character/duck.glb";
const lastSlash = path.lastIndexOf("/");
const rootUrl = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "";
const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;

function getTopLevelRoot(result) {
  if (!result.meshes || !result.meshes.length) return result.transformNodes?.[0] || null;
  const tops = [];
  const addTop = (node) => {
    let n = node;
    while (n && n.parent && n.parent !== scene) n = n.parent;
    if (n && n !== scene) tops.push(n);
  };
  for (const mesh of result.meshes) addTop(mesh);
  for (const node of result.transformNodes || []) addTop(node);
  const unique = [...new Set(tops)];
  const hasSkeletons = (result.skeletons?.length > 0) || (result.meshes?.some((m) => m.skeleton));
  if (unique.length === 1) return unique[0];
  const firstEmpty = result.meshes[0]?.getTotalVertices?.() === 0;
  if (!hasSkeletons && firstEmpty && result.meshes.length >= 2 && result.meshes[1].parent)
    return result.meshes[1].parent;
  return unique[0] || null;
}

function getWorldBounds(meshes) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const tmp = new Vector3();
  for (const mesh of meshes) {
    const info = mesh.getBoundingInfo?.();
    if (!info) continue;
    const m = mesh.getWorldMatrix();
    for (const p of [info.boundingBox.minimum, info.boundingBox.maximum]) {
      Vector3.TransformCoordinatesToRef(p, m, tmp);
      minX = Math.min(minX, tmp.x); minY = Math.min(minY, tmp.y); minZ = Math.min(minZ, tmp.z);
      maxX = Math.max(maxX, tmp.x); maxY = Math.max(maxY, tmp.y); maxZ = Math.max(maxZ, tmp.z);
    }
  }
  if (minX === Infinity) return null;
  return {
    min: new Vector3(minX, minY, minZ),
    max: new Vector3(maxX, maxY, maxZ),
    center: new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    size: Math.max(maxX - minX, maxY - minY, maxZ - minZ),
  };
}

const TARGET_SIZE = 2.5;

SceneLoader.ImportMeshAsync(null, rootUrl, filename, scene)
  .then((result) => {
    if (!result.meshes?.length && !result.transformNodes?.length) return;
    const parent = getTopLevelRoot(result);
    if (!parent) return;
    parent.position.set(0, 0, 0);
    parent.rotation.set(0, 0, 0);
    parent.scaling.setAll(1);
    const meshes = result.meshes || [];
    const withVerts = meshes.filter((m) => typeof m.getTotalVertices === "function" && m.getTotalVertices() > 0);
    scene.onReadyObservable.addOnce(() => {
      if (withVerts.length) {
        if (typeof parent.computeWorldMatrix === "function") parent.computeWorldMatrix(true);
        const bounds = getWorldBounds(withVerts);
        if (bounds && bounds.size > 0) {
          parent.position.copyFrom(bounds.center).scaleInPlace(-1);
          const scale = TARGET_SIZE / bounds.size;
          parent.scaling.setAll(scale);
          if (typeof parent.computeWorldMatrix === "function") parent.computeWorldMatrix(true);
          camera.setTarget(Vector3.Zero());
        } else {
          const first = withVerts[0];
          if (first?.getBoundingInfo) {
            const b = first.getBoundingInfo();
            if (b) camera.setTarget(b.boundingBox.center);
          }
        }
      }
    });
  })
  .catch((err) => console.warn("glTF load failed:", err));

engine.runRenderLoop(() => scene.render());

window.addEventListener("resize", () => engine.resize());
