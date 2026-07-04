import buildingJson from "@/public/data/building.json";
import historyJson from "@/public/data/history.json";
import loadDayJson from "@/public/data/load_day.json";
import costJson from "@/public/data/cost.json";
import measuresJson from "@/public/data/measures.json";
import spacesJson from "@/public/data/spaces.json";
import summaryJson from "@/public/data/summary.json";

export const building = buildingJson;
export const history = historyJson;
export const loadDay = loadDayJson;
export const cost = costJson;
export const measures = measuresJson;
export const spaces = spacesJson;
export const summary = summaryJson;

export type Measure = (typeof measuresJson)["measures"][number];
export type CostComponent = (typeof costJson)["components"][number];
export type HistoryRow = (typeof historyJson)[number];
export type Classroom = (typeof spacesJson)["classrooms"][number];
export type OfficeZone = (typeof spacesJson)["office_zones"][number];
