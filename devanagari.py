"""Devanagari text as Life seeds, and Devanagari glyphs as Life pixels."""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
    "/System/Library/Fonts/Supplemental/DevanagariMT.ttc",
    "/System/Library/Fonts/Supplemental/ITFDevanagari.ttc",
    "/System/Library/Fonts/Kohinoor.ttc",
    "/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf",
    "/usr/share/fonts/truetype/fonts-deva-extra/samanata.ttf",
    "C:/Windows/Fonts/Nirmala.ttf",
)

# Non-combining, single-column glyphs ordered roughly by ink weight. A cell's age
# picks its glyph, so a settled colony visibly thickens where it has held ground.
AGE_RAMP = ("॰", "ऽ", "।", "१", "र", "न", "म", "ब", "भ", "झ")

CONSONANTS = "कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह"

DIGITS = str.maketrans("0123456789", "०१२३४५६७८९")


def to_devanagari_digits(value: int | str) -> str:
    return str(value).translate(DIGITS)


def find_font(path: str | None = None) -> str:
    """Locate a Devanagari-capable font, preferring an explicit path."""
    if path:
        if not os.path.exists(path):
            raise FileNotFoundError(f"no font at {path}")
        return path
    for candidate in FONT_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(
        "no Devanagari font found; pass --font /path/to/font.ttf"
    )


def rasterize(text: str, height: int, font_path: str | None = None) -> np.ndarray:
    """Render `text` and return a boolean bitmap exactly `height` rows tall.

    Rendered at high resolution and downsampled, so the letterforms survive the
    trip down to a handful of rows.
    """
    if height < 3:
        raise ValueError("height must be at least 3 rows")
    font = ImageFont.truetype(find_font(font_path), 180)

    left, top, right, bottom = font.getbbox(text)
    image = Image.new("L", (right - left + 16, bottom - top + 16), 0)
    ImageDraw.Draw(image).text((8 - left, 8 - top), text, fill=255, font=font)

    ys, xs = np.nonzero(np.array(image) > 40)
    if not len(ys):
        raise ValueError(f"{text!r} rendered to an empty bitmap")
    image = image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

    width = max(1, round(image.width * height / image.height))
    image = image.resize((width, height), Image.LANCZOS)
    return np.array(image) > 115


def rasterize_to_fit(
    text: str,
    shape: tuple[int, int],
    font_path: str | None = None,
    fill: float = 0.6,
) -> np.ndarray:
    """Rasterize `text` as large as will comfortably sit inside a `shape` board."""
    rows, cols = shape
    height = max(3, int(rows * fill))
    bitmap = rasterize(text, height, font_path)

    budget = max(4, cols - 2)
    if bitmap.shape[1] > budget:
        height = max(3, int(height * budget / bitmap.shape[1]))
        bitmap = rasterize(text, height, font_path)
    return bitmap


def place(bitmap: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    """Centre a bitmap on an empty board, cropping anything that overhangs."""
    board = np.zeros(shape, dtype=bool)
    rows = min(bitmap.shape[0], shape[0])
    cols = min(bitmap.shape[1], shape[1])
    top = (shape[0] - rows) // 2
    left = (shape[1] - cols) // 2
    board[top : top + rows, left : left + cols] = bitmap[:rows, :cols]
    return board


def aksara_field(shape: tuple[int, int], rng: np.random.Generator) -> np.ndarray:
    """A fixed letter per cell, so glyphs stay put while life moves over them."""
    letters = np.array(list(CONSONANTS))
    return letters[rng.integers(0, len(letters), shape)]


def _pattern(art: str) -> np.ndarray:
    rows = [line for line in art.strip("\n").splitlines()]
    width = max(len(row) for row in rows)
    return np.array([[c == "O" for c in row.ljust(width)] for row in rows], dtype=bool)


PATTERNS: dict[str, tuple[str, np.ndarray]] = {
    "glider": ("ग्लाइडर", _pattern("""
.O.
..O
OOO
""")),
    "lwss": ("हल्का जहाज", _pattern("""
O..O.
....O
O...O
.OOOO
""")),
    "pulsar": ("पल्सर", _pattern("""
..OOO...OOO..
.............
O....O.O....O
O....O.O....O
O....O.O....O
..OOO...OOO..
.............
..OOO...OOO..
O....O.O....O
O....O.O....O
O....O.O....O
.............
..OOO...OOO..
""")),
    "rpentomino": ("आर-पेन्टोमिनो", _pattern("""
.OO
OO.
.O.
""")),
    "acorn": ("अखुवा", _pattern("""
.O.....
...O...
OO..OOO
""")),
    "gun": ("गोस्पर बन्दुक", _pattern("""
........................O...........
......................O.O...........
............OO......OO............OO
...........O...O....OO............OO
OO........O.....O...OO..............
OO........O...O.OO....O.O...........
..........O.....O.......O...........
...........O...O....................
............OO......................
""")),
}
