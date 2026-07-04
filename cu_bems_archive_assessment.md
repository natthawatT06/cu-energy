# ผลประเมิน CU-BEMS Archive และการใช้กับ CU-EnergyBrain

## สรุปสำคัญ

ชุด `archive/` เป็นข้อมูลของ **อาคารจามจุรี 5** ไม่ใช่อาคารตัวอย่างที่ไม่เกี่ยวข้องกับระบบเรา งานวิจัยต้นทางระบุว่า CU-BEMS ถูกติดตั้งที่ Chamchuri 5 และมีข้อมูล AC, lighting, plug load, temperature, humidity และ ambient light ระดับชั้น/โซนทุก 1 นาที

จึงเชื่อมสามชุดข้อมูลได้เป็นสายเดียว:

```text
CU-BEMS archive
จามจุรี 5, 2018-2019, 1-minute zone/load-type data
        ↓ building identity
EN-cu
CEN 62 / meter O-036634, 2022-01 ถึง 2026-04, monthly kWh + Baht
        ↓ building identity
CU Smart
building_id 231 / faculty_id 62, 2026 snapshot, 15-minute Energy/Power
```

นี่เป็น asset ที่สัมพันธ์กับงานเรามากที่สุดในตอนนี้ และทำให้อาคารจามจุรี 5 เป็นตัวเลือก Pilot ที่ดีกว่าอาคารที่ mapping ยังคลุมเครือ

แหล่งอ้างอิง: [CU-BEMS, smart building electricity consumption and indoor environmental sensor datasets](https://www.nature.com/articles/s41597-020-00582-3)

## Inventory

| รายการ | ผลตรวจ |
|---|---:|
| CSV files | 14 |
| ขนาดรวม | 699.14 MB |
| ชั้น | 1–7 |
| ช่วงข้อมูล | 2018-07-01 ถึง 2019-12-31 |
| ความละเอียด | 1 นาที |
| แถวที่พบในไฟล์ | 5,432,489 |
| Schema ระหว่าง 2018/2019 | ตรงกันครบทั้ง 7 ชั้น |
| Floor 1 | 12 คอลัมน์รวม Date |
| Floor 2 | 37 คอลัมน์รวม Date |
| Floor 3–7 | 30 คอลัมน์รวม Date |

## Data quality ที่ตรวจพบ

### Timestamp และความครบถ้วน

- ไฟล์ปี 2018 ทั้ง 7 ชั้นมี 264,960 แถวครบ ตั้งแต่ 1 ก.ค.–31 ธ.ค. 2018
- ไฟล์ปี 2019 ชั้น 1–5 และ 7 มี 525,600 แถวครบ
- `2019Floor6.csv` มีเพียง 424,169 แถว โดยข้อมูลจริงจบที่ `2019-10-22 13:27:00`
- แถวสุดท้ายของ `2019Floor6.csv` เป็นค่า `2` ทำให้มี invalid timestamp 1 แถว
- Floor 6 ปี 2019 ขาด 101,432 นาทีเมื่อเทียบกับปีเต็ม จึงควร re-download หรือกู้ต้นฉบับก่อนใช้ train แบบรวมทุกชั้น
- ไฟล์อื่นไม่พบ duplicate timestamp, backward timestamp หรือ gap ภายในช่วงที่ไฟล์ครอบคลุม

### Missingness

| ปี | Power missing | Temperature missing | RH missing | Lux missing |
|---:|---:|---:|---:|---:|
| 2018 | 5.89% | 63.69% | 63.69% | 63.69% |
| 2019 | 2.00% | 23.73% | 23.73% | 23.73% |

Sensor missing จำนวนมากสอดคล้องกับงานวิจัยที่ระบุว่าถอด sensor ไปบำรุงรักษาช่วงประมาณ 15 ก.ย. 2018–5 มี.ค. 2019 จึงต้องสร้าง availability mask และห้าม interpolate ข้ามช่วงยาวแบบไร้เงื่อนไข

### Outlier และค่าผิดปกติ

1. `2018Floor1.csv` คอลัมน์ `z3_Light(kW)` มีค่า 4,762.43 kW ที่ `2018-09-11 09:54:00` ซึ่งเป็นไปไม่ได้เมื่อเทียบกับ peak อาคารประมาณ 700 kW
2. `z2_AC2(kW)` มี spike 798.72 kW และ `z4_Light(kW)` มี spike 512.01 kW ในปี 2018
3. Building peak ดิบปี 2018 จึงพุ่งเป็น 5,288.68 kW แต่ p99 อยู่ที่ 719.73 kW ซึ่งสมเหตุผลกว่า
4. ปี 2019 มี temperature ต่ำสุด 10.83°C บน Floor 5 และมี 33,972 จุดนอกช่วง plausibility 15–40°C ควร flag เป็น sensor anomaly
5. ไม่พบค่ากำลังไฟฟ้าติดลบในชุดที่สแกน
6. Header Floor 1 ในไฟล์จริงมี `z1_Plug(kW)` แต่ไม่มี `z4_Plug(kW)` ขณะที่คำอธิบายใน publication ระบุว่าควรเป็น Zone 1 ไม่มี plug และ Zone 4 มี plug จึงต้องยืนยัน column label ก่อนทำ zone-level interpretation

## Building load summary

การรวม load ด้านล่างใช้ timestamp เป็น key และถือค่า missing เป็น 0 จึงอาจประเมินพลังงานต่ำกว่าความจริง โดยเฉพาะ Floor 6 ปี 2019

| Metric | Jul–Dec 2018 | Jan–Dec 2019 |
|---|---:|---:|
| Raw peak | 5,288.68 kW (มี outlier) | 917.45 kW |
| p95 | 613.28 kW | 649.21 kW |
| p99 | 719.73 kW | 753.54 kW |
| Mean monitored load | 246.90 kW | 238.85 kW |
| Monitored energy | 1,090,310 kWh | 2,092,294 kWh |

### Load-type contribution

| Load type | 2018 | 2019 |
|---|---:|---:|
| AC | ~50.6% | ~54.0% |
| Lighting | ~38.0% | ~34.9% |
| Plug load | ~11.4% | ~11.1% |

AC เป็น load ที่ใหญ่ที่สุดและควบคุมได้มากที่สุด จึงสนับสนุนแนวคิด staggered start, pre-cooling และ demand response ใน CU-EnergyBrain โดยตรง

## ความสัมพันธ์กับ EN-cu

พบ mapping ที่สอดคล้องกัน:

| Field | ค่า |
|---|---|
| EN-cu building code | CEN 62 |
| EN-cu internal meter | O-036634 |
| EN-cu building name | จามจุรี 5 |
| EN-cu periods | 52 เดือน, 2022-01 ถึง 2026-04 |
| EN-cu total energy | 4,460,400 kWh |
| EN-cu total amount | 23,747,688 บาท |

ค่าเฉลี่ย EN-cu ประมาณ 85,777 kWh/เดือน ขณะที่ CU-BEMS archive อยู่ประมาณ 174,000–182,000 kWh/เดือน ความต่างเกือบ 2 เท่าอาจเกิดจาก meter boundary, การเปลี่ยนการใช้งาน/อุปกรณ์, missing data หรือ scaling จึงยังห้ามนำมารวมเป็น series เดียวก่อนทำ monthly reconciliation

## ความสัมพันธ์กับ CU Smart

| Field | ค่า |
|---|---|
| CU Smart building_id | 231 |
| faculty_id | 62 |
| Name | อาคารจามจุรี 5 / Chamchuri 5 Building |
| Type | Office |
| FIAP points | `central/cham_5/.../s_meter/1` และ `s_meter/2` |

Snapshot CU Smart ที่เก็บวันที่ 4 ก.ค. 2026 แสดง `power=70`, `peak=638` และกราฟ 96 จุด/วัน แต่ความหมายของช่วงสะสม `energy` ยังต้องยืนยันก่อนเทียบกับ EN-cu

## ใช้กับ CU-EnergyBrain อย่างไร

### ใช้ได้ทันที

1. **Algorithm benchmark:** train/test load forecast 1–60 นาที, anomaly detection และ load disaggregation
2. **AC control simulation:** พัฒนา staggered start, pre-cooling และ peak cap ด้วย load AC รายตัว
3. **Thermal model:** ใช้ AC power + indoor temperature/RH เพื่อสร้าง response model ของโซน
4. **Load-type prioritization:** ประเมินว่า peak มาจาก AC, light หรือ plug load
5. **Feature engineering:** สร้าง time-of-day, day-of-week, lag, rolling peak และ zone aggregation ก่อนนำไปใช้กับ CU Smart

### ใช้โดยตรงไม่ได้

1. ไม่ควรนำโมเดลปี 2018–2019 ไปควบคุมอาคารปี 2026 ทันที เพราะมี domain shift
2. ไม่มีข้อมูล occupancy, ตารางเรียน หรือ outdoor weather ในไฟล์ archive
3. ไม่มีค่าไฟ/TOU จึงต้องใช้ EN-cu และ tariff layer ประกอบ
4. Sensor missing และ outlier ต้อง clean ก่อน train
5. ชุดนี้เป็นอาคารเดียว ไม่ใช่ตัวแทนทุกอาคารในมหาวิทยาลัย

## Pipeline ที่แนะนำ

```text
archive 1-minute raw
  -> schema validation
  -> remove impossible spikes / retain anomaly flags
  -> availability masks
  -> resample 15-minute to match CU Smart
  -> aggregate by zone/floor/load type
  -> train benchmark model on 2018-2019
  -> fine-tune/calibrate with CU Smart building_id 231
  -> translate savings to Baht using EN-cu O-036634
```

## ข้อเสนอ Pilot

เลือก **อาคารจามจุรี 5** เป็น Pilot แรก เพราะเป็นอาคารเดียวที่มี data lineage ครบสามระดับ:

- zone/load-type history 1 นาทีจาก CU-BEMS
- monthly kWh/cost จาก EN-cu
- current building profile จาก CU Smart

ก่อนเริ่ม Pilot ควรทำ 4 งาน:

1. ยืนยันว่า O-036634 และ CU Smart building_id 231 วัด meter boundary เดียวกัน
2. หาไฟล์ `2019Floor6.csv` ฉบับเต็ม
3. สร้าง physical-range rules ต่อ channel และลบ spike 2018 ที่ผิดธรรมชาติ
4. เก็บ CU Smart building 231 ต่อเนื่องอย่างน้อย 30–90 วันเพื่อ calibration

## Verdict

ชุด archive มีประโยชน์สูงมากและเติมส่วนที่ EN-cu ไม่มี คือ **load shape ราย 1 นาที, load type และ indoor environment** โดยเชื่อมกับจามจุรี 5 ได้จริง เหมาะสำหรับพัฒนา PoC ของ Peak Forecast และ AC Optimization แต่ต้องใช้เป็น benchmark/pretraining dataset แล้วปรับด้วยข้อมูล CU Smart ปัจจุบัน ไม่ใช่นำโมเดลเก่าไปใช้งานจริงโดยตรง
