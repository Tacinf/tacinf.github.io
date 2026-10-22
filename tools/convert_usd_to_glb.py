#!/usr/bin/env python3
"""Convert a USD asset to GLB with Isaac Sim's asset converter.

Run with the Isaac Sim Python (it starts a headless Kit app):

    ~/miniconda3/envs/isaac5/bin/python tools/convert_usd_to_glb.py input.usd output.glb

Materials are exported as UsdPreviewSurface, textures are embedded, and lights/
cameras/animations are skipped.  The resulting GLB is often very large for
photogrammetry assets; follow up with gltf-transform, e.g.

    gltf-transform optimize in.glb out.glb \
        --compress false --simplify true --simplify-ratio 0.002 \
        --simplify-error 0.01 --texture-compress webp --texture-size 512
"""
import asyncio
import os
import sys

from isaacsim import SimulationApp

app = SimulationApp({"headless": True})
import omni.kit.asset_converter  # noqa: E402


async def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: convert_usd_to_glb.py input.usd output.glb")
    source, target = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
    context = omni.kit.asset_converter.AssetConverterContext()
    context.export_preview_surface = True
    context.embed_textures = True
    context.keep_all_materials = True
    context.ignore_animations = True
    context.ignore_camera = True
    context.ignore_light = True
    context.merge_all_meshes = False
    task = omni.kit.asset_converter.get_instance().create_converter_task(
        source, target, None, context
    )
    ok = await task.wait_until_finished()
    if not ok:
        raise SystemExit(f"conversion failed: {task.get_status()} {task.get_error_message()}")
    print(f"converted {source} -> {target} ({os.path.getsize(target) / 1e6:.2f} MB)")


asyncio.get_event_loop().run_until_complete(main())
app.close()
