export const baht = (n: number, digits = 0) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

export const num = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

export const compactBaht = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(0)}k`;
  return `฿${n.toFixed(0)}`;
};

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

export const ON_PEAK_START = 36; // 09:00 in 15-min slots
export const ON_PEAK_END = 88; // exclusive -> 22:00
export const isOnPeak = (slot: number) =>
  slot >= ON_PEAK_START && slot < ON_PEAK_END;

// Tariff (kept in sync with cost.json / generator)
export const TARIFF = {
  demand: 132.93,
  onPeak: 4.1839,
  offPeak: 2.6037,
  ft: 0.3972,
  vat: 0.07,
};
export const GRID_CO2 = 0.4999;
export const WEEKDAYS = 22;

export type SimResult = {
  optimized: number[];
  basePeak: number;
  optPeak: number;
  peakSaved: number;
  peakPctSaved: number;
  monthlyBaht: number;
  monthlyCo2Kg: number;
};

/** Recompute optimized curve + savings from a set of active measure deltas. */
export function simulate(
  baseTotal: number[],
  activeDeltas: number[][],
): SimResult {
  const optimized = baseTotal.map((v, i) => {
    const d = activeDeltas.reduce((s, arr) => s + (arr[i] ?? 0), 0);
    return Math.max(0, v + d);
  });
  const basePeak = Math.max(...baseTotal);
  const optPeak = Math.max(...optimized);
  const peakSaved = basePeak - optPeak;

  // Monthly energy delta (weekday-only measures), priced at TOU.
  let onDelta = 0;
  let offDelta = 0;
  for (let i = 0; i < baseTotal.length; i++) {
    const d = optimized[i] - baseTotal[i];
    if (isOnPeak(i)) onDelta += d;
    else offDelta += d;
  }
  onDelta = (onDelta / 4) * WEEKDAYS;
  offDelta = (offDelta / 4) * WEEKDAYS;
  const kwhDelta = onDelta + offDelta;
  const energyBaht =
    (onDelta * TARIFF.onPeak +
      offDelta * TARIFF.offPeak +
      kwhDelta * TARIFF.ft) *
    (1 + TARIFF.vat);
  const demandBaht = peakSaved * TARIFF.demand * (1 + TARIFF.vat);

  return {
    optimized,
    basePeak,
    optPeak,
    peakSaved,
    peakPctSaved: (peakSaved / basePeak) * 100,
    monthlyBaht: -energyBaht + demandBaht,
    monthlyCo2Kg: -kwhDelta * GRID_CO2,
  };
}

export const slotLabel = (slot: number) =>
  `${String(Math.floor((slot * 15) / 60)).padStart(2, "0")}:${String(
    (slot * 15) % 60,
  ).padStart(2, "0")}`;
