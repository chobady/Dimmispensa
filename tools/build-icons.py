#!/usr/bin/env python3
"""Genera src/icons-data.js (tutte le icone pixel come data-URI), la mascotte e le icone dell'app.

Uso:  python3 tools/build-icons.py [cartella_emoji_serenity]
Senza argomenti usa assets/serenity-emoji (le PNG gia' copiate nel repo).

Fonti:
- assets/serenity-emoji/*.png : emoji pixel di SerenityOS (licenza BSD 2-Clause, vedi LICENSE li' dentro)
- tools/custom-icons.txt      : icone 10x10 disegnate per Dimmispensa
"""
import base64, io, json, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "serenity-emoji")
KEEP = os.path.join(ROOT, "assets", "serenity-emoji")

PALETTE = {
    ".": None,
    "k": "#2b2140", "w": "#ffffff", "g": "#c8c8d0", "G": "#8a8a9a",
    "r": "#e0443c", "R": "#a52a2a", "o": "#f08a24", "O": "#b85c12",
    "y": "#f7d038", "Y": "#c99a1c", "n": "#7a4a22", "N": "#4a2c14",
    "t": "#e8c690", "T": "#c89858", "l": "#7ac74f", "L": "#3a8a3a",
    "b": "#4fa4d8", "B": "#2a6aa8", "c": "#9fd8e8", "p": "#f4a6c0",
    "P": "#d0607a", "v": "#8a5ac8", "V": "#5a3a98", "e": "#f8f0d8",
    "s": "#f58c6c", "S": "#d0603c", "m": "#a02868", "M": "#701848",
    "q": "#f8c8c0", "Q": "#e09890",
}

# Emoji usate: intervalli "cibo e bevande" + singoli codepoint (animali, oggetti, interfaccia)
RANGES = [(0x1F32D, 0x1F37F), (0x1F950, 0x1F96F), (0x1F9C0, 0x1F9CB), (0x1FAD0, 0x1FADC)]
SINGLES = """
1F414 1F416 1F404 1F411 1F407 1F983 1F986 1F41F 1F420 1F990 1F991 1F980 1F99E 1F419 1F9AA
1F33F 1F331 1F382 1F383 1F344_200D_1F7EB 2615 1F9FA 1F4E6 1F6D2 1F37D 1F9FE
1F4C5 1F4F7 1F3A4 2699 1F5D1 2B50 1F3B2 1F50D 270F 2705 274C 2795 26A0 1F480 1F525 2744
1F3E0 23F0 2764 1F4A4 1F511 1F465 1F50A 1F507 2728 1F916 1F6AA 1F517 1F4DD 1F514 1F4A1 231B
1F44D 1F389 1F47B 1F4A7 2328 1F319 2600 1F4F1 1F4BE 1F504 1F3AE 1F579 1F451 1F4AA 1F60B 1F634
""".split()


def hex_rgba(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def parse_custom(path):
    icons, name, rows = {}, None, []
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if line.startswith("#") or not line.strip():
            continue
        if line.startswith("@"):
            if name:
                icons[name] = rows
            name, rows = line[1:].strip(), []
        else:
            rows.append(line)
    if name:
        icons[name] = rows
    return icons


def draw(rows, name="?"):
    h, w = len(rows), len(rows[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        if len(row) != w:
            raise SystemExit(f"icona {name}: riga {y} lunga {len(row)} invece di {w}: {row!r}")
        for x, ch in enumerate(row):
            if ch not in PALETTE:
                raise SystemExit(f"icona {name}: carattere sconosciuto {ch!r}")
            if PALETTE[ch]:
                im.putpixel((x, y), hex_rgba(PALETTE[ch]))
    return im


def pad(im, size=10):
    im = im.convert("RGBA")
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, ((size - im.width) // 2, size - im.height), im)
    return out


def data_uri(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


MASCOT = [
    "..kkkkkkkkkk..",
    ".kwwcccccccbk.",
    ".kwccccccccbk.",
    ".kcckcccckcbk.",
    ".kcckcccckcbk.",
    ".kcccccccccbk.",
    ".kcpckkkcpcbk.",
    ".kcccccccccbk.",
    ".kkkkkkkkkkkk.",
    ".kwccccccccbk.",
    ".kcGcccccccbk.",
    ".kcGcccccccbk.",
    ".kcGcccccccbk.",
    ".kcccccccccbk.",
    ".kbbbbbbbbbbk.",
    "..kk......kk..",
]
MASCOT_BLINK = list(MASCOT)
MASCOT_BLINK[3] = ".kcccccccccbk."
MASCOT_BLINK[4] = ".kckkccckkcbk."
MASCOT_HAPPY = list(MASCOT)
MASCOT_HAPPY[3] = ".kcckcccckcbk."
MASCOT_HAPPY[4] = ".kckckcckckbk."
MASCOT_WORRY = list(MASCOT)
MASCOT_WORRY[2] = ".kwcckcckccbk."
MASCOT_WORRY[6] = ".kccckkkkccbk."
MASCOT_WORRY[7] = ".kcckcccckcbk."


def main():
    os.makedirs(KEEP, exist_ok=True)
    icons = {}
    wanted = []
    for a, b in RANGES:
        wanted += ["%X" % c for c in range(a, b + 1)]
    wanted += SINGLES
    missing = []
    for code in dict.fromkeys(wanted):
        fname = "_".join("U+" + part for part in code.split("_")) + ".png"
        p = os.path.join(SRC, fname)
        if not os.path.exists(p):
            missing.append(code)
            continue
        if os.path.abspath(SRC) != os.path.abspath(KEEP):
            shutil.copyfile(p, os.path.join(KEEP, fname))
        icons[code.lower().replace("_", "-")] = pad(Image.open(p))
    for name, rows in parse_custom(os.path.join(ROOT, "tools", "custom-icons.txt")).items():
        if len(rows) != 10:
            raise SystemExit(f"icona {name}: {len(rows)} righe invece di 10")
        icons[name] = draw(rows, name)

    mascot = {
        "idle": draw(MASCOT, "mascot"),
        "blink": draw(MASCOT_BLINK, "blink"),
        "happy": draw(MASCOT_HAPPY, "happy"),
        "worry": draw(MASCOT_WORRY, "worry"),
    }

    with open(os.path.join(ROOT, "src", "icons-data.js"), "w", encoding="utf-8") as f:
        f.write("// File generato da tools/build-icons.py: non modificare a mano.\n")
        f.write("export const ICONS = " + json.dumps({k: data_uri(v) for k, v in icons.items()}, indent=0) + ";\n")
        f.write("export const MASCOT = " + json.dumps({k: data_uri(v) for k, v in mascot.items()}, indent=0) + ";\n")

    # Icone dell'app (mascotte su sfondo viola)
    pub = os.path.join(ROOT, "public")
    os.makedirs(pub, exist_ok=True)
    for size, fname in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png"), (32, "favicon.png")]:
        grid = 24
        base = Image.new("RGBA", (grid, grid), hex_rgba("#6b4fbb"))
        for i in range(grid):  # bordino piu' scuro in basso, come un tasto
            for j in range(grid - 2, grid):
                base.putpixel((i, j), hex_rgba("#4a3490"))
        m = mascot["idle"]
        base.paste(m, ((grid - m.width) // 2, (grid - m.height) // 2 - 1), m)
        base.resize((size, size), Image.NEAREST).convert("RGB").save(os.path.join(pub, fname))

    # Foglio di anteprima
    names = list(icons)
    S, cell, cols = 5, 78, 16
    sheet = Image.new("RGB", (cols * cell, ((len(names) + cols - 1) // cols) * cell), (230, 242, 196))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        im = icons[n].resize((10 * S, 10 * S), Image.NEAREST)
        sheet.paste(im, ((i % cols) * cell + 14, (i // cols) * cell + 6), im)
        d.text(((i % cols) * cell + 2, (i // cols) * cell + 62), n[:12], fill=(43, 33, 64))
    sheet.save(os.path.join(ROOT, "tools", "anteprima-icone.png"))
    ms = Image.new("RGB", (4 * 14 * 8 + 50, 16 * 8 + 20), (230, 242, 196))
    for i, k in enumerate(mascot):
        im = mascot[k].resize((14 * 8, 16 * 8), Image.NEAREST)
        ms.paste(im, (10 + i * (14 * 8 + 10), 10), im)
    ms.save(os.path.join(ROOT, "tools", "anteprima-mascotte.png"))
    print(f"{len(icons)} icone ({len(parse_custom(os.path.join(ROOT, 'tools', 'custom-icons.txt')))} disegnate a mano). Mancanti nel pack: {missing}")


if __name__ == "__main__":
    main()
