export const pipelineKeys = {
  all: ["pipeline"] as const,
  currentRun: () => [...pipelineKeys.all, "current"] as const,
};
