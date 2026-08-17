"""Watch Devanagari letterforms live and die under Conway's rules."""

from __future__ import annotations

import argparse
import shutil
import sys
import time

import numpy as np

import devanagari as dev
from life import Life, SettleDetector

RESET = "\033[0m"
HIDE_CURSOR = "\033[?25l"
SHOW_CURSOR = "\033[?25h"
CLEAR = "\033[2J\033[H"
HOME = "\033[H"

# Newborn cells run white-hot and cool toward indigo as they hold their ground.
AGE_COLOURS = (231, 223, 222, 215, 209, 203, 168, 133, 98, 61)


def board_shape(rows: int | None, cols: int | None) -> tuple[int, int]:
    """Fit the board to the terminal, two columns per cell so pixels stay square."""
    size = shutil.get_terminal_size(fallback=(100, 32))
    return (
        rows if rows else max(8, size.lines - 2),
        cols if cols else max(8, size.columns // 2),
    )


def build_seed(args: argparse.Namespace, shape: tuple[int, int]) -> np.ndarray:
    rng = np.random.default_rng(args.seed)
    if args.random is not None:
        return rng.random(shape) < args.random
    if args.pattern:
        _, bitmap = dev.PATTERNS[args.pattern]
        return dev.place(bitmap, shape)
    bitmap = dev.rasterize_to_fit(args.text, shape, args.font, args.fill)
    return dev.place(bitmap, shape)


def render(life: Life, glyphs: np.ndarray, filler: str, colour: bool) -> str:
    """Draw the board, emitting a colour escape only when the colour actually changes."""
    ages = np.clip(life.age - 1, 0, len(AGE_COLOURS) - 1).tolist()
    alive = life.grid.tolist()
    chars = glyphs.tolist()

    lines = []
    for y, row_alive in enumerate(alive):
        row: list[str] = []
        current = None
        for x, is_alive in enumerate(row_alive):
            if not is_alive:
                if current is not None:
                    row.append(RESET)
                    current = None
                row.append("  ")
                continue
            if colour:
                colour_code = AGE_COLOURS[ages[y][x]]
                if colour_code != current:
                    row.append(f"\033[38;5;{colour_code}m")
                    current = colour_code
            row.append(chars[y][x] + filler)
        if current is not None:
            row.append(RESET)
        lines.append("".join(row))
    return "\n".join(lines)


def glyph_layer(life: Life, style: str, field: np.ndarray) -> tuple[np.ndarray, str]:
    """The character shown per live cell, plus the filler that squares up the aspect."""
    if style == "block":
        return np.full(life.grid.shape, "█"), "█"
    if style == "aksara":
        return field, " "
    ramp = np.array(dev.AGE_RAMP)
    return ramp[np.clip(life.age - 1, 0, len(ramp) - 1)], " "


def status(life: Life, note: str = "") -> str:
    parts = [
        f"पुस्ता {dev.to_devanagari_digits(life.generation)}",
        f"जनसंख्या {dev.to_devanagari_digits(life.population)}",
        life.rule,
    ]
    if note:
        parts.append(note)
    return "\033[2m" + "  ·  ".join(parts) + RESET


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Conway's Game of Life, seeded and drawn in Devanagari.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "examples:\n"
            "  python main.py --text नमस्कार\n"
            "  python main.py --text जीवन --style glyph\n"
            "  python main.py --pattern gun --rule B3/S23\n"
            "  python main.py --random 0.35 --style aksara\n"
        ),
    )
    seed_group = parser.add_mutually_exclusive_group()
    seed_group.add_argument("--text", default="जीवन", help="Devanagari text to seed the board with")
    seed_group.add_argument("--pattern", choices=sorted(dev.PATTERNS), help="seed with a classic pattern")
    seed_group.add_argument("--random", type=float, metavar="DENSITY", help="seed randomly, 0.0-1.0")

    parser.add_argument("--style", choices=("block", "glyph", "aksara"), default="block",
                        help="block: solid pixels; glyph: Devanagari by cell age; aksara: a fixed letter per cell")
    parser.add_argument("--gens", type=int, default=0, help="generations to run (0 = until settled or interrupted)")
    parser.add_argument("--fps", type=float, default=12.0, help="frames per second")
    parser.add_argument("--rule", default="B3/S23", help="rulestring, e.g. B3/S23 or B36/S23")
    parser.add_argument("--no-wrap", action="store_true", help="dead edges instead of a torus")
    parser.add_argument("--no-colour", "--no-color", dest="no_colour", action="store_true", help="plain monochrome output")
    parser.add_argument("--fill", type=float, default=0.6, help="fraction of board height the text should occupy")
    parser.add_argument("--font", help="path to a Devanagari font file")
    parser.add_argument("--rows", type=int, help="board rows (default: fit terminal)")
    parser.add_argument("--cols", type=int, help="board columns (default: fit terminal)")
    parser.add_argument("--seed", type=int, help="RNG seed for --random and --style aksara")
    parser.add_argument("--run-on", action="store_true", help="keep going after the board settles")
    parser.add_argument("--list-patterns", action="store_true", help="list the built-in patterns and exit")

    args = parser.parse_args(argv)
    if args.random is not None and not 0.0 <= args.random <= 1.0:
        parser.error("--random must be between 0.0 and 1.0")
    if args.fps <= 0:
        parser.error("--fps must be positive")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.list_patterns:
        for name, (label, bitmap) in sorted(dev.PATTERNS.items()):
            print(f"  {name:<12} {label:<16} {bitmap.shape[1]}×{bitmap.shape[0]}")
        return 0

    shape = board_shape(args.rows, args.cols)
    try:
        seed = build_seed(args, shape)
        life = Life(seed, rule=args.rule, wrap=not args.no_wrap)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    field = dev.aksara_field(shape, np.random.default_rng(args.seed))
    detector = SettleDetector()
    colour = not args.no_colour and sys.stdout.isatty()
    delay = 1.0 / args.fps
    note = ""

    sys.stdout.write(HIDE_CURSOR + CLEAR)
    try:
        while True:
            glyphs, filler = glyph_layer(life, args.style, field)
            sys.stdout.write(HOME + render(life, glyphs, filler, colour) + "\n" + status(life, note) + "\033[K")
            sys.stdout.flush()

            if args.gens and life.generation >= args.gens:
                break
            if note and not args.run_on:
                break

            time.sleep(delay)
            life.step()

            if not life.population:
                note = "निर्वाण — सबै मरे"  # extinction
            elif not args.run_on:
                period = detector.check(life)
                if period == 1:
                    note = "स्थिर"  # still life
                elif period:
                    note = f"दोहोरियो — अवधि {dev.to_devanagari_digits(period)}"  # oscillation
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\n" + SHOW_CURSOR)
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
