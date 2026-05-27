import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusDot, StatusPill, StatusBar } from "@/components/ui/status-indicator";

describe("StatusDot", () => {
  it("renders a span with healthy token class", () => {
    const { container } = render(<StatusDot variant="healthy" />);
    const span = container.querySelector("span")!;
    expect(span).not.toBeNull();
    expect(span.className).toContain("bg-status-healthy");
  });

  it("uses degraded token class for degraded variant", () => {
    const { container } = render(<StatusDot variant="degraded" />);
    expect(container.querySelector("span")!.className).toContain(
      "bg-status-degraded",
    );
  });

  it("uses critical token class for critical variant", () => {
    const { container } = render(<StatusDot variant="critical" />);
    expect(container.querySelector("span")!.className).toContain(
      "bg-status-critical",
    );
  });

  it("uses unknown token class for unknown variant", () => {
    const { container } = render(<StatusDot variant="unknown" />);
    expect(container.querySelector("span")!.className).toContain(
      "bg-status-unknown",
    );
  });

  it("applies sm size by default", () => {
    const { container } = render(<StatusDot variant="healthy" />);
    const cls = container.querySelector("span")!.className;
    expect(cls).toContain("h-2");
    expect(cls).toContain("w-2");
  });

  it("applies md size classes when size=md", () => {
    const { container } = render(<StatusDot variant="healthy" size="md" />);
    const cls = container.querySelector("span")!.className;
    expect(cls).toContain("h-2.5");
    expect(cls).toContain("w-2.5");
  });

  it("adds pulse class when pulse=true", () => {
    const { container } = render(<StatusDot variant="critical" pulse />);
    expect(container.querySelector("span")!.className).toContain("animate-pulse");
  });
});

describe("StatusPill", () => {
  it("renders children with variant surface", () => {
    const { container, getByText } = render(
      <StatusPill variant="degraded">Warning</StatusPill>,
    );
    expect(getByText("Warning")).not.toBeNull();
    expect(container.firstChild).not.toBeNull();
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain("bg-status-degraded-soft");
    expect(pill.className).toContain("text-status-degraded");
  });
});

describe("StatusBar", () => {
  it("renders a left-edge accent strip with variant color", () => {
    const { container } = render(<StatusBar variant="critical" />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain("bg-status-critical");
    expect(bar.className).toContain("w-[3px]");
  });
});
