import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "./ui";

// Validated categorical slots (light surface). Text never wears these colors.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;

const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const BASELINE = "#c3c2b7";

/** Tightest clean integer axis with 3–5 steps of 1/2/2.5/5 × 10ⁿ. */
export function niceTicks(maxValue: number): number[] {
  if (maxValue <= 0) return [0, 1, 2, 3, 4];
  let best: { max: number; n: number } | null = null;
  for (const n of [4, 5, 3]) {
    const raw = maxValue / n;
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / exp;
    const step = Math.max((f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp, 1);
    if (!Number.isInteger(step)) continue;
    if (!best || step * n < best.max) best = { max: step * n, n };
  }
  const { max, n } = best ?? { max: Math.ceil(maxValue), n: 4 };
  return Array.from({ length: n + 1 }, (_, i) => (max / n) * i);
}

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

export function Legend({ items, className }: { items: { name: string; color: string; value?: string }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-stone-600", className)}>
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.name}
          {i.value && <span className="font-medium text-stone-900 tabular">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label, format }: TooltipContentProps<number, string> & { format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="min-w-36 rounded-xl bg-white px-3 py-2.5 text-xs shadow-lift ring-1 ring-stone-900/10">
      <p className="mb-1.5 font-medium text-stone-900">{label}</p>
      <div className="space-y-1">
        {[...payload].reverse().map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-stone-600">
              <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium text-stone-900 tabular">{format(Number(p.value) || 0)}</span>
          </div>
        ))}
        {payload.length > 1 && (
          <div className="mt-1 flex justify-between border-t border-stone-100 pt-1 text-stone-500">
            <span>Total</span>
            <span className="font-medium text-stone-900 tabular">{format(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Stacked/single column chart following the house mark specs. */
export function ColumnChart({
  data,
  xKey,
  series,
  height = 240,
  format = (n) => n.toLocaleString("en-US"),
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  format?: (n: number) => string;
}) {
  const peak = Math.max(0, ...data.map((d) => series.reduce((sum, s) => sum + (Number(d[s.key]) || 0), 0)));
  const ticks = niceTicks(peak);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={{ stroke: BASELINE }}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            allowDecimals={false}
            domain={[0, ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={(v) => format(Number(v))}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "rgba(28,25,23,0.04)" }}
            content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} format={format} />}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="a"
              fill={s.color}
              maxBarSize={24}
              stroke="#ffffff"
              strokeWidth={series.length > 1 ? 1 : 0}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal proportion bar (parts of a whole) with a 2px surface gap between segments. */
export function ProportionBar({
  parts,
  className,
}: {
  parts: { name: string; value: number; color: string }[];
  className?: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className={className}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-stone-100">
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div
                key={p.name}
                title={`${p.name}: ${p.value}`}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              />
            ))}
      </div>
      <Legend className="mt-3" items={parts.map((p) => ({ name: p.name, color: p.color, value: p.value.toLocaleString("en-US") }))} />
    </div>
  );
}

/** Horizontal ranked bars, value at the tip. */
export function RankedBars({
  rows,
  color = SERIES[0],
  format = (n) => n.toLocaleString("en-US"),
}: {
  rows: { label: string; value: number; sub?: string }[];
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-stone-700">{r.label}</span>
            <span className="shrink-0 font-medium text-stone-900 tabular">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
