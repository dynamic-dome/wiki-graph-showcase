from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools import lh_summary


def _report(score: float | None, lcp: float, tbt: float, console_items: int = 0) -> dict:
    return {
        "finalDisplayedUrl": "http://127.0.0.1:8051/",
        "fetchTime": "2026-10-02T10:00:00.000Z",
        "categories": {"performance": {"score": score}},
        "audits": {
            "first-contentful-paint": {"numericValue": 1000.0},
            "largest-contentful-paint": {"numericValue": lcp},
            "total-blocking-time": {"numericValue": tbt},
            "speed-index": {"numericValue": 2000.0},
            "cumulative-layout-shift": {"numericValue": 0.0},
            "errors-in-console": {"details": {"items": [{}] * console_items}},
        },
    }


def _write(path: Path, data: dict) -> Path:
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_load_run_extracts_metrics(tmp_path: Path) -> None:
    run = lh_summary.load_run(_write(tmp_path / "a.json", _report(0.64, 5000.0, 3000.0, 2)))
    assert run["score"] == 64
    assert run["lcp_ms"] == 5000.0
    assert run["tbt_ms"] == 3000.0
    assert run["console_errors"] == 2
    assert run["url"] == "http://127.0.0.1:8051/"


def test_median_of_two_runs_is_their_mean(tmp_path: Path) -> None:
    a = lh_summary.load_run(_write(tmp_path / "a.json", _report(0.60, 4000.0, 1000.0)))
    b = lh_summary.load_run(_write(tmp_path / "b.json", _report(0.70, 6000.0, 2000.0)))
    med = lh_summary.median_of([a, b])
    assert med["score"] == 65
    assert med["lcp_ms"] == 5000.0
    assert med["tbt_ms"] == 1500.0


def test_missing_score_raises(tmp_path: Path) -> None:
    path = _write(tmp_path / "x.json", _report(None, 1.0, 1.0))
    with pytest.raises(ValueError, match="score"):
        lh_summary.load_run(path)
