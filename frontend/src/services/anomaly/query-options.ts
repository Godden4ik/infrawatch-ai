export const anomalyKeys = {
  all: ["anomaly"] as const,
  history: () => [...anomalyKeys.all, "history"] as const,
};
