"use client";

import { useId } from "react";
import type { MetricPoint } from "@/services/metrics/schema";

interface MetricChartProps {
  title: string;
  data: MetricPoint[];
  color: string;
  areaColor: string;
  formatValue: (value: number) => string;
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

  return { linePath, areaPath, lastPoint };
}

export function MetricChart({
  title,
  data,
  color,
  areaColor,
  formatValue,
}: MetricChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const safeData = sanitizeMetricData(data);
  const sparkline = buildSparkline(safeData);
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

      <div className="mt-2 h-[76px]">
        {sparkline ? (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-full w-full"
            aria-label={`${title} trend`}
            role="img"
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
            <circle
              cx={sparkline.lastPoint.x}
              cy={sparkline.lastPoint.y}
              r="3"
              fill={color}
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-xs text-muted-foreground/40">
              {safeData.length === 1 ? "Collecting samples" : "No data"}
            </span>
          </div>
        )}
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
