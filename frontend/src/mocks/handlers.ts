import { healthHandlers } from "./handlers/health";
import { metricsHandlers } from "./handlers/metrics";
import { graphHandlers } from "./handlers/graph";
import { pipelineHandlers } from "./handlers/pipeline";
import { anomalyHandlers } from "./handlers/anomaly";
import { ragHandlers } from "./handlers/rag";

export const handlers = [
  ...healthHandlers,
  ...metricsHandlers,
  ...graphHandlers,
  ...pipelineHandlers,
  ...anomalyHandlers,
  ...ragHandlers,
];
