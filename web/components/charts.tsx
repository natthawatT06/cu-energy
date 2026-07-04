import { slotLabel } from "@/lib/format";

const W = 1000;
const H = 340;
const PAD = { l: 52, r: 20, t: 24, b: 30 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

const xAt = (i: number, n = 96) => PAD.l + (i / (n - 1)) * IW;
const yAt = (v: number, max: number) => PAD.t + IH - (v / max) * IH;

function niceMax(v: number) {
  const step = v > 500 ? 100 : v > 200 ? 50 : 20;
  return Math.ceil(v / step) * step;
}

function areaPath(vals: number[], base: number[], max: number) {
  const top = vals.map((v, i) => `${xAt(i)},${yAt(v, max)}`);
  const bot = [];
  for (let i = base.length - 1; i >= 0; i--) bot.push(`${xAt(i)},${yAt(base[i], max)}`);
  return `M${top.join(" L")} L${bot.join(" L")} Z`;
}

function linePath(vals: number[], max: number, n = vals.length) {
  return "M" + vals.map((v, i) => `${xAt(i, n)},${yAt(v, max)}`).join(" L");
}

function HourTicks({ max }: { max: number }) {
  return (
    <>
      {[0, 24, 48, 72, 95].map((s) => (
        <g key={s}>
          <line
            x1={xAt(s)}
            x2={xAt(s)}
            y1={PAD.t}
            y2={PAD.t + IH}
            stroke="var(--color-border-soft)"
            strokeWidth={1}
          />
          <text
            x={xAt(s)}
            y={H - 10}
            textAnchor="middle"
            className="tnum"
            fontSize={12}
            fill="var(--color-faint)"
          >
            {slotLabel(Math.min(s, 96))}
          </text>
        </g>
      ))}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD.l}
            x2={PAD.l + IW}
            y1={yAt(max * f, max)}
            y2={yAt(max * f, max)}
            stroke="var(--color-border-soft)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <text
            x={PAD.l - 8}
            y={yAt(max * f, max) + 4}
            textAnchor="end"
            className="tnum"
            fontSize={11}
            fill="var(--color-faint)"
          >
            {Math.round(max * f)}
          </text>
        </g>
      ))}
    </>
  );
}

function OnPeakBand({ max }: { max: number }) {
  return (
    <>
      <rect
        x={xAt(36)}
        y={PAD.t}
        width={xAt(87) - xAt(36)}
        height={IH}
        fill="var(--color-warn)"
        opacity={0.06}
      />
      <text
        x={(xAt(36) + xAt(87)) / 2}
        y={PAD.t + 14}
        textAnchor="middle"
        fontSize={11}
        fill="var(--color-warn)"
        opacity={0.8}
      >
        On-Peak 09:00–22:00
      </text>
    </>
  );
}

/** Day load: stacked ac/light/plug baseline + forecast band + partial actual. */
export function LoadForecastChart({
  baseline,
  forecast,
  actual,
  currentSlot,
  peakSlot,
  peakVal,
}: {
  baseline: { ac: number; light: number; plug: number; total: number }[];
  forecast: { p10: number; p50: number; p90: number }[];
  actual: { total: number }[];
  currentSlot: number;
  peakSlot: number;
  peakVal: number;
}) {
  const max = niceMax(Math.max(...forecast.map((f) => f.p90)) * 1.05);
  const plug = baseline.map((b) => b.plug);
  const plusLight = baseline.map((b) => b.plug + b.light);
  const zero = baseline.map(() => 0);
  const p90 = forecast.map((f) => f.p90);
  const p10 = forecast.map((f) => f.p10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <OnPeakBand max={max} />
      <HourTicks max={max} />

      {/* stacked load types */}
      <path d={areaPath(plug, zero, max)} fill="var(--color-plug)" opacity={0.85} />
      <path d={areaPath(plusLight, plug, max)} fill="var(--color-light)" opacity={0.8} />
      <path
        d={areaPath(
          baseline.map((b) => b.total),
          plusLight,
          max,
        )}
        fill="var(--color-ac)"
        opacity={0.75}
      />

      {/* forecast band */}
      <path
        d={`M${p90.map((v, i) => `${xAt(i)},${yAt(v, max)}`).join(" L")} L${p10
          .map((v, i) => `${xAt(p10.length - 1 - i)},${yAt(p10[p10.length - 1 - i], max)}`)
          .join(" L")} Z`}
        fill="var(--color-fg)"
        opacity={0.06}
      />
      <path
        d={linePath(
          forecast.map((f) => f.p50),
          max,
        )}
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        opacity={0.55}
      />

      {/* actual so far */}
      <path
        d={linePath(
          actual.map((a) => a.total),
          max,
          actual.length,
        )}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2.5}
      />

      {/* now line */}
      <line
        x1={xAt(currentSlot)}
        x2={xAt(currentSlot)}
        y1={PAD.t}
        y2={PAD.t + IH}
        stroke="var(--color-primary)"
        strokeWidth={1}
        opacity={0.5}
      />
      <circle cx={xAt(currentSlot)} cy={yAt(actual[actual.length - 1]?.total ?? 0, max)} r={4} fill="var(--color-primary)" />

      {/* peak marker */}
      <circle cx={xAt(peakSlot)} cy={yAt(peakVal, max)} r={4} fill="var(--color-warn)" />
      <line
        x1={xAt(peakSlot)}
        x2={xAt(peakSlot)}
        y1={yAt(peakVal, max)}
        y2={PAD.t}
        stroke="var(--color-warn)"
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.6}
      />
      <text x={xAt(peakSlot)} y={PAD.t - 8} textAnchor="middle" fontSize={12} className="tnum" fill="var(--color-warn)">
        Peak {Math.round(peakVal)} kW
      </text>
    </svg>
  );
}

/** Baseline vs optimized comparison. */
export function SimCompareChart({
  baseline,
  optimized,
}: {
  baseline: number[];
  optimized: number[];
}) {
  const max = niceMax(Math.max(...baseline) * 1.08);
  const basePeak = Math.max(...baseline);
  const optPeak = Math.max(...optimized);
  const basePeakSlot = baseline.indexOf(basePeak);
  const optPeakSlot = optimized.indexOf(optPeak);
  const zero = baseline.map(() => 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <OnPeakBand max={max} />
      <HourTicks max={max} />

      {/* savings area (between baseline and optimized) */}
      <path d={areaPath(baseline, optimized, max)} fill="var(--color-primary)" opacity={0.12} />

      {/* optimized fill */}
      <path d={areaPath(optimized, zero, max)} fill="var(--color-primary)" opacity={0.14} />
      <path d={linePath(optimized, max)} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} />

      {/* baseline line */}
      <path
        d={linePath(baseline, max)}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />

      {/* peak markers */}
      <line x1={PAD.l} x2={PAD.l + IW} y1={yAt(basePeak, max)} y2={yAt(basePeak, max)} stroke="var(--color-danger)" strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      <line x1={PAD.l} x2={PAD.l + IW} y1={yAt(optPeak, max)} y2={yAt(optPeak, max)} stroke="var(--color-primary)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
      <circle cx={xAt(basePeakSlot)} cy={yAt(basePeak, max)} r={4} fill="var(--color-danger)" />
      <circle cx={xAt(optPeakSlot)} cy={yAt(optPeak, max)} r={4} fill="var(--color-primary)" />
      <text x={PAD.l + 6} y={yAt(basePeak, max) - 6} fontSize={11} className="tnum" fill="var(--color-danger)">
        เดิม {Math.round(basePeak)} kW
      </text>
      <text x={PAD.l + 6} y={yAt(optPeak, max) + 14} fontSize={11} className="tnum" fill="var(--color-primary)">
        ใหม่ {Math.round(optPeak)} kW
      </text>
    </svg>
  );
}

/** 52-month billed energy history. */
export function HistoryBars({
  rows,
}: {
  rows: { period: string; energy_kwh: number | null }[];
}) {
  const vals = rows.map((r) => r.energy_kwh ?? 0);
  const max = niceMax(Math.max(...vals) * 1.05);
  const bw = IW / rows.length;
  return (
    <svg viewBox={`0 0 ${W} 220`} className="w-full h-auto">
      {[0.5, 1].map((f) => (
        <line key={f} x1={PAD.l} x2={PAD.l + IW} y1={24 + (1 - f) * 150} y2={24 + (1 - f) * 150} stroke="var(--color-border-soft)" strokeDasharray="2 4" />
      ))}
      {rows.map((r, i) => {
        const v = r.energy_kwh ?? 0;
        const h = (v / max) * 150;
        const x = PAD.l + i * bw;
        const isYearStart = r.period.endsWith("-01");
        return (
          <g key={r.period}>
            <rect x={x + 1} y={24 + 150 - h} width={bw - 2} height={h} rx={1.5} fill={isYearStart ? "var(--color-accent)" : "var(--color-primary)"} opacity={0.8}>
              <title>{`${r.period}: ${Math.round(v).toLocaleString()} kWh`}</title>
            </rect>
            {isYearStart && (
              <text x={x} y={210} fontSize={11} className="tnum" fill="var(--color-faint)">
                {r.period.slice(0, 4)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal segmented cost bar. */
export function CostBar({
  components,
  total,
}: {
  components: { label: string; baht: number; key: string }[];
  total: number;
}) {
  const colors: Record<string, string> = {
    energy_on: "var(--color-ac)",
    energy_off: "var(--color-primary-dim)",
    demand: "var(--color-accent)",
    ft: "var(--color-plug)",
    service: "var(--color-faint)",
    vat: "var(--color-muted)",
  };
  let acc = 0;
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-border">
        {components.map((c) => {
          const w = (c.baht / total) * 100;
          acc += c.baht;
          return (
            <div
              key={c.key}
              style={{ width: `${w}%`, background: colors[c.key] }}
              className="h-full first:rounded-l-lg last:rounded-r-lg"
              title={`${c.label}: ${Math.round(c.baht).toLocaleString()} ฿`}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        {components.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[c.key] }} />
            <span className="text-muted">{c.label}</span>
            <span className="tnum ml-auto text-fg/90">{Math.round(c.baht).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
