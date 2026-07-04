"use client";

import { useStore, statusLabel, type RecStatus } from "@/lib/store";
import { num, compactBaht } from "@/lib/format";
import { Kpi, PageHeader, Pill } from "@/components/ui";

const STATUS_TONE: Record<RecStatus, string> = {
  pending: "gray",
  approved: "amber",
  scheduled: "pink",
  done: "green",
  dismissed: "gray",
};

const CAT: Record<string, string> = {
  ac: "แอร์",
  peak: "Peak",
  lighting: "แสงสว่าง",
  space: "พื้นที่",
};

export default function ActionsPage() {
  const { role, recs, setRecStatus } = useStore();

  const committed = recs.filter((r) => ["approved", "scheduled", "done"].includes(r.status));
  const savedBaht = committed.reduce((s, r) => s + r.baht, 0);
  const savedKw = committed.reduce((s, r) => s + r.kw, 0);

  return (
    <div>
      <PageHeader
        title="มาตรการแนะนำ — ควรทำอย่างไร"
        desc={
          role === "executive"
            ? "พิจารณาอนุมัติมาตรการประหยัดพลังงานที่ระบบแนะนำ พร้อมผลลัพธ์ที่คาดว่าจะได้"
            : "ดำเนินการมาตรการที่ได้รับอนุมัติแล้ว พร้อมขั้นตอนปฏิบัติทีละข้อ"
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="มาตรการที่รับไปแล้ว" value={`${committed.length}/${recs.length}`} accent="primary" />
        <Kpi label="ประหยัดรวมที่คาดได้" value={compactBaht(savedBaht)} sub="ต่อเดือน" accent="primary" />
        <Kpi label="ลด Peak รวม" value={num(savedKw, 1)} unit="kW" accent="accent" />
        <Kpi label="รออนุมัติ" value={num(recs.filter((r) => r.status === "pending").length)} accent="warn" />
      </div>

      <div className="space-y-3">
        {recs.map((r) => (
          <div key={r.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold">{r.name}</h3>
              <Pill tone="gray">{CAT[r.category] ?? r.category}</Pill>
              <Pill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Pill>
            </div>
            <p className="mt-1.5 text-sm text-muted">{r.rule}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="rounded-xl border border-border-soft p-3">
                <div className="mb-2 text-xs font-medium text-faint">ขั้นตอนปฏิบัติ</div>
                <ol className="space-y-1.5 text-sm text-fg/85">
                  {r.steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="tnum text-faint">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-2 rounded-xl border border-border-soft p-3 sm:w-44">
                <div>
                  <div className="text-xs text-faint">ประหยัด/เดือน</div>
                  <div className="tnum text-lg font-semibold text-primary">฿{num(r.baht)}</div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-xs text-faint">Peak</div>
                    <div className="tnum text-sm text-accent">−{num(r.kw, 1)} kW</div>
                  </div>
                  <div>
                    <div className="text-xs text-faint">CO₂</div>
                    <div className="tnum text-sm text-muted">−{num(r.co2)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* role-based workflow */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {role === "executive" ? (
                r.status === "pending" ? (
                  <>
                    <button
                      onClick={() => setRecStatus(r.id, "approved")}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-bg transition hover:brightness-110"
                    >
                      อนุมัติ
                    </button>
                    <button
                      onClick={() => setRecStatus(r.id, "dismissed")}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-danger"
                    >
                      ไม่ดำเนินการ
                    </button>
                  </>
                ) : r.status === "dismissed" ? (
                  <button onClick={() => setRecStatus(r.id, "pending")} className="text-xs text-muted hover:text-fg">
                    นำกลับมาพิจารณา
                  </button>
                ) : (
                  <span className="text-xs text-faint">อนุมัติแล้ว — รอเจ้าหน้าที่ดำเนินการ</span>
                )
              ) : /* operator */ r.status === "pending" ? (
                <span className="text-xs text-faint">⏳ รออนุมัติจากผู้บริหาร</span>
              ) : r.status === "approved" ? (
                <>
                  <button
                    onClick={() => setRecStatus(r.id, "scheduled")}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-fg"
                  >
                    ตั้งเวลา
                  </button>
                  <button
                    onClick={() => setRecStatus(r.id, "done")}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-bg transition hover:brightness-110"
                  >
                    ดำเนินการแล้ว
                  </button>
                </>
              ) : r.status === "scheduled" ? (
                <button
                  onClick={() => setRecStatus(r.id, "done")}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-bg transition hover:brightness-110"
                >
                  ดำเนินการแล้ว
                </button>
              ) : r.status === "done" ? (
                <span className="text-xs text-primary">✓ ดำเนินการแล้ว</span>
              ) : (
                <span className="text-xs text-faint">ผู้บริหารไม่อนุมัติ</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
