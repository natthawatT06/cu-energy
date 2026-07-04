"use client";

import { useMemo, useState } from "react";
import { measures as M } from "@/lib/data";
import { simulate, baht, num, compactBaht } from "@/lib/format";
import { SimCompareChart } from "@/components/charts";
import { Kpi } from "@/components/ui";

const CAT: Record<string, { label: string; color: string }> = {
  ac: { label: "แอร์", color: "var(--color-ac)" },
  peak: { label: "Peak", color: "var(--color-accent)" },
  lighting: { label: "แสงสว่าง", color: "var(--color-light)" },
  space: { label: "พื้นที่", color: "var(--color-primary)" },
};

export function Simulator() {
  const base = M.baseline_total_kw;
  const all = M.measures;
  const [active, setActive] = useState<Set<string>>(
    () => new Set(all.map((m) => m.id)),
  );

  const toggle = (id: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const result = useMemo(() => {
    const deltas = all.filter((m) => active.has(m.id)).map((m) => m.delta_kw);
    return simulate(base, deltas);
  }, [active, all, base]);

  const annualBaht = result.monthlyBaht * 12;
  const annualCo2 = (result.monthlyCo2Kg * 12) / 1000;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      {/* measures */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted">เลือกมาตรการเพื่อจำลองผล</span>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setActive(new Set(all.map((m) => m.id)))}
              className="chip px-2.5 py-1 text-muted transition hover:text-fg"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={() => setActive(new Set())}
              className="chip px-2.5 py-1 text-muted transition hover:text-fg"
            >
              ล้าง
            </button>
          </div>
        </div>
        {all.map((m) => {
          const on = active.has(m.id);
          const cat = CAT[m.category] ?? CAT.ac;
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`w-full rounded-2xl border p-3.5 text-left transition ${
                on
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "border-border bg-panel hover:border-border/80"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                    on ? "justify-end bg-primary" : "justify-start bg-white/10"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full bg-bg shadow" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg">{m.name}</span>
                    <span
                      className="chip shrink-0 px-1.5 py-0.5 text-[10px]"
                      style={{ color: cat.color }}
                    >
                      {cat.label}
                    </span>
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-faint">{m.rule}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tnum">
                    <span className="text-primary">
                      −{compactBaht(-m.monthly_energy_baht_delta + m.peak_kw_delta * 132.93 * 1.07)}
                      <span className="text-faint">/เดือน</span>
                    </span>
                    <span className="text-accent">
                      −{num(m.peak_kw_delta, 1)} kW peak
                    </span>
                    <span className="text-muted">
                      −{num(-m.monthly_co2_delta_kg)} kgCO₂
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* live result */}
      <div className="panel p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h4 className="font-display text-lg font-semibold">ผลจำลองแบบ real-time</h4>
          <span className="text-xs text-faint">baseline vs optimized</span>
        </div>
        <SimCompareChart baseline={base} optimized={result.optimized} />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kpi
            label="ลด Peak"
            value={num(result.peakSaved, 0)}
            unit="kW"
            sub={`−${result.peakPctSaved.toFixed(1)}%`}
            accent="accent"
          />
          <Kpi label="ประหยัด/เดือน" value={compactBaht(result.monthlyBaht)} accent="primary" />
          <Kpi label="ประหยัด/ปี" value={compactBaht(annualBaht)} accent="primary" />
          <Kpi label="ลด CO₂/ปี" value={num(annualCo2, 1)} unit="ตัน" accent="fg" />
        </div>
        <div className="mt-3 rounded-xl border border-border-soft bg-bg-2/50 p-3 text-xs leading-relaxed text-muted">
          Demand charge คิดจาก <span className="text-fg">Peak สูงสุดเพียง 15 นาทีเดียว</span> ของเดือน
          — การรีดยอด Peak ลง {num(result.peakSaved, 0)} kW จึงลดค่า Demand ได้{" "}
          <span className="tnum text-accent">
            {baht(result.peakSaved * 132.93 * 1.07)}
          </span>
          /เดือน โดยไม่ลงทุนฮาร์ดแวร์
        </div>
      </div>
    </div>
  );
}
