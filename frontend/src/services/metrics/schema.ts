import { z } from "zod";

export const prometheusResultSchema = z.object({
  status: z.string(),
  data: z.object({
    resultType: z.string(),
    result: z.array(
      z.object({
        metric: z.record(z.string(), z.string()),
        values: z.array(z.tuple([z.number(), z.string()])).optional(),
        value: z.tuple([z.number(), z.string()]).optional(),
      }),
    ),
  }),
});

export type PrometheusResult = z.infer<typeof prometheusResultSchema>;
