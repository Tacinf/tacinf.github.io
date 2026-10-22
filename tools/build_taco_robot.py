#!/usr/bin/env python3
"""Build a compact GLB of the posed xArm7 + Tacumi gripper from the URDF visuals.

The URDF visual STLs are low-poly (about 80k faces total).  The realworld
scene pose is the IK pregrasp above the Vitasoy, with the robot base at the
task-6 robot_base_pos.  Geometry is baked in the robot base frame; the web
viewer applies the base pose and the Z-up -> Y-up rotation.

Usage: python3 tools/build_taco_robot.py
"""
from pathlib import Path
import math
import xml.etree.ElementTree as ET

import numpy as np
import trimesh

URDF = Path.home() / "git_pkgs/xarm_umi_description/urdf/xarm_umi.urdf"
OUT = Path(__file__).resolve().parent.parent / "assets/models/taco-robot.glb"
PKG = "package://xarm_umi_description/"
MESH_ROOT = "/home/wqw/git_pkgs/xarm_umi_description/"

# IK pregrasp above the Vitasoy (radians), from the xArm URDF.
ANGLES = {
    "joint1": 0.033696,
    "joint2": 0.856240,
    "joint3": 0.291594,
    "joint4": 1.749504,
    "joint5": -0.273718,
    "joint6": 0.932917,
    "joint7": -1.177236,
    "right_grip_joint": -0.030,   # open: URDF limit [-0.048, 0]
    "left_grip_joint": 0.030,
}
WHITE = [0.88, 0.88, 0.86, 1.0]
GREY = [0.72, 0.72, 0.70, 1.0]
BLACK = [0.025, 0.025, 0.025, 1.0]


def xyz(s):
    return np.array([float(v) for v in s.split()], float) if s else np.zeros(3)


def rpy_matrix(rpy):
    r, p, y = rpy
    cr, sr = math.cos(r), math.sin(r)
    cp, sp = math.cos(p), math.sin(p)
    cy, sy = math.cos(y), math.sin(y)
    Rx = np.array([[1, 0, 0], [0, cr, -sr], [0, sr, cr]])
    Ry = np.array([[cp, 0, sp], [0, 1, 0], [-sp, 0, cp]])
    Rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def origin_matrix(el):
    if el is None:
        return np.eye(4)
    M = np.eye(4)
    M[:3, :3] = rpy_matrix(xyz(el.get("rpy", "0 0 0")))
    M[:3, 3] = xyz(el.get("xyz", "0 0 0"))
    return M


def axis_angle(axis, angle):
    a = axis / np.linalg.norm(axis)
    c, s = math.cos(angle), math.sin(angle)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    M = np.eye(4)
    M[:3, :3] = np.eye(3) + s * K + (1 - c) * (K @ K)
    return M


def main():
    root = ET.parse(URDF).getroot()
    joints = {j.get("name"): j for j in root.findall("joint")}
    links = {l.get("name"): l for l in root.findall("link")}

    # Forward kinematics from the URDF.
    world = {"world": np.eye(4)}
    # world_joint is fixed and at the origin.
    world["link_base"] = np.eye(4)
    pending = [j for j in joints.values() if j.get("name") != "world_joint"]
    while pending:
        progressed = False
        for j in pending[:]:
            parent = j.find("parent").get("link")
            child = j.find("child").get("link")
            if parent not in world:
                continue
            T = world[parent] @ origin_matrix(j.find("origin"))
            kind = j.get("type")
            if kind == "revolute":
                axis = xyz(j.find("axis").get("xyz", "0 0 1"))
                T = T @ axis_angle(axis, ANGLES.get(j.get("name"), 0.0))
            elif kind == "prismatic":
                axis = xyz(j.find("axis").get("xyz", "1 0 0"))
                T = T @ np.eye(4)
                T[:3, 3] += axis / np.linalg.norm(axis) * ANGLES.get(j.get("name"), 0.0)
            world[child] = T
            pending.remove(j)
            progressed = True
        if not progressed:
            raise RuntimeError(f"unresolved joints: {[j.get('name') for j in pending]}")

    scene = trimesh.Scene()
    n_faces = 0
    for name, link in links.items():
        for visual in link.findall("visual"):
            geom = visual.find("geometry")
            if geom is None:
                continue
            vis = origin_matrix(visual.find("origin"))
            M = world[name] @ vis
            mesh = None
            color = WHITE
            if geom.find("mesh") is not None:
                mesh_el = geom.find("mesh")
                filename = mesh_el.get("filename").replace(PKG, MESH_ROOT)
                mesh = trimesh.load(filename, force="mesh")
                mesh.apply_scale(xyz(mesh_el.get("scale", "1 1 1")))
                mesh.merge_vertices()
                mesh.fix_normals()
                if name in ("right_grip_1", "left_grip_1"):
                    color = WHITE
                elif name == "link_base":
                    color = GREY
            elif geom.find("box") is not None:
                size = xyz(geom.find("box").get("size"))
                mesh = trimesh.creation.box(extents=size)
                color = BLACK
            if mesh is None:
                continue
            mesh.apply_transform(M)
            mesh.visual = trimesh.visual.TextureVisuals(
                material=trimesh.visual.material.PBRMaterial(
                    name=f"{name}_material",
                    baseColorFactor=color,
                    metallicFactor=0.05,
                    roughnessFactor=0.48,
                )
            )
            scene.add_geometry(mesh, node_name=name, geom_name=name)
            n_faces += len(mesh.faces)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    scene.export(OUT, file_type="glb")
    print(f"faces={n_faces} nodes={len(scene.graph.nodes)} size={OUT.stat().st_size/1e6:.2f} MB")
    print("bounds", scene.bounds)


if __name__ == "__main__":
    main()
