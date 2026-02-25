# Game assets

Optional assets for the photorealistic graphics upgrade. If a file is missing, the game falls back to procedural meshes. Without adding glTF and texture files under `public/assets/`, the game uses procedural character and obstacles, so they look the same as before the graphics redesign; adding the suggested assets upgrades the look.

- **character/** – Place `snowboarder.glb` (or any glTF/GLB) here. The character can be swapped later (e.g. generic character + board) by replacing this file and adjusting scale in code.
- **obstacles/** – Optional glTFs: `tree.glb`, `rock.glb`, `box.glb`, `ramp.glb`. Used when present; otherwise procedural obstacles are used.
- **terrain/** – Optional: `heightmap.png`, `snow_albedo.png`, `snow_normal.png`, `snow_roughness.png` for PBR snow. Terrain already uses a procedural mogul heightmap if no texture is set.
- **sky/** – Optional: `env.hdr` (or other HDR sky). If missing, the default Babylon environment/skybox is used.

Asset URLs are configured in `src/config.js` under `CONFIG.assets`. Run the game with `npm run dev` so that `/assets/` paths resolve; opening `index.html` directly may prevent assets from loading. For meter-based character models (e.g. Onirix/Sketchfab snowboarder), set `CONFIG.assets.characterScale` to `1`; for cm-based models use `0.01`. Adjust if the model appears too large or too small.
