"""Long-term memory: facts about the user saved in ~/.karishma/memory.json."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .base import ToolRegistry


class Memory:
    def __init__(self, path: Path):
        self.path = path
        self.facts: list[dict[str, str]] = []
        if path.exists():
            try:
                self.facts = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self.facts = []

    def add(self, fact: str) -> None:
        self.facts.append({"fact": fact.strip(), "saved": datetime.now().strftime("%Y-%m-%d")})
        self._save()

    def forget(self, text: str) -> int:
        before = len(self.facts)
        self.facts = [f for f in self.facts if text.lower() not in f["fact"].lower()]
        self._save()
        return before - len(self.facts)

    def as_text(self) -> str:
        return "\n".join(f"- {f['fact']}" for f in self.facts) or "(nothing saved yet)"

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.facts, ensure_ascii=False, indent=2), encoding="utf-8")


def register_memory_tools(reg: ToolRegistry, memory: Memory) -> None:
    @reg.add(
        "remember",
        "Save a lasting fact about the user (name, home city, preferences, frequent routes, IRCTC "
        "username, favourite food, family names). Never save passwords, OTPs or card numbers.",
        {"fact": {"type": "string"}},
        ["fact"],
    )
    def remember(fact: str) -> str:
        memory.add(fact)
        return "saved"

    @reg.add("recall", "List everything saved about the user.", {})
    def recall() -> str:
        return memory.as_text()

    @reg.add("forget", "Delete saved facts containing this text.", {"text": {"type": "string"}}, ["text"])
    def forget(text: str) -> str:
        return f"removed {memory.forget(text)} fact(s)"
