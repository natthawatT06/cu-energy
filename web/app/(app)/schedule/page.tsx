"use client";

import { useStore, type ZoneMode } from "@/lib/store";
import { PageHeader, Pill } from "@/components/ui";

const MODES: { key: ZoneMode; label: string }[] = [
  { key: "auto", label: "อัตโนมัติ" },
  { key: "force_on", label: "เปิดค้าง" },
  { key: "force_off", label: "ปิด" },
];

// minutes from 07:00 for the stagger timeline
function toMin(t: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? +m[1] * 60 + +m[2] : null;
}

export default function SchedulePage() {
  const { zones, updateZone, applySchedule, scheduleDirty } = useStore();

  const starts = zones
    .map((z) => ({ name: z.name, min: toMin(z.acOn) }))
    .filter((z) => z.min != null) as { name: string; min: number }[];
  const lo = Math.min(...starts.map((s) => s.min), 7 * 60);
  const hi = Math.max(...starts.map((s) => s.min), 9 * 60);

  return (
    <div>
      <PageHeader
        title="แผนเปิด-ปิดแอร์ / โซน"
        desc="กำหนดเวลาเปิด-ปิดแอร์รายโซน และเปิดเหลื่อมเวลาเพื่อไม่ให้โหลดพุ่งพร้อมกันตอนเช้า"
        action={
          <button
            disabled={!scheduleDirty}
            onClick={applySchedule}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              scheduleDirty
                ? "bg-primary text-bg hover:brightness-110"
                : "cursor-not-allowed border border-border text-faint"
            }`}
          >
            {scheduleDirty ? "ปรับใช้แผน" : "แผนเป็นปัจจุบัน ✓"}
          </button>
        }
      />

      {/* stagger timeline */}
      <div className="panel mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">ไทม์ไลน์เปิดแอร์เหลื่อมเวลา (เช้า)</h3>
          <span className="text-xs text-faint">07:00 → 09:00</span>
        </div>
        <div className="space-y-2">
          {starts.map((s) => {
            const pct = ((s.min - lo) / Math.max(1, hi - lo)) * 100;
            return (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-xs text-muted">{s.name}</div>
                <div className="relative h-2 flex-1 rounded-full bg-black/[0.06]">
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary"
                    style={{ left: `calc(${pct}% - 6px)` }}
                  />
                </div>
                <div className="tnum w-14 shrink-0 text-right text-xs text-fg/80">
                  {String(Math.floor(s.min / 60)).padStart(2, "0")}:
                  {String(s.min % 60).padStart(2, "0")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* zone table */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-soft text-left text-xs text-faint">
              <th className="px-4 py-3 font-medium">โซน</th>
              <th className="px-4 py-3 font-medium">การใช้งานเฉลี่ย</th>
              <th className="px-4 py-3 font-medium">เปิดแอร์</th>
              <th className="px-4 py-3 font-medium">ปิดแอร์</th>
              <th className="px-4 py-3 font-medium">โหมด</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-b border-border-soft/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-fg">{z.name}</div>
                  {z.critical && (
                    <div className="mt-1">
                      <Pill tone="red">Critical Load — ห้ามปิด</Pill>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${z.occupancy}%` }}
                      />
                    </div>
                    <span className="tnum text-xs text-muted">{z.occupancy}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {z.critical ? (
                    <span className="tnum text-faint">24 ชม.</span>
                  ) : (
                    <input
                      type="time"
                      value={z.acOn}
                      onChange={(e) => updateZone(z.id, { acOn: e.target.value })}
                      className="tnum rounded-lg border border-border bg-bg-2 px-2 py-1 text-fg outline-none focus:border-primary"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  {z.critical ? (
                    <span className="tnum text-faint">24 ชม.</span>
                  ) : (
                    <input
                      type="time"
                      value={z.acOff}
                      onChange={(e) => updateZone(z.id, { acOff: e.target.value })}
                      className="tnum rounded-lg border border-border bg-bg-2 px-2 py-1 text-fg outline-none focus:border-primary"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    {MODES.map((m) => (
                      <button
                        key={m.key}
                        disabled={z.critical && m.key !== "force_on"}
                        onClick={() => updateZone(z.id, { mode: m.key })}
                        className={`rounded-md px-2.5 py-1 text-xs transition disabled:opacity-30 ${
                          z.mode === m.key ? "bg-primary/20 text-primary" : "text-muted hover:text-fg"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-faint">
        * การปรับใช้แผนเป็นคำแนะนำเชิงปฏิบัติ (advisory) — ยังไม่สั่งควบคุมอุปกรณ์จริง ต้องผ่านการยืนยันจากฝ่ายอาคาร
      </p>
    </div>
  );
}
