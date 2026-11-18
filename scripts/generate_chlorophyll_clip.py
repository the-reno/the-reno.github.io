#!/usr/bin/env python3
"""Render the Leaf chapter's silent, schematic absorption clip.

Run from any directory: python scripts/generate_chlorophyll_clip.py
Requires Python 3, Pillow, NumPy, RDKit, and ffmpeg on PATH.

Scientific / structural sources:
  https://www.rcsb.org/ligand/CLA
    Chlorophyll a, OpenEye canonical SMILES from the RCSB Chemical Component
    Dictionary. Hydrogen atoms and bond orders are omitted in this connectivity
    drawing. Heavy-atom positions are a 2D layout, not a measured conformation.
  https://goldbook.iupac.org/terms/view/E01994
    An electronically excited state has more electronic energy than the ground
    state of the same entity.
  https://pdb101.rcsb.org/motm/59
    Chlorophyll absorbs light; excitation transfer and electron transfer are
    distinct steps.

The wave packet is an illustrative photon symbol, not a literal photon shape.
The two-level panel shows molecular electronic energy, not physical height or
an electron trajectory. Orange is an editorial highlight, not emitted light.
Timing is expanded for reading; no real lifetime or transition rate is implied.
The molecule and all drawn atoms/bonds remain fixed throughout absorption.
"""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rdkit import Chem
from rdkit.Chem import rdDepictor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets" / "sunlight"
WIDTH, HEIGHT, FPS, DURATION = 960, 720, 30, 10.5
SCALE = 2
BG = (16, 19, 24)
TEXT = (236, 239, 233)
MUTED = (186, 192, 198)
FAINT = (105, 117, 127)
BOND = (114, 125, 135)
LINE = (48, 57, 67)
ORANGE = (255, 122, 26)
SANS = "/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

SMILES = (
    r"CCC1=C(C2=Cc3c(c(c4n3[Mg]56[N]2=C1C=C7N5C8=C([C@H](C(=O)C8=C7C)"
    r"C(=O)OC)C9=[N]6C(=C4)[C@H]([C@@H]9CCC(=O)OC/C=C(\C)/CCC[C@H](C)"
    r"CCC[C@H](C)CCCC(C)C)C)C)C=C)C"
)


def font(size: int, mono: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(MONO if mono else SANS, size * SCALE)


FONTS = {n: font(n) for n in (20, 22, 24, 28, 30, 32, 36, 38, 40, 42, 44, 48, 52)}


def smooth(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def mix(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def xy(point: tuple) -> tuple:
    return tuple(round(p * SCALE) for p in point)


def text(draw, position, value, size=30, color=TEXT, anchor=None):
    draw.text(xy(position), value, font=FONTS[size], fill=color, anchor=anchor)


def line(draw, points, fill, width=2):
    draw.line([xy(p) for p in points], fill=fill, width=round(width * SCALE))


def circle(draw, center, radius, fill):
    x, y = center
    draw.ellipse(xy((x - radius, y - radius, x + radius, y + radius)), fill=fill)


def geometry():
    mol = Chem.MolFromSmiles(SMILES)
    if mol is None or mol.GetNumAtoms() != 65:
        raise ValueError("Unexpected chlorophyll-a heavy-atom graph")
    mg = next(atom.GetIdx() for atom in mol.GetAtoms() if atom.GetSymbol() == "Mg")
    nitrogen = [atom.GetIdx() for atom in mol.GetAtomWithIdx(mg).GetNeighbors()]
    # A flat macrocycle is easier to read without metal-coordination edges
    # constraining the layout engine. Restore these edges in the final drawing.
    drawing = Chem.RWMol(mol)
    for atom_id in nitrogen:
        drawing.RemoveBond(mg, atom_id)
    drawing = drawing.GetMol()
    rdDepictor.Compute2DCoords(drawing)
    conformer = drawing.GetConformer()
    center = [sum(conformer.GetAtomPosition(n)[i] for n in nitrogen) / 4 for i in range(3)]
    conformer.SetAtomPosition(mg, center)
    points = np.array([[-conformer.GetAtomPosition(a.GetIdx()).x,
                        -conformer.GetAtomPosition(a.GetIdx()).y]
                       for a in mol.GetAtoms()])
    minimum, maximum = points.min(axis=0), points.max(axis=0)
    factor = min(610 / (maximum[0] - minimum[0]), 326 / (maximum[1] - minimum[1]))
    points = (points - minimum) * factor + [302, 155]
    return mol, points, mg, nitrogen


MOL, POINTS, MG, NITROGEN = geometry()
MG_X, MG_Y = POINTS[MG]
PHOTON_Y = MG_Y - 47
PHOTON_TARGET_X = MG_X - 28


def static_scene():
    scene = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), BG)
    draw = ImageDraw.Draw(scene)
    # A small ball-and-stick connectivity view, with no atomic motion.
    for bond in MOL.GetBonds():
        a, b = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        if MG in (a, b):
            # Subdued coordination lines keep the four nitrogens readable.
            line(draw, [POINTS[a], POINTS[b]], LINE, 2)
        else:
            line(draw, [POINTS[a], POINTS[b]], BOND, 2.8)
    for atom in MOL.GetAtoms():
        p, symbol = POINTS[atom.GetIdx()], atom.GetSymbol()
        if symbol == "C":
            circle(draw, p, 4.7, MUTED)
        elif symbol == "Mg":
            circle(draw, p, 24, BG)
            text(draw, p, "Mg", 24, TEXT, anchor="mm")
        else:
            circle(draw, p, 13, BG)
            text(draw, p, symbol, 22, MUTED, anchor="mm")

    text(draw, (730, 124), "Chlorophyll", 40, TEXT, anchor="mm")
    line(draw, [(48, 505), (912, 505)], LINE, 1)
    text(draw, (48, 529), "Electronic energy", 38, MUTED)
    text(draw, (48, 680), "Schematic · time expanded", 20, FAINT)
    return scene


BASE = static_scene()


def frame(t: float):
    scene = BASE.copy()
    draw = ImageDraw.Draw(scene)
    excited = smooth((t - 4.3) / 0.6)
    if t < 4.1:
        heading = "A photon arrives."
    elif t < 5.45:
        heading = "Light is absorbed."
    else:
        heading = "Chlorophyll is excited."
    text(draw, (48, 33), heading, 52, TEXT)

    # The state indicators crossfade in place; no dot moves between levels.
    for y, label, active, active_color in [
        (557, "Excited", excited, ORANGE),
        (632, "Ground", 1 - excited, TEXT),
    ]:
        text(draw, (536, y), label, 44, mix(FAINT, active_color, active), anchor="lm")
        color = mix(LINE, active_color, active)
        draw.rounded_rectangle(xy((714, y - 4, 890, y + 4)), radius=4 * SCALE, fill=color)

    lower_alpha = 1 - smooth((t - 4.3) / 0.3)
    higher_alpha = smooth((t - 4.6) / 0.3)
    if lower_alpha:
        text(draw, (48, 581), "Ground state", 48, mix(BG, TEXT, lower_alpha))
    if higher_alpha:
        text(draw, (48, 581), "Excited state", 48, mix(BG, ORANGE, higher_alpha))

    progress = smooth((t - 1.0) / 3.3)
    cx = 122 + (PHOTON_TARGET_X - 122) * progress
    visibility = 1 - smooth((t - 4.1) / 0.45)
    if visibility > 0:
        # Localized wave symbol; vanishes on absorption, with no outgoing wave.
        packet = Image.new("RGBA", scene.size)
        pd = ImageDraw.Draw(packet)
        pts = []
        for offset in np.linspace(-67, 67, 220):
            envelope = math.exp(-(offset / 39) ** 2)
            y = PHOTON_Y + 18 * envelope * math.sin(offset / 9.5 - t * 5.5)
            pts.append((cx + offset, y))
        line(pd, pts, ORANGE + (round(255 * visibility),), 3.4)
        scene = Image.alpha_composite(scene.convert("RGBA"), packet).convert("RGB")
        draw = ImageDraw.Draw(scene)
        label_visibility = 1 - smooth((t - 1.9) / 1.0)
        if label_visibility:
            text(draw, (122, PHOTON_Y + 57), "Photon", 40,
                 mix(BG, ORANGE, label_visibility), anchor="mm")

    return scene.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    video = OUT / "chlorophyll-excitation.mp4"
    poster = OUT / "chlorophyll-excitation-poster.webp"
    frame(0.7).save(poster, quality=91, method=6)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-", "-an",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        for index in range(round(DURATION * FPS)):
            process.stdin.write(frame(index / FPS).tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed")
    # Review frames are transient and do not ship with the site.
    for t in (0.7, 3.3, 4.5, 6.5):
        frame(t).save(Path("/tmp") / f"chlorophyll-review-{t:.1f}.png")
    print(f"Video: {video} ({video.stat().st_size:,} bytes)")
    print(f"Poster: {poster} ({poster.stat().st_size:,} bytes)")
    print(f"{WIDTH}x{HEIGHT}; {DURATION}s; {FPS}fps; silent")


if __name__ == "__main__":
    main()
