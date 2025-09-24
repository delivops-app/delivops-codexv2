"""Lightweight stub of :mod:`openpyxl` for test purposes."""

from __future__ import annotations

import json
from io import BytesIO
from typing import Iterable, Iterator, List, Sequence, Tuple


class _Cell:
    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value


class Worksheet:
    """Minimal worksheet implementation storing rows in memory."""

    def __init__(self, rows: Sequence[Sequence] | None = None, title: str = "Sheet"):
        self._rows: List[List] = [list(row) for row in (rows or [])]
        self.title = title

    def append(self, row: Iterable) -> None:
        self._rows.append(list(row))

    def iter_rows(
        self,
        min_row: int = 1,
        max_row: int | None = None,
        values_only: bool = False,
    ) -> Iterator[Tuple]:
        start = max(min_row - 1, 0)
        end = max_row if max_row is not None else len(self._rows)
        selected = self._rows[start:end]
        for row in selected:
            if values_only:
                yield tuple(row)
            else:
                yield tuple(_Cell(value) for value in row)


class Workbook:
    """Minimal in-memory workbook used for CSV/Excel tests."""

    def __init__(self, rows: Sequence[Sequence] | None = None, title: str = "Sheet"):
        self.active = Worksheet(rows=rows, title=title)

    def save(self, target) -> None:
        data = {"rows": self.active._rows, "title": self.active.title}
        payload = json.dumps(data).encode("utf-8")
        if hasattr(target, "write"):
            target.write(payload)
        else:  # treat as path-like
            with open(target, "wb") as fh:
                fh.write(payload)

    def close(self) -> None:  # pragma: no cover - API compatibility
        return None


def load_workbook(source) -> Workbook:
    if hasattr(source, "read"):
        content = source.read()
        if isinstance(source, BytesIO):
            source.seek(0)
    else:
        with open(source, "rb") as fh:
            content = fh.read()
    if not content:
        return Workbook()
    data = json.loads(content.decode("utf-8"))
    rows = data.get("rows") or []
    title = data.get("title") or "Sheet"
    return Workbook(rows=rows, title=title)
