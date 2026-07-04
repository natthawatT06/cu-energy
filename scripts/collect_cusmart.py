"""Collect a timestamped raw snapshot from CU Smart's frontend data routes."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cu_energy import CusmartApiError, CusmartClient  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect read-only data exposed to the CU Smart frontend."
    )
    parser.add_argument("--node-id", type=int, default=1)
    parser.add_argument(
        "--faculty-id",
        type=int,
        action="append",
        default=[],
        help="Faculty ID to include; repeat the flag for multiple IDs.",
    )
    parser.add_argument(
        "--include-buildings",
        action="store_true",
        help="Include building summaries and profiles for each --faculty-id.",
    )
    parser.add_argument(
        "--all-faculties",
        action="store_true",
        help="Discover all faculty IDs and include every building dataset.",
    )
    parser.add_argument(
        "--metric",
        action="append",
        choices=("energy", "power", "peak"),
        help="Profile metric to collect; repeat for multiple metrics (default: energy).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "data" / "raw" / "cusmart",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and validate but do not write a snapshot.",
    )
    return parser.parse_args()


def collect(client: CusmartClient, args: argparse.Namespace) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc)
    payloads: dict[str, Any] = {}
    errors: list[dict[str, str]] = []

    def fetch(
        name: str,
        operation: Callable[[], Any],
        *,
        required: bool = False,
    ) -> Any | None:
        try:
            value = operation()
            payloads[name] = value
            return value
        except CusmartApiError as exc:
            errors.append({"dataset": name, "error": str(exc)})
            if required:
                raise
            return None

    faculty_info = fetch(
        "faculty_energy_info", client.faculty_energy_info, required=True
    )
    fetch("faculties", client.faculties)
    fetch("faculty_energy", client.faculty_energy)
    fetch("faculty_eui", client.faculty_eui)
    fetch("building_type_eui", client.building_type_eui)
    fetch("structure_nodes", client.structure_nodes)
    fetch(f"node_{args.node_id}_energy_info", lambda: client.node_energy_info(args.node_id))

    metrics = list(dict.fromkeys(args.metric or ["energy"]))
    for metric in metrics:
        fetch(
            f"node_{args.node_id}_usage_profile_{metric}",
            lambda metric=metric: client.node_usage_profile(
                args.node_id, metric=metric
            ),
        )
        fetch(
            f"node_{args.node_id}_generation_profile_{metric}",
            lambda metric=metric: client.node_generation_profile(
                args.node_id, metric=metric
            ),
        )
        fetch(
            f"faculty_usage_profiles_{metric}",
            lambda metric=metric: client.faculty_usage_profiles(metric=metric),
        )
        fetch(
            f"faculty_generation_profiles_{metric}",
            lambda metric=metric: client.faculty_generation_profiles(metric=metric),
        )

    faculty_ids = set(args.faculty_id)
    if args.all_faculties:
        faculty_ids.update(item["id"] for item in faculty_info["data"])

    include_buildings = args.include_buildings or args.all_faculties
    if include_buildings and not faculty_ids:
        raise ValueError(
            "Building collection requires --faculty-id or --all-faculties"
        )

    if include_buildings:
        for faculty_id in sorted(faculty_ids):
            prefix = f"faculty_{faculty_id}_building"
            fetch(
                f"{prefix}_energy",
                lambda faculty_id=faculty_id: client.building_energy(faculty_id),
            )
            fetch(
                f"{prefix}_energy_info",
                lambda faculty_id=faculty_id: client.building_energy_info(faculty_id),
            )
            fetch(
                f"{prefix}_eui",
                lambda faculty_id=faculty_id: client.building_eui(faculty_id),
            )
            for metric in metrics:
                fetch(
                    f"{prefix}_usage_profiles_{metric}",
                    lambda faculty_id=faculty_id, metric=metric: (
                        client.building_usage_profiles(
                            faculty_id, metric=metric
                        )
                    ),
                )

    finished_at = datetime.now(timezone.utc)

    return {
        "schema_version": "0.2.0",
        "collection_started_at_utc": started_at.isoformat(),
        "collection_finished_at_utc": finished_at.isoformat(),
        "source": "CU Smart Lump Sum frontend JSON endpoints",
        "base_url": client.base_url,
        "timezone": "Asia/Bangkok",
        "metrics": metrics,
        "notes": [
            "Raw source values; units and aggregation windows require owner confirmation.",
            "Future 15-minute timestamps may contain zero placeholders.",
        ],
        "errors": errors,
        "payloads": payloads,
    }


def main() -> int:
    args = parse_args()
    try:
        snapshot = collect(CusmartClient(), args)
    except (CusmartApiError, ValueError) as exc:
        print(f"Collection failed: {exc}", file=sys.stderr)
        return 1

    faculties = snapshot["payloads"]["faculty_energy_info"]["data"]
    first_metric = snapshot["metrics"][0]
    node_profile = snapshot["payloads"][
        f"node_{args.node_id}_usage_profile_{first_metric}"
    ]["data"]
    errors = snapshot["errors"]
    print(
        f"Validated {len(faculties)} faculty records and "
        f"{len(node_profile.get('graph', []))} node profile points; "
        f"captured {len(snapshot['payloads'])} datasets with {len(errors)} errors."
    )
    for error in errors:
        print(f"Warning: {error['dataset']}: {error['error']}", file=sys.stderr)

    if args.dry_run:
        print("Dry run complete; no file written.")
        return 0

    args.output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = args.output_dir / f"cusmart_snapshot_{stamp}.json"
    output_path.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
