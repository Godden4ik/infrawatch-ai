"use client";

import { useMemo } from "react";
import { ResponsiveLine } from "@nivo/line";
import type { StreamPoint } from "@/hooks/use-metrics-stream";
import type { MetricFormat } from "@/lib/metric-registry";
import { formatMetricValue } from "@/lib/metric-registry";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "next-themes";

interface LiveChartProps {
  label: string;
  metricKey: string;
  points: StreamPoint[];
  colorVar: string;
  format: MetricFormat;
}

function resolveColor(colorVar: string): string {
  if (typeof window === "undefined") return "#6366f1";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(colorVar)
    .trim();
  return raw || "#6366f1";
}

export function LiveChart({ label, points, colorVar, format }: LiveChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // eslint-disable-next-line react-hooks/exhaustive-deps -- isDark triggers re-read of CSS variable
  const color = useMemo(() => resolveColor(colorVar), [colorVar, isDark]);

  const currentValue = points.length > 0 ? points[points.length - 1].value : null;
  const minValue = points.length > 0 ? Math.min(...points.map((p) => p.value)) : null;
  const maxValue = points.length > 0 ? Math.max(...points.map((p) => p.value)) : null;

  const nivoData = useMemo(
    () => [
      {
        id: label,
        data: points.map((p) => ({
          x: new Date(p.time),
          y: p.value,
        })),
      },
    ],
    [label, points],
  );

  const nivoTheme = useMemo(
    () => ({
      text: { fill: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" },
      axis: {
        ticks: {
          text: {
            fontSize: 10,
            fill: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
            fontFamily: "var(--font-mono)",
          },
        },
      },
      grid: { line: { stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } },
      crosshair: { line: { stroke: color, strokeOpacity: 0.4 } },
    }),
    [isDark, color],
  );

  return (
    <Card className="h-full p-0">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {currentValue !== null ? formatMetricValue(currentValue, format) : "—"}
          </p>
        </div>

        <div className="mt-2 h-[170px]">
          {points.length >= 2 ? (
            <ResponsiveLine
              data={nivoData}
              margin={{ top: 4, right: 8, bottom: 24, left: 40 }}
              xScale={{ type: "time" }}
              yScale={{ type: "linear", min: "auto", max: "auto" }}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                format: "%H:%M:%S",
                tickValues: 4,
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                tickValues: 4,
                format: (v) => formatMetricValue(Number(v), format),
              }}
              colors={[color]}
              lineWidth={2}
              enablePoints={false}
              enableArea
              areaOpacity={0.12}
              enableGridX={false}
              enableGridY
              animate={false}
              theme={nivoTheme}
              enableCrosshair
              isInteractive
              useMesh
              tooltip={({ point }) => (
                <div className="border-border bg-popover px-2 py-1 font-mono text-[11px] text-popover-foreground shadow-md">
                  {formatMetricValue(Number(point.data.y), format)}
                </div>
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground/40">
                Collecting samples…
              </span>
            </div>
          )}
        </div>

        {minValue !== null && maxValue !== null && (
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>min {formatMetricValue(minValue, format)}</span>
            <span>max {formatMetricValue(maxValue, format)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
