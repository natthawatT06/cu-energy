# CU-EnergyBrain - Ingestion & Assessment PoC (Proof of Concept)

โครงการนี้เป็นระบบต้นแบบการรวบรวมและวิเคราะห์ข้อมูลพลังงานไฟฟ้า (Data Ingestion PoC) ของจุฬาลงกรณ์มหาวิทยาลัย เพื่อใช้เป็นรากฐานสำหรับระบบ **CU-EnergyBrain** (การพยากรณ์ Peak Demand และการเสนอแนะมาตรการประหยัดพลังงานอัจฉริยะ)

---

## 📊 แหล่งข้อมูลหลักในระบบ (Data Sources)

โครงการนี้ประกอบด้วยข้อมูล 3 ส่วนหลักที่สามารถนำมาประสานร่วมกัน เพื่อวิเคราะห์การใช้ไฟฟ้าของมหาวิทยาลัยได้อย่างมีประสิทธิภาพ:

### 1. [CU Smart Public API](file:///c:/Users/Natth/Documents/cu-energy/data_source_feasibility.md)
*   **คำอธิบาย:** ข้อมูลการใช้พลังงานไฟฟ้าแบบเรียลไทม์ผ่าน Endpoint ภายในของ Frontend Dashboard (`ls.ene.cusmart.chula.ac.th`)
*   **ความละเอียด:** ทุก 15 นาที (96 จุดข้อมูลต่อวัน) ระดับมหาวิทยาลัย, หน่วยงาน (คณะ/สำนักงาน), และอาคารรายบุคคล
*   **สถานะการเชื่อมต่อ:** สามารถดึง Raw Snapshot และประเมินค่า EUI, โครงสร้างโหนด, พิกัด รวมถึง Peak Profile ในวันปัจจุบันได้โดยไม่ต้องข้ามระบบล็อกอิน (Public Access ณ กรกฎาคม 2026)

### 2. [รายงานค่าไฟรายเดือน EN-cu](file:///c:/Users/Natth/Documents/cu-energy/en_cu_dataset_assessment.md)
*   **คำอธิบาย:** เอกสารตาราง "รายละเอียดค่าใช้จ่ายพลังงานไฟฟ้าจำแนกตามเครื่องวัดภายในและหน่วยงาน" (จัดเก็บแยกโฟลเดอร์ตามปี พ.ศ. 2565 - 2569)
*   **ความละเอียด:** ข้อมูลสรุปรายเดือน (Monthly kWh & Cost) ครอบคลุม 52 เดือน (ม.ค. 2022 - เม.ย. 2026) รวมทั้งหมด 2,371 หน้า
*   **การใช้งาน:** ใช้สร้าง Baseline ต้นทุนและปริมาณการใช้ไฟฟ้าในระยะยาว รวมถึงตรวจจับความผิดปกติรายเดือน (Monthly Anomaly Detection)

### 3. [CU-BEMS Archive (อาคารจามจุรี 5)](file:///c:/Users/Natth/Documents/cu-energy/cu_bems_archive_assessment.md)
*   **คำอธิบาย:** ข้อมูลประวัติการใช้ไฟฟ้าความละเอียดสูงของอาคารจามจุรี 5 ชั้น 1-7 ในช่วงปี 2018 - 2019 (จำนวนแถวรวม 5,432,489 แถว ขนาด 699.14 MB)
*   **ความละเอียด:** ระดับ 1 นาที แยกตามประเภทโหลด (เครื่องปรับอากาศ, แสงสว่าง, เต้ารับ) และเซนเซอร์สิ่งแวดล้อมภายในอาคาร (อุณหภูมิ, ความชื้น, แสงสว่างภายนอก)
*   **การใช้งาน:** เป็นคลังข้อมูลสำคัญในการทำแบบจำลองความเย็น พฤติกรรมการใช้พื้นที่ และการฝึกฝนโมเดล Peak Forecasting สำหรับอาคารนำร่อง (Pilot Building)

---

## 📂 โครงสร้าง Repository (Directory Structure)

```text
cu-energy/
├── src/cu_energy/                # แพ็กเกจหลัก (Core Module)
│   ├── __init__.py
│   └── cusmart.py                # Client สำหรับดึงข้อมูล CU Smart Public API (มี Rate Limit & Retry)
├── scripts/                      # สคริปต์สำหรับการรันระบบและประมวลผล (CLI Tools)
│   ├── collect_cusmart.py        # สคริปต์ดึงและบันทึก Raw Snapshots จาก CU Smart API
│   └── extract_en_cu.py          # สคริปต์สกัดตารางข้อมูลจาก PDF รายงานค่าไฟ EN-cu
├── tests/                        # ชุดทดสอบ Unit Tests
│   └── test_cusmart_client.py    # แบบทดสอบความถูกต้องของ API Client
├── archive/                      # ข้อมูลประวัติ CU-BEMS 1-Minute CSV (จามจุรี 5, 2018-2019)
├── EN-cu/                        # PDF รายงานค่าไฟรายเดือน (แบ่งแยกตามปี พ.ศ. 2565 - 2569)
├── outputs/                      # ข้อมูลที่ประมวลผลเรียบร้อยแล้วและตาราง Export
│   └── en_cu_dataset/            # ไฟล์ XLSX และ CSV สรุปข้อมูลค่าไฟ EN-cu ที่สกัดเสร็จสิ้น
├── data/                         # เก็บข้อมูลดิบและข้อมูลแปรรูป (จะไม่ถูกอัปโหลดขึ้น Git)
│   ├── raw/cusmart/              # ไฟล์ JSON Raw Snapshots ที่เก็บมาได้จาก API
│   └── processed/                # ข้อมูลระดับการทดลองประมวลผล
└── * assessment.md               # เอกสารรายงานวิเคราะห์ความเป็นไปได้และความสัมพันธ์ของข้อมูล (ดูรายละเอียดด้านล่าง)
```

---

## 🛠️ วิธีการติดตั้งและใช้งาน (Getting Started)

### 1. การเตรียมสภาพแวดล้อม (Prerequisites)
โครงการนี้พัฒนาด้วย Python 3.8 ขึ้นไป โดยใช้ไลบรารีสำหรับการประมวลผล PDF และตารางดังนี้:
```powershell
pip install pdfplumber pypdf openpyxl
```

### 2. การดึงข้อมูล CU Smart API
สามารถดึง snapshot ข้อมูลปัจจุบันลงไฟล์ JSON ได้ผ่าน CLI:
```powershell
# รันเพื่อตรวจสอบการเชื่อมต่อและโครงสร้างข้อมูลเบื้องต้น (ไม่มีการเขียนไฟล์จริง)
python scripts/collect_cusmart.py --dry-run

# ดึงข้อมูลภาพรวมมหาวิทยาลัยและคณะทั้งหมดมาเก็บเป็นไฟล์ JSON
python scripts/collect_cusmart.py

# ดึงข้อมูลเฉพาะเจาะจงระดับคณะ (เช่น คณะวิศวกรรมศาสตร์ ID=35) พร้อมอาคารภายใต้คณะ
python scripts/collect_cusmart.py --faculty-id 35 --include-buildings

# ดึงข้อมูลทุกคณะและเก็บ profile ในทุกมิติ (energy, power, peak)
python scripts/collect_cusmart.py --all-faculties --metric energy --metric power
```
*ไฟล์ดิบจะถูกจัดเก็บไว้ใน `data/raw/cusmart/`*

### 3. การสกัดข้อมูล PDF ค่าไฟ EN-cu
ทำการแปลงรายงาน PDF ทั้งหมดในโฟลเดอร์ `EN-cu/` ให้กลายเป็นข้อมูลตารางพิกัดแบบละเอียด:
```powershell
python scripts/extract_en_cu.py
```
*ผลลัพธ์จะถูกจัดเก็บใน `outputs/en_cu_dataset/`*

### 4. การรันชุดทดสอบ (Unit Tests)
ตรวจเช็กความถูกต้องของ API Client และระบบจำลอง request:
```powershell
python -m unittest discover -s tests -v
```

---

## 💡 แนวทางการวิเคราะห์และความสัมพันธ์ของข้อมูล (Data Assessment & Vision)

เพื่อทำความเข้าใจขอบเขตและการประยุกต์ใช้ข้อมูลแต่ละตัวให้ลึกซึ้งยิ่งขึ้น โปรดอ่านรายงานการวิเคราะห์ (Assessment Report) ที่จัดเตรียมไว้:

*   **[รายงานความเป็นไปได้ในการเชื่อมข้อมูล (data_source_feasibility.md)](file:///c:/Users/Natth/Documents/cu-energy/data_source_feasibility.md):** ประเมินคุณลักษณะของ Endpoint ในหน้า CU Smart ข้อจำกัดเรื่องการบล็อกบอท (WAF) บนระบบ e-Off-Bill และข้อมูลที่ต้องขอเพิ่มเติมในระยะถัดไป
*   **[ผลการวิเคราะห์ไฟล์ค่าไฟ EN-cu (en_cu_dataset_assessment.md)](file:///c:/Users/Natth/Documents/cu-energy/en_cu_dataset_assessment.md):** รายละเอียดแถวข้อมูล โครงสร้างตารางใน PDF ปัญหาของโครงสร้างตารางแต่ละปี และสรุปจำนวนเดือน/หน้าของข้อมูลทั้งหมด
*   **[การเชื่อมสัมพันธ์ EN-cu ↔ CU Smart (en_cu_cusmart_relationship.md)](file:///c:/Users/Natth/Documents/cu-energy/en_cu_cusmart_relationship.md):** แสดงอัตราความครอบคลุมการเชื่อมต่อข้อมูล (Data Mapping Coverage) ผ่านชื่ออาคารและการใช้ Fuzzy Matching เพื่อวางรากฐานการ Reconciliation ข้อมูลราย 15 นาทีกับบิลค่าไฟจริง
*   **[ผลประเมินประวัติข้อมูล CU-BEMS (cu_bems_archive_assessment.md)](file:///c:/Users/Natth/Documents/cu-energy/cu_bems_archive_assessment.md):** การตรวจสอบคุณภาพข้อมูลของอาคารจามจุรี 5 ช่วงปี 2018-2019 เพื่อใช้เป็นแผนนำร่อง (Pilot Project) ที่ดีที่สุดในปัจจุบัน

---

## 🔒 กฎความปลอดภัยและการพัฒนาที่สำคัญ

1.  **การควบคุมความถี่ (Rate Limiting):** API Client ใน [cusmart.py](file:///c:/Users/Natth/Documents/cu-energy/src/cu_energy/cusmart.py) มีการจำกัดความถี่การส่งรีเควสต์อย่างเคร่งครัด (ขั้นต่ำ 0.5 วินาทีต่อ request) เพื่อไม่ให้กระทบต่อเซิร์ฟเวอร์ผู้ให้บริการ
2.  **การเก็บข้อมูลดิบ:** ข้อมูล Raw Response จะถูกบันทึกแบบ Immutable (ไม่ปรับแต่งค่าใดๆ) และมี Metadata กำกับ เช่น `collected_at`, URL ต้นทาง และ Schema version เพื่อใช้ในการ audit ย้อนหลัง
3.  **การระวังค่าศูนย์ในอนาคต (Future-Zero):** Endpoint รายวันจะส่งข้อมูลครบ 96 จุดเสมอ หากยังไม่ถึงเวลานั้นๆ ข้อมูลจะแสดงเป็น `0` โปรแกรมวิเคราะห์ต้องตีความจุดเหล่านี้เป็น `not_observed_yet` เพื่อหลีกเลี่ยงการคำนวณที่ผิดพลาด
