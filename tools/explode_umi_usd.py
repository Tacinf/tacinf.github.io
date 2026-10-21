#!/usr/bin/env python3
"""Exploded-view variant of the handheld UMI for the comparison figure.

`handheld_umi_exploded.usd` sublayers `handheld_umi_aligned.usd` (so it inherits
the pose that lines the handheld up with the arm) and takes the device apart
along its own axes:

    +Z (camera side)   camera body + lens plate + clamp bracket + knob
    -Z (handle side)   outer housing (with the handle), cover plate, bracket, screws
    +-X (finger travel) the two fingers and the carriage blocks they sit on
    +-Z (across the body) the two linear rails
    everything else    central body block and the motor ring/discs stay put

The URDF export gives one mesh per link, so the parts are told apart exactly the
way `recolor_gripper.py` does it: split each visual mesh into connected
components ("shells") and use the shell ids that script's docstring maps to
parts.  Each moving group is re-authored as its own mesh (points and faceVarying
normals gathered per face-vertex -- the export is unwelded, so a face's three
corners are private to it), and the original meshes are hidden.

Usage:  ~/miniconda3/envs/isaac5/bin/python explode_handheld_progress.py PROGRESS OUT.usd
"""
import argparse
import os
from pathlib import Path

import numpy as np
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, Vt

PAPER = Path(os.environ.get("TACINF_PAPER", Path.home() / "docs" / "Tacinf-NVTech"))
HERE = PAPER / "figs" / "UMI_URDF" / "usd"
SRC = HERE / "handheld_umi_aligned.usd"
OUT = HERE / "handheld_umi_exploded.usd"

BASE_MESH = "/UMI______/base_link/visuals/base_link/node_STL_BINARY_/mesh"
FINGER_MESH = "/UMI______/finger_{side}_link/visuals/finger_{side}_link/node_STL_BINARY_/mesh"

# shell ids (see recolor_gripper.py) -> (group, offset in the device frame, metres)
BASE_GROUPS = {
    "camera":     dict(shells=[0, 1, 2, 52],                    offset=(0.0, 0.0, +0.060)),
    "housing":    dict(shells=[3, 7, 51, *range(8, 24)],        offset=(0.0, 0.0, -0.085)),
    "rail_up":    dict(shells=[48],                             offset=(0.0, 0.0, +0.036)),
    "rail_down":  dict(shells=[49],                             offset=(0.0, 0.0, -0.036)),
    "jaw_left":   dict(shells=[46],                             offset=(-0.045, 0.0, 0.0)),
    "jaw_right":  dict(shells=[50],                             offset=(+0.045, 0.0, 0.0)),
}
BASE_STAYS = [4, 5, 6, 47, *range(24, 46)]        # body block, motor ring/discs, small hardware
FINGER_OFFSET = {"left": (-0.070, 0.0, 0.0), "right": (+0.070, 0.0, 0.0)}

# the parts keep the material recolour_gripper.py bound to their shell
BASE_MATERIAL = {51: "white", 0: "white", 52: "white", 6: "white", 7: "white",
                 46: "white", 50: "white", 2: "white",
                 1: "black", 3: "black", 4: "black", 5: "black", 47: "black",
                 48: "steel", 49: "steel"}


def world_H(stage, path):
    m = UsdGeom.XformCache(Usd.TimeCode.Default()).GetLocalToWorldTransform(
        stage.GetPrimAtPath(path))
    return np.array([list(m[i]) for i in range(4)], float).T


def shell_labels(points: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Connected-component label per face -- same definition as recolor_gripper.py."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    _, inv = np.unique(np.round(points, 6), axis=0, return_inverse=True)
    F = inv.reshape(-1, 3)
    nv = int(F.max()) + 1
    rows = np.concatenate([F[:, 0], F[:, 1], F[:, 2]])
    cols = np.tile(np.arange(len(F)), 3)
    A = coo_matrix((np.ones(len(rows), np.int8), (rows, cols)), shape=(nv, len(F)))
    _, lab = connected_components((A.T @ A).tocsc(), directed=False)
    return lab


def copy_shell(stage, mesh, faces, path, matrix_rel, material_path):
    """Re-author `faces` of `mesh` as a standalone mesh prim."""
    pts = np.array(mesh.GetPointsAttr().Get(), float)
    nrm = np.array(mesh.GetNormalsAttr().Get(), float)
    fvi = np.array(mesh.GetFaceVertexIndicesAttr().Get(), int).reshape(-1, 3)
    fv = fvi[faces].reshape(-1)

    out = UsdGeom.Mesh.Define(stage, path)
    out.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(pts[fv]))
    out.CreateFaceVertexCountsAttr(Vt.IntArray([3] * len(faces)))
    out.CreateFaceVertexIndicesAttr(Vt.IntArray(np.arange(len(fv)).tolist()))
    out.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(nrm[fv]))
    out.SetNormalsInterpolation(UsdGeom.Tokens.faceVarying)
    UsdGeom.Xformable(out).MakeMatrixXform().Set(
        Gf.Matrix4d(*[float(v) for v in matrix_rel.T.reshape(-1)]))
    if material_path:
        UsdShade.MaterialBindingAPI.Apply(out.GetPrim()).Bind(
            UsdShade.Material(stage.GetPrimAtPath(material_path)))
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("progress", type=float)
    parser.add_argument("out")
    args = parser.parse_args()
    progress = max(0.0, min(1.0, args.progress))

    src = Usd.Stage.Open(str(SRC))
    H_root = world_H(src, "/UMI______")
    H_link = world_H(src, "/UMI______/base_link")
    mesh_prim = src.GetPrimAtPath(BASE_MESH)
    mesh = UsdGeom.Mesh(mesh_prim)
    H_mesh = world_H(src, BASE_MESH)

    pts = np.array(mesh.GetPointsAttr().Get(), float)
    fvi = np.array(mesh.GetFaceVertexIndicesAttr().Get(), int).reshape(-1, 3)
    lab = shell_labels(pts, fvi)

    # every shell must end up in exactly one place
    assigned = {}
    for group, spec in BASE_GROUPS.items():
        for s in spec["shells"]:
            assigned[s] = group
    for s in BASE_STAYS:
        assigned[s] = "stay"
    for s in range(int(lab.max()) + 1):
        assert s in assigned, f"base_link shell {s} not assigned to a group"

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    stage = Usd.Stage.CreateNew(str(out_path))
    stage.GetRootLayer().subLayerPaths.append(str(SRC))
    stage.SetDefaultPrim(stage.GetPrimAtPath("/UMI______"))
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)

    # The original base_link mesh is replaced by the per-shell copies.  It sits
    # inside the instanceable /visuals subtree, so hide the instance root -- the
    # mesh itself is an instance proxy and cannot be edited.
    assert stage.GetPrimAtPath("/UMI______/base_link/visuals").IsInstance()
    stage.OverridePrim("/UMI______/base_link/visuals").GetAttribute(
        "visibility").Set("invisible")

    parent = stage.OverridePrim("/UMI______/base_link/exploded")
    H_mesh_rel = np.linalg.inv(H_link) @ H_mesh
    n = 0
    for group, spec in BASE_GROUPS.items():
        T = np.eye(4)
        T[:3, 3] = np.array(spec["offset"], float) * progress
        for s in spec["shells"]:
            faces = np.where(lab == s)[0]
            mat = f"/UMI______/PreviewLooks/preview_{BASE_MATERIAL.get(s, 'hardware')}"
            copy_shell(stage, mesh, faces,
                       f"/UMI______/base_link/exploded/{group}_shell_{s}",
                       np.linalg.inv(H_link) @ T @ H_mesh, mat)
            n += 1
    for s in BASE_STAYS:
        faces = np.where(lab == s)[0]
        mat = f"/UMI______/PreviewLooks/preview_{BASE_MATERIAL.get(s, 'hardware')}"
        copy_shell(stage, mesh, faces,
                   f"/UMI______/base_link/exploded/body_shell_{s}",
                   H_mesh_rel, mat)
        n += 1

    # the fingers move as whole links
    for side, off in FINGER_OFFSET.items():
        T = np.eye(4)
        T[:3, 3] = np.array(off, float) * progress
        link = stage.OverridePrim(f"/UMI______/finger_{side}_link")
        H_l = np.linalg.inv(H_root) @ world_H(src, f"/UMI______/finger_{side}_link")
        UsdGeom.Xformable(link).MakeMatrixXform().Set(
            Gf.Matrix4d(*[float(v) for v in (T @ H_l).T.reshape(-1)]))
        link.GetAttribute("xformOpOrder").Set(Vt.TokenArray(["xformOp:transform"]))
    stage.GetRootLayer().Save()
    print(f"base_link: {n} shells re-authored, {len(BASE_GROUPS)} groups + body; "
          f"fingers moved by {FINGER_OFFSET}")
    print("saved:", out_path)


if __name__ == "__main__":
    main()
