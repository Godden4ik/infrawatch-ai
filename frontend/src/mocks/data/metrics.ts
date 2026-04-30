function generateTimeSeries(
  baseValue: number,
  variance: number,
  points = 60,
  stepSeconds = 60,
) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - points * stepSeconds;
  return Array.from({ length: points }, (_, i) => {
    const jitter = (Math.random() - 0.5) * 2 * variance;
    return [start + i * stepSeconds, String(Math.max(0, baseValue + jitter).toFixed(6))] as [
      number,
      string,
    ];
  });
}

const SERVICE_BASELINES: Record<string, { latency: number; rate: number; errorRate: number }> = {
  "api-gateway": { latency: 0.1, rate: 25, errorRate: 0.5 },
  "payment-service": { latency: 0.93, rate: 15, errorRate: 1.2 },
  "user-service": { latency: 0.1, rate: 20, errorRate: 0.3 },
  "order-service": { latency: 2.3, rate: 10, errorRate: 0.8 },
  "redis-cache": { latency: 0.005, rate: 50, errorRate: 0.1 },
};

export function generateMockPrometheusResponse(promql: string) {
  // Extract service name from query
  const serviceMatch = promql.match(/service="([^"]+)"/);
  const service = serviceMatch?.[1] ?? "api-gateway";
  const baseline = SERVICE_BASELINES[service] ?? SERVICE_BASELINES["api-gateway"];

  let baseValue = baseline.rate;
  let variance = 3;

  if (promql.includes("histogram_quantile") || promql.includes("duration")) {
    baseValue = baseline.latency;
    variance = baseline.latency * 0.2;
  } else if (promql.includes('status=~"5')) {
    baseValue = baseline.errorRate;
    variance = 0.5;
  }

  const isRange = promql.includes("query_range") || true; // treat all as range for mock

  return {
    status: "success",
    data: {
      resultType: isRange ? "matrix" : "vector",
      result: [
        {
          metric: { service, __name__: "mock_metric" },
          values: generateTimeSeries(baseValue, variance),
        },
      ],
    },
  };
}
