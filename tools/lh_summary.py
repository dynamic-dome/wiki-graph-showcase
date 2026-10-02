"""Lighthouse-JSON kompakt auswerten und den Median über mehrere Läufe bilden.

    python -m tools.lh_summary lauf1.json lauf2.json --tbt-limit 1000
"""
from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

METRICS = {
    "fcp_ms": "first-contentful-paint",
    "lcp_ms": "largest-contentful-paint",
    "tbt_ms": "total-blocking-time",
    "si_ms": "speed-index",
    "cls": "cumulative-layout-shift",
}


def load_run(path: Path | str) -> dict:
    report = json.loads(Path(path).read_text(encoding="utf-8"))
    score = report["categories"]["performance"]["score"]
    if score is None:
        raise ValueError(f"{path}: performance score fehlt (Lauf fehlgeschlagen?)")
    run = {
        "file": Path(path).name,
        "url": report.get("finalDisplayedUrl") or report.get("finalUrl"),
        "fetched": report.get("fetchTime"),
        "score": round(score * 100),
    }
    for key, audit_id in METRICS.items():
        run[key] = report["audits"][audit_id]["numericValue"]
    console = report["audits"].get("errors-in-console", {})
    run["console_errors"] = len(console.get("details", {}).get("items", []))
    return run


def median_of(runs: list[dict]) -> dict:
    keys = ["score", *METRICS, "console_errors"]
    return {k: statistics.median(r[k] for r in runs) for k in keys}


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("reports", nargs="+", type=Path)
    ap.add_argument("--tbt-limit", type=float, default=None, help="C1b-Gate in ms (Spec: 1000)")
    args = ap.parse_args()
    runs = [load_run(p) for p in args.reports]
    print("| Datei | Score | FCP ms | LCP ms | TBT ms | CLS | Konsolenfehler | URL | Zeit |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in runs:
        print(f"| {r['file']} | {r['score']} | {r['fcp_ms']:.0f} | {r['lcp_ms']:.0f} | "
              f"{r['tbt_ms']:.0f} | {r['cls']:.3f} | {r['console_errors']} | {r['url']} | {r['fetched']} |")
    med = median_of(runs)
    print(f"| MEDIAN ({len(runs)} Läufe) | {med['score']:.0f} | {med['fcp_ms']:.0f} | {med['lcp_ms']:.0f} | "
          f"{med['tbt_ms']:.0f} | {med['cls']:.3f} | {med['console_errors']:.0f} | | |")
    if args.tbt_limit is not None:
        if med["tbt_ms"] > args.tbt_limit:
            print(f"C1b-Gate: OFFEN (TBT-Median {med['tbt_ms']:.0f} ms > {args.tbt_limit:.0f} ms). C1b nur mit Dominics Go.")
        else:
            print(f"C1b-Gate: ENTFÄLLT (TBT-Median {med['tbt_ms']:.0f} ms <= {args.tbt_limit:.0f} ms).")


if __name__ == "__main__":
    _main()
