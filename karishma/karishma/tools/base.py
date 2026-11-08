"""Tool registry: every tool = a JSON schema for Claude + a Python function."""

from __future__ import annotations

import base64
import traceback
from dataclasses import dataclass
from typing import Any, Callable, Protocol


class UserIO(Protocol):
    """How Karishma talks to the user (voice or text)."""

    def say(self, text: str) -> None: ...

    def ask(self, question: str) -> str: ...

    def confirm(self, summary: str) -> bool: ...


ToolResult = str | list[dict[str, Any]]


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    func: Callable[..., ToolResult]

    def schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


class ToolError(Exception):
    """Raised by a tool to return a clean error message to Claude."""


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def add(self, name: str, description: str, properties: dict[str, Any], required: list[str] | None = None):
        """Decorator form: @registry.add("name", "desc", {...props...}, ["req"])"""

        def deco(func: Callable[..., ToolResult]) -> Callable[..., ToolResult]:
            self.register(
                Tool(
                    name=name,
                    description=description,
                    input_schema={
                        "type": "object",
                        "properties": properties,
                        "required": required or [],
                    },
                    func=func,
                )
            )
            return func

        return deco

    def names(self) -> list[str]:
        return list(self._tools)

    def schemas(self) -> list[dict[str, Any]]:
        # Sorted so the tool list is byte-identical every request (prompt caching).
        return [self._tools[n].schema() for n in sorted(self._tools)]

    def execute(self, name: str, args: dict[str, Any]) -> tuple[ToolResult, bool]:
        """Run a tool. Returns (content, is_error)."""
        tool = self._tools.get(name)
        if tool is None:
            return f"Unknown tool: {name}", True
        if not isinstance(args, dict):
            return "Tool input must be a JSON object.", True
        missing = [k for k in tool.input_schema.get("required", []) if k not in args]
        if missing:
            return f"Missing required arguments: {', '.join(missing)}", True
        allowed = set(tool.input_schema.get("properties", {}))
        clean = {k: v for k, v in args.items() if k in allowed}
        try:
            return tool.func(**clean), False
        except ToolError as e:
            return str(e), True
        except Exception as e:  # never crash the assistant because of one tool
            return f"{type(e).__name__}: {e}\n{traceback.format_exc(limit=3)}", True


def image_block(data: bytes, media_type: str = "image/jpeg") -> dict[str, Any]:
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": base64.b64encode(data).decode()},
    }


def text_block(text: str) -> dict[str, Any]:
    return {"type": "text", "text": text}
