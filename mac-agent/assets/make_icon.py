"""Draws the app icon (glowing orb with a sparkle, matching the Lottie animation).

Run: python assets/make_icon.py  -> assets/icon.png (1024x1024)
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
OUT = Path(__file__).with_name("icon.png")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def main():
    # Rounded-square background with a vertical gradient.
    bg = Image.new("RGBA", (SIZE, SIZE))
    top, bottom = (40, 30, 92, 255), (8, 8, 22, 255)
    draw = ImageDraw.Draw(bg)
    for y in range(SIZE):
        draw.line([(0, y), (SIZE, y)], fill=lerp(top, bottom, y / SIZE))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([40, 40, SIZE - 40, SIZE - 40], radius=220, fill=255)
    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), mask)

    # Glow.
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([232, 232, 792, 792], fill=(139, 123, 255, 170))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    icon = Image.alpha_composite(icon, glow)

    # Gradient ring (violet -> cyan -> pink).
    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    stops = [(139, 123, 255), (0, 212, 255), (255, 110, 199), (139, 123, 255)]
    for deg in range(360):
        t = deg / 360 * 3
        i = min(int(t), 2)
        color = lerp(stops[i], stops[i + 1], t - i) + (255,)
        rd.arc([262, 262, 762, 762], deg, deg + 2, fill=color, width=22)
    icon = Image.alpha_composite(icon, ring)

    # Core.
    core = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cd = ImageDraw.Draw(core)
    for r in range(210, 0, -2):
        t = r / 210
        cd.ellipse([512 - r, 512 - r, 512 + r, 512 + r], fill=lerp((110, 95, 255, 255), (22, 18, 52, 255), t))
    icon = Image.alpha_composite(icon, core)

    # Four-point sparkle star.
    star = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    points = []
    for k in range(8):
        angle = math.pi / 4 * k - math.pi / 2
        radius = 150 if k % 2 == 0 else 34
        points.append((512 + radius * math.cos(angle), 512 + radius * math.sin(angle)))
    ImageDraw.Draw(star).polygon(points, fill=(255, 255, 255, 255))
    star_glow = star.filter(ImageFilter.GaussianBlur(18))
    icon = Image.alpha_composite(icon, star_glow)
    icon = Image.alpha_composite(icon, star)

    # Small companion sparkle.
    small = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pts = []
    for k in range(8):
        angle = math.pi / 4 * k - math.pi / 2
        radius = 52 if k % 2 == 0 else 12
        pts.append((650 + radius * math.cos(angle), 380 + radius * math.sin(angle)))
    ImageDraw.Draw(small).polygon(pts, fill=(255, 255, 255, 235))
    icon = Image.alpha_composite(icon, small)

    icon.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    main()
