"use client";

import { useRouter } from "next/navigation";
import { useStore, type Role } from "@/lib/store";
import { building } from "@/lib/data";

const ROLES: {
  role: Role;
  title: string;
  desc: string;
  perms: string[];
  home: string;
  accent: string;
}[] = [
  {
    role: "executive",
    title: "ผู้บริหาร",
    desc: "ดูภาพรวมการใช้พลังงาน ค่าไฟ แนวโน้ม และอนุมัติมาตรการ",
    perms: ["ดู Dashboard & KPI", "รายงานค่าไฟ + anomaly", "อนุมัติ/ปฏิเสธมาตรการ"],
    home: "/overview",
    accent: "var(--color-accent)",
  },
  {
    role: "operator",
    title: "เจ้าหน้าที่ควบคุม",
    desc: "เฝ้าระวังโหลดแบบเรียลไทม์ รับ-สั่งการ Peak alert และคุมแผนเปิด-ปิดแอร์/โซน",
    perms: ["Live monitoring + สั่งการ", "จัดการ Peak alert", "แก้/ปรับใช้แผนแอร์/โซน"],
    home: "/live",
    accent: "var(--color-primary)",
  },
];

export default function RoleSelect() {
  const router = useRouter();
  const { setRole } = useStore();

  const enter = (r: Role, home: string) => {
    setRole(r);
    router.push(home);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-16">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/30 bg-primary/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="var(--color-primary)" />
          </svg>
        </div>
        <div>
          <div className="font-display text-lg font-semibold">CU-EnergyBrain</div>
          <div className="text-xs text-faint">Smart Campus Energy Management · {building.name_th}</div>
        </div>
      </div>

      <h1 className="mt-10 font-display text-3xl font-semibold sm:text-4xl">
        เข้าสู่ระบบในบทบาทของคุณ
      </h1>
      <p className="mt-2 text-sm text-muted">เลือกบทบาทเพื่อเข้าใช้งานหน้าจอและสิทธิ์ที่เหมาะสม</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ROLES.map((r) => (
          <button
            key={r.role}
            onClick={() => enter(r.role, r.home)}
            className="panel group p-6 text-left transition hover:-translate-y-0.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: `color-mix(in oklab, ${r.accent} 14%, white)` }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={r.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={r.role === "executive" ? "M4 20V10M10 20V4M16 20v-7M20 20H3" : "M3 12h4l2 6 4-14 2 8h6"} />
              </svg>
            </div>
            <div className="mt-4 font-display text-xl font-semibold">{r.title}</div>
            <div className="mt-1.5 text-sm leading-relaxed text-muted">{r.desc}</div>
            <ul className="mt-4 space-y-1.5">
              {r.perms.map((p) => (
                <li key={p} className="flex items-center gap-2 text-xs text-fg/80">
                  <span style={{ color: r.accent }}>✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <div
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: r.accent }}
            >
              เข้าใช้งาน
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-faint">
        ระบบสาธิต · ข้อมูล grounded จาก CU-BEMS / EN-cu / CU Smart · การสั่งการเป็น advisory
      </p>
    </div>
  );
}
