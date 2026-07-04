"""Extract EN-cu monthly internal-meter reports and map them to CU Smart.

The PDF tables use two closely related layouts (9 and 10 columns). This
extractor keeps source coordinates and parse flags so every normalized row can
be audited back to its PDF page.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "EN-cu"
DEFAULT_OUTPUT = ROOT / "data" / "processed" / "en_cu"
MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
THAI_MONTHS_FULL = {
    "มกราคม": 1,
    "กุมภาพันธ์": 2,
    "มีนาคม": 3,
    "เมษายน": 4,
    "พฤษภาคม": 5,
    "มิถุนายน": 6,
    "กรกฎาคม": 7,
    "สิงหาคม": 8,
    "กันยายน": 9,
    "ตุลาคม": 10,
    "พฤศจิกายน": 11,
    "ธันวาคม": 12,
}
THAI_MONTHS_ABBR = {
    "ม.ค": 1,
    "ก.พ": 2,
    "มี.ค": 3,
    "เม.ย": 4,
    "พ.ค": 5,
    "มิ.ย": 6,
    "ก.ค": 7,
    "ส.ค": 8,
    "ก.ย": 9,
    "ต.ค": 10,
    "พ.ย": 11,
    "ธ.ค": 12,
}
TABLE_SETTINGS = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,
    "join_tolerance": 3,
    "intersection_tolerance": 5,
    "text_tolerance": 2,
}
MONTHLY_COLUMNS = [
    "row_id",
    "source_file",
    "source_page",
    "source_table_row",
    "billing_year_be",
    "billing_year_ce",
    "billing_month",
    "billing_period",
    "report_date",
    "organization_raw",
    "organization",
    "row_no",
    "building_code_raw",
    "building_code",
    "building_name_raw",
    "building_name",
    "internal_meter_no_raw",
    "internal_meter_no",
    "energy_kwh",
    "change_raw",
    "change_direction",
    "change_percent",
    "amount_baht",
    "reading_date_raw",
    "reading_date",
    "note_raw",
    "note",
    "parse_status",
    "parse_flags",
    "raw_cells_json",
]


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFC", str(value))
    text = re.sub(r"\(cid:\d+\)", "", text)
    text = text.replace("\x00", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_number(value: Any) -> float | None:
    text = clean_text(value)
    if not text or re.fullmatch(r"[-–—]+", text):
        return None
    negative = bool(re.search(r"-\s*$", text) or re.match(r"^\s*-", text))
    compact = text.replace(",", "").replace(" ", "")
    match = re.search(r"\d+(?:\.\d+)?", compact)
    if not match:
        return None
    number = float(match.group(0))
    return -number if negative else number


def normalize_meter(value: Any) -> str:
    text = clean_text(value).upper()
    if not text or re.fullmatch(r"[-–—]+", text):
        return ""
    text = re.sub(r"\s*-\s*", "-", text)
    text = re.sub(r"\s+", "", text)
    return text


def normalize_building_code(value: Any) -> str:
    text = clean_text(value).upper()
    text = re.sub(r"\s+", " ", text)
    return "" if re.fullmatch(r"[-–—]+", text) else text


def parse_change(direction_cell: Any, percent_cell: Any) -> tuple[str, float | None]:
    direction_raw = clean_text(direction_cell)
    compact = re.sub(r"\s+", "", direction_raw)
    if "ลดลง" in compact:
        direction = "decrease"
    elif "คงท" in compact:
        direction = "stable"
    elif compact.startswith("เพ") or "ขึน" in compact or "ขึ้น" in compact:
        direction = "increase"
    else:
        direction = "unknown"
    percent = parse_number(percent_cell if clean_text(percent_cell) else direction_cell)
    return direction, percent


def parse_report_date(text: str) -> str:
    cleaned = clean_text(text)
    for month_name, month in THAI_MONTHS_FULL.items():
        match = re.search(rf"(\d{{1,2}})\s*{re.escape(month_name)}\s*(25\d{{2}})", cleaned)
        if match:
            year_be = int(match.group(2))
            try:
                return date(year_be - 543, month, int(match.group(1))).isoformat()
            except ValueError:
                return ""
    return ""


def parse_reading_date(value: Any) -> str:
    text = clean_text(value)
    numeric_match = re.search(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", text)
    if numeric_match:
        day, month, year = map(int, numeric_match.groups())
        year_be = year + 2500 if year < 100 else year
        try:
            return date(year_be - 543, month, day).isoformat()
        except ValueError:
            return ""
    match = re.search(r"(\d{1,2})\s*([^\d\s]+)\s*(\d{2,4})", text)
    if not match:
        return ""
    month_token = match.group(2).replace(" ", "").rstrip(".")
    month = None
    for token, candidate in THAI_MONTHS_ABBR.items():
        if month_token.startswith(token.rstrip(".")):
            month = candidate
            break
    if month is None:
        return ""
    year = int(match.group(3))
    year_be = year + 2500 if year < 100 else year
    try:
        return date(year_be - 543, month, int(match.group(1))).isoformat()
    except ValueError:
        return ""


def pdf_metadata_from_path(path: Path) -> tuple[int, int, int]:
    match = re.search(
        r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{2})\.pdf$",
        path.name,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError(f"Cannot determine billing period from {path.name}")
    year_be = 2500 + int(match.group(2))
    return year_be, year_be - 543, MONTHS[match.group(1).lower()]


def is_organization_row(row: list[Any]) -> bool:
    first = clean_text(row[0] if row else "")
    if not first or re.fullmatch(r"\d+", first):
        return False
    if any(term in first for term in ("หน่วยงานต", "สบง.", "สรุปยอด", "ลําด", "ลำดับ")):
        return False
    identity_cells = [clean_text(cell) for cell in row[1:5]]
    return not any(identity_cells)


def extract_pdf(path_string: str) -> dict[str, Any]:
    path = Path(path_string)
    year_be, year_ce, month = pdf_metadata_from_path(path)
    billing_period = f"{year_ce:04d}-{month:02d}"
    result: dict[str, Any] = {"rows": [], "issues": []}
    page_count = 0
    pages_with_table = 0
    report_date = ""
    current_organization_raw = ""
    current_organization = ""

    with pdfplumber.open(path) as pdf:
        page_count = len(pdf.pages)
        if pdf.pages:
            report_date = parse_report_date(
                PdfReader(path).pages[0].extract_text() or ""
            )

        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.find_tables(table_settings=TABLE_SETTINGS)
            if not tables:
                result["issues"].append(
                    {
                        "source_file": path.as_posix(),
                        "source_page": page_number,
                        "issue_type": "no_table",
                        "detail": "No ruled table detected",
                    }
                )
                continue
            pages_with_table += 1
            if len(tables) > 1:
                result["issues"].append(
                    {
                        "source_file": path.as_posix(),
                        "source_page": page_number,
                        "issue_type": "multiple_tables",
                        "detail": f"Detected {len(tables)} tables; selected the largest",
                    }
                )
            table = max(
                tables,
                key=lambda item: (item.bbox[2] - item.bbox[0])
                * (item.bbox[3] - item.bbox[1]),
            )
            data = table.extract(x_tolerance=2, y_tolerance=2)
            for source_row, raw_row in enumerate(data, start=1):
                row = list(raw_row)
                if is_organization_row(row):
                    current_organization_raw = clean_text(row[0])
                    current_organization = clean_text(row[0])
                    continue

                row_number_text = clean_text(row[0] if row else "")
                if not re.fullmatch(r"\d+", row_number_text):
                    continue

                flags: list[str] = []
                column_count = len(row)
                if column_count not in {9, 10}:
                    flags.append(f"unexpected_{column_count}_columns")
                row += [None] * max(0, 10 - len(row))

                if column_count >= 10:
                    code_raw, building_raw, meter_raw, energy_raw = row[1:5]
                    direction_raw = row[5]
                    percent_raw = row[6] if clean_text(row[6]) else row[5]
                    amount_raw, reading_raw, note_raw = row[7:10]
                else:
                    code_raw, building_raw, meter_raw, energy_raw = row[1:5]
                    direction_raw = row[5]
                    percent_raw = row[5]
                    amount_raw, reading_raw, note_raw = row[6:9]

                building_code = normalize_building_code(code_raw)
                building_name = clean_text(building_raw)
                meter = normalize_meter(meter_raw)
                energy = parse_number(energy_raw)
                amount = parse_number(amount_raw)
                direction, percent = parse_change(direction_raw, percent_raw)
                reading_date = parse_reading_date(reading_raw)

                if not meter:
                    flags.append("missing_meter")
                if energy is None:
                    flags.append("missing_energy")
                if amount is None:
                    flags.append("missing_amount")
                if "#DIV/0!" in clean_text(direction_raw) or "#DIV/0!" in clean_text(percent_raw):
                    flags.append("invalid_change_percent")
                if direction == "unknown" and clean_text(direction_raw) not in {"", "-"}:
                    flags.append("unknown_change_direction")
                if clean_text(reading_raw) and not reading_date:
                    flags.append("unparsed_reading_date")
                if not current_organization:
                    flags.append("missing_organization")
                footer_probe = " ".join(
                    clean_text(value)
                    for value in (building_raw, meter_raw, direction_raw, reading_raw)
                ).lower()
                if "www." in footer_probe or "ตรวจสอบค่าไฟ" in footer_probe:
                    flags.append("suspected_footer_overlap")

                status = "ok" if not flags else "review"
                relative_path = path.relative_to(ROOT).as_posix()
                result["rows"].append(
                    {
                        "row_id": f"{path.stem}-p{page_number:03d}-r{source_row:03d}",
                        "source_file": relative_path,
                        "source_page": page_number,
                        "source_table_row": source_row,
                        "billing_year_be": year_be,
                        "billing_year_ce": year_ce,
                        "billing_month": month,
                        "billing_period": billing_period,
                        "report_date": report_date,
                        "organization_raw": current_organization_raw,
                        "organization": current_organization,
                        "row_no": int(row_number_text),
                        "building_code_raw": clean_text(code_raw),
                        "building_code": building_code,
                        "building_name_raw": clean_text(building_raw),
                        "building_name": building_name,
                        "internal_meter_no_raw": clean_text(meter_raw),
                        "internal_meter_no": meter,
                        "energy_kwh": energy,
                        "change_raw": clean_text(direction_raw),
                        "change_direction": direction,
                        "change_percent": percent,
                        "amount_baht": amount,
                        "reading_date_raw": clean_text(reading_raw),
                        "reading_date": reading_date,
                        "note_raw": clean_text(note_raw),
                        "note": clean_text(note_raw),
                        "parse_status": status,
                        "parse_flags": "|".join(flags),
                        "raw_cells_json": json.dumps(
                            [clean_text(cell) for cell in raw_row], ensure_ascii=False
                        ),
                    }
                )

    rows = result["rows"]
    result["summary"] = {
        "source_file": path.relative_to(ROOT).as_posix(),
        "billing_year_be": year_be,
        "billing_year_ce": year_ce,
        "billing_month": month,
        "billing_period": billing_period,
        "report_date": report_date,
        "page_count": page_count,
        "pages_with_table": pages_with_table,
        "rows_extracted": len(rows),
        "rows_ok": sum(row["parse_status"] == "ok" for row in rows),
        "rows_review": sum(row["parse_status"] == "review" for row in rows),
        "rows_missing_meter": sum("missing_meter" in row["parse_flags"] for row in rows),
        "energy_kwh_total": sum(row["energy_kwh"] or 0 for row in rows),
        "amount_baht_total": sum(row["amount_baht"] or 0 for row in rows),
        "file_issue_count": len(result["issues"]),
    }
    return result


def mode(values: Iterable[str]) -> str:
    cleaned = [value for value in values if value]
    if not cleaned:
        return ""
    return Counter(cleaned).most_common(1)[0][0]


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def build_meter_catalog(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["internal_meter_no"]:
            grouped[row["internal_meter_no"]].append(row)

    catalog: list[dict[str, Any]] = []
    for meter, records in grouped.items():
        periods = sorted({row["billing_period"] for row in records})
        catalog.append(
            {
                "internal_meter_no": meter,
                "building_code": mode(row["building_code"] for row in records),
                "building_name": mode(row["building_name"] for row in records),
                "organization": mode(row["organization"] for row in records),
                "first_period": periods[0],
                "last_period": periods[-1],
                "observation_count": len(records),
                "distinct_months": len(periods),
                "energy_kwh_total": sum(row["energy_kwh"] or 0 for row in records),
                "amount_baht_total": sum(row["amount_baht"] or 0 for row in records),
                "building_name_variants": " | ".join(
                    sorted({row["building_name"] for row in records if row["building_name"]})
                ),
                "building_code_variants": " | ".join(
                    sorted({row["building_code"] for row in records if row["building_code"]})
                ),
                "review_observation_count": sum(
                    row["parse_status"] == "review" for row in records
                ),
            }
        )
    return sorted(catalog, key=lambda item: item["internal_meter_no"])


def find_latest_snapshot() -> Path | None:
    directory = ROOT / "data" / "raw" / "cusmart"
    candidates = list(directory.glob("cusmart_snapshot_*.json"))
    return max(candidates, key=lambda path: path.stat().st_mtime) if candidates else None


def build_cusmart_catalog(snapshot_path: Path) -> list[dict[str, Any]]:
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    points_by_node: dict[int, list[str]] = defaultdict(list)

    def walk(nodes: list[dict[str, Any]]) -> None:
        for node in nodes:
            node_id = node.get("id")
            if isinstance(node_id, int):
                points_by_node[node_id].extend(
                    point.get("name", "") for point in node.get("pointid") or []
                )
            walk(node.get("nodes") or [])

    structure = snapshot.get("payloads", {}).get("structure_nodes", {}).get("data", [])
    walk(structure)

    by_id: dict[int, dict[str, Any]] = {}
    for key, payload in snapshot.get("payloads", {}).items():
        match = re.fullmatch(r"faculty_(\d+)_building_energy", key)
        if not match:
            continue
        faculty_id = int(match.group(1))
        for building in payload.get("data", []):
            building_id = building.get("id")
            if not isinstance(building_id, int):
                continue
            map_pin = building.get("map_pin") or {}
            by_id[building_id] = {
                "cusmart_building_id": building_id,
                "cusmart_faculty_id": faculty_id,
                "cusmart_name": building.get("name") or "",
                "cusmart_display_th": building.get("display_th") or "",
                "cusmart_display_en": building.get("display_en") or "",
                "cusmart_type": building.get("type") or "",
                "latitude": map_pin.get("lat"),
                "longitude": map_pin.get("lon"),
                "fiap_points": " | ".join(sorted(set(points_by_node.get(building_id, [])))),
                "snapshot_file": snapshot_path.relative_to(ROOT).as_posix(),
            }
    return sorted(by_id.values(), key=lambda item: item["cusmart_building_id"])


def normalize_name(value: str) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"^อาคาร", "", text)
    text = re.sub(r"[\s\-–—_.,()（）/]+", "", text)
    return text


def map_meters_to_cusmart(
    meter_catalog: list[dict[str, Any]], cusmart: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    candidate_names: list[tuple[dict[str, Any], list[str]]] = []
    for building in cusmart:
        names = {
            normalize_name(building["cusmart_name"]),
            normalize_name(building["cusmart_display_th"]),
        }
        candidate_names.append((building, [name for name in names if name]))

    mappings: list[dict[str, Any]] = []
    for meter in meter_catalog:
        source_name = normalize_name(meter["building_name"])
        scored: list[tuple[float, dict[str, Any]]] = []
        for building, names in candidate_names:
            score = max(
                (SequenceMatcher(None, source_name, name).ratio() for name in names),
                default=0.0,
            )
            scored.append((score, building))
        scored.sort(key=lambda item: (-item[0], item[1]["cusmart_building_id"]))
        top = scored[:3]
        best_score = top[0][0] if top else 0.0
        second_score = top[1][0] if len(top) > 1 else 0.0
        best = top[0][1] if top else {}
        if best_score >= 0.995:
            status = "exact_name"
        elif best_score >= 0.85 and best_score - second_score >= 0.08:
            status = "high_candidate"
        elif best_score >= 0.65:
            status = "review_candidate"
        else:
            status = "unmatched"
        mappings.append(
            {
                **meter,
                "match_status": status,
                "match_method": "normalized_thai_building_name",
                "match_score": round(best_score, 4),
                "score_margin": round(best_score - second_score, 4),
                "cusmart_building_id": best.get("cusmart_building_id"),
                "cusmart_faculty_id": best.get("cusmart_faculty_id"),
                "cusmart_name": best.get("cusmart_name", ""),
                "cusmart_display_th": best.get("cusmart_display_th", ""),
                "cusmart_display_en": best.get("cusmart_display_en", ""),
                "cusmart_type": best.get("cusmart_type", ""),
                "fiap_points": best.get("fiap_points", ""),
                "candidate_2": (
                    f"{top[1][1]['cusmart_building_id']}|{top[1][1]['cusmart_name']}|{top[1][0]:.4f}"
                    if len(top) > 1
                    else ""
                ),
                "candidate_3": (
                    f"{top[2][1]['cusmart_building_id']}|{top[2][1]['cusmart_name']}|{top[2][0]:.4f}"
                    if len(top) > 2
                    else ""
                ),
                "mapping_approved": "no",
            }
        )
    return mappings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--snapshot", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    files = sorted(args.input_dir.glob("256[5-9]/*.pdf"))
    if not files:
        raise SystemExit(f"No PDFs found under {args.input_dir}")

    extracted: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(extract_pdf, str(path)): path for path in files}
        for completed, future in enumerate(as_completed(futures), start=1):
            path = futures[future]
            try:
                extracted.append(future.result())
            except Exception as exc:  # preserve other files when one PDF is malformed
                failures.append({"source_file": str(path), "error": repr(exc)})
            print(f"Processed {completed}/{len(files)}: {path.name}", flush=True)

    all_rows = sorted(
        [row for item in extracted for row in item["rows"]],
        key=lambda row: (
            row["billing_period"],
            row["source_file"],
            row["source_page"],
            row["source_table_row"],
        ),
    )
    summaries = sorted(
        [item["summary"] for item in extracted],
        key=lambda row: (row["billing_period"], row["source_file"]),
    )
    issues = [issue for item in extracted for issue in item["issues"]]
    issues.extend(
        {
            "source_file": failure["source_file"],
            "source_page": "",
            "issue_type": "file_failure",
            "detail": failure["error"],
        }
        for failure in failures
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_csv(args.output_dir / "en_cu_monthly_meter.csv", all_rows, MONTHLY_COLUMNS)
    summary_columns = list(summaries[0].keys()) if summaries else []
    write_csv(args.output_dir / "en_cu_file_summary.csv", summaries, summary_columns)
    issue_columns = ["source_file", "source_page", "issue_type", "detail"]
    write_csv(args.output_dir / "en_cu_parse_issues.csv", issues, issue_columns)

    meter_catalog = build_meter_catalog(all_rows)
    meter_columns = list(meter_catalog[0].keys()) if meter_catalog else []
    write_csv(args.output_dir / "en_cu_meter_catalog.csv", meter_catalog, meter_columns)

    snapshot_path = args.snapshot or find_latest_snapshot()
    cusmart_catalog: list[dict[str, Any]] = []
    mappings: list[dict[str, Any]] = []
    if snapshot_path:
        cusmart_catalog = build_cusmart_catalog(snapshot_path)
        mappings = map_meters_to_cusmart(meter_catalog, cusmart_catalog)
        write_csv(
            args.output_dir / "cusmart_building_catalog.csv",
            cusmart_catalog,
            list(cusmart_catalog[0].keys()) if cusmart_catalog else [],
        )
        write_csv(
            args.output_dir / "en_cu_cusmart_mapping.csv",
            mappings,
            list(mappings[0].keys()) if mappings else [],
        )

    manifest = {
        "input_files": len(files),
        "parsed_files": len(extracted),
        "failed_files": len(failures),
        "monthly_rows": len(all_rows),
        "rows_ok": sum(row["parse_status"] == "ok" for row in all_rows),
        "rows_review": sum(row["parse_status"] == "review" for row in all_rows),
        "unique_meters": len(meter_catalog),
        "cusmart_buildings": len(cusmart_catalog),
        "mapping_status": dict(Counter(row["match_status"] for row in mappings)),
        "snapshot_file": (
            snapshot_path.relative_to(ROOT).as_posix() if snapshot_path else None
        ),
        "outputs": sorted(path.name for path in args.output_dir.glob("*.csv")),
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
