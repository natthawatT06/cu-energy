import { spaces } from "@/lib/data";
import { num } from "@/lib/format";
import { Bar } from "@/components/ui";

export function Spaces() {
  const s = spaces;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Office zones */}
      <div className="panel p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-primary)" }} />
          <h4 className="font-display text-lg font-semibold">สำนักงาน — After-hours zoning</h4>
        </div>
        <p className="mb-4 text-xs text-faint">จามจุรี 5 · โซนอ้างอิงจากโครงสร้าง CU-BEMS จริง</p>
        <div className="space-y-3">
          {s.office_zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-sm text-fg/90">{z.zone}</div>
              <div className="flex-1">
                <Bar
                  v={z.typical_occupancy_pct}
                  max={100}
                  color={z.critical ? "var(--color-danger)" : "var(--color-primary)"}
                />
              </div>
              <div className="tnum w-12 text-right text-xs text-muted">{z.typical_occupancy_pct}%</div>
              {z.critical ? (
                <span className="chip w-24 shrink-0 px-2 py-0.5 text-center text-[10px] text-danger">
                  Critical Load
                </span>
              ) : (
                <span className="tnum w-24 shrink-0 text-right text-xs text-faint">
                  {z.after_hours_kw} kW ค้าง
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.05] p-3 text-sm leading-relaxed text-fg/90">
          <span className="font-medium text-primary">คำแนะนำ · </span>
          {s.office_recommendation.text}
          <div className="tnum mt-2 text-xs text-primary">
            ปิดได้ {s.office_recommendation.closable_zones} โซน · ลดโหลดค้างคืน ~
            {num(s.office_recommendation.after_hours_kw_saved)} kW
          </div>
        </div>
      </div>

      {/* Classrooms */}
      <div className="panel p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-accent)" }} />
          <h4 className="font-display text-lg font-semibold">ห้องเรียน — Right-sizing & consolidation</h4>
        </div>
        <p className="mb-4 text-xs text-faint">คลัสเตอร์ห้องเรียนตัวอย่าง (synthetic ตามสเปกห้องจริง)</p>
        <div className="space-y-2.5">
          {s.classrooms.map((c) => (
            <div
              key={c.room}
              className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                c.oversized ? "border-warn/30 bg-warn/[0.04]" : "border-border-soft"
              }`}
            >
              <div className="w-24 shrink-0">
                <div className="tnum text-sm text-fg">{c.room}</div>
                <div className="text-[11px] text-faint">
                  ตึก {c.building} · {c.type}
                </div>
              </div>
              <div className="flex-1">
                <Bar
                  v={c.utilization_pct}
                  max={100}
                  color={c.oversized ? "var(--color-warn)" : "var(--color-primary)"}
                />
                <div className="tnum mt-1 text-[11px] text-faint">
                  {c.enrolled}/{c.capacity} ที่นั่ง · {c.utilization_pct}%
                </div>
              </div>
              {c.oversized && (
                <span className="chip shrink-0 px-2 py-0.5 text-[10px] text-warn">ห้องใหญ่เกิน</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[0.05] p-3 text-sm leading-relaxed text-fg/90">
          <span className="font-medium text-accent">คำแนะนำ · </span>
          {s.classroom_recommendation.text}
          <div className="tnum mt-2 text-xs text-accent">
            ปิดได้ {s.classroom_recommendation.buildings_closable} อาคารในคาบนั้น · ลดโหลดแอร์ ~
            {num(s.classroom_recommendation.ac_kw_saved)} kW
          </div>
        </div>
      </div>
    </div>
  );
}
