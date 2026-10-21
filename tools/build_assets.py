#!/usr/bin/env python3
"""Build web-ready image assets for the Tacinf project page.

Reads figures from the paper repository, rasterizes the vector PDFs, and
writes resized WebP files into assets/img. Re-run after the paper figures
change:

    python3 tools/build_assets.py
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
PAPER = Path.home() / "docs" / "Tacinf-NVTech"
OUT = SITE / "assets" / "img"
PDF_OUT = SITE / "assets" / "pdf"

# (output name, source path, max width, source kind)
IMAGES = [
    ("teaser", "figs/fig01_overview/tacinf_main.png", 2000, "image"),
    ("tabero", "figs/fig02_sim_platform/mul_task_new.png", 1400, "image"),
    ("force-decomposition", "figs/fig03_force_decomposition/force_decomposition.png", 2000, "image"),
    ("vtla-system", "figs/fig04_model_control/vtla_system.pdf", 1600, "pdf"),
    ("force-loop", "figs/fig04_model_control/force_feedback_loop.pdf", 1400, "pdf"),
    ("tacumi", "figs/fig05_tacumi_interface/tacumi_interface_photo.pdf", 1600, "pdf"),
    ("taco-loop", "figs/fig06_taco_data_loop/taco_data_loop.pdf", 1600, "pdf"),
    ("force-distribution", "figs/fig07_force_distribute/rgb_marker_new.png", 1200, "image"),
    ("ablation", "figs/fig08_tactile_ablation/tactile_ablation.png", 2000, "image"),
    ("agreement", "figs/fig09_agreement_bars/agreement_bars.png", 1600, "image"),
    ("controller-firm", "figs/fig10_force_feedback/firm_first151.png", 1200, "image"),
    ("controller-gentle", "figs/fig10_force_feedback/gentle_first151.png", 1200, "image"),
    ("controller-no-ff", "figs/fig10_force_feedback/gentle_woff_first151.png", 1200, "image"),
    ("controller-no-adm", "figs/fig10_force_feedback/gentle_woall_first151.png", 1200, "image"),
    ("real2sim", "figs/fig12_real2sim_deploy/tacumi_real2sim_deployment_views.jpg", 1400, "image"),
]

# Vector figures rasterized at this resolution before downscaling.
PDF_DPI = 220


def render_pdf(src: Path, dst: Path) -> None:
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(PDF_DPI), "-singlefile", str(src), str(dst)],
        check=True,
    )
    # pdftoppm appends .png
    produced = dst.with_suffix(".png")
    if produced != dst and produced.exists():
        produced.replace(dst)


def flatten(im: Image.Image) -> Image.Image:
    """Composite transparent images onto white so WebP has no dark fringes."""
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im.convert("RGB")


def save_webp(im: Image.Image, path: Path, max_width: int) -> None:
    im = flatten(im)
    if im.width > max_width:
        height = round(im.height * max_width / im.width)
        im = im.resize((max_width, height), Image.LANCZOS)
    im.save(path, "WEBP", quality=82, method=6)


def make_og(teaser: Path, path: Path) -> None:
    """1200x630 social card: the teaser centred on the page background."""
    im = flatten(Image.open(teaser))
    canvas = Image.new("RGB", (1200, 630), (251, 251, 247))
    scale = min((1200 - 96) / im.width, (630 - 96) / im.height)
    w, h = round(im.width * scale), round(im.height * scale)
    im = im.resize((w, h), Image.LANCZOS)
    canvas.paste(im, ((1200 - w) // 2, (630 - h) // 2))
    canvas.save(path, "JPEG", quality=88, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PDF_OUT.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for name, rel, max_width, kind in IMAGES:
            src = PAPER / rel
            if not src.exists():
                raise SystemExit(f"missing source: {src}")
            if kind == "pdf":
                rendered = tmpdir / name
                render_pdf(src, rendered)
                im = Image.open(rendered)
            else:
                im = Image.open(src)
            dst = OUT / f"{name}.webp"
            save_webp(im, dst, max_width)
            print(f"{dst.name:28s} {im.width:4d}x{im.height:<4d} -> "
                  f"{Image.open(dst).width:4d}x{Image.open(dst).height:<4d} "
                  f"{dst.stat().st_size / 1024:6.1f} KB")

    make_og(OUT / "teaser.webp", OUT / "og.jpg")
    print(f"og.jpg                      1200x630  {(OUT / 'og.jpg').stat().st_size / 1024:.1f} KB")

    paper_pdf = PAPER / "Tacinf_NVTech.pdf"
    if paper_pdf.exists():
        shutil.copy2(paper_pdf, PDF_OUT / "Tacinf_NVTech.pdf")
        print(f"copied paper PDF -> assets/pdf/Tacinf_NVTech.pdf "
              f"({(PDF_OUT / 'Tacinf_NVTech.pdf').stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
