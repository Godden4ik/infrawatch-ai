import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusIndicator } from "@/components/layout/status-indicator";

describe("StatusIndicator", () => {
  it("renders without crashing", () => {
    const { container } = render(<StatusIndicator status="healthy" />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders a span element", () => {
    const { container } = render(<StatusIndicator status="healthy" />);
    expect(container.querySelector("span")).not.toBeNull();
  });

  it("applies emerald color class for healthy status", () => {
    const { container } = render(<StatusIndicator status="healthy" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("bg-emerald-500");
  });

  it("applies amber color class for unhealthy status", () => {
    const { container } = render(<StatusIndicator status="unhealthy" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("bg-amber-500");
  });

  it("applies red color class for unreachable status", () => {
    const { container } = render(<StatusIndicator status="unreachable" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("bg-red-500");
  });

  it("applies sm size classes by default", () => {
    const { container } = render(<StatusIndicator status="healthy" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("h-2");
    expect(span.className).toContain("w-2");
  });

  it("applies md size classes when size=md", () => {
    const { container } = render(
      <StatusIndicator status="healthy" size="md" />,
    );
    const span = container.querySelector("span")!;
    expect(span.className).toContain("h-2.5");
    expect(span.className).toContain("w-2.5");
  });
});
