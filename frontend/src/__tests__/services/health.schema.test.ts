import { describe, it, expect } from "vitest";
import {
  healthResponseSchema,
  serviceStatusSchema,
} from "@/services/health/schema";

describe("serviceStatusSchema", () => {
  it("parses a healthy service", () => {
    const result = serviceStatusSchema.parse({
      service: "api-gateway",
      status: "healthy",
    });
    expect(result.status).toBe("healthy");
  });

  it("parses unhealthy and unreachable statuses", () => {
    expect(
      serviceStatusSchema.parse({ service: "x", status: "unhealthy" }).status,
    ).toBe("unhealthy");
    expect(
      serviceStatusSchema.parse({ service: "x", status: "unreachable" }).status,
    ).toBe("unreachable");
  });

  it("rejects an unknown status", () => {
    expect(() =>
      serviceStatusSchema.parse({ service: "x", status: "unknown" }),
    ).toThrow();
  });
});

describe("healthResponseSchema", () => {
  it("parses a healthy response", () => {
    const data = {
      status: "healthy",
      services: {
        "api-gateway": "healthy",
        "payment-service": "unhealthy",
      },
    };
    const result = healthResponseSchema.parse(data);
    expect(result.status).toBe("healthy");
    expect(result.services["api-gateway"]).toBe("healthy");
  });

  it("parses a degraded response", () => {
    const result = healthResponseSchema.parse({
      status: "degraded",
      services: {},
    });
    expect(result.status).toBe("degraded");
  });

  it("rejects missing services field", () => {
    expect(() =>
      healthResponseSchema.parse({ status: "healthy" }),
    ).toThrow();
  });
});
