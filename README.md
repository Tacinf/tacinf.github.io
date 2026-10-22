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

### 3D model

`assets/models/` holds the UMI viewer assets:

| File | Source | Notes |
|---|---|---|
| `tacumi-umi.glb` | `handheld_umi_aligned.usd` | assembled, meshopt-compressed |
| `tacumi-umi-exploded.glb` | `handheld_umi_exploded.usd` | exploded, meshopt-compressed |

The Tacumi panel shows the assembled UMI. Its **Exploded view** button swaps to
the exploded GLB and pulls the camera back; both states stay draggable and
zoomable. The two USD assets share the aligned frame, so the toggle does not
rotate the device.

The Taco panel uses the `real2sim.mp4` replay clip as a large
Real–Sim replay video instead of a 3D scene.

Regenerate the UMI GLBs with:

```bash
~/miniconda3/envs/isaac5/bin/python tools/convert_usd_to_glb.py \
  ~/docs/Tacinf-NVTech/figs/UMI_URDF/usd/handheld_umi_aligned.usd /tmp/umi.glb
~/miniconda3/envs/isaac5/bin/python tools/convert_usd_to_glb.py \
  ~/docs/Tacinf-NVTech/figs/UMI_URDF/usd/handheld_umi_exploded.usd /tmp/umi-exploded.glb
gltf-transform optimize <in.glb> <out.glb> \
  --compress meshopt --simplify true --simplify-ratio 0.5 \
  --simplify-error 0.001 --texture-compress false
```

The viewer initializes the meshopt decoder for both files.

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
