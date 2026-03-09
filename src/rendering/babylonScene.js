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
  Matrix,
  Quaternion,
  AnimationGroupMask,
  AnimationGroupMaskMode,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { CONFIG, hexToRgb } from "../config.js";
import {
  CHARACTER_ANIMATION_CONFIG,
  createInitialAnimationRuntime,
  deriveCharacterAnimationDirectives,
} from "../game/characterAnimations.js";

let environmentHelper = null;
let skyboxMesh = null;
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
      const bump =
        Math.sin(v * Math.PI * 2 * 12) * 0.5 +
        Math.sin(u * Math.PI * 2 * 4) * 0.2;
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
  const { r, g, b } = hexToRgb(hex);
  return new Color3(r, g, b);
}

let engine, scene, camera, canvasEl;
let playerRoot, playerMeshContainer, shieldMesh, dynamiteMesh, glideSurfaceMesh;
let glideSurfaceOpacity = 0;
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
/** Cache of original colors for glTF character meshes when applying glide tint (restore when hasGlide becomes false). Key = material, value = { diffuseColor?, albedoColor? }. */
let glideOriginalColors = new Map();

/** Animation groups from the character GLB (set when glTF is applied). */
let characterAnimationGroups = [];
/** Reference to the "Idle" animation group, or null if not found. */
let idleAnimationGroup = null;
/** Reference to the "Turn_Left" animation group, or null if not found. */
let turnLeftAnimationGroup = null;
/** Reference to the "Turn_Right" animation group, or null if not found. */
let turnRightAnimationGroup = null;
/** Reference to the "Fall" animation group, or null if not found. */
let fallAnimationGroup = null;
/** Reference to the brake-wave animation group (e.g. Start_Wave), or null if not found. */
let brakeWaveAnimationGroup = null;
/** One-time warn when brake-wave is requested but clip is missing. */
let brakeWaveMissingWarned = false;
/** Runtime state for animation decisions, shared across frames. */
let characterAnimationRuntime = createInitialAnimationRuntime();

/** Procedural body meshes (board, legs, torso, etc.). Replaced by glTF when loaded. */
function createProceduralPlayer(scene, container) {
  const meshes = [];

  const board = MeshBuilder.CreateBox(
    "board",
    { width: 0.6, height: 0.1, depth: 2.2 },
    scene,
  );
  board.position.y = 0.05;
  board.material = new StandardMaterial("boardMat", scene);
  board.material.diffuseColor = hexToColor3(0x333333);
  board.parent = container;
  board.receiveShadows = true;
  meshes.push(board);

  const legMat = new StandardMaterial("legMat", scene);
  legMat.diffuseColor = hexToColor3(CONFIG.colors.pants);
  const leftLeg = MeshBuilder.CreateCylinder(
    "leftLeg",
    { height: 0.8, diameter: 0.3, tessellation: 8 },
    scene,
  );
  leftLeg.position.set(-0.2, 0.5, 0.3);
  leftLeg.rotation.x = -0.2;
  leftLeg.material = legMat;
  leftLeg.parent = container;
  meshes.push(leftLeg);
  const rightLeg = MeshBuilder.CreateCylinder(
    "rightLeg",
    { height: 0.8, diameter: 0.3, tessellation: 8 },
    scene,
  );
  rightLeg.position.set(0.2, 0.5, -0.3);
  rightLeg.rotation.x = 0.2;
  rightLeg.material = legMat;
  rightLeg.parent = container;
  meshes.push(rightLeg);

  const torsoMat = new StandardMaterial("torsoMat", scene);
  torsoMat.diffuseColor = hexToColor3(CONFIG.colors.jacket);
  const torso = MeshBuilder.CreateBox(
    "torso",
    { width: 0.7, height: 0.9, depth: 0.5 },
    scene,
  );
  torso.position.set(0, 1.1, 0);
  torso.material = torsoMat;
  torso.parent = container;
  meshes.push(torso);

  const bagMat = new StandardMaterial("bagMat", scene);
  bagMat.diffuseColor = hexToColor3(CONFIG.colors.backpack);
  const bag = MeshBuilder.CreateBox(
    "bag",
    { width: 0.5, height: 0.6, depth: 0.3 },
    scene,
  );
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
  const goggles = MeshBuilder.CreateBox(
    "goggles",
    { width: 0.35, height: 0.15, depth: 0.1 },
    scene,
  );
  goggles.position.set(0, 1.7, -0.22);
  goggles.material = goggleMat;
  goggles.parent = container;
  meshes.push(goggles);

  const armGeo = MeshBuilder.CreateCylinder(
    "arm",
    { height: 0.7, diameter: 0.2, tessellation: 8 },
    scene,
  );
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

  const glideSurface = MeshBuilder.CreateDisc(
    "glideSurface",
    { radius: 1, tessellation: 32 },
    scene,
  );
  glideSurface.rotation.x = Math.PI / 2;
  const glideSurfaceMat = new StandardMaterial("glideSurfaceMat", scene);
  glideSurfaceMat.diffuseColor = hexToColor3(
    CONFIG.colors?.glideSurface ?? 0x20b2aa,
  );
  glideSurface.material = glideSurfaceMat;
  glideSurface.position.y = 0;
  glideSurface.scaling.x = 1.2;
  glideSurface.scaling.z = 0.8;
  glideSurface.isVisible = false;
  glideSurface.parent = container;

  const dynStick = MeshBuilder.CreateCylinder(
    "dynStick",
    { height: 0.6, diameter: 0.2, tessellation: 16 },
    scene,
  );
  dynStick.rotation.z = Math.PI / 2;
  const stickMat = new StandardMaterial("stickMat", scene);
  stickMat.diffuseColor = hexToColor3(0x8b4513);
  stickMat.specularColor = new Color3(0.2, 0.1, 0.05);
  stickMat.specularPower = 48;
  dynStick.material = stickMat;
  dynStick.receiveShadows = true;

  const dynBody = MeshBuilder.CreateCylinder(
    "dynBody",
    { height: 0.4, diameter: 0.18, tessellation: 12 },
    scene,
  );
  dynBody.position.x = 0.35;
  dynBody.rotation.z = Math.PI / 2;
  const bodyMat = new StandardMaterial("dynBodyMat", scene);
  bodyMat.diffuseColor = new Color3(0.92, 0.87, 0.75);
  bodyMat.specularColor = new Color3(0.3, 0.3, 0.3);
  bodyMat.specularPower = 16;
  dynBody.material = bodyMat;
  dynBody.receiveShadows = true;
  dynBody.isVisible = false;

  const dynFuse = MeshBuilder.CreateCylinder(
    "dynFuse",
    { height: 0.25, diameter: 0.04, tessellation: 8 },
    scene,
  );
  dynFuse.position.x = 0.55;
  dynFuse.rotation.z = Math.PI / 2;
  const fuseMat = new StandardMaterial("dynFuseMat", scene);
  fuseMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
  fuseMat.emissiveColor = new Color3(0.15, 0.05, 0.02);
  fuseMat.emissiveIntensity = 0.1;
  dynFuse.material = fuseMat;
  dynFuse.receiveShadows = true;
  dynFuse.isVisible = false;

  const chain = MeshBuilder.CreateCylinder(
    "chain",
    { height: 1, diameter: 0.04, tessellation: 10 },
    scene,
  );
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

  return {
    root,
    container,
    shieldMesh: shield,
    dynamiteMesh: dynGroup,
    glideSurfaceMesh: glideSurface,
    proceduralBodyMeshes,
  };
}

/** Load glTF character; on success attach to container and replace procedural body. On failure or no URL, procedural stays. Uses only assets.character (never characterTest). */
function loadCharacterModel(scene, container, proceduralBodyMeshes) {
  const url =
    typeof CONFIG.assets?.character === "string" &&
    CONFIG.assets.character !== ""
      ? CONFIG.assets.character.trim()
      : "";
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
        const hasTransformNodes =
          result.transformNodes && result.transformNodes.length > 0;
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
          const hasSkeletons =
            result.skeletons?.length > 0 ||
            result.meshes?.some((m) => m.skeleton);
          if (uniqueTops.length === 1) {
            loaderRoot = uniqueTops[0];
          } else {
            loaderRoot = new Mesh("characterGltfRoot", scene);
            for (const top of uniqueTops) top.parent = loaderRoot;
          }
          const firstEmpty =
            result.meshes[0] &&
            typeof result.meshes[0].getTotalVertices === "function" &&
            result.meshes[0].getTotalVertices() === 0;
          if (
            !hasSkeletons &&
            firstEmpty &&
            result.meshes.length >= 2 &&
            result.meshes[1].parent
          )
            loaderRoot = result.meshes[1].parent;
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
            characterAnimationGroups = result.animationGroups || [];
            const clips = CHARACTER_ANIMATION_CONFIG.clips;
            idleAnimationGroup =
              characterAnimationGroups.find((ag) => ag.name === clips.idle) ??
              null;
            turnLeftAnimationGroup =
              characterAnimationGroups.find(
                (ag) => ag.name === clips.turnLeft,
              ) ?? null;
            turnRightAnimationGroup =
              characterAnimationGroups.find(
                (ag) => ag.name === clips.turnRight,
              ) ?? null;
            fallAnimationGroup =
              characterAnimationGroups.find((ag) => ag.name === clips.fall) ??
              null;
            brakeWaveMissingWarned = false;
            brakeWaveAnimationGroup =
              (clips.brakeWave &&
                characterAnimationGroups.find(
                  (ag) => ag.name === clips.brakeWave,
                )) ??
              null;
            if (!brakeWaveAnimationGroup && clips.brakeWave) {
              const used = new Set([
                clips.idle,
                clips.turnLeft,
                clips.turnRight,
                clips.fall,
              ]);
              brakeWaveAnimationGroup =
                characterAnimationGroups.find(
                  (ag) => ag && !used.has(ag.name) && /wave/i.test(ag.name),
                ) ?? null;
              if (logLoad && brakeWaveAnimationGroup) {
                console.warn(
                  "[character] brakeWave clip not found as",
                  clips.brakeWave,
                  "; using",
                  brakeWaveAnimationGroup.name,
                );
              }
            }
            if (logLoad && characterAnimationGroups.length > 0) {
              console.log(
                "[character] animation names:",
                characterAnimationGroups.map((ag) => ag.name),
              );
            }
            // Configure animation blending and initial weights
            const configureGroup = (group, initialWeight) => {
              if (!group) return;
              try {
                if ("enableBlending" in group) group.enableBlending = true;
                if ("blendingSpeed" in group && group.blendingSpeed == null)
                  group.blendingSpeed = 0.1;
                if (typeof group.setWeightForAllAnimatables === "function")
                  group.setWeightForAllAnimatables(initialWeight);
              } catch {
                // Best-effort; ignore if this Babylon version differs
              }
            };

            // Idle is the base layer, turn animations are overlays starting at 0 weight (one-shot on keydown).
            // When config maps multiple slots to the same clip (e.g. idle and turnLeft both "Turn_Left"),
            // set each unique group once to the max weight across the slots that use it.
            const uniqueGroups = new Set(
              [
                idleAnimationGroup,
                turnLeftAnimationGroup,
                turnRightAnimationGroup,
                fallAnimationGroup,
                brakeWaveAnimationGroup,
              ].filter(Boolean),
            );
            for (const group of uniqueGroups) {
              let initialWeight = 0;
              if (group === idleAnimationGroup) initialWeight = 1;
              configureGroup(group, initialWeight);
            }
            if (
              turnLeftAnimationGroup &&
              "loopAnimation" in turnLeftAnimationGroup
            )
              turnLeftAnimationGroup.loopAnimation = false;
            if (
              turnRightAnimationGroup &&
              "loopAnimation" in turnRightAnimationGroup
            )
              turnRightAnimationGroup.loopAnimation = false;
            if (
              brakeWaveAnimationGroup &&
              "loopAnimation" in brakeWaveAnimationGroup
            )
              brakeWaveAnimationGroup.loopAnimation = true;

            // Stop and zero weight for any other groups so only our clips run.
            const controlledNames = new Set(
              Object.values(CHARACTER_ANIMATION_CONFIG.clips),
            );
            for (const ag of characterAnimationGroups) {
              if (!ag || controlledNames.has(ag.name)) continue;
              try {
                if (typeof ag.setWeightForAllAnimatables === "function")
                  ag.setWeightForAllAnimatables(0);
                if (typeof ag.stop === "function") ag.stop();
              } catch {
                // Best-effort
              }
            }

            if (!scene.environmentTexture)
              scene.createDefaultEnvironment({
                createGround: false,
                createSkybox: true,
              });
            if (scene.environmentIntensity === undefined)
              scene.environmentIntensity = 1;

            const isZeroVertexMesh =
              loaderRoot.getClassName?.() === "Mesh" &&
              typeof loaderRoot.getTotalVertices === "function" &&
              loaderRoot.getTotalVertices() === 0;
            const root = isZeroVertexMesh
              ? new TransformNode("characterGltfWrapper", scene)
              : loaderRoot;
            if (isZeroVertexMesh) loaderRoot.parent = root;

            container.setEnabled(true);
            container.isVisible = true;
            root.parent = container;
            root.position.set(0, 0, 0);
            root.rotation.set(0, 0, 0);
            // The snowboarder model faces the opposite direction compared to our
            // gameplay coordinates, so rotate it 180° around Y once here.
            root.rotation.y = Math.PI;
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
            const childMeshes =
              (root.getChildMeshes && root.getChildMeshes()) || [];
            const allMeshes = [...fromResult];
            for (const m of childMeshes)
              if (!allMeshes.includes(m)) allMeshes.push(m);
            const withVerts = allMeshes.filter(
              (m) =>
                typeof m.getTotalVertices === "function" &&
                m.getTotalVertices() > 0,
            );

            let fallbackMat = null;
            for (const mesh of withVerts) {
              if (!mesh.material) {
                if (!fallbackMat) {
                  fallbackMat = new StandardMaterial(
                    "characterFallbackMat",
                    scene,
                  );
                  fallbackMat.diffuseColor = new Color3(0.5, 0.5, 0.55);
                  fallbackMat.backFaceCulling = false;
                }
                mesh.material = fallbackMat;
              }
              mesh.setEnabled(true);
              mesh.isVisible = true;
              if (mesh.receiveShadows !== undefined) mesh.receiveShadows = true;
              if (typeof mesh.alwaysSelectAsActiveMesh !== "undefined")
                mesh.alwaysSelectAsActiveMesh = true;
              if (typeof mesh.refreshBoundingInfo === "function")
                mesh.refreshBoundingInfo();
            }

            if (typeof root.computeWorldMatrix === "function")
              root.computeWorldMatrix(true);
            if (shadowGenerator)
              for (const m of withVerts)
                shadowGenerator.addShadowCaster(m, false);

            // Parent board mesh to skeleton root bone so it stays with the character during
            // Fall animation and avoids feet/board detachment.
            const skeleton =
              result.skeletons && result.skeletons.length > 0
                ? result.skeletons[0]
                : (() => {
                    const skinned = (result.meshes || []).find(
                      (m) => m.skeleton != null,
                    );
                    return skinned ? skinned.skeleton : null;
                  })();
            if (skeleton && skeleton.bones && skeleton.bones.length > 0) {
              const rootBone = skeleton.bones[0];
              // Exclude root (and common hip/root) bone from Fall animation so the character
              // stays aligned with the board and doesn’t detach.
              let boneTransformNode =
                typeof rootBone.getTransformNode === "function"
                  ? rootBone.getTransformNode()
                  : null;
              if (
                !boneTransformNode &&
                typeof rootBone.linkTransformNode === "function"
              ) {
                const linked = new TransformNode("rootBoneLink", scene);
                rootBone.linkTransformNode(linked);
                boneTransformNode = linked;
              }
              if (fallAnimationGroup) {
                const excludeNames = new Set();
                if (rootBone.name) excludeNames.add(rootBone.name);
                if (boneTransformNode?.name)
                  excludeNames.add(boneTransformNode.name);
                const targetedAnimations =
                  fallAnimationGroup.targetedAnimations || [];
                for (const ta of targetedAnimations) {
                  const t = ta.target;
                  if (!t?.name) continue;
                  const isRootBone =
                    t === rootBone ||
                    (typeof t.getParent === "function" &&
                      t.getParent?.() == null &&
                      typeof t.getSkeleton === "function" &&
                      t.getSkeleton?.() === skeleton);
                  const isRootLinkedNode =
                    boneTransformNode && t === boneTransformNode;
                  if (isRootBone || isRootLinkedNode) excludeNames.add(t.name);
                }
                if (excludeNames.size > 0) {
                  const fallRootMask = new AnimationGroupMask(
                    [...excludeNames],
                    AnimationGroupMaskMode.Exclude,
                  );
                  fallAnimationGroup.mask = fallRootMask;
                }
              }
              const nonSkinned = withVerts.filter((m) => !m.skeleton);
              let boardMesh = nonSkinned.find(
                (m) => m.name && /board|snowboard/i.test(m.name),
              );
              if (!boardMesh && nonSkinned.length > 0) {
                const nameLike = nonSkinned.find(
                  (m) => m.name && /board|snowboard|plane/i.test(m.name),
                );
                if (nameLike) boardMesh = nameLike;
                else if (nonSkinned.length === 1) boardMesh = nonSkinned[0];
                else {
                  let maxHorizExtent = -1;
                  for (const m of nonSkinned) {
                    const b = m.getBoundingInfo?.();
                    if (b?.minimum && b?.maximum) {
                      const size = b.maximum.subtract(b.minimum);
                      const horiz = Math.max(
                        Math.abs(size.x),
                        Math.abs(size.z),
                      );
                      if (horiz > maxHorizExtent) {
                        maxHorizExtent = horiz;
                        boardMesh = m;
                      }
                    }
                  }
                }
              }
              if (boardMesh && boneTransformNode) {
                const worldBefore = boardMesh.getWorldMatrix().clone();
                boardMesh.setParent(boneTransformNode);
                const boneWorld = boneTransformNode.getWorldMatrix();
                const invBone = Matrix.Invert(boneWorld);
                const localMat = worldBefore.clone();
                localMat.multiplyInPlace(invBone);
                const scale = Vector3.One();
                const rot = Quaternion.Identity();
                const pos = Vector3.Zero();
                localMat.decompose(scale, rot, pos);
                boardMesh.scaling.copyFrom(scale);
                boardMesh.rotationQuaternion = rot;
                boardMesh.position.copyFrom(pos);
              }
            }

            proceduralBodyMeshes.forEach((m) => m.dispose());
            characterRoot = root;
            characterMode = "gltf";
            // Default to Idle so we don't show start_wave. Idle runs as a base layer,
            // while turn animations are overlaid via weights.
            if (
              idleAnimationGroup &&
              typeof idleAnimationGroup.start === "function"
            ) {
              idleAnimationGroup.start(true);
            }
            if (
              turnLeftAnimationGroup &&
              typeof turnLeftAnimationGroup.start === "function"
            ) {
              // Start once (no loop); kept at weight 0 until keydown triggers one-shot.
              turnLeftAnimationGroup.start(false);
            }
            if (
              turnRightAnimationGroup &&
              typeof turnRightAnimationGroup.start === "function"
            ) {
              // Start once (no loop); kept at weight 0 until keydown triggers one-shot.
              turnRightAnimationGroup.start(false);
            }
            resetCharacterAnimationState();
            if (logLoad)
              console.log(
                "[character] glTF applied; root parented to container",
              );
          } catch (e) {
            console.warn("Character apply failed:", e);
            if (loaderRoot && loaderRoot !== scene) loaderRoot.dispose();
          }
        };

        const runApply = () => {
          const envTex = scene.environmentTexture;
          const envReady =
            !envTex ||
            (typeof envTex.isReady === "function" && envTex.isReady());
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
  const leftCenter = {
    x: (leftDir.x * lineDepth) / 2,
    z: tipZ + (leftDir.z * lineDepth) / 2,
  };
  const rightCenter = {
    x: (rightDir.x * lineDepth) / 2,
    z: tipZ + (rightDir.z * lineDepth) / 2,
  };
  const leftLine = MeshBuilder.CreateBox(
    "arrowLeft",
    { width: lineWidth, height: lineHeight, depth: lineDepth },
    scene,
  );
  leftLine.position.set(leftCenter.x, 0, leftCenter.z);
  leftLine.rotation.y = angle;
  leftLine.material = material;
  leftLine.parent = arrowGroup;
  const rightLine = MeshBuilder.CreateBox(
    "arrowRight",
    { width: lineWidth, height: lineHeight, depth: lineDepth },
    scene,
  );
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
  if (
    template &&
    (type === "tree" || type === "rock" || type === "box" || type === "ramp")
  ) {
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
    const trunk = MeshBuilder.CreateCylinder(
      "trunk",
      { height: 1, diameterTop: 0.4, diameterBottom: 0.6, tessellation: 6 },
      scene,
    );
    trunk.position.y = 0.5;
    trunk.material = new StandardMaterial("trunkMat", scene);
    trunk.material.diffuseColor = hexToColor3(0x5d4037);
    trunk.parent = root;
    const leafMat = new StandardMaterial("leafMat", scene);
    leafMat.diffuseColor = hexToColor3(CONFIG.colors.tree);
    const b1 = MeshBuilder.CreateCylinder(
      "b1",
      { height: 2, diameterTop: 0, diameterBottom: 3, tessellation: 6 },
      scene,
    );
    b1.position.y = 1.5;
    b1.material = leafMat;
    b1.parent = root;
    const b2 = MeshBuilder.CreateCylinder(
      "b2",
      { height: 1.5, diameterTop: 0, diameterBottom: 2.4, tessellation: 6 },
      scene,
    );
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
    const ramp = MeshBuilder.CreateBox(
      "ramp",
      { width: 2, height: 0.5, depth: 4 },
      scene,
    );
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
  const ring = MeshBuilder.CreateTorus(
    "ring",
    { diameter: outer * 2, thickness: outer - inner, tessellation: 32 },
    scene,
  );
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
  const mesh = MeshBuilder.CreateGround(
    "trail",
    { width: 0.8, height: 2 },
    scene,
  );
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

  engine = new Engine(canvasEl, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  scene = new Scene(engine);
  const skyColor = hexToColor3(CONFIG.colors.sky);
  scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);
  const fogCfg = CONFIG.rendering?.fog;
  const fogEnabled = fogCfg?.enabled !== false;
  if (fogEnabled) {
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = fogCfg?.start ?? 20;
    scene.fogEnd = fogCfg?.end ?? 120;
    const fogColor3 = hexToColor3(fogCfg?.color ?? CONFIG.colors.sky);
    scene.fogColor = new Color4(fogColor3.r, fogColor3.g, fogColor3.b, 1);
  }

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
      const hdrTexture = new HDRCubeTexture(
        skyUrl,
        scene,
        1024,
        false,
        true,
        false,
        true,
        null,
        null,
        true,
      );
      scene.environmentTexture = hdrTexture;
      skyboxMesh = scene.createDefaultSkybox(hdrTexture, true, 512, 0, false);
      if (skyboxMesh && skyboxMesh.material)
        skyboxMesh.material.fogEnabled = false;
      // Use same clear sky blue as config (no grey-blue override)
      scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);
    } catch (err) {
      console.warn(
        "Sky HDR failed to load, using default environment:",
        skyUrl,
        err,
      );
      environmentHelper = scene.createDefaultEnvironment({
        createGround: false,
        createSkybox: true,
      });
    }
  } else {
    environmentHelper = scene.createDefaultEnvironment({
      createGround: false,
      createSkybox: true,
    });
  }
  if (scene.environmentIntensity === undefined) scene.environmentIntensity = 1;

  let groundMesh;
  try {
    const heightMapRes = 128;
    const heightMapBuffer = createMogulHeightMapBuffer(
      heightMapRes,
      heightMapRes,
    );
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
      scene,
    );
    if (
      !groundMesh ||
      (typeof groundMesh.getTotalVertices === "function" &&
        groundMesh.getTotalVertices() === 0)
    ) {
      throw new Error("Empty ground geometry");
    }
    const snowMat = new PBRMaterial("groundMat", scene);
    snowMat.albedoColor = hexToColor3(CONFIG.colors.snow);
    snowMat.metallic = 0;
    snowMat.roughness = 0.95;
    const snowAlbedoUrl = CONFIG.assets?.terrain?.snowAlbedo;
    if (
      snowAlbedoUrl &&
      typeof snowAlbedoUrl === "string" &&
      snowAlbedoUrl !== ""
    ) {
      snowMat.albedoTexture = new Texture(snowAlbedoUrl, scene);
      const snowNormalUrl = CONFIG.assets?.terrain?.snowNormal;
      if (
        snowNormalUrl &&
        typeof snowNormalUrl === "string" &&
        snowNormalUrl !== ""
      ) {
        snowMat.bumpTexture = new Texture(snowNormalUrl, scene);
      }
    }
    groundMesh.material = snowMat;
    groundMesh.receiveShadows = true;
    groundMesh.isVisible = true;
  } catch (_) {
    groundMesh = MeshBuilder.CreateGround(
      "ground",
      { width: 200, height: 200 },
      scene,
    );
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
  glideSurfaceMesh = player.glideSurfaceMesh;
  dynamiteMesh.isVisible = false;
  scene.addMesh(playerRoot);
  if (shadowGenerator) shadowGenerator.addShadowCaster(playerRoot, true);

  loadCharacterModel(scene, playerMeshContainer, player.proceduralBodyMeshes);

  // Defer obstacle template loads so the first rAF stays under the 50ms threshold.
  requestAnimationFrame(() => {
    ["tree", "rock", "box", "ramp"].forEach((t) =>
      loadObstacleTemplate(scene, t),
    );
  });

  return { getCanvas: () => canvasEl };
}

/**
 * Resets character animation runtime (prev input, turn weights, spin-out history).
 * Call this when switching scenarios on the test page so the new scenario applies immediately.
 */
export function resetCharacterAnimationState() {
  characterAnimationRuntime = createInitialAnimationRuntime();
  if (!characterAnimationGroups || characterAnimationGroups.length === 0)
    return;

  // Restore idle as the sole active clip. When config reuses the same clip for
  // multiple slots (e.g. idle and turnLeft both "Turn_Left"), set each unique
  // group once: idle group -> 1, others -> 0.
  const uniqueControlled = new Set(
    [
      idleAnimationGroup,
      turnLeftAnimationGroup,
      turnRightAnimationGroup,
      fallAnimationGroup,
      brakeWaveAnimationGroup,
    ].filter(Boolean),
  );
  for (const group of uniqueControlled) {
    try {
      const isIdleGroup = group === idleAnimationGroup;
      if (typeof group.setWeightForAllAnimatables === "function")
        group.setWeightForAllAnimatables(isIdleGroup ? 1 : 0);
      if (!isIdleGroup) {
        if (typeof group.stop === "function") group.stop();
        if (typeof group.reset === "function") group.reset();
      } else {
        if (typeof group.stop === "function") group.stop();
        if (typeof group.reset === "function") group.reset();
        if (typeof group.start === "function") group.start(true);
      }
    } catch {
      /* best-effort */
    }
  }

  const controlledNames = new Set(
    Object.values(CHARACTER_ANIMATION_CONFIG.clips),
  );
  const groups = Array.isArray(characterAnimationGroups)
    ? characterAnimationGroups
    : [];
  for (const ag of groups) {
    if (!ag || controlledNames.has(ag.name)) continue;
    try {
      if (typeof ag.setWeightForAllAnimatables === "function")
        ag.setWeightForAllAnimatables(0);
      if (typeof ag.stop === "function") ag.stop();
      if (typeof ag.reset === "function") ag.reset();
    } catch {
      /* best-effort */
    }
  }
}

export function syncFromState(state) {
  const p = state.player;
  const pos = p.position;
  const hasGlide = Boolean(state.playerStats?.hasGlide);
  const GLIDE_LIFT_Y = 0.05;
  playerRoot.position.set(pos.x, pos.y + (hasGlide ? GLIDE_LIFT_Y : 0), pos.z);
  const spinOut = state.spinOut || {
    active: state.isSpinningOut,
    phase: state.isSpinningOut ? "SPINNING" : null,
  };
  const spinningActive = !!spinOut.active;

  // During spin-out, keep the root upright to avoid flipping into the snow.
  if (spinningActive) {
    playerRoot.rotation.set(0, 0, 0);
    playerMeshContainer.rotation.x = 0;
  } else {
    playerRoot.rotation.set(state.playerRotationX ?? 0, 0, 0);
    playerMeshContainer.rotation.x = p.leanBack;
  }
  // Use visualSpinAngle (if any) during spin-out so we can spin the character
  // without affecting gameplay steering direction.
  const visualY =
    spinningActive && typeof p.visualSpinAngle === "number"
      ? p.visualSpinAngle
      : p.angle;
  playerMeshContainer.rotation.y = visualY;
  const steeringTiltScale = CONFIG.rendering?.steeringTiltScale ?? 0.3;
  playerMeshContainer.rotation.z = -p.angle * steeringTiltScale;

  if (
    characterMode === "gltf" &&
    (idleAnimationGroup ||
      turnLeftAnimationGroup ||
      turnRightAnimationGroup ||
      brakeWaveAnimationGroup)
  ) {
    const { directives, nextRuntime } = deriveCharacterAnimationDirectives(
      state,
      characterAnimationRuntime,
      spinOut,
    );
    characterAnimationRuntime = nextRuntime;

    // When config maps multiple slots to the same clip, set each unique group's weight
    // to the max of the weights for the slots that use it (so e.g. idle=1 and turnLeft=0
    // on the same group yields weight 1).
    const uniqueGroups = new Set(
      [
        idleAnimationGroup,
        turnLeftAnimationGroup,
        turnRightAnimationGroup,
        brakeWaveAnimationGroup,
      ].filter(Boolean),
    );
    for (const group of uniqueGroups) {
      let w = 0;
      if (group === idleAnimationGroup && directives.idle) {
        let idleWeight = directives.idle.weight;
        if (directives.brakeWave?.active && !brakeWaveAnimationGroup)
          idleWeight = 1;
        w = Math.max(w, idleWeight);
      }
      if (group === turnLeftAnimationGroup && directives.turn)
        w = Math.max(w, directives.turn.leftWeight);
      if (group === turnRightAnimationGroup && directives.turn)
        w = Math.max(w, directives.turn.rightWeight);
      if (group === brakeWaveAnimationGroup && directives.brakeWave?.active)
        w = Math.max(w, 1);
      try {
        if (group && typeof group.setWeightForAllAnimatables === "function")
          group.setWeightForAllAnimatables(w);
      } catch {
        /* best-effort */
      }
    }

    if (
      directives.brakeWave?.active &&
      !brakeWaveAnimationGroup &&
      !brakeWaveMissingWarned
    ) {
      brakeWaveMissingWarned = true;
      if (
        typeof console !== "undefined" &&
        typeof console.warn === "function"
      ) {
        const names =
          Array.isArray(characterAnimationGroups) &&
          characterAnimationGroups.length > 0
            ? characterAnimationGroups.map((ag) => ag.name).join(", ")
            : "(none)";
        console.warn(
          "[character] Brake-wave requested but clip not found. Set clips.brakeWave to one of:",
          names,
        );
      }
    }
    if (directives.brakeWave && brakeWaveAnimationGroup) {
      if (directives.brakeWave.justStarted) {
        try {
          if (typeof brakeWaveAnimationGroup.reset === "function")
            brakeWaveAnimationGroup.reset();
          if (typeof brakeWaveAnimationGroup.start === "function")
            brakeWaveAnimationGroup.start(true);
        } catch {
          /* best-effort */
        }
      } else if (directives.brakeWave.justStopped) {
        try {
          if (
            typeof brakeWaveAnimationGroup.setWeightForAllAnimatables ===
            "function"
          )
            brakeWaveAnimationGroup.setWeightForAllAnimatables(0);
          if (typeof brakeWaveAnimationGroup.stop === "function")
            brakeWaveAnimationGroup.stop();
          if (typeof brakeWaveAnimationGroup.reset === "function")
            brakeWaveAnimationGroup.reset();
        } catch {
          /* best-effort */
        }
      }
    }

    if (
      directives.turn &&
      !(directives.brakeWave && directives.brakeWave.active)
    ) {
      if (directives.turn.startLeft && turnLeftAnimationGroup) {
        try {
          if (typeof turnLeftAnimationGroup.reset === "function")
            turnLeftAnimationGroup.reset();
          if (typeof turnLeftAnimationGroup.start === "function")
            turnLeftAnimationGroup.start(false);
        } catch {
          /* best-effort */
        }
      }
      if (directives.turn.startRight && turnRightAnimationGroup) {
        try {
          if (typeof turnRightAnimationGroup.reset === "function")
            turnRightAnimationGroup.reset();
          if (typeof turnRightAnimationGroup.start === "function")
            turnRightAnimationGroup.start(false);
        } catch {
          /* best-effort */
        }
      }
    }

    if (directives.fall && fallAnimationGroup) {
      if (directives.fall.start) {
        try {
          if (typeof fallAnimationGroup.stop === "function") {
            fallAnimationGroup.stop();
          }
          if (typeof fallAnimationGroup.reset === "function") {
            fallAnimationGroup.reset();
          }
          if (typeof fallAnimationGroup.start === "function") {
            fallAnimationGroup.start(true);
            if (typeof fallAnimationGroup.syncWithMask === "function") {
              fallAnimationGroup.syncWithMask(true);
            }
          }
        } catch {
          /* best-effort */
        }
      } else if (directives.fall.stop) {
        try {
          if (typeof fallAnimationGroup.stop === "function") {
            fallAnimationGroup.stop();
          }
        } catch {
          /* best-effort */
        }
      }
    }

    if (
      directives.postFall &&
      directives.postFall.realignNow &&
      characterMode === "gltf"
    ) {
      playerRoot.rotation.set(0, 0, 0);
      playerMeshContainer.rotation.set(0, 0, 0);
      state.player.visualSpinAngle = 0;
      state.player.angle = 0;

      if (fallAnimationGroup) {
        try {
          if (
            typeof fallAnimationGroup.setWeightForAllAnimatables === "function"
          ) {
            fallAnimationGroup.setWeightForAllAnimatables(0);
          }
          if (typeof fallAnimationGroup.stop === "function") {
            fallAnimationGroup.stop();
          }
          if (typeof fallAnimationGroup.reset === "function") {
            fallAnimationGroup.reset();
          }
        } catch {
          /* best-effort */
        }
      }

      // After realign: idle group = 1, all other controlled groups = 0. Use unique
      // groups so that when idle and turnLeft share the same clip we set it once to 1.
      const uniqueForRealign = new Set(
        [
          idleAnimationGroup,
          turnLeftAnimationGroup,
          turnRightAnimationGroup,
          fallAnimationGroup,
          brakeWaveAnimationGroup,
        ].filter(Boolean),
      );
      for (const group of uniqueForRealign) {
        try {
          const isIdleGroup = group === idleAnimationGroup;
          if (typeof group.setWeightForAllAnimatables === "function")
            group.setWeightForAllAnimatables(isIdleGroup ? 1 : 0);
          if (typeof group.stop === "function") group.stop();
          if (typeof group.reset === "function") group.reset();
          if (isIdleGroup && typeof group.start === "function")
            group.start(true);
        } catch {
          /* best-effort */
        }
      }

      const controlledNames = new Set(
        Object.values(CHARACTER_ANIMATION_CONFIG.clips),
      );
      const groups = Array.isArray(characterAnimationGroups)
        ? characterAnimationGroups
        : [];
      for (const ag of groups) {
        if (!ag || controlledNames.has(ag.name)) continue;
        try {
          if (typeof ag.setWeightForAllAnimatables === "function")
            ag.setWeightForAllAnimatables(0);
          if (typeof ag.stop === "function") ag.stop();
          if (typeof ag.reset === "function") ag.reset();
        } catch {
          /* best-effort */
        }
      }
    }
  }

  // After the fall animation has played and spin-out is no longer active,
  // additional pose realignment and clip cleanup is handled via directives
  // above when characterMode is \"gltf\".

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
        const z =
          ((((phase + i * 3) % trackLen) + trackLen) % trackLen) - trackLen / 2;
        arrowMesh.position.z = z;
        for (const child of arrowMesh.getChildMeshes()) {
          if (child.material) child.material.alpha = alpha;
        }
      }
    }
  }

  shieldMesh.isVisible = state.playerStats.invincibleTimer > 0;
  if (shieldMesh.isVisible) {
    const margin = 1.1;
    const shieldSizeFactor = 0.07;
    const charScale =
      characterMode === "gltf" ? (CONFIG.assets?.characterScale ?? 1) : 1;
    const sphereLocalDiameter = 3;
    const baseScale =
      (charScale * margin * shieldSizeFactor) / sphereLocalDiameter;
    const pulseTime = state.visuals.shieldPulseTime;
    const scale =
      pulseTime > 0 ? baseScale * (1 + 0.3 * (pulseTime / 0.25)) : baseScale;
    shieldMesh.scaling.setAll(scale);
    shieldMesh.material.alpha = state.visuals.shieldOpacity ?? 0.3;
  }
  const showDynamite = Boolean(state.playerStats?.hasDynamite);
  dynamiteMesh.isVisible = showDynamite;
  for (const child of dynamiteMesh.getChildMeshes()) {
    child.isVisible = showDynamite;
  }
  if (glideSurfaceMesh && glideSurfaceMesh.material) {
    const targetOpacity = hasGlide ? 1 : 0;
    const lerpFactor = 0.15;
    glideSurfaceOpacity += (targetOpacity - glideSurfaceOpacity) * lerpFactor;
    if (!hasGlide && Math.abs(glideSurfaceOpacity) < 0.01) {
      glideSurfaceOpacity = 0;
    }
    glideSurfaceMesh.isVisible = glideSurfaceOpacity > 0.01;
    glideSurfaceMesh.material.alpha = glideSurfaceOpacity;
  }
  const proceduralDefaults = {
    board: 0x333333,
    leftLeg: CONFIG.colors.pants,
    rightLeg: CONFIG.colors.pants,
    torso: CONFIG.colors.jacket,
    leftArm: CONFIG.colors.jacket,
    rightArm: CONFIG.colors.jacket,
    bag: CONFIG.colors.backpack,
    head: CONFIG.colors.helmet,
    goggles: CONFIG.colors.goggles,
  };
  function isShieldOrDynamite(mesh) {
    if (
      mesh === shieldMesh ||
      mesh === dynamiteMesh ||
      mesh === glideSurfaceMesh
    )
      return true;
    let n = mesh.parent;
    while (n) {
      if (n === dynamiteMesh) return true;
      n = n.parent;
    }
    return false;
  }
  const allContainerMeshes = playerMeshContainer.getChildMeshes(true);
  const characterMeshes = allContainerMeshes.filter(
    (m) => !isShieldOrDynamite(m),
  );
  function getMaterials(mesh) {
    const mat = mesh.material;
    if (!mat) return [];
    if (mat.subMaterials && Array.isArray(mat.subMaterials)) {
      return mat.subMaterials.filter(Boolean);
    }
    return [mat];
  }
  function restoreMaterial(mat) {
    if (!glideOriginalColors.has(mat)) return;
    const cached = glideOriginalColors.get(mat);
    if (cached.diffuseColor) mat.diffuseColor = cached.diffuseColor;
    if (cached.albedoColor) mat.albedoColor = cached.albedoColor;
    glideOriginalColors.delete(mat);
  }
  if (!hasGlide) {
    for (const mesh of characterMeshes) {
      for (const mat of getMaterials(mesh)) {
        if (glideOriginalColors.has(mat)) {
          restoreMaterial(mat);
        } else if (
          characterMode === "procedural" &&
          mesh.name &&
          proceduralDefaults[mesh.name] != null &&
          mat.diffuseColor != null
        ) {
          mat.diffuseColor = hexToColor3(proceduralDefaults[mesh.name]);
        } else if (characterMode === "procedural" && mat.diffuseColor != null) {
          mat.diffuseColor = hexToColor3(0x333333);
        }
      }
    }
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
      mesh = createRingMesh(
        scene,
        e.position,
        e.inner ?? 1,
        e.outer ?? 1.5,
        e.color ?? 0xffff00,
      );
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
  glideOriginalColors.clear();
  glideSurfaceOpacity = 0;
  if (characterMode === "gltf" && characterRoot) {
    for (const ag of characterAnimationGroups) {
      if (ag && typeof ag.stop === "function") ag.stop();
      if (ag && typeof ag.dispose === "function") ag.dispose();
    }
    characterAnimationGroups = [];
    idleAnimationGroup = null;
    turnLeftAnimationGroup = null;
    turnRightAnimationGroup = null;
    fallAnimationGroup = null;
    brakeWaveAnimationGroup = null;
    brakeWaveMissingWarned = false;
    characterAnimationRuntime = createInitialAnimationRuntime();
    characterRoot.dispose();
    characterRoot = null;
    characterMode = "procedural";
  }
  if (environmentHelper) {
    environmentHelper.dispose();
    environmentHelper = null;
  }
  if (skyboxMesh) {
    skyboxMesh.dispose();
    skyboxMesh = null;
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
