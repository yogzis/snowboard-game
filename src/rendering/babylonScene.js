import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Mesh,
  TransformNode,
  SceneLoader,
  HDRCubeTexture,
  PBRMaterial,
  Texture,
  ShadowGenerator,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { CONFIG } from "../config.js";

let environmentHelper = null;
let shadowGenerator = null;

/** Generate a procedural heightmap buffer for moguls (repeating bumps along Z with variation). */
function createMogulHeightMapBuffer(width, height) {
  const size = width * height * 4;
  const buffer = new Uint8Array(size);
  const mogulScale = 0.15;
  const mogulFreqZ = 0.25;
  const mogulFreqX = 0.08;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const v = y / (height - 1);
      const bump = Math.sin(v * Math.PI * 2 * 12) * 0.5 + Math.sin(u * Math.PI * 2 * 4) * 0.2;
      const h = 0.5 + mogulScale * bump + (Math.random() - 0.5) * 0.05;
      const byte = Math.max(0, Math.min(255, Math.floor(h * 255)));
      const i = (y * width + x) * 4;
      buffer[i] = byte;
      buffer[i + 1] = byte;
      buffer[i + 2] = byte;
      buffer[i + 3] = 255;
    }
  }
  return buffer;
}

function hexToColor3(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return new Color3(r, g, b);
}

let engine, scene, camera, canvasEl;
let playerRoot, playerMeshContainer, shieldMesh, dynamiteMesh;
/** Character visual: container (procedural) or glTF wrapper when loaded. Used for dispose only; sync is always via playerRoot/playerMeshContainer. */
let characterRoot = null;
/** "procedural" | "gltf" – whether characterRoot is the container or a glTF wrapper (affects dispose). */
let characterMode = "procedural";
let ground;
const obstacleTemplateCache = new Map();
let obstacleIdToMesh = new Map();
let particleIdToMesh = new Map();
let effectIdToMesh = new Map();
let boostTrailIdToMesh = new Map();
let dynamiteSparkIdToMesh = new Map();

/** Procedural body meshes (board, legs, torso, etc.). Replaced by glTF when loaded. */
function createProceduralPlayer(scene, container) {
  const meshes = [];

  const board = MeshBuilder.CreateBox("board", { width: 0.6, height: 0.1, depth: 2.2 }, scene);
  board.position.y = 0.05;
  board.material = new StandardMaterial("boardMat", scene);
  board.material.diffuseColor = hexToColor3(0x333333);
  board.parent = container;
  board.receiveShadows = true;
  meshes.push(board);

  const legMat = new StandardMaterial("legMat", scene);
  legMat.diffuseColor = hexToColor3(CONFIG.colors.pants);
  const leftLeg = MeshBuilder.CreateCylinder("leftLeg", { height: 0.8, diameter: 0.3, tessellation: 8 }, scene);
  leftLeg.position.set(-0.2, 0.5, 0.3);
  leftLeg.rotation.x = -0.2;
  leftLeg.material = legMat;
  leftLeg.parent = container;
  meshes.push(leftLeg);
  const rightLeg = MeshBuilder.CreateCylinder("rightLeg", { height: 0.8, diameter: 0.3, tessellation: 8 }, scene);
  rightLeg.position.set(0.2, 0.5, -0.3);
  rightLeg.rotation.x = 0.2;
  rightLeg.material = legMat;
  rightLeg.parent = container;
  meshes.push(rightLeg);

  const torsoMat = new StandardMaterial("torsoMat", scene);
  torsoMat.diffuseColor = hexToColor3(CONFIG.colors.jacket);
  const torso = MeshBuilder.CreateBox("torso", { width: 0.7, height: 0.9, depth: 0.5 }, scene);
  torso.position.set(0, 1.1, 0);
  torso.material = torsoMat;
  torso.parent = container;
  meshes.push(torso);

  const bagMat = new StandardMaterial("bagMat", scene);
  bagMat.diffuseColor = hexToColor3(CONFIG.colors.backpack);
  const bag = MeshBuilder.CreateBox("bag", { width: 0.5, height: 0.6, depth: 0.3 }, scene);
  bag.position.set(0, 1.2, 0.35);
  bag.material = bagMat;
  bag.parent = container;
  meshes.push(bag);

  const headMat = new StandardMaterial("headMat", scene);
  headMat.diffuseColor = hexToColor3(CONFIG.colors.helmet);
  const head = MeshBuilder.CreateSphere("head", { diameter: 0.5 }, scene);
  head.position.set(0, 1.7, 0);
  head.material = headMat;
  head.parent = container;
  meshes.push(head);

  const goggleMat = new StandardMaterial("goggleMat", scene);
  goggleMat.diffuseColor = hexToColor3(CONFIG.colors.goggles);
  goggleMat.specularPower = 100;
  const goggles = MeshBuilder.CreateBox("goggles", { width: 0.35, height: 0.15, depth: 0.1 }, scene);
  goggles.position.set(0, 1.7, -0.22);
  goggles.material = goggleMat;
  goggles.parent = container;
  meshes.push(goggles);

  const armGeo = MeshBuilder.CreateCylinder("arm", { height: 0.7, diameter: 0.2, tessellation: 8 }, scene);
  const leftArm = armGeo.clone("leftArm");
  leftArm.position.set(-0.45, 1.2, 0);
  leftArm.rotation.z = 0.5;
  leftArm.material = torsoMat;
  leftArm.parent = container;
  meshes.push(leftArm);
  const rightArm = armGeo.clone("rightArm");
  rightArm.position.set(0.45, 1.2, 0);
  rightArm.rotation.z = -0.5;
  rightArm.material = torsoMat;
  rightArm.parent = container;
  meshes.push(rightArm);
  armGeo.dispose();

  return meshes;
}

/** Create player visual: root + container, with procedural body and optional glTF swap later. */
function createPlayerVisual(scene) {
  const root = new Mesh("playerRoot", scene);
  const container = new Mesh("playerContainer", scene);
  container.parent = root;
  root.setEnabled(true);
  root.isVisible = true;
  container.setEnabled(true);
  container.isVisible = true;

  const proceduralBodyMeshes = createProceduralPlayer(scene, container);

  const shieldMat = new StandardMaterial("shieldMat", scene);
  shieldMat.diffuseColor = hexToColor3(CONFIG.colors.shield);
  shieldMat.alpha = 0.3;
  shieldMat.wireframe = true;
  const shield = MeshBuilder.CreateSphere("shield", { diameter: 3 }, scene);
  shield.material = shieldMat;
  shield.isVisible = false;
  shield.parent = container;

  const dynStick = MeshBuilder.CreateCylinder("dynStick", { height: 0.6, diameter: 0.2, tessellation: 16 }, scene);
  dynStick.rotation.z = Math.PI / 2;
  const stickMat = new StandardMaterial("stickMat", scene);
  stickMat.diffuseColor = hexToColor3(0x8B4513);
  stickMat.specularColor = new Color3(0.2, 0.1, 0.05);
  stickMat.specularPower = 48;
  dynStick.material = stickMat;
  dynStick.receiveShadows = true;

  const dynBody = MeshBuilder.CreateCylinder("dynBody", { height: 0.4, diameter: 0.18, tessellation: 12 }, scene);
  dynBody.position.x = 0.35;
  dynBody.rotation.z = Math.PI / 2;
  const bodyMat = new StandardMaterial("dynBodyMat", scene);
  bodyMat.diffuseColor = new Color3(0.92, 0.87, 0.75);
  bodyMat.specularColor = new Color3(0.3, 0.3, 0.3);
  bodyMat.specularPower = 16;
  dynBody.material = bodyMat;
  dynBody.receiveShadows = true;
  dynBody.isVisible = false;

  const dynFuse = MeshBuilder.CreateCylinder("dynFuse", { height: 0.25, diameter: 0.04, tessellation: 8 }, scene);
  dynFuse.position.x = 0.55;
  dynFuse.rotation.z = Math.PI / 2;
  const fuseMat = new StandardMaterial("dynFuseMat", scene);
  fuseMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
  fuseMat.emissiveColor = new Color3(0.15, 0.05, 0.02);
  fuseMat.emissiveIntensity = 0.1;
  dynFuse.material = fuseMat;
  dynFuse.receiveShadows = true;
  dynFuse.isVisible = false;

  const chain = MeshBuilder.CreateCylinder("chain", { height: 1, diameter: 0.04, tessellation: 10 }, scene);
  chain.position.y = 0.5;
  const chainMat = new StandardMaterial("chainMat", scene);
  chainMat.diffuseColor = hexToColor3(0x555555);
  chainMat.specularColor = new Color3(0.4, 0.4, 0.4);
  chainMat.specularPower = 64;
  chain.material = chainMat;
  chain.receiveShadows = true;

  const dynGroup = new Mesh("dynamite", scene);
  dynStick.parent = dynGroup;
  dynBody.parent = dynGroup;
  dynFuse.parent = dynGroup;
  chain.parent = dynGroup;
  dynStick.isVisible = false;
  chain.isVisible = false;
  dynGroup.scaling.set(1.5, 1.5, 1.5);
  dynGroup.position.set(0, 1, 1.6);
  dynGroup.isVisible = false;
  dynGroup.parent = container;

  return { root, container, shieldMesh: shield, dynamiteMesh: dynGroup, proceduralBodyMeshes };
}

/** Load glTF character; on success attach to container and replace procedural body. On failure or no URL, procedural stays. Uses only assets.character (never characterTest). */
function loadCharacterModel(scene, container, proceduralBodyMeshes) {
  const url = (typeof CONFIG.assets?.character === "string" && CONFIG.assets.character !== "") ? CONFIG.assets.character.trim() : "";
  if (!url) return;

  const lastSlash = url.lastIndexOf("/");
  const rootUrl = lastSlash >= 0 ? url.substring(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? url.substring(lastSlash + 1) : url;
  const scale = CONFIG.assets?.characterScale ?? 1;
  const logLoad = CONFIG.debug?.logCharacterLoad;

  const doLoad = () => {
    SceneLoader.ImportMeshAsync(null, rootUrl, filename, scene)
      .then((result) => {
        const hasMeshes = result.meshes && result.meshes.length > 0;
        const hasTransformNodes = result.transformNodes && result.transformNodes.length > 0;
        if (!hasMeshes && !hasTransformNodes) return;

        let loaderRoot;
        if (hasMeshes) {
          const tops = [];
          const addTop = (node) => {
            let n = node;
            while (n && n.parent && n.parent !== scene) n = n.parent;
            if (n && n !== scene) tops.push(n);
          };
          for (const mesh of result.meshes) addTop(mesh);
          for (const node of result.transformNodes || []) addTop(node);
          const uniqueTops = [...new Set(tops)];
          const hasSkeletons = (result.skeletons?.length > 0) || (result.meshes?.some((m) => m.skeleton));
          if (uniqueTops.length === 1) {
            loaderRoot = uniqueTops[0];
          } else {
            loaderRoot = new Mesh("characterGltfRoot", scene);
            for (const top of uniqueTops) top.parent = loaderRoot;
          }
          const firstEmpty = result.meshes[0] && typeof result.meshes[0].getTotalVertices === "function" && result.meshes[0].getTotalVertices() === 0;
          if (!hasSkeletons && firstEmpty && result.meshes.length >= 2 && result.meshes[1].parent) loaderRoot = result.meshes[1].parent;
          if (loaderRoot === scene) {
            const wrap = new Mesh("characterGltfRoot", scene);
            for (const top of uniqueTops) if (top !== scene) top.parent = wrap;
            loaderRoot = wrap;
          }
        } else {
          loaderRoot = result.transformNodes[0];
        }
        if (!loaderRoot) return;

        const applyCharacter = () => {
          try {
            if (!scene.environmentTexture) scene.createDefaultEnvironment({ createGround: false, createSkybox: true });
            if (scene.environmentIntensity === undefined) scene.environmentIntensity = 1;

            const isZeroVertexMesh = loaderRoot.getClassName?.() === "Mesh" && typeof loaderRoot.getTotalVertices === "function" && loaderRoot.getTotalVertices() === 0;
            const root = isZeroVertexMesh ? new TransformNode("characterGltfWrapper", scene) : loaderRoot;
            if (isZeroVertexMesh) loaderRoot.parent = root;

            container.setEnabled(true);
            container.isVisible = true;
            root.parent = container;
            root.position.set(0, 0, 0);
            root.rotation.set(0, 0, 0);
            root.scaling.setAll(scale);
            root.setEnabled(true);
            if ("isVisible" in root) root.isVisible = true;

            const setVisible = (node) => {
              node.setEnabled(true);
              if ("isVisible" in node) node.isVisible = true;
              (node.getChildren?.() ?? []).forEach(setVisible);
            };
            setVisible(root);

            const fromResult = result.meshes || [];
            const childMeshes = (root.getChildMeshes && root.getChildMeshes()) || [];
            const allMeshes = [...fromResult];
            for (const m of childMeshes) if (!allMeshes.includes(m)) allMeshes.push(m);
            const withVerts = allMeshes.filter((m) => typeof m.getTotalVertices === "function" && m.getTotalVertices() > 0);

            let fallbackMat = null;
            for (const mesh of withVerts) {
              if (!mesh.material) {
                if (!fallbackMat) {
                  fallbackMat = new StandardMaterial("characterFallbackMat", scene);
                  fallbackMat.diffuseColor = new Color3(0.5, 0.5, 0.55);
                  fallbackMat.backFaceCulling = false;
                }
                mesh.material = fallbackMat;
              }
              mesh.setEnabled(true);
              mesh.isVisible = true;
              if (mesh.receiveShadows !== undefined) mesh.receiveShadows = true;
              if (typeof mesh.alwaysSelectAsActiveMesh !== "undefined") mesh.alwaysSelectAsActiveMesh = true;
              if (typeof mesh.refreshBoundingInfo === "function") mesh.refreshBoundingInfo();
            }

            if (typeof root.computeWorldMatrix === "function") root.computeWorldMatrix(true);
            if (shadowGenerator) for (const m of withVerts) shadowGenerator.addShadowCaster(m, false);

            proceduralBodyMeshes.forEach((m) => m.dispose());
            characterRoot = root;
            characterMode = "gltf";
            if (logLoad) console.log("[character] glTF applied; root parented to container");
          } catch (e) {
            console.warn("Character apply failed:", e);
            if (loaderRoot && loaderRoot !== scene) loaderRoot.dispose();
          }
        };

        const runApply = () => {
          const envTex = scene.environmentTexture;
          const envReady = !envTex || (typeof envTex.isReady === "function" && envTex.isReady());
          if (envReady) {
            applyCharacter();
          } else if (envTex && envTex.onLoadObservable) {
            envTex.onLoadObservable.addOnce(applyCharacter);
          } else {
            applyCharacter();
          }
        };
        setTimeout(runApply, 0);
      })
      .catch((err) => {
        console.warn("Character model failed to load:", url, err);
      });
  };
  requestAnimationFrame(() => requestAnimationFrame(doLoad));
}

/** Load one obstacle type glTF and store as template (invisible). Used for cloning in createObstacleMesh. */
function loadObstacleTemplate(scene, type) {
  const url = CONFIG.assets?.obstacles?.[type];
  if (!url || typeof url !== "string" || url === "") return;

  const lastSlash = url.lastIndexOf("/");
  const rootUrl = lastSlash >= 0 ? url.substring(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? url.substring(lastSlash + 1) : url;

  SceneLoader.ImportMeshAsync(null, rootUrl, filename, scene)
    .then((result) => {
      if (!result.meshes || result.meshes.length === 0) return;
      const templateRoot = new Mesh("obstacleTemplate_" + type, scene);
      for (const mesh of result.meshes) {
        mesh.parent = templateRoot;
      }
      templateRoot.setEnabled(false);
      templateRoot.isVisible = false;
      obstacleTemplateCache.set(type, templateRoot);
    })
    .catch(() => {
      /* Fallback to procedural in createObstacleMesh */
    });
}

function createBoostArrowLines(scene, material) {
  const arrowGroup = new Mesh("boostArrow", scene);
  const lineDepth = 2.1;
  const lineWidth = 0.28;
  const lineHeight = 0.12;
  const angle = Math.PI / 6;
  const tipZ = -0.4;
  const leftDir = { x: Math.sin(angle), z: Math.cos(angle) };
  const rightDir = { x: -Math.sin(angle), z: Math.cos(angle) };
  const leftCenter = { x: (leftDir.x * lineDepth) / 2, z: tipZ + (leftDir.z * lineDepth) / 2 };
  const rightCenter = { x: (rightDir.x * lineDepth) / 2, z: tipZ + (rightDir.z * lineDepth) / 2 };
  const leftLine = MeshBuilder.CreateBox("arrowLeft", { width: lineWidth, height: lineHeight, depth: lineDepth }, scene);
  leftLine.position.set(leftCenter.x, 0, leftCenter.z);
  leftLine.rotation.y = angle;
  leftLine.material = material;
  leftLine.parent = arrowGroup;
  const rightLine = MeshBuilder.CreateBox("arrowRight", { width: lineWidth, height: lineHeight, depth: lineDepth }, scene);
  rightLine.position.set(rightCenter.x, 0, rightCenter.z);
  rightLine.rotation.y = -angle;
  rightLine.material = material;
  rightLine.parent = arrowGroup;
  return arrowGroup;
}

const OBSTACLE_SCALE = { tree: 1.2, rock: 1.2, box: 1.0, ramp: 1.0 };

function createObstacleMesh(ob, scene) {
  const { type, position, rotation, userData } = ob;
  const root = new Mesh("obstacle_" + ob.id, scene);
  root.position.set(position.x, position.y, position.z);
  root.rotation.set(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0);
  root.metadata = { id: ob.id, type, userData };

  const template = obstacleTemplateCache.get(type);
  if (template && (type === "tree" || type === "rock" || type === "box" || type === "ramp")) {
    const clone = template.clone("ob_" + ob.id + "_" + type, root);
    if (clone) {
      clone.setEnabled(true);
      clone.isVisible = true;
      clone.position.set(0, 0, 0);
      const scale = OBSTACLE_SCALE[type] ?? 1;
      clone.scaling.setAll(scale);
      clone.receiveShadows = true;
      for (const child of clone.getChildMeshes()) {
        child.receiveShadows = true;
      }
    }
    return root;
  }

  if (type === "tree") {
    const trunk = MeshBuilder.CreateCylinder("trunk", { height: 1, diameterTop: 0.4, diameterBottom: 0.6, tessellation: 6 }, scene);
    trunk.position.y = 0.5;
    trunk.material = new StandardMaterial("trunkMat", scene);
    trunk.material.diffuseColor = hexToColor3(0x5d4037);
    trunk.parent = root;
    const leafMat = new StandardMaterial("leafMat", scene);
    leafMat.diffuseColor = hexToColor3(CONFIG.colors.tree);
    const b1 = MeshBuilder.CreateCylinder("b1", { height: 2, diameterTop: 0, diameterBottom: 3, tessellation: 6 }, scene);
    b1.position.y = 1.5;
    b1.material = leafMat;
    b1.parent = root;
    const b2 = MeshBuilder.CreateCylinder("b2", { height: 1.5, diameterTop: 0, diameterBottom: 2.4, tessellation: 6 }, scene);
    b2.position.y = 2.5;
    b2.material = leafMat;
    b2.parent = root;
  } else if (type === "rock") {
    const rock = MeshBuilder.CreateSphere("rock", { diameter: 0.8 }, scene);
    rock.position.y = 0.4;
    rock.material = new StandardMaterial("rockMat", scene);
    rock.material.diffuseColor = hexToColor3(CONFIG.colors.rock);
    rock.parent = root;
  } else if (type === "boost") {
    const pad = MeshBuilder.CreateGround("pad", { width: 2, height: 6 }, scene);
    pad.position.y = 0.05;
    pad.rotation.x = 0;
    pad.material = new StandardMaterial("padMat", scene);
    pad.material.diffuseColor = hexToColor3(CONFIG.colors.boost);
    pad.parent = root;
    const arrowMat = new StandardMaterial("arrowMat", scene);
    arrowMat.diffuseColor = new Color3(1, 1, 1);
    arrowMat.alpha = 1;
    const arrowMeshes = [];
    const numArrows = 4;
    for (let i = 0; i < numArrows; i++) {
      const arrow = createBoostArrowLines(scene, arrowMat);
      arrow.position.y = 0.06;
      arrow.parent = root;
      arrowMeshes.push(arrow);
    }
    root.metadata.arrowMeshes = arrowMeshes;
  } else if (type === "box") {
    const box = MeshBuilder.CreateBox("box", { size: 1.5 }, scene);
    box.material = new StandardMaterial("boxMat", scene);
    box.material.diffuseColor = hexToColor3(CONFIG.colors.box);
    box.material.specularPower = 100;
    box.parent = root;
  } else if (type === "ramp") {
    const ramp = MeshBuilder.CreateBox("ramp", { width: 2, height: 0.5, depth: 4 }, scene);
    ramp.material = new StandardMaterial("rampMat", scene);
    ramp.material.diffuseColor = hexToColor3(CONFIG.colors.ramp);
    ramp.parent = root;
  }
  root.receiveShadows = true;
  for (const child of root.getChildMeshes()) child.receiveShadows = true;
  return root;
}

function createParticleMesh(scene, position, color) {
  const mesh = MeshBuilder.CreateBox("particle", { size: 0.1 }, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = new StandardMaterial("pMat", scene);
  mesh.material.diffuseColor = hexToColor3(color);
  return mesh;
}

function createRingMesh(scene, position, inner, outer, color) {
  const ring = MeshBuilder.CreateTorus("ring", { diameter: outer * 2, thickness: outer - inner, tessellation: 32 }, scene);
  ring.rotation.x = Math.PI / 2;
  const mat = new StandardMaterial("ringMat", scene);
  mat.diffuseColor = hexToColor3(color);
  mat.alpha = 0.8;
  mat.backFaceCulling = false;
  ring.material = mat;
  ring.position.set(position.x, position.y, position.z);
  return ring;
}

function createBoostTrailMesh(scene, position, angle) {
  const mesh = MeshBuilder.CreateGround("trail", { width: 0.8, height: 2 }, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.y = angle;
  mesh.material = new StandardMaterial("trailMat", scene);
  mesh.material.diffuseColor = hexToColor3(0xadff2f);
  mesh.material.alpha = 0.7;
  mesh.material.backFaceCulling = false;
  return mesh;
}

function createDynamiteSparkMesh(scene, position, color) {
  const mesh = MeshBuilder.CreateSphere("spark", { diameter: 0.1 }, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = new StandardMaterial("sparkMat", scene);
  mesh.material.diffuseColor = hexToColor3(color);
  mesh.material.alpha = 1;
  return mesh;
}

export function init(container) {
  canvasEl = document.createElement("canvas");
  canvasEl.width = window.innerWidth;
  canvasEl.height = window.innerHeight;
  canvasEl.style.position = "absolute";
  canvasEl.style.top = "0";
  canvasEl.style.left = "0";
  canvasEl.style.width = "100%";
  canvasEl.style.height = "100%";
  canvasEl.style.zIndex = "1";
  canvasEl.style.pointerEvents = "none";
  container.appendChild(canvasEl);

  engine = new Engine(canvasEl, true, { preserveDrawingBuffer: true, stencil: true });
  scene = new Scene(engine);
  const skyColor = hexToColor3(CONFIG.colors.sky);
  scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 20;
  scene.fogEnd = 120;
  scene.fogColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);

  camera = new ArcRotateCamera("camera", 0, 0, 0, Vector3.Zero(), scene);
  camera.setPosition(new Vector3(0, 6, 12));
  camera.setTarget(Vector3.Zero());

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene, 0.6);
  const dirLight = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
  dirLight.position = new Vector3(10, 20, 10);
  dirLight.intensity = 0.8;

  shadowGenerator = new ShadowGenerator(1024, dirLight);
  shadowGenerator.useBlurExponentialShadowMap = false;
  shadowGenerator.useCloseExponentialShadowMap = true;

  const skyUrl = CONFIG.assets?.sky;
  if (skyUrl && typeof skyUrl === "string" && skyUrl !== "") {
    try {
      const hdrTexture = new HDRCubeTexture(skyUrl, scene, 128, false, true, false, true);
      scene.environmentTexture = hdrTexture;
      scene.createDefaultSkybox(hdrTexture, true, 500, 0, false);
    } catch (_) {
      environmentHelper = scene.createDefaultEnvironment({ createGround: false, createSkybox: true });
    }
  } else {
    environmentHelper = scene.createDefaultEnvironment({ createGround: false, createSkybox: true });
  }
  if (scene.environmentIntensity === undefined) scene.environmentIntensity = 1;

  let groundMesh;
  try {
    const heightMapRes = 128;
    const heightMapBuffer = createMogulHeightMapBuffer(heightMapRes, heightMapRes);
    groundMesh = MeshBuilder.CreateGroundFromHeightMap(
      "ground",
      { data: heightMapBuffer, width: heightMapRes, height: heightMapRes },
      {
        width: 200,
        height: 200,
        subdivisions: heightMapRes - 1,
        minHeight: -0.5,
        maxHeight: 0.5,
      },
      scene
    );
    if (!groundMesh || (typeof groundMesh.getTotalVertices === "function" && groundMesh.getTotalVertices() === 0)) {
      throw new Error("Empty ground geometry");
    }
    const snowMat = new PBRMaterial("groundMat", scene);
    snowMat.albedoColor = hexToColor3(CONFIG.colors.snow);
    snowMat.metallic = 0;
    snowMat.roughness = 0.95;
    const snowAlbedoUrl = CONFIG.assets?.terrain?.snowAlbedo;
    if (snowAlbedoUrl && typeof snowAlbedoUrl === "string" && snowAlbedoUrl !== "") {
      snowMat.albedoTexture = new Texture(snowAlbedoUrl, scene);
      const snowNormalUrl = CONFIG.assets?.terrain?.snowNormal;
      if (snowNormalUrl && typeof snowNormalUrl === "string" && snowNormalUrl !== "") {
        snowMat.bumpTexture = new Texture(snowNormalUrl, scene);
      }
    }
    groundMesh.material = snowMat;
    groundMesh.receiveShadows = true;
    groundMesh.isVisible = true;
  } catch (_) {
    groundMesh = MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    const snowMat = new StandardMaterial("groundMat", scene);
    snowMat.diffuseColor = hexToColor3(CONFIG.colors.snow);
    groundMesh.material = snowMat;
    groundMesh.receiveShadows = true;
  }
  ground = groundMesh;
  ground.isVisible = true;

  const player = createPlayerVisual(scene);
  playerRoot = player.root;
  playerMeshContainer = player.container;
  characterRoot = playerMeshContainer;
  characterMode = "procedural";
  shieldMesh = player.shieldMesh;
  dynamiteMesh = player.dynamiteMesh;
  dynamiteMesh.isVisible = false;
  scene.addMesh(playerRoot);
  if (shadowGenerator) shadowGenerator.addShadowCaster(playerRoot, true);

  loadCharacterModel(scene, playerMeshContainer, player.proceduralBodyMeshes);

  // Defer obstacle template loads so the first rAF stays under the 50ms threshold.
  requestAnimationFrame(() => {
    ["tree", "rock", "box", "ramp"].forEach((t) => loadObstacleTemplate(scene, t));
  });

  return { getCanvas: () => canvasEl };
}

export function syncFromState(state) {
  const p = state.player;
  const pos = p.position;
  playerRoot.position.set(pos.x, pos.y, pos.z);
  playerRoot.rotation.set(state.playerRotationX ?? 0, 0, 0);
  playerMeshContainer.rotation.x = p.leanBack;
  playerMeshContainer.rotation.y = p.angle;
  playerMeshContainer.rotation.z = -p.angle * 0.3;

  ground.position.set(state.world.groundX, 0, state.world.groundZ);

  const currentObIds = new Set(state.obstacles.map((o) => o.id));
  for (const [id, mesh] of obstacleIdToMesh) {
    if (!currentObIds.has(id)) {
      mesh.dispose();
      obstacleIdToMesh.delete(id);
    }
  }
  for (const ob of state.obstacles) {
    let mesh = obstacleIdToMesh.get(ob.id);
    if (!mesh) {
      mesh = createObstacleMesh(ob, scene);
      obstacleIdToMesh.set(ob.id, mesh);
      if (shadowGenerator) shadowGenerator.addShadowCaster(mesh, true);
    }
    mesh.position.set(ob.position.x, ob.position.y, ob.position.z);
    mesh.rotation.set(ob.rotation.x, ob.rotation.y, ob.rotation.z);
    if (ob.type === "boost" && mesh.metadata?.arrowMeshes) {
      const opacity = 0.65 + 0.35 * Math.sin(ob.arrowPhase ?? 0);
      const alpha = Math.max(0.5, Math.min(1, opacity));
      const phase = ob.arrowZ ?? 0;
      const trackLen = 6;
      for (let i = 0; i < mesh.metadata.arrowMeshes.length; i++) {
        const arrowMesh = mesh.metadata.arrowMeshes[i];
        const z = ((phase + i * 3) % trackLen + trackLen) % trackLen - trackLen / 2;
        arrowMesh.position.z = z;
        for (const child of arrowMesh.getChildMeshes()) {
          if (child.material) child.material.alpha = alpha;
        }
      }
    }
  }

  shieldMesh.isVisible = state.playerStats.invincibleTimer > 0;
  if (shieldMesh.isVisible) {
    const pulseTime = state.visuals.shieldPulseTime;
    if (pulseTime > 0) {
      shieldMesh.scaling.setAll(1 + 0.3 * (pulseTime / 0.25));
    } else {
      shieldMesh.scaling.setAll(1);
    }
    shieldMesh.material.alpha = state.visuals.shieldOpacity ?? 0.3;
  }
  const showDynamite = Boolean(state.playerStats?.hasDynamite);
  dynamiteMesh.isVisible = showDynamite;
  for (const child of dynamiteMesh.getChildMeshes()) {
    child.isVisible = showDynamite;
  }

  const particleIds = new Set(state.particles.map((x) => x.id));
  for (const [id, mesh] of particleIdToMesh) {
    if (!particleIds.has(id)) {
      mesh.dispose();
      particleIdToMesh.delete(id);
    }
  }
  for (const pt of state.particles) {
    let mesh = particleIdToMesh.get(pt.id);
    if (!mesh) {
      mesh = createParticleMesh(scene, pt.position, pt.color);
      particleIdToMesh.set(pt.id, mesh);
    }
    mesh.position.set(pt.position.x, pt.position.y, pt.position.z);
    mesh.scaling.setAll(pt.life);
  }

  const effectIds = new Set(state.effects.map((e) => e.id));
  for (const [id, mesh] of effectIdToMesh) {
    if (!effectIds.has(id)) {
      mesh.dispose();
      effectIdToMesh.delete(id);
    }
  }
  for (const e of state.effects) {
    let mesh = effectIdToMesh.get(e.id);
    if (!mesh) {
      mesh = createRingMesh(scene, e.position, e.inner ?? 1, e.outer ?? 1.5, e.color ?? 0xffff00);
      effectIdToMesh.set(e.id, mesh);
    }
    mesh.scaling.setAll(e.scale);
    mesh.material.alpha = e.opacity;
    mesh.lookAt(camera.position);
  }

  const boostIds = new Set(state.boostTrail.map((b) => b.id));
  for (const [id, mesh] of boostTrailIdToMesh) {
    if (!boostIds.has(id)) {
      mesh.dispose();
      boostTrailIdToMesh.delete(id);
    }
  }
  for (const mark of state.boostTrail) {
    let mesh = boostTrailIdToMesh.get(mark.id);
    if (!mesh) {
      mesh = createBoostTrailMesh(scene, mark.position, mark.angle ?? 0);
      boostTrailIdToMesh.set(mark.id, mesh);
    }
    mesh.material.alpha = mark.life * 0.7;
  }

  const sparkIds = new Set(state.dynamiteSparks.map((s) => s.id));
  const sparkColors = [0xff6600, 0xff3300, 0xffaa00];
  for (const [id, mesh] of dynamiteSparkIdToMesh) {
    if (!sparkIds.has(id)) {
      mesh.dispose();
      dynamiteSparkIdToMesh.delete(id);
    }
  }
  for (const s of state.dynamiteSparks) {
    let mesh = dynamiteSparkIdToMesh.get(s.id);
    if (!mesh) {
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      mesh = createDynamiteSparkMesh(scene, s.position, color);
      dynamiteSparkIdToMesh.set(s.id, mesh);
    }
    mesh.position.set(s.position.x, s.position.y, s.position.z);
    mesh.material.alpha = s.life;
  }

  const cam = state.camera.position;
  const look = state.camera.lookAt;
  camera.setPosition(new Vector3(cam.x, cam.y, cam.z));
  camera.setTarget(new Vector3(look.x, look.y, look.z));
}

export function render() {
  if (scene) scene.render();
}

export function resize(width, height) {
  if (!engine || !canvasEl) return;
  canvasEl.width = width;
  canvasEl.height = height;
  engine.resize();
}

export function dispose() {
  if (characterMode === "gltf" && characterRoot) {
    characterRoot.dispose();
    characterRoot = null;
    characterMode = "procedural";
  }
  if (environmentHelper) {
    environmentHelper.dispose();
    environmentHelper = null;
  }
  shadowGenerator = null;
  for (const template of obstacleTemplateCache.values()) {
    template.dispose();
  }
  obstacleTemplateCache.clear();
  for (const mesh of obstacleIdToMesh.values()) mesh.dispose();
  obstacleIdToMesh.clear();
  for (const mesh of particleIdToMesh.values()) mesh.dispose();
  particleIdToMesh.clear();
  for (const mesh of effectIdToMesh.values()) mesh.dispose();
  effectIdToMesh.clear();
  for (const mesh of boostTrailIdToMesh.values()) mesh.dispose();
  boostTrailIdToMesh.clear();
  for (const mesh of dynamiteSparkIdToMesh.values()) mesh.dispose();
  dynamiteSparkIdToMesh.clear();
}
