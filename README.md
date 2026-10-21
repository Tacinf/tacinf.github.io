# tacinf.github.io

Project page for **Tacinf: A Unified Tactile Infrastructure for Robot Manipulation**.

Static, dependency-free HTML/CSS/JS. No build step is required to serve it; the
only tooling is an optional Python script that regenerates the WebP figures
from the paper repository.

## Preview locally

```bash
cd ~/git_pkgs/tacinf.github.io
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Publish to GitHub Pages

The target URL is <https://tacinf.github.io>, which requires a GitHub account or
organization named `tacinf` and a public repository named `tacinf.github.io`.

1. Create a free organization named `tacinf`:
   <https://github.com/organizations/new>. If the name is unavailable, use the
   fallback below.
2. In that organization, create a public repository named `tacinf.github.io`
   (empty — no README, no license).
3. From this directory, push:

   ```bash
   bash tools/deploy.sh
   ```

   Or manually:

   ```bash
   git remote add origin git@github.com:tacinf/tacinf.github.io.git
   git push -u origin main
   ```

4. Enable Pages if the script could not: repository **Settings → Pages →
   Build and deployment → Deploy from a branch → `main` → `/ (root)` → Save**.
5. Wait a minute, then visit <https://tacinf.github.io>.

`tools/deploy.sh` also tries to enable Pages through `gh api`. If the repository
was just created, the token may need a refresh; the Settings route always works.

### If the `tacinf` organization name is taken

A GitHub username and organization name share one namespace, and `tacinf` was
free when this site was built. If that changes, either:

- publish from the existing account as a project page:
  `https://nathanwu7.github.io/tacinf` (create a repo named `tacinf`, not
  `tacinf.github.io`), and update the canonical/Open Graph URLs in
  `index.html`; or
- use a custom domain, for example `tacinf.org`, and add a `CNAME` file with
  that domain plus a DNS `CNAME` record pointing to `tacinf.github.io`.

## Updating content

- Page text and layout: `index.html`
- Styles: `assets/css/style.css`
- Interactions (lightbox, BibTeX copy, nav): `assets/js/main.js`
- Figures: re-run the asset pipeline after the paper's figures change:

  ```bash
  python3 tools/build_assets.py
  ```

  It reads from `~/docs/Tacinf-NVTech`, rasterizes the vector figure PDFs, and
  writes resized WebP files (plus the PDF and social card) into
  `assets/`.

## Layout

```
index.html                 single-page project site
404.html                   GitHub Pages 404
favicon.svg                tactile-pad mark
assets/css/style.css       all styling, light/dark, responsive
assets/js/main.js          lightbox, BibTeX copy, nav state
assets/img/*.webp          web-optimized figures
assets/img/og.jpg          1200x630 social card
assets/pdf/Tacinf_NVTech.pdf
tools/build_assets.py      regenerates images from the paper
tools/deploy.sh            push + enable Pages
```

## Notes on claims

The page distinguishes validated results from planned experiments. Real-robot
task expansion (blackboard wiping, card swiping, knob turning) and the
real–simulation–UMI co-training table are marked as ongoing, matching the
current paper. Update both the page and the paper together when those numbers
are filled in.
