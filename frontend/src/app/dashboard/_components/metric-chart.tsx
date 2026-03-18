"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricChartProps {
  title: string;
  data: Array<{ time: string; value: number }>;
  unit?: string;
  color?: string;
}

export function MetricChart({
  title,
  data,
  unit = "",
  color = "#3b82f6",
}: MetricChartProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-xs font-medium tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "#64748b", fontFamily: "monospace" }}
                tickFormatter={(t) => {
                  const d = new Date(t);
                  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
                }}
                axisLine={{ stroke: "rgba(148,163,184,0.15)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#64748b", fontFamily: "monospace" }}
                tickFormatter={(v) => `${Number(v).toFixed(2)}${unit}`}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toFixed(4)}${unit}`, title]}
                labelFormatter={(t) => new Date(String(t)).toLocaleTimeString()}
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#e2e8f0",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={color}
                fillOpacity={0.08}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
