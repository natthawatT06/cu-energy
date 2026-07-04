"use client";

import { useMemo } from "react";
import { history, building } from "@/lib/data";
import { num, baht, compactBaht } from "@/lib/format";
import { HistoryBars } from "@/components/charts";
import { Kpi, PageHeader, Pill } from "@/components/ui";

const ANOMALY_THRESHOLD = 30; // % month-over-month

export default function ReportsPage() {
  const rows = history;

  const anomalies = useMemo(
    () =>
      rows
        .map((r, i) => ({ ...r, idx: i }))
        .filter(
          (r) =>
            (r.change_percent != null && Math.abs(r.change_percent) >= ANOMALY_THRESHOLD) ||
            r.energy_kwh == null ||
            r.amount_baht == null,
        ),
    [rows],
  );

  const totalKwh = rows.reduce((s, r) => s + (r.energy_kwh ?? 0), 0);
  const totalBaht = rows.reduce((s, r) => s + (r.amount_baht ?? 0), 0);
  const avgRate = totalBaht / totalKwh;

  const exportCsv = () => {
    const header = "period,energy_kwh,amount_baht,effective_baht_per_kwh,change_direction,change_percent\n";
    const body = rows
      .map(
        (r) =>
          `${r.period},${r.energy_kwh ?? ""},${r.amount_baht ?? ""},${r.effective_baht_per_kwh ?? ""},${r.change_direction},${r.change_percent ?? ""}`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `en-cu_${building.en_cu_meter}_billing.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="รายงานค่าไฟ & Anomaly"
        desc={`ประวัติค่าไฟจริง 52 เดือน · มิเตอร์ ${building.en_cu_meter} (${building.en_cu_building_code})`}
        action={
          <button
            onClick={exportCsv}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-fg"
          >
            ↓ Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="พลังงานรวม 52 เดือน" value={compactKwh(totalKwh)} unit="kWh" />
        <Kpi label="ค่าไฟรวม 52 เดือน" value={compactBaht(totalBaht)} />
        <Kpi label="ค่าไฟเฉลี่ย" value={avgRate.toFixed(2)} unit="฿/kWh" />
        <Kpi label="เดือนที่ผิดปกติ" value={num(anomalies.length)} sub={`เกิน ±${ANOMALY_THRESHOLD}%`} accent="warn" />
      </div>

      <div className="panel mt-4 p-5">
        <h3 className="mb-1 font-display text-base font-semibold">การใช้ไฟรายเดือน (kWh)</h3>
        <p className="mb-3 text-xs text-faint">ม.ค. 2022 – เม.ย. 2026 · แท่งชมพู = ต้นปี</p>
        <HistoryBars rows={rows} />
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-soft px-5 py-3.5">
          <h3 className="font-display text-base font-semibold">เดือนที่ตรวจพบความผิดปกติ</h3>
          <Pill tone="amber">{anomalies.length} รายการ</Pill>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs text-faint">
                <th className="px-5 py-2.5 font-medium">เดือน</th>
                <th className="px-5 py-2.5 font-medium">พลังงาน (kWh)</th>
                <th className="px-5 py-2.5 font-medium">ค่าไฟ (บาท)</th>
                <th className="px-5 py-2.5 font-medium">เปลี่ยนแปลง</th>
                <th className="px-5 py-2.5 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((r) => {
                const up = r.change_direction === "increase";
                const missing = r.energy_kwh == null || r.amount_baht == null;
                return (
                  <tr key={r.period} className="border-b border-border-soft/60 last:border-0">
                    <td className="tnum px-5 py-2.5 text-fg">{r.period}</td>
                    <td className="tnum px-5 py-2.5 text-muted">
                      {r.energy_kwh != null ? num(r.energy_kwh) : "—"}
                    </td>
                    <td className="tnum px-5 py-2.5 text-muted">
                      {r.amount_baht != null ? num(r.amount_baht) : "—"}
                    </td>
                    <td className="tnum px-5 py-2.5">
                      {r.change_percent != null ? (
                        <span className={up ? "text-danger" : "text-primary"}>
                          {up ? "▲" : "▼"} {Math.abs(r.change_percent).toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {missing ? (
                        <Pill tone="gray">ข้อมูลไม่ครบ</Pill>
                      ) : up ? (
                        <Pill tone="red">พุ่งผิดปกติ</Pill>
                      ) : (
                        <Pill tone="green">ลดผิดปกติ</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-faint">
        เกณฑ์ anomaly: การเปลี่ยนแปลงพลังงานเทียบเดือนก่อนหน้าเกิน ±{ANOMALY_THRESHOLD}% หรือข้อมูลไม่ครบ —
        ควรตรวจสอบการอ่านมิเตอร์ โหลดร่วม หรือการเปลี่ยนการใช้งานอาคาร
      </p>
    </div>
  );
}

function compactKwh(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}
