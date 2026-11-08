"""Turn the Lottie animation (assets/karishma_orb.json) into small PNG frames for the orb.

Frames are cached in ~/.karishma/orb_frames_<size>_<hash>/ so this runs only once.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

log = logging.getLogger("karishma.lottie")
ASSET = Path(__file__).resolve().parent / "assets" / "karishma_orb.json"


def render_frames(cache_root: Path, size: int, step: int = 1) -> list[Path]:
    """Return PNG paths (one per frame). Empty list if rendering isn't possible."""
    if not ASSET.exists():
        return []
    digest = hashlib.sha1(ASSET.read_bytes()).hexdigest()[:10]
    out = cache_root / f"orb_frames_{size}_{step}_{digest}"
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
    for i in range(0, total, step):
        im = anim.render_pillow_frame(frame_num=i, width=size, height=fh)
        p = out / f"f_{i:04d}.png"
        im.save(p)
        paths.append(p)
    done.write_text(str(len(paths)))
    return paths
