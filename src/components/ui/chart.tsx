import { cn } from "@/lib/utils";

export type ChartPoint = { label: string; value: number };

function niceMax(values: number[]): number {
  const max = Math.max(1, ...values);
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / magnitude) * magnitude;
}

/** Dependency-free bar chart rendered on the server as SVG. */
export function BarChart({
  data,
  height = 180,
  className,
  format = (v: number) => v.toLocaleString("en-IN"),
  tone = "accent",
}: {
  data: ChartPoint[];
  height?: number;
  className?: string;
  format?: (value: number) => string;
  tone?: "accent" | "success" | "danger";
}) {
  const max = niceMax(data.map((d) => d.value));
  const barColor = tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--accent)";
  const width = 100 / Math.max(1, data.length);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }}>
        {[0, 0.5, 1].map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${t * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-card pl-1 font-mono text-[10px] text-muted-soft">{format(max * t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end pr-10">
          {data.map((d) => (
            <div key={d.label} className="group relative flex h-full items-end justify-center" style={{ width: `${width}%` }}>
              <div
                className="w-[60%] max-w-8 rounded-t-sm opacity-85 transition-opacity group-hover:opacity-100"
                style={{ height: `${(d.value / max) * 100}%`, background: barColor, minHeight: d.value > 0 ? 2 : 0 }}
              />
              <span className="pointer-events-none absolute -top-6 rounded border border-border bg-popover px-1.5 py-0.5 text-[10px] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                {format(d.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex pr-10">
        {data.map((d, i) => (
          <span key={d.label} className="truncate text-center text-[10px] text-muted-soft" style={{ width: `${width}%` }}>
            {data.length > 12 && i % 2 === 1 ? "" : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Area/line chart rendered as SVG with a responsive viewBox. */
export function AreaChart({
  data,
  height = 180,
  className,
  format = (v: number) => v.toLocaleString("en-IN"),
}: {
  data: ChartPoint[];
  height?: number;
  className?: string;
  format?: (value: number) => string;
}) {
  const max = niceMax(data.map((d) => d.value));
  const w = 600;
  const h = 200;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((d, i) => [i * step, h - (d.value / max) * (h - 10)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gradientId = `area-${data.length}-${Math.round(max)}`;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1="0" x2={w} y1={h * t} y2={h * t} stroke="var(--border)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          ))}
          {data.length > 0 && <path d={area} fill={`url(#${gradientId})`} />}
          {data.length > 0 && (
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <span className="absolute top-0 right-0 font-mono text-[10px] text-muted-soft">{format(max)}</span>
      </div>
      <div className="mt-2 flex justify-between">
        {data
          .filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2))
          .map((d) => (
            <span key={d.label} className="text-[10px] text-muted-soft">
              {d.label}
            </span>
          ))}
      </div>
    </div>
  );
}
