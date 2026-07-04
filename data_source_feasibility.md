# ความเป็นไปได้ในการเชื่อมข้อมูลสำหรับ CU-EnergyBrain

## สรุปการตัดสินใจ

ทำได้ โดยใช้ **frontend JSON endpoints** ที่หน้าเว็บเรียกอยู่ แม้ไม่มี public API documentation ซึ่งเสถียรและตรงกับข้อมูลบนหน้าจอกว่าการ parse HTML

- **CU Smart / Lump Sum:** หน้าเว็บเรียก JSON endpoint ภายในอยู่แล้ว ข้อมูลสรุปปัจจุบันหลายชุดเปิดอ่านได้ จึงเก็บ raw snapshot ได้ทันที
- **ข้อมูลย้อนหลังและรายงาน Demand:** endpoint ที่ตรวจพบตอบ `401 Unauthorized` เมื่อไม่มีบัญชี จำเป็นต้องขอ service account, API token หรือ export ที่ได้รับอนุญาต
- **e-Off-Bill:** request อัตโนมัติถูก Imperva/Incapsula WAF ปฏิเสธ ไม่ควร bypass ควรขอ API, CSV/XLSX export หรือบัญชีระบบสำหรับงาน integration

## สิ่งที่ตรวจยืนยันแล้ว (4 กรกฎาคม 2026, Asia/Bangkok)

| แหล่ง | สิ่งที่พบ | สถานะ |
|---|---|---|
| `ls.ene.cusmart.chula.ac.th` | Angular frontend เรียก API ฐาน `https://ls.ene.cusmart.chula.ac.th/web-api/api/v1` | ยืนยันจาก frontend bundle |
| `/faculty/energy_info` | รายการ 22 หน่วยงาน พร้อม `energy`, `power`, `supply_energy`, `supply_power` | เปิดอ่านได้, HTTP 200 |
| `/node/1/usage_profile/default/energy` | ภาพรวมพร้อม `energy`, `power`, `peak`, `bill` และกราฟ 96 จุด/วัน (15 นาที) | เปิดอ่านได้, HTTP 200 |
| `/building/energy_info?faculty_id=35` | พบ 24 รายการภายใต้คณะวิศวกรรมศาสตร์ | เปิดอ่านได้, HTTP 200 |
| `/building/usage_profile/default/energy?faculty_id=35` | load profile ระดับอาคาร/โหนด | เปิดอ่านได้, HTTP 200 |
| `/report/demand?...` | รายงาน Demand ย้อนหลัง | ต้องยืนยันตัวตน, HTTP 401 |
| `/users/profile` | ตรวจ session/token | ต้องยืนยันตัวตน, HTTP 401 |
| `prm.chula.ac.th/e-off-bill` | WAF ส่งหน้า `Request unsuccessful` แทนข้อมูล | automation ถูกบล็อก |

### ผลการเก็บข้อมูลจริงรอบเต็ม

รอบเวลา 06:25–06:26 น. เก็บข้อมูลจาก CU Smart สำเร็จโดยไม่มี endpoint error:

- 125 datasets ขนาดรวม 27.18 MB
- 22 หน่วยงาน
- 218 อาคาร/โหนดอาคารที่มี ID ไม่ซ้ำกัน
- 290 โหนดใน structure tree ทุกระดับ
- 20,928 จุดข้อมูล power ระดับอาคาร (218 × 96 จุด/วัน)
- เก็บทั้ง `energy` และ `power` profiles พร้อม master data, EUI, พิกัด และ generation profiles

ไฟล์ raw: `data/raw/cusmart/cusmart_snapshot_20260703T232646Z.json`

หน้า CU Smart แสดงหน่วย `kWh`, `kW` และ `Baht` แต่ความหมายของช่วงสะสม เช่น `energy` และสูตร `bill` ควรยืนยันกับเจ้าของระบบก่อนใช้เป็นตัวเลขทางการ

## ข้อมูลที่ใช้ทำ MVP ได้ทันที

1. Snapshot กำลังไฟปัจจุบันรายมหาวิทยาลัย/หน่วยงาน/อาคาร
2. กราฟราย 15 นาทีของวันปัจจุบันจาก public profile endpoint
3. ค่า peak และ energy summary ที่หน้า dashboard ใช้อยู่
4. รายชื่อหน่วยงานและโหนดอาคารสำหรับทำ data catalog เบื้องต้น

ข้อควรระวัง: endpoint รายวันคืนครบ 96 timestamp ตั้งแต่ 00:00–23:45 และจุดเวลาในอนาคตอาจเป็นศูนย์ ต้องระบุว่าเป็น `not_observed_yet` แทนการตีความว่าใช้ไฟ 0 kWh

## ข้อมูลที่ยังต้องขอ

| ชุดข้อมูล | เหตุผลที่ต้องมี | วิธีขอที่แนะนำ |
|---|---|---|
| Load 15 นาทีย้อนหลังอย่างน้อย 12–24 เดือน | ฝึกและ backtest Peak Forecast | Read-only API token หรือ scheduled export |
| Maximum Demand และค่า Demand Charge ในบิลจริง | สร้าง baseline และคำนวณเงินประหยัด | CSV/XLSX จาก e-Off-Bill หรือ API อย่างเป็นทางการ |
| Mapping มิเตอร์ → อาคาร → ชั้น/โซน | เชื่อมโหลดกับตารางเรียนและคำแนะนำ | Master data จาก CU Smart/BEMS |
| ตารางเรียน จำนวนผู้เรียน และความจุห้อง | Space Optimization | Export/API จากระบบทะเบียน/ห้องเรียน |
| ตารางเปิดแอร์และข้อจำกัด Critical Load | สร้างคำแนะนำที่ทำได้จริง | ฝ่ายอาคารและผู้ดูแล BEMS |
| Tariff/TOU และวันหยุด | คำนวณ On-Peak, Off-Peak และต้นทุน | ตารางอัตราที่ได้รับการยืนยันจากฝ่ายการเงิน/MEA |

## แนวทางเชื่อมข้อมูลที่แนะนำ

```text
CU Smart API ───────┐
e-Off-Bill export ──┼─> Raw snapshots ─> Normalized 15-min data ─> Forecast ─> Optimizer ─> Dashboard
ตารางเรียน/ห้อง ────┤
อากาศ/ปฏิทิน ───────┘
```

- ดึง CU Smart ทุก 15 นาที โดยเผื่อเวลา 1–2 นาทีหลังจบ interval และใช้ retry/backoff
- เก็บ raw response แบบ immutable พร้อม `collected_at`, source URL และ schema version
- Normalize เวลาเป็น `Asia/Bangkok` และเก็บ UTC ควบคู่กัน
- แยกค่าที่วัดจริง ค่าที่ระบบคำนวณ และค่าคาดการณ์ออกจากกัน
- ทำ data quality checks: missing intervals, duplicate timestamps, meter reset, negative load, stale data และ future-zero
- ให้ backend เป็นผู้เรียก API; production origin อาจต้องให้ผู้ดูแล CU Smartเพิ่ม CORS allowlist

## กติกาความปลอดภัยและการใช้งาน

- ขออนุญาตเป็นลายลักษณ์อักษรจากเจ้าของระบบก่อนเก็บข้อมูลต่อเนื่องหรือใช้ใน production
- ไม่ bypass WAF, CAPTCHA, CUNET/Keycloak หรือดึง token จาก browser session ของบุคคล
- ใช้ service account แบบ read-only และเก็บ secret ใน secret manager ไม่ใส่ใน Git
- กำหนด request rate, cache และ retention ให้ชัดเจน
- ห้ามถือว่า field `bill` จาก dashboard เป็นบิลจริงจนกว่าจะเทียบกับ e-Off-Bill แล้ว

## ข้อเสนอ Pilot

เริ่มที่คณะวิศวกรรมศาสตร์ (`faculty_id=35`) เพราะ public API พบ 24 โหนด/อาคาร ทำงาน 4 สัปดาห์แรกดังนี้

1. เก็บ snapshot สาธารณะทุก 15 นาทีเพื่อวัด data completeness
2. ขอ historical export และบิลจริงจากเจ้าของข้อมูล
3. ทำ baseline dashboard: kWh, kW, daily peak, missing data และค่าไฟจริง
4. ฝึก forecast แบบง่ายก่อน เช่น persistence/XGBoost แล้วเทียบกับ rule-based baseline
5. เมื่อข้อมูลตารางเรียนพร้อม ค่อยเพิ่ม room consolidation และ staggered start recommendation

## สิ่งที่สร้างไว้ใน repository

- `src/cu_energy/cusmart.py` — client สำหรับ public CU Smart API
- `scripts/collect_cusmart.py` — CLI เก็บ raw snapshot
- `tests/test_cusmart_client.py` — unit tests สำหรับ URL, response และ validation
