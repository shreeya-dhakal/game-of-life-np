"""Conway's Game of Life on a NumPy grid."""

from __future__ import annotations

import numpy as np

OFFSETS = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0)]


def parse_rule(rule: str) -> tuple[frozenset[int], frozenset[int]]:
    """Parse a rulestring like 'B3/S23' into (birth counts, survival counts)."""
    born: str | None = None
    survives: str | None = None
    for part in rule.upper().replace(" ", "").split("/"):
        if part.startswith("B"):
            born = part[1:]
        elif part.startswith("S"):
            survives = part[1:]
        else:
            raise ValueError(f"bad rule segment {part!r} in {rule!r}")
    if born is None or survives is None:
        raise ValueError(f"rule {rule!r} needs both a B and an S segment")
    if not (born + survives).isdigit() or any(c == "9" for c in born + survives):
        raise ValueError(f"rule {rule!r} may only contain neighbour counts 0-8")
    return frozenset(map(int, born)), frozenset(map(int, survives))


class Life:
    """A Life board. `grid` is the live/dead state, `age` counts unbroken generations alive."""

    def __init__(self, grid: np.ndarray, rule: str = "B3/S23", wrap: bool = True):
        self.grid = np.asarray(grid, dtype=bool)
        if self.grid.ndim != 2:
            raise ValueError("grid must be 2-D")
        self.rule = rule
        self.wrap = wrap
        self.generation = 0
        self.age = self.grid.astype(np.int32)

        born, survives = parse_rule(rule)
        self._born = np.zeros(9, dtype=bool)
        self._survives = np.zeros(9, dtype=bool)
        self._born[list(born)] = True
        self._survives[list(survives)] = True

    @property
    def population(self) -> int:
        return int(self.grid.sum())

    def neighbours(self) -> np.ndarray:
        """Live-neighbour count for every cell (0-8)."""
        g = self.grid.view(np.uint8)
        if self.wrap:
            return sum(np.roll(g, shift, (0, 1)) for shift in OFFSETS)
        h, w = g.shape
        p = np.pad(g, 1)
        return sum(p[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w] for dy, dx in OFFSETS)

    def step(self) -> np.ndarray:
        n = self.neighbours()
        self.grid = np.where(self.grid, self._survives[n], self._born[n])
        self.age = np.where(self.grid, self.age + 1, 0)
        self.generation += 1
        return self.grid


class SettleDetector:
    """Spots a board that has stopped changing, or fallen into a short-period oscillation."""

    def __init__(self, max_period: int = 12):
        self.max_period = max_period
        self._seen: dict[bytes, int] = {}

    def check(self, life: Life) -> int | None:
        """Return the oscillation period once the board repeats a recent state, else None."""
        key = life.grid.tobytes()
        previous = self._seen.get(key)
        self._seen[key] = life.generation
        if previous is not None:
            return life.generation - previous
        if len(self._seen) > self.max_period:
            oldest = min(self._seen, key=self._seen.get)  # type: ignore[arg-type]
            del self._seen[oldest]
        return None
