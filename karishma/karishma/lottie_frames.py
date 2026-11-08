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


# ---------------------------------------------------------------------------
# Vector version: every frame becomes a few polygons (one per star). Canvas
# polygons draw reliably in the transparent macOS window, unlike photo images.
_RING = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]  # clockwise


def _trace(mask, start):
    """Moore-neighbour boundary tracing of the blob containing `start` (its top-left pixel)."""
    h, w = mask.shape

    def fg(r, c):
        return 0 <= r < h and 0 <= c < w and mask[r, c]

    cur, bt = start, (start[0], start[1] - 1)
    pts = [cur]
    for _ in range(20000):
        i = _RING.index((bt[0] - cur[0], bt[1] - cur[1]))
        for k in range(1, 9):
            o = _RING[(i + k) % 8]
            p = (cur[0] + o[0], cur[1] + o[1])
            if fg(*p):
                po = _RING[(i + k - 1) % 8]
                bt = (cur[0] + po[0], cur[1] + po[1])
                cur = p
                break
        else:
            break  # single pixel
        if cur == start:
            break
        pts.append(cur)
    return pts


def _blobs(mask):
    """Split a boolean mask into blobs; yield (top-left pixel, blob mask, area)."""
    import numpy as np

    seen = np.zeros_like(mask)
    h, w = mask.shape
    for r in range(h):
        for c in range(w):
            if mask[r, c] and not seen[r, c]:
                stack, comp = [(r, c)], []
                seen[r, c] = True
                while stack:
                    y, x = stack.pop()
                    comp.append((y, x))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
                blob = np.zeros_like(mask)
                ys, xs = zip(*comp)
                blob[list(ys), list(xs)] = True
                yield (r, c), blob, len(comp)


def vector_frames(cache_root: Path, size: int, step: int = 1) -> list[list[tuple[list[float], int]]]:
    """Frames as polygons: [[(flat_points, area), ...], ...] in a size x size box. Cached as JSON."""
    import json

    if not ASSET.exists():
        return []
    digest = hashlib.sha1(ASSET.read_bytes()).hexdigest()[:10]
    cache = cache_root / f"orb_vectors_{size}_{step}_{digest}.json"
    if cache.exists():
        try:
            return [[(p, a) for p, a in fr] for fr in json.loads(cache.read_text())]
        except (ValueError, OSError):
            pass
    try:
        import numpy as np
        from rlottie_python import LottieAnimation
    except Exception as e:  # noqa: BLE001
        log.warning("rlottie/numpy not available: %s", e)
        return []
    anim = LottieAnimation.from_file(str(ASSET))
    total = anim.lottie_animation_get_totalframe()
    w, h = anim.lottie_animation_get_size()
    scale = 2  # trace at 2x for smoother edges
    rw, rh = size * scale, max(1, round(size * h / w)) * scale
    oy = (size - rh / scale) / 2
    frames = []
    for i in range(0, total, step):
        im = anim.render_pillow_frame(frame_num=i, width=rw, height=rh)
        mask = np.array(im.getchannel("A")) > 110
        polys = []
        for start, blob, area in _blobs(mask):
            if area < 6:
                continue
            pts = _trace(blob, start)[::3]
            if len(pts) < 3:
                continue
            flat = []
            for r, c in pts:
                flat += [round(c / scale, 1), round(r / scale + oy, 1)]
            polys.append((flat, area))
        polys.sort(key=lambda p: -p[1])
        frames.append(polys)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(frames))
    return frames
