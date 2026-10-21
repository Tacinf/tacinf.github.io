#!/usr/bin/env python3
"""Headless Kit renderer adapted from the Tacinf paper repository.

This is `figs/tools/render_kit_preview.py` from ~/docs/Tacinf-NVTech with one
addition: `--camera-usd` lets every frame of a sequence share the camera
framing of a reference asset (the fully exploded USD), so an explosion can be
rendered without the camera zooming between frames.

Run with the Isaac Sim environment, e.g.
    ~/miniconda3/envs/isaac5/bin/python tools/render_kit_preview_fixed.py ...
"""
"""Render a USD asset with Isaac Sim's own renderer (headless Kit), in the same
style as figs/UMI_URDF/usd/preview.png: 3/4 front-left view, one white dome +
one warm sun, viewport grid off.

Usage:
    ~/miniconda3/envs/isaac5/bin/python render_kit_preview.py <asset.usd> <out.png>
        [--dir x,y,z] [--dist-factor 3.15] [--focal 28.0]
        [--bg r,g,b] [--backdrop r,g,b] [--dome-intensity 700] [--res WxH]

The camera is derived from the asset's bounding box, so any USD gets the same
presentation:   direction (0.5, -1.0, 0.35) (normalized), distance =
3.15 * largest bbox extent, 28 mm lens, target = bbox centre + 1% height.
(Kit's default viewport background is a light grey that sits too close to the
white printed parts; --bg colours the dome instead, which tints the background
and the fill light together -- e.g. `--bg 0.24,0.30,0.40` gives a slate
blue-grey backdrop.)

A pale backdrop is where colouring the dome stops working: pale light washes
the parts out until they sit at the same brightness as the backdrop. --backdrop
adds a flat emissive plane behind the asset instead, and then the dome is only
the fill light: `--bg 0.30,0.30,0.30 --backdrop 0.463,0.592,0.486` keeps the
parts as bright as in the blue-grey figures on a pale sage-green background.

Whatever camera this places can be reproduced outside Kit for annotation:
`figs/tools/kit_view.py` has the same model and projects world points to pixel
coordinates.
"""
import sys

# Kit-specific switches must be on the command line before SimulationApp starts.
for flag in ("--/persistent/app/viewport/grid/enabled=false",
             "--/app/viewport/grid/enabled=false"):
    if flag not in sys.argv:
        sys.argv.append(flag)

# ... and so must the render resolution, which the capture inherits.
_res = (1280, 720)
for i, a in enumerate(sys.argv):
    if a == "--res" and i + 1 < len(sys.argv):
        _res = tuple(int(v) for v in sys.argv[i + 1].lower().split("x"))
    elif a.startswith("--res="):
        _res = tuple(int(v) for v in a.split("=", 1)[1].lower().split("x"))

import argparse
import os

from isaacsim import SimulationApp

app_kit = SimulationApp({"headless": True, "width": _res[0], "height": _res[1]})

import omni.kit.app
import omni.kit.viewport.utility as vpu
import omni.usd
from pxr import Gf, Sdf, Usd, UsdGeom, UsdLux, UsdShade

# the plane has to fill the frame at its distance; tan of the horizontal
# half-angle, i.e. (aperture/2) / focal, as in kit_view.py
def _tan_half_aperture(focal):
    return (20.955 / 2) / focal


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("usd", help="asset to render")
    parser.add_argument("out", help="output PNG path")
    parser.add_argument("--dir", default="0.5,-1.0,0.35",
                        help="camera direction from the object (x,y,z)")
    parser.add_argument("--dist-factor", type=float, default=3.15)
    parser.add_argument("--focal", type=float, default=28.0)
    parser.add_argument("--bg", default="1,1,1",
                        help="dome colour (r,g,b in 0..1); sets the background")
    parser.add_argument("--camera-usd", default=None,
                        help="derive the camera bbox from this USD instead of the rendered asset")
    parser.add_argument("--backdrop", default=None,
                        help="flat colour (r,g,b in 0..1) on a backdrop plane; "
                             "the background then no longer lights the asset, "
                             "so it can be pale without washing the parts out")
    parser.add_argument("--dome-intensity", type=float, default=700.0)
    parser.add_argument("--res", default=f"{_res[0]}x{_res[1]}",
                        help="render resolution WxH (read before Kit starts)")
    args, _ = parser.parse_known_args()

    app = omni.kit.app.get_app()
    ctx = omni.usd.get_context()
    usd_path = os.path.abspath(args.usd)
    print("open:", ctx.open_stage(usd_path))
    for _ in range(120):
        app.update()
    stage = ctx.get_stage()

    dome = UsdLux.DomeLight.Define(stage, "/PreviewDome")
    dome.CreateColorAttr().Set(Gf.Vec3f(*[float(v) for v in args.bg.split(",")]))
    dome.CreateIntensityAttr(args.dome_intensity)
    sun = UsdLux.DistantLight.Define(stage, "/PreviewSun")
    sun.CreateIntensityAttr(2800.0)
    sun.AddRotateXYZOp().Set(Gf.Vec3f(40.0, 0.0, 125.0))

    if args.camera_usd:
        ref_stage = Usd.Stage.Open(os.path.abspath(args.camera_usd))
        root = ref_stage.GetDefaultPrim() or ref_stage.GetPseudoRoot()
    else:
        root = stage.GetDefaultPrim()
        if not root:
            root = stage.GetPseudoRoot()
    cache = UsdGeom.BBoxCache(Usd.TimeCode.Default(), [UsdGeom.Tokens.default_])
    b = cache.ComputeWorldBound(root).ComputeAlignedBox()
    mn, mx = b.GetMin(), b.GetMax()
    center = (mn + mx) * 0.5
    size = mx - mn
    maxd = max(size[0], size[1], size[2])

    cam = UsdGeom.Camera.Define(stage, "/PreviewCam")
    cam.CreateFocalLengthAttr().Set(args.focal)
    cam.CreateClippingRangeAttr().Set(Gf.Vec2f(0.01, 1000.0))
    direction = Gf.Vec3d(*[float(v) for v in args.dir.split(",")])
    campos = center + direction.GetNormalized() * (maxd * args.dist_factor)
    target = Gf.Vec3d(center[0], center[1], center[2] + size[2] * 0.01)
    UsdGeom.Xformable(cam).AddTransformOp().Set(
        Gf.Matrix4d().SetLookAt(campos, target, Gf.Vec3d(0, 0, 1)).GetInverse())

    if args.backdrop:
        # a plane perpendicular to the view, far enough behind the asset to
        # cover the whole frame, sized to the frame at that distance
        forward = (target - campos).GetNormalized()
        centre = Gf.Vec3d(*center)
        pos = centre + forward * (maxd * 1.2)
        n = -forward                                     # normal -> the camera
        x = Gf.Vec3d(0, 0, 1).GetCross(n).GetNormalized()
        y = n.GetCross(x).GetNormalized()
        half = _tan_half_aperture(args.focal) * (pos - campos).GetLength() * 1.3
        plane = UsdGeom.Mesh.Define(stage, "/PreviewBackdrop")   # one quad
        plane.CreatePointsAttr([Gf.Vec3f(-half, -half, 0), Gf.Vec3f(half, -half, 0),
                                Gf.Vec3f(half, half, 0), Gf.Vec3f(-half, half, 0)])
        plane.CreateFaceVertexCountsAttr([4])
        plane.CreateFaceVertexIndicesAttr([0, 1, 2, 3])
        plane.CreateNormalsAttr([Gf.Vec3f(0, 0, 1)] * 4)
        UsdGeom.Xformable(plane).AddTransformOp().Set(Gf.Matrix4d(
            x[0], x[1], x[2], 0, y[0], y[1], y[2], 0,
            n[0], n[1], n[2], 0, pos[0], pos[1], pos[2], 1))
        # pure emission with no diffuse and no specular: the plane shows exactly
        # its colour whatever the lights do, and takes no shadow from the asset
        material = UsdShade.Material.Define(stage, "/PreviewBackdropMat")
        shade = UsdShade.Shader.Define(stage, "/PreviewBackdropMat/Surface")
        shade.CreateIdAttr("UsdPreviewSurface")
        for name, value in (("emissiveColor", [float(v) for v in args.backdrop.split(",")]),
                            ("diffuseColor", [0.0, 0.0, 0.0]),
                            ("specularColor", [0.0, 0.0, 0.0]),
                            ("roughness", 1.0)):
            shade.CreateInput(name, Sdf.ValueTypeNames.Float
                              if isinstance(value, float) else
                              Sdf.ValueTypeNames.Color3f).Set(
                                  value if isinstance(value, float) else Gf.Vec3f(*value))
        material.CreateSurfaceOutput().ConnectToSource(shade.ConnectableAPI(), "surface")
        UsdShade.MaterialBindingAPI.Apply(plane.GetPrim()).Bind(material)

    vp = vpu.get_active_viewport()
    vp.camera_path = "/PreviewCam"
    for _ in range(80):
        app.update()
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    vpu.capture_viewport_to_file(vp, out)
    # the PNG is written asynchronously; give it time to land
    for _ in range(60):
        app.update()
    # Kit's shutdown can drop buffered stdout, so flush every line as it happens
    print("saved:", out, os.path.exists(out),
          "size:", tuple(int(v) for v in args.res.lower().split("x")),
          "dir:", args.dir, "dist-factor:", args.dist_factor, "bg:", args.bg,
          "backdrop:", args.backdrop, flush=True)


if __name__ == "__main__":
    main()
    app_kit.close()
