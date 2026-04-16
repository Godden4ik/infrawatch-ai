import { z } from "zod";

const prometheusTimestampSchema = z.union([
  z.number(),
  z.string().transform((value) => Number.parseFloat(value)),
]);

const prometheusValueSchema = z.union([
  z.string(),
  z.number().transform((value) => String(value)),
  z.null(),
]);

const prometheusSampleSchema = z.tuple([
  prometheusTimestampSchema,
  prometheusValueSchema,
]);

const prometheusSeriesSchema = z.object({
  metric: z.record(z.string(), z.string()).catch({}),
  values: z.array(prometheusSampleSchema).nullish(),
  value: prometheusSampleSchema.nullish(),
});

export const prometheusResultSchema = z.object({
  status: z.string(),
  data: z.object({
    resultType: z.string(),
    result: z.array(prometheusSeriesSchema).nullish(),
  }),
});

export const metricPointSchema = z.object({
  time: z.string(),
  value: z.number(),
});

export type PrometheusResult = z.infer<typeof prometheusResultSchema>;
export type MetricPoint = z.infer<typeof metricPointSchema>;

function sampleToMetricPoint(
  sample: z.infer<typeof prometheusSampleSchema>,
): MetricPoint | null {
  const [timestamp, rawValue] = sample;
  const parsedValue =
    rawValue === null ? Number.NaN : Number.parseFloat(String(rawValue));

  if (!Number.isFinite(timestamp) || !Number.isFinite(parsedValue)) {
    return null;
  }

  return {
    time: new Date(timestamp * 1000).toISOString(),
    value: parsedValue,
  };
}

export function mapPrometheusResultToMetricPoints(input: unknown): MetricPoint[] {
  const parsed = prometheusResultSchema.safeParse(input);
  if (!parsed.success) return [];

  const series = parsed.data.data.result?.[0];
  if (!series) return [];

  const samples = Array.isArray(series.values)
    ? series.values
    : series.value
      ? [series.value]
      : [];

  return samples
    .map(sampleToMetricPoint)
    .filter((point): point is MetricPoint => point !== null);
}
