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
