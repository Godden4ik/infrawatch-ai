import { describe, it, expect } from "vitest";
import {
  injectRequestSchema,
  ANOMALY_TYPES,
  SERVICES,
  SCENARIOS,
} from "@/services/anomaly/schema";

describe("injectRequestSchema", () => {
  it("parses a valid inject request", () => {
    const result = injectRequestSchema.parse({
      service: "api-gateway",
      anomaly_type: "latency",
    });
    expect(result.service).toBe("api-gateway");
    expect(result.anomaly_type).toBe("latency");
  });

  it("rejects missing anomaly_type", () => {
    expect(() =>
      injectRequestSchema.parse({ service: "api-gateway" }),
    ).toThrow();
  });

  it("rejects missing service", () => {
    expect(() =>
      injectRequestSchema.parse({ anomaly_type: "error" }),
    ).toThrow();
  });
});

describe("ANOMALY_TYPES", () => {
  it("includes all expected anomaly types", () => {
    expect(ANOMALY_TYPES).toContain("latency");
    expect(ANOMALY_TYPES).toContain("error");
    expect(ANOMALY_TYPES).toContain("memory_leak");
    expect(ANOMALY_TYPES).toContain("cache_failure");
    expect(ANOMALY_TYPES).toContain("cache_degraded");
  });
});

describe("SERVICES", () => {
  it("contains all five monitored services", () => {
    expect(SERVICES).toContain("api-gateway");
    expect(SERVICES).toContain("payment-service");
    expect(SERVICES).toContain("user-service");
    expect(SERVICES).toContain("order-service");
    expect(SERVICES).toContain("redis-cache");
  });

  it("has exactly 5 services", () => {
    expect(SERVICES).toHaveLength(5);
  });
});

describe("SCENARIOS", () => {
  it("includes the cascade scenario", () => {
    expect(SCENARIOS).toContain("cascade");
  });
});
