"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { measures, spaces } from "@/lib/data";

export type Role = "operator" | "executive";

export type AlertStatus = "new" | "ack" | "resolved";
export type Alert = {
  id: string;
  severity: "high" | "med" | "info";
  title: string;
  detail: string;
  time: string; // HH:MM today
  status: AlertStatus;
  recId?: string;
};

export type RecStatus =
  | "pending"
  | "approved"
  | "scheduled"
  | "done"
  | "dismissed";
export type Rec = {
  id: string;
  name: string;
  category: string;
  rule: string;
  steps: string[];
  baht: number; // monthly saving
  kw: number; // peak kW reduced
  co2: number; // kg/month
  status: RecStatus;
};

export type ZoneMode = "auto" | "force_on" | "force_off";
export type Zone = {
  id: string;
  name: string;
  floor: number;
  acOn: string;
  acOff: string;
  mode: ZoneMode;
  critical: boolean;
  occupancy: number;
};

export type LogEntry = { ts: number; who: Role; msg: string };

export type State = {
  role: Role | null;
  alerts: Alert[];
  recs: Rec[];
  zones: Zone[];
  log: LogEntry[];
  scheduleDirty: boolean;
};

const STEPS: Record<string, string[]> = {
  setpoint: [
    "ตั้งค่า setpoint แอร์โซนสำนักงานเป็น 26°C ในช่วง 09:00–22:00",
    "แจ้งผู้ใช้พื้นที่ล่วงหน้าผ่านประกาศ/อีเมล",
    "เก็บ comfort feedback หลังใช้ 1 สัปดาห์ แล้วปรับตามเหมาะสม",
  ],
  precool: [
    "เปิดแอร์ pre-cooling เวลา 06:00–08:00 (ช่วง Off-Peak ค่าไฟถูก)",
    "ลดการทำงานแอร์ช่วง 13:00–15:00 โดยอาศัยความเย็นสะสม",
    "ตรวจอุณหภูมิห้องไม่ให้เกิน 27°C ระหว่างช่วง coast",
  ],
  stagger: [
    "กำหนดเวลาเปิดแอร์เหลื่อมกันทีละโซน (ห่างกัน 10 นาที)",
    "เริ่มจากโซนที่มีคนเข้าใช้เร็วสุดก่อน",
    "ตรวจว่าไม่มีหลายโซนสตาร์ตพร้อมกันในช่วงเช้า",
  ],
  lighting: [
    "แบ่งวงจรไฟโซนริมหน้าต่างที่มีแสงธรรมชาติพอ",
    "หรี่/ปิดไฟโซนนั้นช่วงกลางวัน (07:00–17:00)",
    "ติดป้าย/สื่อสารให้ผู้ใช้เข้าใจเหตุผล",
  ],
  consolidate: [
    "หลัง 18:00 รวมผู้ใช้งานนอกเวลาไว้โซนเดียว (After-hours Zone)",
    "ปิดแอร์/ไฟโซนที่เหลือ ยกเว้น Server room",
    "เปิดช่องให้ผู้ใช้ขอใช้พื้นที่นอกเวลาได้ล่วงหน้า",
  ],
};

function seed(): State {
  const recs: Rec[] = measures.measures.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    rule: m.rule,
    steps: STEPS[m.id] ?? [],
    baht: Math.round(-m.monthly_energy_baht_delta + m.peak_kw_delta * 132.93 * 1.07),
    kw: m.peak_kw_delta,
    co2: -m.monthly_co2_delta_kg,
    status: "pending",
  }));

  const starts = ["07:45", "07:55", "08:05", "08:15", "08:25"];
  const zones: Zone[] = spaces.office_zones.map((z, i) => ({
    id: `z${z.floor}-${i}`,
    name: z.zone,
    floor: z.floor,
    acOn: z.critical ? "24ชม." : starts[i % starts.length],
    acOff: z.critical ? "24ชม." : "18:00",
    mode: z.critical ? "force_on" : "auto",
    critical: z.critical,
    occupancy: z.typical_occupancy_pct,
  }));

  const alerts: Alert[] = [
    {
      id: "a1",
      severity: "high",
      title: "เสี่ยงตั้งค่า Peak Demand ใหม่ของเดือน",
      detail:
        "พยากรณ์โหลดแตะ 640 kW เวลา 13:15 ซึ่งใกล้เพดาน Demand ของเดือน หากปล่อยไว้จะเพิ่มค่า Demand Charge",
      time: "13:15",
      status: "new",
      recId: "precool",
    },
    {
      id: "a2",
      severity: "med",
      title: "โหลดโซน F3 สำนักงานสูงกว่าค่าเฉลี่ย 18%",
      detail: "โซน F3 ใช้ไฟสูงผิดปกติช่วงบ่าย อาจมีแอร์/อุปกรณ์เปิดค้างเกินการใช้งานจริง",
      time: "14:20",
      status: "new",
      recId: "setpoint",
    },
    {
      id: "a3",
      severity: "info",
      title: "พรุ่งนี้อากาศร้อน 35°C — เตรียม pre-cooling",
      detail: "พยากรณ์อากาศร้อนกว่าปกติ แนะนำ pre-cooling ช่วงเช้าเพื่อลดโหลด On-Peak",
      time: "16:00",
      status: "new",
      recId: "precool",
    },
  ];

  return { role: null, alerts, recs, zones, log: [], scheduleDirty: false };
}

const KEY = "cu-eb-state-v1";

type Ctx = State & {
  hydrated: boolean;
  setRole: (r: Role | null) => void;
  ackAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  setRecStatus: (id: string, status: RecStatus) => void;
  updateZone: (id: string, patch: Partial<Zone>) => void;
  applySchedule: () => void;
  reset: () => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const api = useMemo<Ctx>(() => {
    const addLog = (s: State, msg: string): LogEntry[] =>
      [{ ts: Date.now(), who: s.role ?? "operator", msg }, ...s.log].slice(0, 50);

    return {
      ...state,
      hydrated,
      setRole: (role) => setState((s) => ({ ...s, role })),
      ackAlert: (id) =>
        setState((s) => ({
          ...s,
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: "ack" } : a)),
          log: addLog(s, `รับทราบ alert: ${s.alerts.find((a) => a.id === id)?.title ?? id}`),
        })),
      resolveAlert: (id) =>
        setState((s) => ({
          ...s,
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, status: "resolved" } : a,
          ),
          log: addLog(s, `ปิด alert: ${s.alerts.find((a) => a.id === id)?.title ?? id}`),
        })),
      setRecStatus: (id, status) =>
        setState((s) => ({
          ...s,
          recs: s.recs.map((r) => (r.id === id ? { ...r, status } : r)),
          log: addLog(
            s,
            `มาตรการ "${s.recs.find((r) => r.id === id)?.name ?? id}" → ${statusLabel(status)}`,
          ),
        })),
      updateZone: (id, patch) =>
        setState((s) => ({
          ...s,
          zones: s.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
          scheduleDirty: true,
        })),
      applySchedule: () =>
        setState((s) => ({
          ...s,
          scheduleDirty: false,
          log: addLog(s, "ปรับใช้แผนเปิด-ปิดแอร์/โซนใหม่"),
        })),
      reset: () => {
        localStorage.removeItem(KEY);
        setState(seed());
      },
    };
  }, [state, hydrated]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function statusLabel(s: RecStatus): string {
  return {
    pending: "รอพิจารณา",
    approved: "อนุมัติแล้ว",
    scheduled: "ตั้งเวลาแล้ว",
    done: "ดำเนินการแล้ว",
    dismissed: "ไม่ดำเนินการ",
  }[s];
}

export const ROLE_LABEL: Record<Role, string> = {
  operator: "เจ้าหน้าที่ควบคุม",
  executive: "ผู้บริหาร",
};
