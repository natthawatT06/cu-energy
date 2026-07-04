"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { loadDay } from "@/lib/data";
import { num } from "@/lib/format";
import { LoadForecastChart } from "@/components/charts";
import { Kpi, PageHeader, Pill } from "@/components/ui";

export default function LivePage() {
  const { alerts, zones, log, ackAlert } = useStore();
  const current = loadDay.actual[loadDay.actual.length - 1]?.total ?? 0;
  const peakSlot = loadDay.baseline.findIndex((b) => b.total === loadDay.forecast_peak_kw);
  const activeAlerts = alerts.filter((a) => a.status !== "resolved");
  const autoZones = zones.filter((z) => z.mode !== "force_off").length;

  return (
    <div>
      <PageHeader
        title="Live Operations"
        desc="เฝ้าระวังโหลดไฟฟ้าแบบเรียลไทม์ · พยากรณ์ Peak วันนี้ · จัดการเหตุการณ์"
        action={
          <span className="chip flex items-center gap-2 px-3 py-1.5 text-xs text-muted">
            <span className="live-dot relative h-2 w-2 rounded-full bg-primary" />
            อัปเดตล่าสุด {loadDay.current_time}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="โหลดปัจจุบัน" value={num(current)} unit="kW" accent="primary" />
        <Kpi label="Peak คาดการณ์วันนี้" value={num(loadDay.forecast_peak_kw)} unit="kW" sub={`เวลา ${loadDay.forecast_peak_time}`} accent="warn" />
        <Kpi label="เหตุการณ์ที่ต้องจัดการ" value={num(activeAlerts.length)} sub="Peak alerts" accent={activeAlerts.some((a) => a.severity === "high") ? "danger" : "fg"} />
        <Kpi label="โซนที่ทำงาน" value={`${autoZones}/${zones.length}`} sub="ตามแผนแอร์" />
      </div>

      <div className="panel mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">พยากรณ์โหลด ราย 15 นาที</h3>
          <div className="flex gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-primary" />ค่าจริง</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-ac" />แอร์</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-light" />แสง</span>
          </div>
        </div>
        <LoadForecastChart
          baseline={loadDay.baseline}
          forecast={loadDay.forecast}
          actual={loadDay.actual}
          currentSlot={loadDay.current_slot}
          peakSlot={peakSlot}
          peakVal={loadDay.forecast_peak_kw}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* active alerts */}
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">เหตุการณ์ที่ต้องจัดการ</h3>
            <Link href="/alerts" className="text-xs text-primary hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="space-y-2.5">
            {activeAlerts.length === 0 && (
              <p className="py-6 text-center text-sm text-faint">ไม่มีเหตุการณ์ค้าง ✓</p>
            )}
            {activeAlerts.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-xl border border-border-soft p-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      a.severity === "high" ? "bg-danger" : a.severity === "med" ? "bg-warn" : "bg-ac"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg">{a.title}</span>
                      <span className="tnum ml-auto shrink-0 text-xs text-faint">{a.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{a.detail}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {a.status === "new" ? (
                        <button
                          onClick={() => ackAlert(a.id)}
                          className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/25"
                        >
                          รับทราบ
                        </button>
                      ) : (
                        <Pill tone="green">รับทราบแล้ว</Pill>
                      )}
                      <Link href="/alerts" className="text-xs text-muted hover:text-fg">
                        สั่งการ →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* activity log */}
        <div className="panel p-5">
          <h3 className="mb-3 font-display text-base font-semibold">บันทึกการทำงาน</h3>
          <div className="space-y-2">
            {log.length === 0 && (
              <p className="py-6 text-center text-sm text-faint">ยังไม่มีการดำเนินการ</p>
            )}
            {log.slice(0, 8).map((e, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <span className="tnum mt-0.5 shrink-0 text-xs text-faint">
                  {new Date(e.ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-fg/85">{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
