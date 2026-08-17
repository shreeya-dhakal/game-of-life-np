# conway-np

Conway's Game of Life on a NumPy grid — seeded with Devanagari letterforms, and drawn with Devanagari glyphs.

Type a word, and its letters become the initial colony. The shirorekha (the top bar) is a long horizontal line, so it holds for a few generations before eroding; bowls and stems collapse fast; the counters inside क and म tend to leave still lifes behind. Words dissolve differently depending on how they're shaped.

## Install

```sh
pip install -r requirements.txt
```

Needs a Devanagari font. macOS and most Linux distros ship one and it's found automatically; otherwise pass `--font /path/to/font.ttf`.

## Use

```sh
python main.py                              # seeds with जीवन
python main.py --text नमस्कार
python main.py --text कमल --style glyph
python main.py --pattern gun --rule B36/S23
python main.py --random 0.35 --style aksara --seed 7
```

`Ctrl-C` to stop. The board fits itself to the terminal; `--rows`/`--cols` override that.

### Styles

| `--style` | Live cells drawn as |
|---|---|
| `block` (default) | solid blocks — the most legible for reading the letterforms |
| `glyph` | a Devanagari glyph chosen by cell age, from `॰` for newborns up to `झ` for long-settled cells |
| `aksara` | a fixed random consonant per cell, so the letters stay put while life moves across them |

In colour, cell age runs from white-hot newborns down to indigo for cells that have held their ground. Colour is skipped automatically when output isn't a terminal.

### Options worth knowing

- `--rule B3/S23` — any B/S rulestring. `B36/S23` (HighLife) and `B34/S34` (3-4 Life) both chew through text nicely.
- `--no-wrap` — dead edges instead of a torus, so gliders crash rather than wrap around.
- `--fill 0.6` — how much of the board height the text takes up.
- `--gens N` — run a fixed number of generations, then stop.
- `--run-on` — don't stop when the board settles.
- `--list-patterns` — the built-in classics (glider, LWSS, pulsar, R-pentomino, acorn, Gosper gun).

The run stops on its own when the board goes still, starts oscillating, or dies out, and says which in the status line: `स्थिर` (still), `दोहोरियो — अवधि २` (period-2 oscillation), `निर्वाण — सबै मरे` (extinct).

## A note on text shaping

Seed text is rasterized with Pillow. If Pillow was built without [libraqm](https://github.com/HOST-Oman/libraqm), it has no complex-script shaping: standalone consonants (`कखग`, `कमल`, `नमन`) render perfectly, but matras and conjuncts (the `ी` in `जीवन`, the `स्ते` in `नमस्ते`) are laid out as separate glyphs rather than being properly composed. Still readable, just not correctly typeset.

Check with `python -c "from PIL import features; print(features.check('raqm'))"`. To fix it on macOS:

```sh
brew install libraqm
pip install --force-reinstall --no-binary :all: pillow
```

## Files

- [life.py](life.py) — the engine. Neighbour counts via eight `np.roll` shifts on a torus, or eight padded slices with dead edges. Tracks per-cell age and detects settling.
- [devanagari.py](devanagari.py) — text rasterization, the age→glyph ramp, Devanagari numerals, and the pattern library.
- [main.py](main.py) — CLI and terminal renderer.
