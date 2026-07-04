# CU-EnergyBrain data ingestion PoC

จุดเริ่มต้นสำหรับดึง snapshot ข้อมูลไฟฟ้าจาก JSON endpoints ที่ frontend ของ CU Smart ใช้อยู่ โดยไม่ข้ามระบบล็อกอิน ไม่เก็บรหัสผ่าน และไม่ยิง request ถี่เกินจำเป็น แม้ระบบจะไม่มี public API documentation ก็ตาม

## สิ่งที่มีใน PoC

- ดึงภาพรวมการใช้ไฟรายหน่วยงานจาก CU Smart
- ดึง load profile ภาพรวมมหาวิทยาลัยของวันปัจจุบัน
- เลือกดึงข้อมูลอาคารของหน่วยงานที่ระบุได้
- ไล่ดึงทุกหน่วยงาน/อาคารที่หน้าเว็บเปิดอ่านได้
- เก็บ master data, EUI, โครงสร้างโหนด และ energy/power/peak profiles
- เก็บ raw snapshot พร้อมเวลาและ URL ต้นทางเพื่อ audit ย้อนหลัง
- ใช้เฉพาะ Python standard library

## ทดลองใช้งาน

```powershell
python scripts/collect_cusmart.py --dry-run
python scripts/collect_cusmart.py
python scripts/collect_cusmart.py --faculty-id 35 --include-buildings
python scripts/collect_cusmart.py --all-faculties --metric energy --metric power
python -m unittest discover -s tests -v
```

ไฟล์จริงจะถูกเก็บที่ `data/raw/cusmart/` และถูก ignore จาก Git โดยค่าเริ่มต้น

ตัวอย่างรอบเต็มที่เก็บแล้ว: `data/raw/cusmart/cusmart_snapshot_20260703T232646Z.json` (125 datasets, 27.18 MB, ไม่มี error)

## ขอบเขตสำคัญ

ตัวดึงนี้เรียกเฉพาะ frontend endpoint ที่ตรวจแล้วว่าเปิดอ่านโดยไม่ล็อกอิน ณ วันที่ 4 กรกฎาคม 2026 ข้อมูลย้อนหลังและรายงาน Demand บางชุดต้องมี session ที่มีสิทธิ์ ส่วน e-Off-Bill มีระบบ WAF ป้องกัน automation จึงยังไม่รวมตัวดึงอัตโนมัติ

อ่านผลตรวจและข้อเสนอการเชื่อมระบบที่ [data_source_feasibility.md](data_source_feasibility.md)
