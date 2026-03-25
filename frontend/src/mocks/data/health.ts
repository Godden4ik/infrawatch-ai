import type { HealthResponse } from "@/services/health/schema";

export const mockHealthResponse: HealthResponse = {
  status: "healthy",
  services: {
    "api-gateway": "healthy",
    "payment-service": "healthy",
    "user-service": "healthy",
    "order-service": "healthy",
    "redis-cache": "healthy",
    prometheus: "healthy",
    neo4j: "healthy",
  },
};

export function getMockHealth(degraded = false): HealthResponse {
  if (!degraded) return mockHealthResponse;
  return {
    status: "degraded",
    services: {
      ...mockHealthResponse.services,
      "redis-cache": "unhealthy",
      "payment-service": "unhealthy",
    },
  };
}
