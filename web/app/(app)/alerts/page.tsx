"use client";

import { useState } from "react";
import { useStore, type AlertStatus } from "@/lib/store";
import { num } from "@/lib/format";
import { PageHeader, Pill } from "@/components/ui";

const SEV = {
  high: { tone: "red", label: "วิกฤต", dot: "bg-danger" },
  med: { tone: "amber", label: "เฝ้าระวัง", dot: "bg-warn" },
  info: { tone: "gray", label: "แจ้งเพื่อทราบ", dot: "bg-ac" },
} as const;

const STATUS_TABS: { key: AlertStatus | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "new", label: "ใหม่" },
  { key: "ack", label: "รับทราบแล้ว" },
  { key: "resolved", label: "ปิดแล้ว" },
];

export default function AlertsPage() {
  const { alerts, recs, ackAlert, resolveAlert, setRecStatus } = useStore();
  const [filter, setFilter] = useState<AlertStatus | "all">("all");
  const list = alerts.filter((a) => filter === "all" || a.status === filter);

  const command = (alertId: string, recId?: string) => {
    if (recId) setRecStatus(recId, "done");
    resolveAlert(alertId);
  };

  return (
    <div>
      <PageHeader
        title="Peak Alerts & สั่งการ"
        desc="รายการแจ้งเตือนความเสี่ยง Peak Demand — รับทราบ สั่งการตามคำแนะนำ และปิดเหตุการณ์"
        action={
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  filter === t.key ? "bg-primary/15 text-primary" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-3">
        {list.length === 0 && (
          <div className="panel p-10 text-center text-sm text-faint">ไม่มีรายการในหมวดนี้</div>
        )}
        {list.map((a) => {
          const sev = SEV[a.severity];
          const rec = recs.find((r) => r.id === a.recId);
          return (
            <div key={a.id} className="panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${sev.dot}`} />
                <h3 className="font-display text-base font-semibold">{a.title}</h3>
                <Pill tone={sev.tone}>{sev.label}</Pill>
                {a.status === "resolved" && <Pill tone="green">ปิดแล้ว</Pill>}
                {a.status === "ack" && <Pill tone="amber">รับทราบแล้ว</Pill>}
                <span className="tnum ml-auto text-xs text-faint">วันนี้ {a.time}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.detail}</p>

              {rec && (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <span>✦ คำแนะนำในการจัดการ</span>
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-fg">{rec.name}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tnum">
                    <span className="text-primary">ลดค่าไฟ ~฿{num(rec.baht)}/เดือน</span>
                    <span className="text-accent">ลด Peak {num(rec.kw, 1)} kW</span>
                    <span className="text-muted">ลด CO₂ {num(rec.co2)} kg/เดือน</span>
                  </div>
                  <ol className="mt-2.5 space-y-1 text-xs text-muted">
                    {rec.steps.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="tnum text-faint">{i + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {a.status !== "resolved" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {a.status === "new" && (
                    <button
                      onClick={() => ackAlert(a.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-fg"
                    >
                      รับทราบ
                    </button>
                  )}
                  <button
                    onClick={() => command(a.id, a.recId)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-bg transition hover:brightness-110"
                  >
                    {a.recId ? "สั่งการตามคำแนะนำ & ปิดเหตุการณ์" : "ปิดเหตุการณ์"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
