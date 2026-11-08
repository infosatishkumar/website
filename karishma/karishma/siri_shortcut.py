"""Create the "Karishma" Shortcut so that "Hey Siri, Karishma" (or a keyboard shortcut) wakes her.

The shortcut has one action - Run Shell Script: `touch ~/.karishma/wake` - which the app
notices within a fraction of a second. Siri itself listens for "Hey Siri", so Karishma's
microphone (and the orange mic dot) stays off until you call her.

    python -m karishma.siri_shortcut      # builds, signs and opens it in the Shortcuts app
"""

from __future__ import annotations

import plistlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = "mkdir -p ~/.karishma && touch ~/.karishma/wake"


def build_plist() -> dict:
    return {
        "WFWorkflowActions": [
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.runshellscript",
                "WFWorkflowActionParameters": {"Script": SCRIPT, "Shell": "/bin/zsh", "InputMode": "to stdin"},
            }
        ],
        "WFWorkflowClientVersion": "2605.0.5",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 2071128575, "WFWorkflowIconGlyphNumber": 59511},
        "WFWorkflowImportQuestions": [],
        "WFWorkflowTypes": [],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasShortcutInputVariables": False,
        "WFQuickActionSurfaces": [],
    }


def main(out_dir: str | None = None) -> int:
    out = Path(out_dir or Path.home() / "karishma")
    out.mkdir(parents=True, exist_ok=True)
    final = out / "Karishma.shortcut"
    with tempfile.TemporaryDirectory() as d:
        unsigned = Path(d) / "Karishma.shortcut"
        unsigned.write_bytes(plistlib.dumps(build_plist(), fmt=plistlib.FMT_BINARY))
        if not shutil.which("shortcuts"):
            print("shortcuts command not found (needs macOS 12+).")
            return 1
        r = subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", str(unsigned), "--output", str(final)],
                           capture_output=True, text=True)
        if r.returncode != 0 or not final.exists():
            print("Auto-sign nahi hua:", (r.stderr or r.stdout).strip()[:300])
            return 1
    subprocess.run(["open", str(final)])
    print(f"Shortcuts app me 'Add Shortcut' dabaiye. ({final})")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:2]))
