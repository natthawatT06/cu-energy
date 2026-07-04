# ความสัมพันธ์ระหว่าง EN-cu และ CU Smart

## ข้อสรุป

ข้อมูลสองชุด **สัมพันธ์กันและนำมาประยุกต์กับ CU-EnergyBrain ได้** แต่เป็นข้อมูลคนละชั้นที่เสริมกัน:

- **EN-cu PDF:** พลังงานและค่าใช้จ่ายรายเดือนระดับเครื่องวัด/รายการภายใน
- **CU Smart:** Energy/Power profile ระดับมหาวิทยาลัย หน่วยงาน และอาคาร โดย snapshot ปัจจุบันมี 96 จุดต่อวัน (15 นาที)

ยังไม่สามารถพิสูจน์ statistical correlation ได้จากชุดที่มีอยู่ เพราะช่วงเวลาไม่ทับกัน: EN-cu ครอบคลุม ม.ค. 2022–เม.ย. 2026 ส่วน CU Smart snapshot เป็นวันที่ 4 ก.ค. 2026 เพียงวันเดียว

## ระดับความสัมพันธ์

| มิติ | ระดับ | เหตุผล |
|---|---|---|
| ความหมายข้อมูล | สูง | ทั้งสองชุดวัดการใช้พลังงานไฟฟ้าของอาคาร/หน่วยงานในจุฬาฯ |
| Entity/อาคาร | ปานกลาง | เชื่อมด้วยชื่ออาคารได้บางส่วน แต่ไม่มี shared meter ID โดยตรง |
| เวลา | ยังไม่พร้อม | PDF สิ้นสุด เม.ย. 2026; CU Smart snapshot อยู่ ก.ค. 2026 |
| Granularity | เสริมกัน | PDF รายเดือน; CU Smart ราย 15 นาที |
| ค่าใช้จ่าย | PDF เด่นกว่า | PDF มีจำนวนเงินรายรายการ แต่ต้องยืนยันสูตร/สถานะทางบัญชี |
| Peak Demand | CU Smart เด่นกว่า | PDF ไม่มี kW หรือ Maximum Demand |

## Coverage ของการเชื่อมปัจจุบัน

จากเลขมิเตอร์ 269 รายการ:

| สถานะ | จำนวนมิเตอร์ | ความหมาย |
|---|---:|---|
| `exact_name` | 10 | ชื่ออาคารตรงกันหลัง normalize |
| `high_candidate` | 35 | คะแนนสูงและห่างจากอันดับสอง แต่ยังต้องตรวจ |
| `review_candidate` | 97 | มี candidate แต่ชื่อยังคลุมเครือ |
| `unmatched` | 127 | ยังเชื่อมจากชื่อไม่ได้ |

- Exact + High candidate รวม 45 มิเตอร์ เชื่อมไปยัง 34 อาคาร CU Smart
- ครอบคลุมประมาณ **40.0% ของพลังงานจากแถวที่มีเลขมิเตอร์** หรือ **29.1% ของพลังงานทุกแถวใน PDF**
- หากตรวจและอนุมัติ Review candidate ทั้งหมด ความครอบคลุมอาจเพิ่มเป็นประมาณ **71.7% ของพลังงานที่มีเลขมิเตอร์** หรือ **52.1% ของพลังงานทุกแถว**
- ทุก mapping ยังตั้ง `mapping_approved=no`; ตัวเลข coverage ของ candidate ไม่ควรถือเป็น mapping ทางการจนกว่าจะตรวจด้วย master data

## การประยุกต์กับ CU-EnergyBrain

### ทำได้ทันที

1. **Monthly Energy Baseline**
   - แสดง kWh และค่าใช้จ่าย 52 เดือนรายมิเตอร์/อาคาร
   - หาอาคารใช้ไฟสูงและ trend ระยะยาว

2. **Pilot Prioritization**
   - ใช้ PDF เลือกอาคารที่ใช้ kWh/เงินสูง
   - ใช้ CU Smart ดู load shape และช่วง peak ของอาคารนั้น

3. **Monthly Anomaly Detection**
   - ตรวจการเพิ่ม/ลดผิดปกติเทียบเดือนก่อน
   - ใช้หมายเหตุใน PDF แยกโหลดร่วมและกรณีมิเตอร์ผิดปกติ

4. **Data Reconciliation**
   - รวม CU Smart 15-minute energy เป็นรายเดือน
   - เทียบกับ `energy_kwh` ใน PDF เพื่อหา missing data, meter reset หรือ mapping ผิด

5. **Savings Estimation**
   - ใช้ CU Smart คำนวณ kWh ที่ลดได้จากมาตรการ
   - ใช้ PDF calibrate ค่าใช้จ่ายต่อ kWh แบบย้อนหลัง
   - ต้องแยก Demand Charge/TOU เพิ่มก่อนใช้เป็นตัวเลขงบประมาณทางการ

### ต้องมีข้อมูลเพิ่ม

1. **Peak Demand Forecast:** ต้องมี CU Smart power 15 นาทีอย่างน้อย 30–90 วันสำหรับ PoC และควรมี 12–24 เดือนสำหรับโมเดลใช้งานจริง
2. **Maximum Demand/TOU:** ต้องมี demand kW, tariff period และ Demand Charge จากบิลจริง
3. **Meter Master:** ต้องมีตาราง `internal_meter_no ↔ building ↔ CU Smart node_id/point_id`
4. **ตารางเรียน/การใช้พื้นที่:** จำเป็นสำหรับ Space Optimization และแผนเปิดแอร์

## Join model ที่แนะนำ

```text
EN-cu internal_meter_no
        ↓
meter_building_map (ตรวจและอนุมัติโดยฝ่ายอาคาร)
        ↓
CU Smart building_id / point_id
        ↓
15-minute power & energy
        ↓
Monthly reconciliation + Peak forecast + Cost model
```

## ประเด็นคณะวิศวกรรมศาสตร์

ปัจจุบันพบ 2 มิเตอร์ที่ชื่อใน PDF เป็น “วิศวกรรมศาสตร์ 4” แต่ระบบ fuzzy mapping เสนอ CU Smart node 36 “อาคารวิศวกรรมศาสตร์ 1” ด้วยคะแนน 0.9333 เนื่องจากชื่อคล้ายกัน กรณีนี้แสดงว่าห้ามอนุมัติด้วยชื่อเพียงอย่างเดียว ต้องใช้เลขมิเตอร์/point ID จากฝ่ายอาคารยืนยันก่อนเริ่ม Pilot

## ลำดับดำเนินงานที่เหมาะสม

1. ให้ฝ่ายอาคารตรวจ 45 รายการ Exact/High candidate ก่อน
2. ขอ meter master เพื่อแก้ 97 Review candidate และ 127 Unmatched
3. เก็บ CU Smart ทุก 15 นาทีต่อเนื่อง พร้อม flag future-zero/stale data
4. เมื่อมีข้อมูลทับกับ PDF อย่างน้อยหนึ่งเดือน ให้ทำ monthly reconciliation
5. เริ่ม Peak Forecast และ recommendation เฉพาะอาคารที่ mapping ผ่านการอนุมัติแล้ว

## คำตอบสั้น

ข้อมูลสัมพันธ์กันในเชิงอาคารและพลังงาน และเหมาะกับงานเราในรูปแบบ **PDF เป็น historical cost/baseline layer + CU Smart เป็น time-series/peak layer** แต่ยังต้องยืนยัน meter mapping และเก็บ CU Smart เพิ่มเพื่อทำ correlation และ Peak Forecast อย่างน่าเชื่อถือ
