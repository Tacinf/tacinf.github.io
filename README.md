# tacinf.github.io

Project page for **Tacinf: A Unified Tactile Infrastructure for Robot Manipulation**.

Static, dependency-free HTML / CSS / JS — no build step is required to serve the
site. The page is organized around four switchable modules:

| Module | Role | Accent |
|---|---|---|
| Tacumi | Handheld tactile data collection | green |
| Tabero | Tactile simulation + benchmark | yellow |
| Tacinf-VTLA | Force-aware vision–language–action policy | blue |
| Taco | Task-aligned sim-to-real | white |

Tabero links to the standalone benchmark repository:
<https://github.com/NathanWu7/Tabero>.

## Preview locally

```bash
cd ~/git_pkgs/tacinf.github.io
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Rebuild assets

Fonts, images, and video clips are generated from the paper repository
(`~/docs/Tacinf-NVTech`) and committed to `assets/`:

```bash
PATH="$HOME/.local/bin:$PATH" python3 tools/build_assets.py
```

This rebuilds:

- WebP figures in `assets/img/` (including transparent render cutouts and the
  social card `og.jpg`)
- Compressed MP4 clips and poster frames in `assets/video/`
- Self-hosted NVIDIA Sans WOFF2 subsets in `assets/fonts/`
- The paper PDF in `assets/pdf/`

### 3D models

`assets/models/` holds the WebGL assets:

| File | Source | Notes |
|---|---|---|
| `taco-robot.glb` | xArm7 + Tacumi URDF visuals | posed at the task-6 IK pregrasp; built by `python3 tools/build_taco_robot.py` |
| `object-vitasoy.glb`, `object-coca.glb`, `object-cookie.glb`, `object-basket.glb` | Tabero_X realworld USD objects | optimized to low-poly meshes with 512 px WebP textures |
| `tacumi-umi.glb` | `handheld_umi.usd` | meshopt-compressed |

The Taco viewer places the robot at the task-6 `robot_base_pos`, the objects at
the task-6 poses, and uses the 1.2 × 1.6 m realworld tabletop. The initial camera
is the realworld `agentview_cam` pose. These values live in
`assets/js/model-viewer.js` and come from
`benchmarks/datasets/realworld/config/gentle_grasp.json` and
`realworld_env_cfg.py` in Tabero_X.

Object and UMI GLBs can be regenerated with:

```bash
~/miniconda3/envs/isaac5/bin/python tools/convert_usd_to_glb.py <asset.usd> <out.glb>
gltf-transform optimize <out.glb> <out-opt.glb> \
  --compress false --simplify true --simplify-ratio 0.002 \
  --simplify-error 0.01 --texture-compress webp --texture-size 512
```

Use `--compress meshopt --simplify false` for the robot/UMI if you want smaller
geometry; the viewer initializes the meshopt decoder for those files.

### Interactive exploded view

The Tacumi panel includes a hover / tap exploded view of the handheld UMI.
Its 16 frames live in `assets/img/explode/` and are rendered from the paper's
USD asset:

```bash
bash tools/render_explode_umi.sh
```

This requires the `isaac5` conda environment and the paper repository at
`~/docs/Tacinf-NVTech` (override with `TACINF_PAPER=/path/to/Tacinf-NVTech`).
`tools/render_kit_preview_fixed.py` is the paper's headless Kit renderer with a
`--camera-usd` option, so every frame of the sequence shares the fully exploded
framing. Keep `FRAME_COUNT` in `assets/js/main.js` in sync if you change the
number of frames.

## Publish to GitHub Pages

The target URL is <https://tacinf.github.io>, served from the public repository
`Tacinf/tacinf.github.io`.

```bash
bash tools/deploy.sh
```

Or manually:

```bash
git remote add origin git@github.com:Tacinf/tacinf.github.io.git
git push -u origin main
```

Pages should be configured as **Settings → Pages → Deploy from a branch → `main`
→ `/ (root)`**. The site uses `.nojekyll` and no build step.
