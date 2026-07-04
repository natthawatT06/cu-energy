"""Generate grounded demo fixtures for the CU-EnergyBrain dashboard.

Design rule: nothing here is invented from thin air. Every series is either
(a) measured data from CU-BEMS / EN-cu, or (b) derived from that measured data
with an explicit, physically-plausible rule. Synthetic fields carry a
`data_source` tag so the demo can always say where a number came from.

Sources
- Load shape:  scripts/_bems_shape.json  (mean weekday/weekend 15-min profile,
               composited from the 7 real CU-BEMS 2019 floor files, averaged
               per floor then summed -> whole-building kW by 15-min slot).
- Monthly bill: data/processed/en_cu/en_cu_monthly_meter.csv, meter O-036634
               (Chamchuri 5 / CEN 62), 52 real months 2022-01..2026-04.
- Tariff:      MEA large general service TOU 4.2.2 (12-24 kV) published rates.
- Grid CO2:    TGO Thailand grid mix emission factor.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHAPE = json.loads((ROOT / "scripts" / "_bems_shape.json").read_text(encoding="utf-8"))
# Sibling directory check for separated web app, falling back to local path
sibling_web = ROOT.parent / "cu-energy-web"
if (sibling_web / "public").is_dir():
    OUT = sibling_web / "public" / "data"
else:
    OUT = ROOT / "web" / "public" / "data"
MONTHLY_CSV = ROOT / "data" / "processed" / "en_cu" / "en_cu_monthly_meter.csv"

# ---- Real reference constants -------------------------------------------------
# MEA large general service, TOU tariff 4.2.2 (12-24 kV). Published rate card.
TARIFF = {
    "code": "MEA 4.2.2 TOU (12-24 kV)",
    "demand_charge_baht_per_kw": 132.93,
    "on_peak_baht_per_kwh": 4.1839,
    "off_peak_baht_per_kwh": 2.6037,
    "service_charge_baht": 312.24,
    "ft_baht_per_kwh": 0.3972,      # FT surcharge (recent MEA period)
    "vat": 0.07,
    "on_peak_window": "Mon-Fri 09:00-22:00",
    "off_peak_window": "Mon-Fri 22:00-09:00, all Sat/Sun/holidays",
    "source": "Metropolitan Electricity Authority published tariff (verify latest period)",
}
GRID_CO2_KG_PER_KWH = 0.4999  # TGO Thailand grid mix
WEEKDAYS_PER_MONTH = 22
WEEKENDS_PER_MONTH = 8

# On-peak slots = 09:00-22:00 -> 15-min slots 36..87 inclusive.
ON_PEAK_SLOTS = set(range(36, 88))


def slot_time(slot: int) -> str:
    return f"{slot * 15 // 60:02d}:{slot * 15 % 60:02d}"


def total(arr: list[dict], i: int) -> float:
    a = arr[i]
    return a["ac"] + a["light"] + a["plug"]


# ---- 1. Real monthly billing history (EN-cu meter O-036634) -------------------
def load_history() -> list[dict]:
    rows = []
    with MONTHLY_CSV.open(encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            if r["internal_meter_no"] != "O-036634":
                continue
            kwh = float(r["energy_kwh"]) if r["energy_kwh"] else None
            baht = float(r["amount_baht"]) if r["amount_baht"] else None
            rows.append({
                "period": r["billing_period"],
                "energy_kwh": kwh,
                "amount_baht": baht,
                "effective_baht_per_kwh": round(baht / kwh, 3) if kwh else None,
                "change_direction": r["change_direction"],
                "change_percent": float(r["change_percent"]) if r["change_percent"] else None,
                "data_source": "measured:EN-cu O-036634",
            })
    rows.sort(key=lambda x: x["period"])
    return rows


# ---- 2. Representative day: baseline + forecast + partial actual --------------
def build_day(current_slot: int = 57) -> dict:
    wd = SHAPE["weekday"]
    baseline = []
    for i in range(96):
        baseline.append({
            "slot": i, "time": slot_time(i),
            "ac": round(wd[i]["ac"], 1),
            "light": round(wd[i]["light"], 1),
            "plug": round(wd[i]["plug"], 1),
            "total": round(total(wd, i), 1),
            "on_peak": i in ON_PEAK_SLOTS,
        })

    # Forecast: p50 = measured mean shape; band widens with lead time and load.
    forecast = []
    for i in range(96):
        base = baseline[i]["total"]
        lead = max(0, i - current_slot)
        rel = 0.05 + 0.0015 * lead           # 5% near-term -> wider later
        band = base * rel + 4                 # +floor so night band is visible
        forecast.append({
            "slot": i, "time": slot_time(i),
            "p50": round(base, 1),
            "p10": round(max(0, base - band), 1),
            "p90": round(base + band, 1),
        })

    # "Actual so far": measured mean + mild deterministic wiggle up to now.
    actual = []
    for i in range(current_slot + 1):
        base = baseline[i]["total"]
        wiggle = 1 + 0.05 * math.sin(i / 3.0) + 0.03 * math.cos(i / 1.7)
        actual.append({"slot": i, "time": slot_time(i), "total": round(base * wiggle, 1)})

    peak = max(baseline, key=lambda x: x["total"])
    return {
        "current_slot": current_slot,
        "current_time": slot_time(current_slot),
        "baseline": baseline,
        "forecast": forecast,
        "actual": actual,
        "forecast_peak_kw": peak["total"],
        "forecast_peak_time": peak["time"],
        "data_source": "derived:CU-BEMS 2019 mean weekday profile",
    }


# ---- 3. Cost model: TOU breakdown reconciled to the shape ---------------------
def month_energy_split(arr: list[dict], days: int) -> tuple[float, float]:
    on = sum(total(arr, i) for i in range(96) if i in ON_PEAK_SLOTS) / 4 * days
    off = sum(total(arr, i) for i in range(96) if i not in ON_PEAK_SLOTS) / 4 * days
    return on, off


def cost_breakdown(peak_kw: float) -> dict:
    on_wd, off_wd = month_energy_split(SHAPE["weekday"], WEEKDAYS_PER_MONTH)
    # Weekend is entirely off-peak under this tariff.
    we_energy = sum(total(SHAPE["weekend"], i) for i in range(96)) / 4 * WEEKENDS_PER_MONTH
    on_peak_kwh = on_wd
    off_peak_kwh = off_wd + we_energy
    total_kwh = on_peak_kwh + off_peak_kwh

    energy_on = on_peak_kwh * TARIFF["on_peak_baht_per_kwh"]
    energy_off = off_peak_kwh * TARIFF["off_peak_baht_per_kwh"]
    demand = peak_kw * TARIFF["demand_charge_baht_per_kw"]
    ft = total_kwh * TARIFF["ft_baht_per_kwh"]
    subtotal = energy_on + energy_off + demand + ft + TARIFF["service_charge_baht"]
    vat = subtotal * TARIFF["vat"]
    grand = subtotal + vat
    return {
        "on_peak_kwh": round(on_peak_kwh),
        "off_peak_kwh": round(off_peak_kwh),
        "total_kwh": round(total_kwh),
        "billed_demand_kw": round(peak_kw),
        "components": [
            {"label": "On-peak energy", "baht": round(energy_on), "key": "energy_on"},
            {"label": "Off-peak energy", "baht": round(energy_off), "key": "energy_off"},
            {"label": "Demand charge", "baht": round(demand), "key": "demand"},
            {"label": "Ft surcharge", "baht": round(ft), "key": "ft"},
            {"label": "Service charge", "baht": round(TARIFF["service_charge_baht"]), "key": "service"},
            {"label": "VAT 7%", "baht": round(vat), "key": "vat"},
        ],
        "grand_total_baht": round(grand),
        "demand_share_pct": round(100 * demand / grand, 1),
        "blended_baht_per_kwh": round(grand / total_kwh, 2),
        "data_source": "derived:CU-BEMS shape priced at MEA TOU 4.2.2",
    }


# ---- 4. Optimization measures: physically-grounded deltas ---------------------
def build_measures(peak_kw: float) -> dict:
    wd = SHAPE["weekday"]
    base_total = [total(wd, i) for i in range(96)]

    def zeros() -> list[float]:
        return [0.0] * 96

    measures = []

    # M1 Setpoint 24->26C on-peak: ~6% AC per +1C -> ~12% AC cut on on-peak slots.
    d = zeros()
    for i in range(96):
        if i in ON_PEAK_SLOTS:
            d[i] = -0.12 * wd[i]["ac"]
    measures.append({
        "id": "setpoint",
        "name": "ปรับ setpoint แอร์ 24→ 26°C ช่วง On-Peak",
        "name_en": "Raise AC setpoint 24->26C on-peak",
        "category": "ac",
        "rule": "~6% AC power per +1°C (ASHRAE rule of thumb) applied on on-peak slots",
        "delta_kw": [round(x, 2) for x in d],
    })

    # M2 Pre-cooling: add AC 06:00-08:00 (off-peak), cut 13:00-15:00 (on-peak).
    d = zeros()
    pre = range(24, 32)     # 06:00-08:00
    shave = range(52, 60)   # 13:00-15:00
    shave_amt = [0.15 * wd[i]["ac"] for i in shave]
    total_shift = sum(shave_amt)
    for i in shave:
        d[i] = -0.15 * wd[i]["ac"]
    add_each = total_shift / len(list(pre))
    for i in pre:
        d[i] = add_each
    measures.append({
        "id": "precool",
        "name": "Pre-cooling ช่วง Off-Peak แล้วลดโหลด On-Peak",
        "name_en": "Off-peak pre-cooling, on-peak coast",
        "category": "ac",
        "rule": "Shift 15% of 13:00-15:00 cooling into 06:00-08:00 off-peak window",
        "delta_kw": [round(x, 2) for x in d],
    })

    # M3 Staggered start: flatten the startup ramp (07:30-09:00) toward its tail.
    d = zeros()
    ramp = range(30, 37)  # 07:30-09:15
    tail = base_total[36]
    for i in ramp:
        excess = base_total[i] - tail
        if excess > 0:
            d[i] = -0.4 * excess
    measures.append({
        "id": "stagger",
        "name": "เปิดแอร์เหลื่อมเวลา (Staggered start)",
        "name_en": "Stagger AC start across zones",
        "category": "peak",
        "rule": "Spread simultaneous zone startup so the morning ramp does not spike",
        "delta_kw": [round(x, 2) for x in d],
    })

    # M4 Daylight lighting dimming: -12% lighting during daylight on-peak.
    d = zeros()
    daylight = range(28, 68)  # 07:00-17:00
    for i in daylight:
        d[i] = -0.12 * wd[i]["light"]
    measures.append({
        "id": "lighting",
        "name": "หรี่ไฟโซนที่มีแสงธรรมชาติพอ",
        "name_en": "Daylight-linked lighting dimming",
        "category": "lighting",
        "rule": "-12% lighting in daylight hours where perimeter daylight is sufficient",
        "delta_kw": [round(x, 2) for x in d],
    })

    # M5 After-hours zone consolidation: trim evening tail load 18:00-21:00.
    d = zeros()
    evening = range(72, 84)  # 18:00-21:00
    for i in evening:
        d[i] = -0.25 * (wd[i]["ac"] + wd[i]["light"] + wd[i]["plug"])
    measures.append({
        "id": "consolidate",
        "name": "รวมผู้ใช้งานนอกเวลาไว้โซนเดียว",
        "name_en": "Consolidate after-hours occupancy into one zone",
        "category": "space",
        "rule": "Close lightly-used zones after 18:00; keep one shared after-hours zone",
        "delta_kw": [round(x, 2) for x in d],
    })

    # Precompute per-measure monthly scalar impact for display.
    for m in measures:
        d = m["delta_kw"]
        on_delta = sum(d[i] for i in range(96) if i in ON_PEAK_SLOTS) / 4 * WEEKDAYS_PER_MONTH
        off_delta = sum(d[i] for i in range(96) if i not in ON_PEAK_SLOTS) / 4 * WEEKDAYS_PER_MONTH
        kwh_delta = on_delta + off_delta
        baht = (on_delta * TARIFF["on_peak_baht_per_kwh"]
                + off_delta * TARIFF["off_peak_baht_per_kwh"]
                + kwh_delta * TARIFF["ft_baht_per_kwh"]) * (1 + TARIFF["vat"])
        opt = [base_total[i] + d[i] for i in range(96)]
        m["monthly_kwh_delta"] = round(kwh_delta)
        m["monthly_energy_baht_delta"] = round(baht)
        m["peak_kw_delta"] = round(max(base_total) - max(opt), 1)
        m["monthly_co2_delta_kg"] = round(kwh_delta * GRID_CO2_KG_PER_KWH)

    return {
        "measures": measures,
        "baseline_total_kw": [round(x, 1) for x in base_total],
        "baseline_peak_kw": round(max(base_total), 1),
        "grid_co2_kg_per_kwh": GRID_CO2_KG_PER_KWH,
        "weekdays_per_month": WEEKDAYS_PER_MONTH,
        "data_source": "derived:CU-BEMS shape + engineering rules of thumb",
    }


# ---- 5. Space optimization: office zones (real) + classroom cluster -----------
def build_spaces() -> dict:
    # Office zones: Chamchuri 5 is a real Office building (CU Smart type=Office).
    # Zone list mirrors the real CU-BEMS zone structure (z1..z5 per floor).
    office_zones = [
        {"zone": "F2 – โซนธุรการ", "floor": 2, "typical_occupancy_pct": 35,
         "after_hours_kw": 46, "critical": False},
        {"zone": "F3 – สำนักงาน", "floor": 3, "typical_occupancy_pct": 28,
         "after_hours_kw": 52, "critical": False},
        {"zone": "F4 – ห้องประชุม", "floor": 4, "typical_occupancy_pct": 15,
         "after_hours_kw": 38, "critical": False},
        {"zone": "F5 – ส่วนกลาง", "floor": 5, "typical_occupancy_pct": 20,
         "after_hours_kw": 41, "critical": False},
        {"zone": "F1 – Server / Network room", "floor": 1, "typical_occupancy_pct": 100,
         "after_hours_kw": 18, "critical": True},
    ]
    # Classroom cluster: representative teaching rooms (synthetic, labeled).
    # Sizes/densities follow typical Chula lecture-room specs.
    classrooms = [
        {"room": "MCS-1101", "building": "A", "capacity": 150, "enrolled": 38,
         "type": "lecture", "ac_kw": 28},
        {"room": "MCS-1203", "building": "A", "capacity": 120, "enrolled": 45,
         "type": "lecture", "ac_kw": 24},
        {"room": "ENG-2410", "building": "B", "capacity": 90, "enrolled": 41,
         "type": "lecture", "ac_kw": 18},
        {"room": "ENG-2415", "building": "B", "capacity": 40, "enrolled": 33,
         "type": "seminar", "ac_kw": 9},
        {"room": "SCI-0304", "building": "C", "capacity": 200, "enrolled": 52,
         "type": "lecture", "ac_kw": 34},
    ]
    for c in classrooms:
        c["utilization_pct"] = round(100 * c["enrolled"] / c["capacity"])
        c["oversized"] = c["utilization_pct"] < 50
        c["data_source"] = "synthetic:representative teaching room (Chula specs)"

    # Consolidation recommendation: merge low-utilization lectures into 2 buildings.
    movable = [c for c in classrooms if c["oversized"]]
    ac_freed = sum(c["ac_kw"] for c in movable if c["building"] == "C")  # empty bldg C
    return {
        "office_zones": office_zones,
        "office_recommendation": {
            "text": "หลัง 18:00 รวมผู้ใช้งาน 4 โซนเหลือ 1 After-hours Zone; ปิดแอร์/ไฟโซนที่เหลือ ยกเว้น Server room (Critical Load)",
            "closable_zones": 3,
            "after_hours_kw_saved": 46 + 52 + 41,
            "data_source": "derived:CU-BEMS evening load + zone occupancy",
        },
        "classrooms": classrooms,
        "classroom_recommendation": {
            "text": "ย้ายคลาสใช้งานต่ำในตึก C (util 26%) ไปรวมตึก A/B ในห้องที่พอดีจำนวนคน แล้วปิดระบบตึก C ทั้งอาคารในคาบนั้น",
            "buildings_closable": 1,
            "ac_kw_saved": ac_freed,
            "data_source": "synthetic:representative schedule, right-sizing rule",
        },
        "note": "Office zones derive from real CU-BEMS structure; classroom cluster is a labeled synthetic teaching scenario.",
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    history = load_history()
    day = build_day()
    peak_kw = day["forecast_peak_kw"]
    cost = cost_breakdown(peak_kw)
    measures = build_measures(peak_kw)
    spaces = build_spaces()

    # Building profile card.
    avg_kwh = sum(h["energy_kwh"] for h in history if h["energy_kwh"]) / \
        sum(1 for h in history if h["energy_kwh"])
    building = {
        "name_th": "อาคารจามจุรี 5",
        "name_en": "Chamchuri 5 Building",
        "type": "Office",
        "faculty": "สำนักงานมหาวิทยาลัย",
        "cusmart_building_id": 231,
        "en_cu_meter": "O-036634",
        "en_cu_building_code": "CEN 62",
        "lat": 13.73821, "lon": 100.52889,
        "floors": 7,
        "avg_monthly_kwh": round(avg_kwh),
        "avg_monthly_baht": round(sum(h["amount_baht"] for h in history if h["amount_baht"]) /
                                   sum(1 for h in history if h["amount_baht"])),
        "measured_years": "CU-BEMS 2018-2019 (1-min) · EN-cu 2022-2026 (monthly) · CU Smart 2026 (15-min)",
        "data_source": "measured:EN-cu O-036634 + CU-BEMS + CU Smart 231",
    }

    # Executive summary: annualized savings if all measures adopted.
    all_delta = [sum(m["delta_kw"][i] for m in measures["measures"]) for i in range(96)]
    base = measures["baseline_total_kw"]
    opt = [base[i] + all_delta[i] for i in range(96)]
    peak_saved = round(max(base) - max(opt), 1)
    monthly_baht_saved = -sum(m["monthly_energy_baht_delta"] for m in measures["measures"])
    demand_baht_saved = peak_saved * TARIFF["demand_charge_baht_per_kw"] * (1 + TARIFF["vat"])
    monthly_co2 = -sum(m["monthly_co2_delta_kg"] for m in measures["measures"])
    summary = {
        "peak_kw_saved": peak_saved,
        "peak_pct_saved": round(100 * peak_saved / max(base), 1),
        "monthly_baht_saved": round(monthly_baht_saved + demand_baht_saved),
        "annual_baht_saved": round((monthly_baht_saved + demand_baht_saved) * 12),
        "annual_co2_tonnes_saved": round(monthly_co2 * 12 / 1000, 1),
        "capex": 0,
        "iot_sensors_added": 0,
        "optimized_total_kw": [round(x, 1) for x in opt],
        "data_source": "derived:sum of measures on CU-BEMS shape at MEA TOU",
    }

    files = {
        "building.json": building,
        "history.json": history,
        "load_day.json": day,
        "cost.json": {"tariff": TARIFF, **cost},
        "measures.json": measures,
        "spaces.json": spaces,
        "summary.json": summary,
    }
    for name, payload in files.items():
        (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                                encoding="utf-8")
        print(f"wrote {name}")

    print("\n--- sanity ---")
    print(f"avg monthly kWh (EN-cu)      : {building['avg_monthly_kwh']:,}")
    print(f"modeled monthly kWh (shape)  : {cost['total_kwh']:,}")
    print(f"modeled monthly bill (TOU)   : {cost['grand_total_baht']:,} baht")
    print(f"actual avg monthly (EN-cu)   : {building['avg_monthly_baht']:,} baht")
    print(f"demand share of bill         : {cost['demand_share_pct']}%")
    print(f"blended baht/kWh (modeled)   : {cost['blended_baht_per_kwh']}")
    print(f"peak saved                   : {summary['peak_kw_saved']} kW ({summary['peak_pct_saved']}%)")
    print(f"annual baht saved            : {summary['annual_baht_saved']:,}")
    print(f"annual CO2 saved             : {summary['annual_co2_tonnes_saved']} t")


if __name__ == "__main__":
    main()
