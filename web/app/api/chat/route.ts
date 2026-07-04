import { GROUNDING, ROLE_PROMPT } from "@/lib/chat";
import type { Role } from "@/lib/store";

type Msg = { role: "user" | "assistant"; content: string };
type Body = { role: Role; context: string; messages: Msg[] };

const BASE_URL = process.env.TYPHOON_BASE_URL || "https://api.opentyphoon.ai/v1";
const MODEL = process.env.TYPHOON_MODEL || "typhoon-v2.5-30b-a3b-instruct";

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const { role, context, messages } = body;
  if (!role || !Array.isArray(messages)) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const key = process.env.TYPHOON_API_KEY;

  // No key configured yet -> grounded local fallback so the demo still works.
  if (!key) {
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return Response.json({ reply: fallbackAnswer(role, context, last), source: "fallback" });
  }

  const system = `${ROLE_PROMPT[role]}\n\n${GROUNDING}\n\nสถานะปัจจุบันของระบบ (ใช้อ้างอิงในการตอบ อย่าแต่งตัวเลขเกินจากนี้):\n${context}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 600,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        {
          reply: `ขออภัยครับ เชื่อมต่อ Typhoon ไม่สำเร็จ (HTTP ${res.status}). ตรวจ API key/model ใน .env.local อีกครั้ง`,
          source: "fallback",
          detail: detail.slice(0, 200),
        },
        { status: 200 },
      );
    }

    const data = await res.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "ขออภัยครับ ไม่ได้รับคำตอบจากโมเดล";
    return Response.json({ reply, source: "typhoon" });
  } catch (e) {
    return Response.json(
      {
        reply:
          "ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อผู้ช่วย AI กรุณาลองใหม่อีกครั้ง",
        source: "fallback",
        detail: String(e).slice(0, 200),
      },
      { status: 200 },
    );
  }
}

/** Lightweight keyword responder used until a Typhoon key is configured. */
function fallbackAnswer(role: Role, context: string, q: string): string {
  const t = q.toLowerCase();
  const note = "\n\n(โหมดสาธิต: ยังไม่ได้เชื่อม Typhoon API — เมื่อใส่ TYPHOON_API_KEY ใน .env.local ผู้ช่วยจะตอบแบบเต็มความสามารถ)";

  if (/peak|พีค|เตือน|alert|ดีมานด์|demand/.test(t)) {
    return (
      (role === "operator"
        ? "แนะนำลำดับการจัดการ Peak ตอนนี้:\n1) กดรับทราบ alert ที่หน้า Peak Alerts\n2) สั่งการตามคำแนะนำ (เช่น pre-cooling / เปิดแอร์เหลื่อมเวลา)\n3) ตรวจว่าโหลดลดต่ำกว่าเพดาน Demand ของเดือน"
        : "Peak Demand เป็นตัวกำหนด Demand Charge ซึ่งคิดจากกำลังไฟสูงสุด 15 นาทีของเดือน การรีด Peak ลงจึงลดค่าไฟก้อนนี้โดยตรง แนะนำอนุมัติมาตรการที่ลด Peak ช่วงบ่ายก่อน") +
      "\n\nอ้างอิงสถานะปัจจุบัน:\n" +
      context +
      note
    );
  }
  if (/ประหยัด|saving|คุ้ม|เงิน|บาท|ค่าไฟ|cost/.test(t)) {
    return (
      "สรุปด้านการประหยัด/ค่าไฟจากข้อมูลปัจจุบัน:\n" +
      context +
      (role === "executive"
        ? "\n\nข้อเสนอ: เริ่มอนุมัติมาตรการที่ให้ผลต่อเดือนสูงสุดและกระทบผู้ใช้น้อยก่อน"
        : "\n\nข้อเสนอ: ทยอยดำเนินมาตรการที่ได้รับอนุมัติแล้วในหน้ามาตรการแนะนำ") +
      note
    );
  }
  if (/แอร์|โซน|ac|schedule|เหลื่อม|pre-?cool|แผน/.test(t)) {
    return (
      (role === "operator"
        ? "แนวทางจัดแผนแอร์/โซน:\n1) เปิดแอร์เหลื่อมเวลาแต่ละโซน (ห่าง ~10 นาที) เพื่อไม่ให้โหลดพุ่งพร้อมกันตอนเช้า\n2) pre-cooling 06:00–08:00 แล้วลดโหลด 13:00–15:00\n3) หลัง 18:00 รวมผู้ใช้งานไว้โซนเดียว ปิดโซนอื่น (ยกเว้น Server room)"
        : "มาตรการด้านแอร์/โซนที่ให้ผลชัดคือ ปรับ setpoint On-Peak, pre-cooling และรวมโซนนอกเวลา — เจ้าหน้าที่จะเป็นผู้ดำเนินการหลังได้รับอนุมัติ") +
      "\n\nสถานะปัจจุบัน:\n" +
      context +
      note
    );
  }
  return (
    (role === "executive"
      ? "ผมช่วยสรุปภาพรวมค่าไฟ แนวโน้ม ความเสี่ยง Peak และช่วยพิจารณามาตรการที่ควรอนุมัติได้ ลองถามเช่น \"มาตรการไหนคุ้มที่สุด\""
      : "ผมช่วยแนะนำการจัดการ Peak alert และการวางแผนเปิด-ปิดแอร์/โซนได้ ลองถามเช่น \"ตอนนี้ควรทำอะไรกับ Peak alert\"") +
    "\n\nสถานะปัจจุบัน:\n" +
    context +
    note
  );
}
