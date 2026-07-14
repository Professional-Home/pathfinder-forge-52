from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "logo.png"
OUT = ROOT / "public" / "logo-mark.png"

im = Image.open(SRC).convert("RGBA")
w, h = im.size
pixels = im.load()

row_density = []
for y in range(h):
    count = 0
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if max(r, g, b) >= 28:
            count += 1
    row_density.append(count)

nonzero = [y for y, d in enumerate(row_density) if d > 20]
gaps = []
prev = nonzero[0]
for y in nonzero[1:]:
    if y - prev > 12:
        gaps.append((prev, y, y - prev))
    prev = y

print("size", im.size)
print("content rows", nonzero[0], nonzero[-1])
print("gaps", gaps[:8])

emblem_bottom = gaps[0][0] + 8 if gaps else int(h * 0.55)
emblem = im.crop((0, 0, w, emblem_bottom))
ew, eh = emblem.size
ep = emblem.load()

# Soft alpha so near-black becomes transparent and blends with any theme.
for y in range(eh):
    for x in range(ew):
        r, g, b, _ = ep[x, y]
        luma = max(r, g, b)
        alpha = 0 if luma <= 12 else min(255, int((luma - 12) * (255 / 28)))
        ep[x, y] = (r, g, b, alpha)

# Tight crop to visible pixels.
xs, ys = [], []
for y in range(eh):
    for x in range(ew):
        if ep[x, y][3] > 16:
            xs.append(x)
            ys.append(y)

pad = 8
x0, x1 = max(0, min(xs) - pad), min(ew, max(xs) + pad + 1)
y0, y1 = max(0, min(ys) - pad), min(eh, max(ys) + pad + 1)
cropped = emblem.crop((x0, y0, x1, y1))
cropped.save(OUT)
print("wrote", OUT, cropped.size)
