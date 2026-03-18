export function getMockInjectResponse(service: string, anomalyType: string) {
  return {
    service,
    anomaly_type: anomalyType,
    status: "injected",
    message: `Anomaly '${anomalyType}' injected into ${service}`,
  };
}

export function getMockScenarioResponse(scenario: string) {
  const results: Record<string, unknown[]> = {
    cascade: [
      { service: "redis-cache", anomaly_type: "cache_failure", status: "injected" },
      { service: "payment-service", anomaly_type: "cache_degraded", status: "injected" },
      { service: "order-service", anomaly_type: "cache_degraded", status: "injected" },
    ],
  };

  return {
    scenario,
    results: results[scenario] ?? [],
  };
}

export function getMockResetResponse() {
  return { status: "reset" };
}
