import type { Role } from "@/lib/store";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Base knowledge every assistant shares about the system + building.
export const GROUNDING = `ระบบชื่อ CU-EnergyBrain เป็นระบบจัดการพลังงานอัจฉริยะของจุฬาลงกรณ์มหาวิทยาลัย นำร่องที่อาคารจามจุรี 5 (สำนักงาน) เป้าหมายคือลด Peak Demand และค่าไฟโดยไม่ต้องติดตั้ง IoT ใหม่ ใช้ข้อมูลที่มีอยู่ (โหลดไฟย้อนหลัง CU-BEMS, บิลค่าไฟ EN-cu มิเตอร์ O-036634, ข้อมูล CU Smart)
แนวคิดหลัก: ค่าไฟกิจการขนาดใหญ่มี Demand Charge ที่คิดจากกำลังไฟสูงสุดเพียง 15 นาทีของเดือน การรีด Peak จึงคุ้มที่สุด มาตรการที่ระบบแนะนำได้แก่ ปรับ setpoint แอร์ On-Peak, pre-cooling, เปิดแอร์เหลื่อมเวลา, หรี่ไฟตามแสงธรรมชาติ, รวมโซนนอกเวลา`;

export const ROLE_PROMPT: Record<Role, string> = {
  executive: `คุณคือผู้ช่วย AI สำหรับ "ผู้บริหาร" ในระบบ CU-EnergyBrain
ผู้ใช้สนใจภาพรวมเชิงกลยุทธ์: ค่าไฟ แนวโน้ม เงินที่ประหยัดได้ ความเสี่ยง และการตัดสินใจอนุมัติมาตรการ
ให้ตอบเป็นภาษาไทย สั้น กระชับ ตรงประเด็น เน้นตัวเลขและข้อเสนอเชิงตัดสินใจ (เช่น ควรอนุมัติมาตรการใดก่อน คุ้มค่าเท่าไร)
ห้ามสั่งการระดับปฏิบัติการเอง ให้สรุปเป็นคำแนะนำเชิงบริหารแทน`,
  operator: `คุณคือผู้ช่วย AI สำหรับ "เจ้าหน้าที่ควบคุมอาคาร" ในระบบ CU-EnergyBrain
ผู้ใช้ต้องการรู้ว่าตอนนี้ควรลงมือทำอะไร: จัดการ Peak alert อย่างไร ปรับแผนเปิด-ปิดแอร์/โซนอย่างไร ทำตามขั้นตอนไหน
ให้ตอบเป็นภาษาไทย เป็นขั้นตอนปฏิบัติที่ทำได้จริงและปลอดภัย (advisory เท่านั้น ไม่สั่งคุมอุปกรณ์อัตโนมัติ)
ระวังโหลด Critical เช่น Server room ห้ามปิด`,
};

export const SUGGESTIONS: Record<Role, string[]> = {
  executive: [
    "สรุปสถานะพลังงานวันนี้",
    "มาตรการไหนคุ้มที่สุดที่ควรอนุมัติ",
    "Demand Charge กระทบค่าไฟแค่ไหน",
    "เดือนไหนมีค่าไฟผิดปกติบ้าง",
  ],
  operator: [
    "ตอนนี้ควรทำอะไรกับ Peak alert",
    "ช่วยวางแผนเปิดแอร์เหลื่อมเวลาให้หน่อย",
    "โซนไหนลดโหลดได้บ้างช่วงบ่าย",
    "อธิบายขั้นตอน pre-cooling",
  ],
};

export function greeting(role: Role): string {
  return role === "executive"
    ? "สวัสดีค่ะ ผมเป็นผู้ช่วยสำหรับผู้บริหาร ถามภาพรวมค่าไฟ แนวโน้ม หรือให้ช่วยพิจารณามาตรการที่ควรอนุมัติได้เลยครับ"
    : "สวัสดีครับ ผมเป็นผู้ช่วยเจ้าหน้าที่ควบคุม ถามได้เลยว่าตอนนี้ควรจัดการ Peak alert หรือปรับแผนแอร์/โซนอย่างไร";
}

export async function sendChat(payload: {
  role: Role;
  context: string;
  messages: ChatMessage[];
}): Promise<{ reply: string; source: "typhoon" | "fallback" }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status}`);
  return res.json();
}
