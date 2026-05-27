"use client";

import { useId, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { MetricPoint } from "@/services/metrics/schema";

interface MetricChartProps {
  title: string;
  data: MetricPoint[];
  /** CSS variable name for line/dot color, e.g. "--status-healthy". */
  colorVar: string;
  /** CSS variable name for area/gradient base, e.g. "--status-healthy-soft". */
  areaVar: string;
  formatValue: (value: number) => string;
}

// Duplicated locally — kept in sync with live-chart.tsx but intentionally not
// imported (live-chart.tsx has a fragile fix we don't want to couple to).
function cssVar(name: string): string {
  if (typeof window === "undefined") return "#888";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw || "#888";
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 76;
const PAD_X = 4;
const PAD_Y = 6;

function sanitizeMetricData(data: MetricPoint[] | null | undefined) {
  if (!Array.isArray(data)) return [];

  return data.filter(
    (point): point is MetricPoint =>
      !!point &&
      typeof point.time === "string" &&
      point.time.length > 0 &&
      typeof point.value === "number" &&
      Number.isFinite(point.value),
  );
}

function buildSparkline(data: MetricPoint[]) {
  if (data.length < 2) return null;

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((point, index) => {
    const x =
      PAD_X +
      (index / Math.max(data.length - 1, 1)) * (CHART_WIDTH - PAD_X * 2);
    const y =
      CHART_HEIGHT -
      PAD_Y -
      ((point.value - min) / range) * (CHART_HEIGHT - PAD_Y * 2);

    return { x, y };
  });

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${(CHART_HEIGHT - PAD_Y).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(CHART_HEIGHT - PAD_Y).toFixed(2)} Z`;

  return { linePath, areaPath, lastPoint, points };
}

function formatHoverTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function MetricChart({
  title,
  data,
  colorVar,
  areaVar,
  formatValue,
}: MetricChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isDark forces re-resolve when theme flips
  const color = useMemo(() => cssVar(colorVar), [colorVar, isDark]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isDark forces re-resolve when theme flips
  const areaColor = useMemo(() => cssVar(areaVar), [areaVar, isDark]);

  const gradientId = useId().replace(/:/g, "");
  const safeData = sanitizeMetricData(data);
  const sparkline = buildSparkline(safeData);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handlePointer = (clientX: number, target: SVGElement) => {
    const svg = target.ownerSVGElement ?? (target as unknown as SVGSVGElement);
    if (!svg || !sparkline) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const local = pt.matrixTransform(ctm.inverse());
    let best = 0;
    let bestDist = Infinity;
    sparkline.points.forEach((p, i) => {
      const dist = Math.abs(p.x - local.x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHoverIndex(best);
  };

  const activePoint =
    hoverIndex !== null && sparkline ? sparkline.points[hoverIndex] : null;
  const activeDatum =
    hoverIndex !== null ? safeData[hoverIndex] ?? null : null;
  const tooltipLeftPct = activePoint
    ? (activePoint.x / CHART_WIDTH) * 100
    : null;
  const latestValue =
    safeData.length > 0 ? safeData[safeData.length - 1].value : null;
  const minValue =
    safeData.length > 0
      ? Math.min(...safeData.map((point) => point.value))
      : null;
  const maxValue =
    safeData.length > 0
      ? Math.max(...safeData.map((point) => point.value))
      : null;

  return (
    <div
      className="border-border bg-background/40 px-3 py-3 ring-1 ring-inset ring-border/70"
      style={{
        boxShadow: `inset 0 1px 0 color-mix(in oklab, ${areaColor} 26%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            {title}
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {latestValue !== null ? formatValue(latestValue) : "No data"}
          </p>
        </div>
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      </div>

      <div className="relative mt-2 h-[76px]">
        {sparkline ? (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-full w-full"
            aria-label={`${title} trend`}
            role="img"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.42" />
                <stop offset="100%" stopColor={areaColor} stopOpacity="0.12" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={0}
                x2={CHART_WIDTH}
                y1={ratio * CHART_HEIGHT}
                y2={ratio * CHART_HEIGHT}
                stroke={color}
                strokeOpacity="0.16"
                strokeWidth="1"
              />
            ))}

            <path
              d={sparkline.areaPath}
              fill={`url(#${gradientId})`}
              stroke="none"
            />
            <path
              d={sparkline.linePath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {activePoint ? (
              <>
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={0}
                  y2={CHART_HEIGHT}
                  stroke={color}
                  strokeOpacity="0.32"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="3.5"
                  fill={color}
                  stroke="var(--background)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : (
              <circle
                cx={sparkline.lastPoint.x}
                cy={sparkline.lastPoint.y}
                r="3"
                fill={color}
              />
            )}
            <rect
              x={0}
              y={0}
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              fill="transparent"
              onMouseMove={(e) =>
                handlePointer(e.clientX, e.currentTarget as SVGElement)
              }
              onMouseLeave={() => setHoverIndex(null)}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch)
                  handlePointer(
                    touch.clientX,
                    e.currentTarget as SVGElement,
                  );
              }}
              onTouchEnd={() => setHoverIndex(null)}
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-xs text-muted-foreground/40">
              {safeData.length === 1 ? "Collecting samples" : "No data"}
            </span>
          </div>
        )}
        {activeDatum && tooltipLeftPct !== null ? (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full border border-border bg-popover px-2.5 py-1.5 font-mono text-[11px] text-popover-foreground shadow-md"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <div className="text-[9px] tracking-[0.16em] text-muted-foreground/80 uppercase">
              {formatHoverTime(activeDatum.time)}
            </div>
            <div
              className="mt-0.5 text-sm font-semibold tabular-nums"
              style={{ color }}
            >
              {formatValue(activeDatum.value)}
            </div>
          </div>
        ) : null}
      </div>

      {minValue !== null && maxValue !== null ? (
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>min {formatValue(minValue)}</span>
          <span>max {formatValue(maxValue)}</span>
        </div>
      ) : null}
    </div>
  );
}
