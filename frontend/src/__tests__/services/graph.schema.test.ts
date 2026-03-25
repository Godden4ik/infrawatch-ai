import { describe, it, expect } from "vitest";
import {
  topologyNodeSchema,
  topologyEdgeSchema,
  topologyResponseSchema,
  blastRadiusResponseSchema,
  runbookSchema,
  incidentSchema,
} from "@/services/graph/schema";

describe("topologyNodeSchema", () => {
  it("parses a node with all fields", () => {
    const node = topologyNodeSchema.parse({
      name: "api-gateway",
      type: "service",
      labels: ["Service", "API"],
    });
    expect(node.name).toBe("api-gateway");
    expect(node.labels).toHaveLength(2);
  });

  it("allows null type", () => {
    const node = topologyNodeSchema.parse({
      name: "x",
      type: null,
      labels: [],
    });
    expect(node.type).toBeNull();
  });
});

describe("topologyEdgeSchema", () => {
  it("parses an edge", () => {
    const edge = topologyEdgeSchema.parse({
      source: "api-gateway",
      relationship: "CALLS",
      target: "payment-service",
    });
    expect(edge.source).toBe("api-gateway");
    expect(edge.relationship).toBe("CALLS");
    expect(edge.target).toBe("payment-service");
  });
});

describe("topologyResponseSchema", () => {
  it("parses a full topology response", () => {
    const result = topologyResponseSchema.parse({
      nodes: [{ name: "svc-a", type: "service", labels: [] }],
      edges: [{ source: "svc-a", relationship: "CALLS", target: "svc-b" }],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
  });

  it("parses an empty topology", () => {
    const result = topologyResponseSchema.parse({ nodes: [], edges: [] });
    expect(result.nodes).toHaveLength(0);
  });
});

describe("blastRadiusResponseSchema", () => {
  it("parses blast radius with affected services", () => {
    const result = blastRadiusResponseSchema.parse({
      service: "api-gateway",
      affected_services: ["payment-service", "order-service"],
    });
    expect(result.affected_services).toHaveLength(2);
  });

  it("parses blast radius with no affected services", () => {
    const result = blastRadiusResponseSchema.parse({
      service: "redis-cache",
      affected_services: [],
    });
    expect(result.affected_services).toHaveLength(0);
  });
});

describe("runbookSchema", () => {
  it("parses a runbook with steps", () => {
    const rb = runbookSchema.parse({
      id: "rb-001",
      title: "Restart payment service",
      severity: "critical",
      steps: ["Check logs", "Restart pod", "Verify health"],
    });
    expect(rb.steps).toHaveLength(3);
    expect(rb.severity).toBe("critical");
  });

  it("parses a runbook with no steps", () => {
    const rb = runbookSchema.parse({
      id: "rb-002",
      title: "Investigate",
      severity: "low",
      steps: [],
    });
    expect(rb.steps).toHaveLength(0);
  });
});

describe("incidentSchema", () => {
  it("parses an incident with all fields", () => {
    const inc = incidentSchema.parse({
      id: "inc-001",
      title: "Payment service down",
      severity: "critical",
      resolution: "Restarted the pod",
      timestamp: "2026-03-17T10:00:00Z",
    });
    expect(inc.resolution).toBe("Restarted the pod");
  });

  it("allows null resolution and timestamp", () => {
    const inc = incidentSchema.parse({
      id: "inc-002",
      title: "Unknown issue",
      severity: "low",
      resolution: null,
      timestamp: null,
    });
    expect(inc.resolution).toBeNull();
    expect(inc.timestamp).toBeNull();
  });
});
