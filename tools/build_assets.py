#!/usr/bin/env python3
"""Build the web assets for the Tacinf project page.

Reads figures, photographs, videos and fonts from the paper repository, then
writes optimized WebP images, MP4 clips and WOFF2 fonts into the site.

    python3 tools/build_assets.py

The script is idempotent: every output is rebuilt from its source.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SITE = Path(__file__).resolve().parent.parent
PAPER = Path.home() / "docs" / "Tacinf-NVTech"
IMG_OUT = SITE / "assets" / "img"
VID_OUT = SITE / "assets" / "video"
FONT_OUT = SITE / "assets" / "fonts"
PDF_OUT = SITE / "assets" / "pdf"

PDF_DPI = 220

# (output name, source path, max width, source kind)
IMAGES = [
    ("teaser", "figs/fig01_overview/tacinf_main.png", 2000, "image"),
    ("force-decomposition", "figs/fig03_force_decomposition/force_decomposition.png", 2000, "image"),
    ("vtla-system", "figs/fig04_model_control/vtla_system.pdf", 1600, "pdf"),
    ("force-loop", "figs/fig04_model_control/force_feedback_loop.pdf", 1400, "pdf"),
    ("taco-loop", "figs/fig06_taco_data_loop/taco_data_loop.pdf", 1600, "pdf"),
    ("agreement", "figs/fig09_agreement_bars/agreement_bars.png", 1600, "image"),
    ("controller-firm", "figs/fig10_force_feedback/firm_first151.png", 1200, "image"),
    ("controller-gentle", "figs/fig10_force_feedback/gentle_first151.png", 1200, "image"),
    ("controller-no-ff", "figs/fig10_force_feedback/gentle_woff_first151.png", 1200, "image"),
    ("controller-no-adm", "figs/fig10_force_feedback/gentle_woall_first151.png", 1200, "image"),
    ("tacumi-hardware", "exp_sup/gripper.jpg", 1600, "image"),
]

# Videos: (output, source, start seconds, duration seconds, max width, crf)
VIDEOS = [
    ("tacumi-streams", "exp_sup/tacumi_real_multimodal_observation_stream.mp4", 1.0, 12.0, 720, 31),
    ("tacumi-sync", "exp_sup/tacumi_real_sensor_timestamp_alignment.mp4", 1.0, 10.0, 900, 31),
    ("tacumi-multiview", "exp_sup/tacumi_real_multiview_tactile_stream.mp4", 0.5, 8.0, 640, 31),
    ("taco-real2sim", "exp_sup/real2sim.mp4", 0.0, 5.8, 1000, 30),
]

FONTS = [
    ("nvidia-sans-regular.woff2", "NVIDIASans_Rg.ttf"),
    ("nvidia-sans-medium.woff2", "NVIDIASans_Md.ttf"),
    ("nvidia-sans-bold.woff2", "NVIDIASans_Bd.ttf"),
    ("nvidia-sans-bolditalic.woff2", "NVIDIASans_BdIt.ttf"),
]


def run(cmd: list[str], **kwargs) -> None:
    subprocess.run(cmd, check=True, **kwargs)


def render_pdf(src: Path, dst: Path) -> None:
    run(["pdftoppm", "-png", "-r", str(PDF_DPI), "-singlefile", str(src), str(dst)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    produced = dst.with_suffix(".png")
    if produced != dst and produced.exists():
        produced.replace(dst)


def flatten(im: Image.Image, background=(255, 255, 255)) -> Image.Image:
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, background)
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im.convert("RGB")


def save_webp(im: Image.Image, path: Path, max_width: int, quality: int = 82) -> None:
    im = flatten(im)
    if im.width > max_width:
        height = round(im.height * max_width / im.width)
        im = im.resize((max_width, height), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6)


def save_webp_alpha(im: Image.Image, path: Path, max_side: int, quality: int = 90) -> None:
    im = im.convert("RGBA")
    if max(im.size) > max_side:
        scale = max_side / max(im.size)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6, lossless=False)


def key_background(im: Image.Image, bg: tuple[int, int, int], tol: float, feather: float = 3.0) -> Image.Image:
    """Remove a flat studio background, keeping soft anti-aliased edges."""
    rgba = im.convert("RGBA")
    arr = np.asarray(rgba).astype(np.int16)
    dist = np.sqrt(((arr[..., :3] - np.array(bg)) ** 2).sum(-1))
    alpha = np.clip((dist - tol) / max(1.0, feather), 0.0, 1.0)
    out = arr.copy()
    out[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def crop_alpha(im: Image.Image, pad: int = 16) -> Image.Image:
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def duotone(im: Image.Image, dark: tuple[int, int, int], light: tuple[int, int, int]) -> Image.Image:
    """Map luminance onto a two-colour ramp inside the alpha channel."""
    rgba = np.asarray(im.convert("RGBA")).astype(np.float32)
    lum = (0.2126 * rgba[..., 0] + 0.7152 * rgba[..., 1] + 0.0722 * rgba[..., 2]) / 255.0
    lum = np.clip(lum, 0, 1)[..., None]
    d = np.array(dark, dtype=np.float32)
    l = np.array(light, dtype=np.float32)
    rgb = d + (l - d) * lum
    out = np.dstack([rgb, rgba[..., 3]]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def build_cutouts() -> None:
    """Transparent, high-contrast renders used as the hero composition."""
    green_panels = PAPER / "figs" / "Gripper_URDF" / "panels_green"
    for src_name, out_name, max_side in [
        ("arm.png", "hero-arm.webp", 1300),
        ("handheld.png", "hero-handheld.webp", 1200),
    ]:
        im = Image.open(green_panels / src_name).convert("RGBA")
        cut = key_background(im, (191, 204, 194), tol=15, feather=3)
        cut = crop_alpha(cut, pad=12)
        save_webp_alpha(cut, IMG_OUT / out_name, max_side)



def build_images() -> None:
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
            dst = IMG_OUT / f"{name}.webp"
            save_webp(im, dst, max_width)
            print(f"{dst.name:30s} {im.width:4d}x{im.height:<4d} -> "
                  f"{Image.open(dst).width:4d}x{Image.open(dst).height:<4d} "
                  f"{dst.stat().st_size / 1024:6.1f} KB")
    build_cutouts()


def build_videos() -> None:
    VID_OUT.mkdir(parents=True, exist_ok=True)
    for name, rel, start, duration, max_width, crf in VIDEOS:
        src = PAPER / rel
        if not src.exists():
            raise SystemExit(f"missing video: {src}")
        dst = VID_OUT / f"{name}.mp4"
        vf = f"scale='min({max_width},iw)':-2,fps=20"
        run([
            "ffmpeg", "-loglevel", "error", "-y",
            "-ss", str(start), "-t", str(duration), "-i", str(src),
            "-vf", vf,
            "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
            "-crf", str(crf), "-preset", "slow", "-movflags", "+faststart",
            "-an", str(dst),
        ])
        poster = IMG_OUT / f"poster-{name}.webp"
        run([
            "ffmpeg", "-loglevel", "error", "-y",
            "-ss", str(start + min(0.8, duration / 4)), "-i", str(src),
            "-frames:v", "1", "-vf", f"scale='min({max_width},iw)':-2",
            str(poster.with_suffix(".png")),
        ])
        save_webp(Image.open(poster.with_suffix(".png")), poster, max_width, quality=80)
        poster.with_suffix(".png").unlink(missing_ok=True)
        print(f"{dst.name:30s} {dst.stat().st_size / 1024:8.1f} KB  "
              f"poster {poster.stat().st_size / 1024:6.1f} KB")


def build_fonts() -> None:
    FONT_OUT.mkdir(parents=True, exist_ok=True)
    unicodes = ("U+0020-007E,U+00A0-00FF,U+0370-03FF,"
                "U+2000-206F,U+2190-21FF,U+2200-22FF,U+25A0-25FF")
    for out_name, src_name in FONTS:
        src = PAPER / "NVIDIA-Sans-Font-TTF" / src_name
        if not src.exists():
            raise SystemExit(f"missing font: {src}")
        dst = FONT_OUT / out_name
        run([
            "pyftsubset", str(src),
            f"--unicodes={unicodes}",
            "--flavor=woff2",
            f"--output-file={dst}",
            "--layout-features=*",
            "--no-hinting",
        ])
        print(f"{dst.name:32s} {dst.stat().st_size / 1024:6.1f} KB")


def make_og() -> None:
    """1200x630 social card in the page's black / system-green language."""
    W, H = 1200, 630
    base = Image.new("RGB", (W, H), (0, 0, 0)).convert("RGBA")

    # soft product glow on the right
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(470, 0, -10):
        alpha = int(26 * (1 - r / 470))
        gd.ellipse([980 - r, 300 - r, 980 + r, 300 + r], fill=(48, 209, 88, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    base = Image.alpha_composite(base, glow)

    arm = Image.open(IMG_OUT / "hero-arm.webp").convert("RGBA")
    scale = (H - 50) / arm.height
    arm = arm.resize((round(arm.width * scale), round(arm.height * scale)), Image.LANCZOS)
    base.alpha_composite(arm, (980 - arm.width // 2, (H - arm.height) // 2 + 10))

    canvas = base.convert("RGB")
    draw = ImageDraw.Draw(canvas)

    font_display = ImageFont.truetype(str(PAPER / "NVIDIA-Sans-Font-TTF" / "NVIDIASans_Bd.ttf"), 112)
    font_sub = ImageFont.truetype(str(PAPER / "NVIDIA-Sans-Font-TTF" / "NVIDIASans_Md.ttf"), 27)
    font_small = ImageFont.truetype(str(PAPER / "NVIDIA-Sans-Font-TTF" / "NVIDIASans_Rg.ttf"), 18)

    white = (245, 245, 247)
    gray = (161, 161, 166)
    gray_2 = (110, 110, 115)
    green = (48, 209, 88)

    draw.text((72, 74), "Tac", font=font_display, fill=white)
    tac_w = draw.textlength("Tac", font=font_display)
    draw.text((72 + tac_w, 74), "inf", font=font_display, fill=green)

    draw.text((74, 232), "A unified tactile infrastructure", font=font_sub, fill=gray)
    draw.text((74, 268), "for robot manipulation.", font=font_sub, fill=gray)

    draw.ellipse([74, 352, 80, 358], fill=green)
    draw.text((90, 343), "Technical report · 2026", font=font_small, fill=gray_2)

    draw.text((74, 400), "Tacumi · Tabero · VTLA · Taco", font=font_small, fill=gray)
    draw.text((74, H - 58), "tacinf.github.io", font=font_small, fill=white)

    canvas.save(IMG_OUT / "og.jpg", "JPEG", quality=90, optimize=True)
    print(f"og.jpg                         1200x630  {(IMG_OUT / 'og.jpg').stat().st_size / 1024:.1f} KB")


def copy_paper() -> None:
    PDF_OUT.mkdir(parents=True, exist_ok=True)
    paper_pdf = PAPER / "Tacinf_NVTech.pdf"
    if paper_pdf.exists():
        shutil.copy2(paper_pdf, PDF_OUT / "Tacinf_NVTech.pdf")
        print(f"copied paper PDF -> assets/pdf/Tacinf_NVTech.pdf "
              f"({(PDF_OUT / 'Tacinf_NVTech.pdf').stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    build_images()
    build_videos()
    build_fonts()
    make_og()
    copy_paper()


if __name__ == "__main__":
    main()
