"""Turn the Lottie animation (assets/karishma_orb.json) into small PNG frames for the orb.

Frames are cached in ~/.karishma/orb_frames_<size>_<hash>/ so this runs only once.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

log = logging.getLogger("karishma.lottie")
ASSET = Path(__file__).resolve().parent / "assets" / "karishma_orb.json"


def _gradient(size: tuple[int, int]):
    """Diagonal violet -> pink -> blue gradient (Siri-like), so the stars show on any wallpaper."""
    from PIL import Image

    w, h = size
    stops = [(124, 58, 237), (236, 72, 153), (59, 130, 246)]
    grad = Image.new("RGB", (w, h))
    px = grad.load()
    for y in range(h):
        for x in range(w):
            t = (x / max(1, w - 1) + y / max(1, h - 1)) / 2
            a, b, k = (stops[0], stops[1], t * 2) if t < 0.5 else (stops[1], stops[2], (t - 0.5) * 2)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))
    return grad


def render_frames(cache_root: Path, size: int, step: int = 1, color: str = "gradient") -> list[Path]:
    """Return PNG paths (one per frame). Empty list if rendering isn't possible.
    color: "gradient" (violet/pink/blue stars) or "white" (as designed)."""
    if not ASSET.exists():
        return []
    digest = hashlib.sha1(ASSET.read_bytes()).hexdigest()[:10]
    out = cache_root / f"orb_frames_{size}_{step}_{color}_{digest}"
    done = out / ".done"
    if done.exists():
        return sorted(out.glob("f_*.png"))
    try:
        from rlottie_python import LottieAnimation
    except Exception as e:  # noqa: BLE001
        log.warning("rlottie not available: %s", e)
        return []
    out.mkdir(parents=True, exist_ok=True)
    anim = LottieAnimation.from_file(str(ASSET))
    total = anim.lottie_animation_get_totalframe()
    w, h = anim.lottie_animation_get_size()
    fh = max(1, round(size * h / w))
    paths = []
    grad = _gradient((size, fh)) if color != "white" else None
    for i in range(0, total, step):
        im = anim.render_pillow_frame(frame_num=i, width=size, height=fh)
        if grad is not None:
            tinted = grad.convert("RGBA")
            tinted.putalpha(im.getchannel("A"))
            im = tinted
        p = out / f"f_{i:04d}.png"
        im.save(p)
        paths.append(p)
    done.write_text(str(len(paths)))
    return paths
