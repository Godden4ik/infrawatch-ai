export const pipelineKeys = {
  all: ["pipeline"] as const,
  currentRun: () => [...pipelineKeys.all, "current"] as const,
  lastParams: () => [...pipelineKeys.all, "last-params"] as const,
};
