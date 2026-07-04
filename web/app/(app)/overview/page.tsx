"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { building, loadDay, cost, summary } from "@/lib/data";
import { num, compactBaht, baht } from "@/lib/format";
import { LoadForecastChart, CostBar } from "@/components/charts";
import { Kpi, PageHeader, Pill } from "@/components/ui";

export default function OverviewPage() {
  const { recs } = useStore();
  const peakSlot = loadDay.baseline.findIndex((b) => b.total === loadDay.forecast_peak_kw);
  const pending = recs.filter((r) => r.status === "pending");
  const committed = recs.filter((r) => ["approved", "scheduled", "done"].includes(r.status));
  const savedBaht = committed.reduce((s, r) => s + r.baht, 0);
  const potential = recs.reduce((s, r) => s + r.baht, 0);
  const progress = potential > 0 ? (savedBaht / potential) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="ภาพรวมพลังงาน"
        desc={`${building.name_th} · สรุปสถานะการใช้พลังงาน ค่าไฟ และมาตรการ`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Peak คาดการณ์วันนี้" value={num(loadDay.forecast_peak_kw)} unit="kW" sub={`เวลา ${loadDay.forecast_peak_time}`} accent="warn" />
        <Kpi label="ค่าไฟจริงเฉลี่ย/เดือน" value={compactBaht(building.avg_monthly_baht)} sub={`มิเตอร์ ${building.en_cu_meter}`} />
        <Kpi label="Demand Charge" value={`${cost.demand_share_pct}%`} sub="ของบิลทั้งอาคาร" accent="accent" />
        <Kpi label="ศักยภาพประหยัด/ปี" value={compactBaht(summary.annual_baht_saved)} sub={`Peak −${summary.peak_pct_saved}%`} accent="primary" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="panel p-5">
          <h3 className="mb-3 font-display text-base font-semibold">พยากรณ์โหลดวันนี้</h3>
          <LoadForecastChart
            baseline={loadDay.baseline}
            forecast={loadDay.forecast}
            actual={loadDay.actual}
            currentSlot={loadDay.current_slot}
            peakSlot={peakSlot}
            peakVal={loadDay.forecast_peak_kw}
          />
        </div>

        <div className="space-y-4">
          {/* approvals */}
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">มาตรการรออนุมัติ</h3>
              {pending.length > 0 && <Pill tone="amber">{pending.length} รายการ</Pill>}
            </div>
            <div className="mt-3 space-y-2">
              {pending.length === 0 && (
                <p className="py-4 text-center text-sm text-faint">อนุมัติครบแล้ว ✓</p>
              )}
              {pending.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border-soft p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-fg">{r.name}</div>
                    <div className="tnum text-xs text-primary">฿{num(r.baht)}/เดือน · −{num(r.kw, 1)} kW</div>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/actions"
              className="mt-3 block rounded-lg bg-primary/15 py-2 text-center text-sm font-medium text-primary transition hover:bg-primary/25"
            >
              ไปหน้าอนุมัติมาตรการ →
            </Link>
          </div>

          {/* savings progress */}
          <div className="panel p-5">
            <h3 className="font-display text-base font-semibold">ความคืบหน้าการประหยัด</h3>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="tnum text-2xl font-semibold text-primary">{compactBaht(savedBaht)}</span>
              <span className="text-xs text-faint">จากศักยภาพ {compactBaht(potential)}/เดือน</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="tnum mt-1.5 text-xs text-muted">{progress.toFixed(0)}% ของมาตรการที่ระบบแนะนำ</div>
          </div>
        </div>
      </div>

      <div className="panel mt-4 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-display text-base font-semibold">โครงสร้างค่าไฟรายเดือน (โมเดลทั้งอาคาร)</h3>
          <span className="tnum text-lg font-semibold">{baht(cost.grand_total_baht)}</span>
        </div>
        <CostBar components={cost.components} total={cost.grand_total_baht} />
        <p className="mt-3 text-xs text-faint">
          Demand Charge ({cost.demand_share_pct}%) คิดจากกำลังไฟสูงสุดเพียง 15 นาทีของเดือน — การรีด Peak จึงลดค่าไฟก้อนนี้โดยตรง
        </p>
      </div>
    </div>
  );
}
