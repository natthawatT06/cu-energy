"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { building, loadDay, cost, summary } from "@/lib/data";
import { num } from "@/lib/format";
import {
  greeting,
  sendChat,
  SUGGESTIONS,
  type ChatMessage,
} from "@/lib/chat";

export function ChatDock() {
  const { role, alerts, recs, zones } = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // reset conversation when the acting role changes
  useEffect(() => {
    if (role) setMessages([{ role: "assistant", content: greeting(role) }]);
  }, [role]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const context = useMemo(() => {
    const newAlerts = alerts.filter((a) => a.status === "new");
    const pending = recs.filter((r) => r.status === "pending");
    const committed = recs.filter((r) => ["approved", "scheduled", "done"].includes(r.status));
    const topPending = [...pending].sort((a, b) => b.baht - a.baht)[0];
    return [
      `อาคาร: ${building.name_th} (มิเตอร์ ${building.en_cu_meter})`,
      `ค่าไฟจริงเฉลี่ย: ${num(building.avg_monthly_baht)} บาท/เดือน`,
      `Peak คาดการณ์วันนี้: ${num(loadDay.forecast_peak_kw)} kW เวลา ${loadDay.forecast_peak_time}`,
      `Demand Charge: ${cost.demand_share_pct}% ของบิลทั้งอาคาร`,
      `ศักยภาพประหยัดรวม: ~${num(summary.annual_baht_saved)} บาท/ปี (ลด Peak ${summary.peak_pct_saved}%)`,
      `Alert ที่ยังไม่จัดการ: ${newAlerts.length} รายการ${newAlerts.length ? " — " + newAlerts.map((a) => a.title).join("; ") : ""}`,
      `มาตรการ: รออนุมัติ ${pending.length} · ดำเนินการ/อนุมัติแล้ว ${committed.length} (จาก ${recs.length})`,
      topPending
        ? `มาตรการที่คุ้มสุดที่ยังรออนุมัติ: ${topPending.name} (ประหยัด ~${num(topPending.baht)} บาท/เดือน, ลด Peak ${num(topPending.kw, 1)} kW)`
        : "อนุมัติมาตรการครบแล้ว",
      `โซนแอร์: ทั้งหมด ${zones.length} โซน · Critical (ห้ามปิด) ${zones.filter((z) => z.critical).length}`,
    ].join("\n");
  }, [alerts, recs, zones]);

  if (!role) return null;
  const accent = role === "executive" ? "var(--color-accent)" : "var(--color-primary)";

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await sendChat({ role, context, messages: next });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "ขออภัยครับ เชื่อมต่อผู้ช่วยไม่ได้ กรุณาลองใหม่อีกครั้ง" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-105"
          style={{ background: accent }}
        >
          <ChatIcon />
          ผู้ช่วย AI
        </button>
      )}

      {/* panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-panel transition-transform duration-300 sm:w-[380px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ boxShadow: open ? "-8px 0 40px -18px rgba(16,24,40,0.25)" : "none" }}
      >
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: accent }}>
            <ChatIcon />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-fg">ผู้ช่วย AI</div>
            <div className="text-[11px] text-faint">
              {role === "executive" ? "โหมดผู้บริหาร" : "โหมดเจ้าหน้าที่ควบคุม"}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-black/[0.04] hover:text-fg"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md text-white"
                    : "rounded-bl-md border border-border-soft bg-bg-2 text-fg"
                }`}
                style={m.role === "user" ? { background: accent } : undefined}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-border-soft bg-bg-2 px-3.5 py-2.5">
                <span className="flex gap-1">
                  <Dot /> <Dot /> <Dot />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* suggestions */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {SUGGESTIONS[role].map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="chip px-2.5 py-1.5 text-left text-xs text-muted transition hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-border-soft p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถาม…"
            className="flex-1 rounded-xl border border-border bg-bg-2 px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition disabled:opacity-40"
            style={{ background: accent }}
            aria-label="ส่ง"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function Dot() {
  return <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint" />;
}
