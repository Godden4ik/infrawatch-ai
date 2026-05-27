import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderCard } from "@/app/providers/_components/provider-card";
import type { Provider } from "@/services/providers/schema";
import { toast } from "@/hooks/use-toast";

const mockCheckProviderHealth = vi.fn();
const mockSaveKey = vi.fn();
const mockGetMasked = vi.fn();
const mockGetRevealed = vi.fn();
const mockRemoveKey = vi.fn();

vi.mock("@/lib/provider-display", () => ({
  getProviderDisplay: () => ({
    icon: () => <svg data-testid="provider-icon" />,
    color: "#fff",
    description: "Mock provider",
  }),
}));

vi.mock("@/components/ui/wifi-icon", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const MockWifiIcon = React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      startAnimation: vi.fn(),
      stopAnimation: vi.fn(),
    }));

    return <svg data-testid="wifi-icon" />;
  });

  MockWifiIcon.displayName = "MockWifiIcon";

  return { WifiIcon: MockWifiIcon };
});

vi.mock("@/services/providers/actions", () => ({
  saveKey: (...args: unknown[]) => mockSaveKey(...args),
  removeKey: (...args: unknown[]) => mockRemoveKey(...args),
  getMasked: (...args: unknown[]) => mockGetMasked(...args),
  getRevealed: (...args: unknown[]) => mockGetRevealed(...args),
  checkProviderHealth: (...args: unknown[]) => mockCheckProviderHealth(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const provider: Provider = {
  id: "anthropic",
  name: "Anthropic",
  available: false,
  requires_key: true,
  default_model: "claude-haiku-4-5-20251001",
  models: [{ id: "claude-haiku-4-5-20251001", name: "Claude Haiku", param_size: "-" }],
};

function renderProviderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProviderCard provider={provider} hasSqliteKey={false} />
    </QueryClientProvider>,
  );
}

function renderConfiguredProviderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProviderCard provider={provider} hasSqliteKey />
    </QueryClientProvider>,
  );
}

describe("ProviderCard connection testing", () => {
  beforeEach(() => {
    mockCheckProviderHealth.mockReset();
    mockSaveKey.mockReset();
    mockRemoveKey.mockReset();
    mockGetMasked.mockReset();
    mockGetRevealed.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("flashes green after a healthy connection test", async () => {
    mockCheckProviderHealth.mockResolvedValue({
      success: true,
      data: {
        provider: "anthropic",
        status: "healthy",
        latency_ms: 123,
        checked_at: "2026-04-16T12:00:00Z",
      },
    });

    renderProviderCard();

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId("connection-indicator-anthropic"),
      ).toHaveClass("text-status-healthy");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("connection-indicator-anthropic"),
      ).toHaveClass("text-muted-foreground");
    });
  });

  it("shows masked spoiler after saving a key", async () => {
    mockSaveKey.mockResolvedValue({
      success: true,
      data: { success: true },
    });
    mockGetMasked.mockResolvedValue({
      success: true,
      data: { masked: "sk-proj-****abcd" },
    });

    renderProviderCard();

    fireEvent.change(screen.getByPlaceholderText("sk-..."), {
      target: { value: "sk-proj-1234abcd" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("sk-proj-****abcd")).toBeInTheDocument();
    });
  });

  it("flashes red after an unhealthy connection test", async () => {
    mockCheckProviderHealth.mockResolvedValue({
      success: true,
      data: {
        provider: "anthropic",
        status: "unhealthy",
        latency_ms: 321,
        checked_at: "2026-04-16T12:00:00Z",
        error: "bad key",
      },
    });

    renderProviderCard();

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId("connection-indicator-anthropic"),
      ).toHaveClass("text-destructive");
    });

    expect(screen.getByText("No connection")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Anthropic: No connection");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("connection-indicator-anthropic"),
      ).toHaveClass("text-muted-foreground");
    });
  });

  it("maps provider auth failures to invalid API key", async () => {
    mockCheckProviderHealth.mockResolvedValue({
      success: true,
      data: {
        provider: "anthropic",
        status: "unhealthy",
        latency_ms: 321,
        checked_at: "2026-04-16T12:00:00Z",
        error: "API_KEY_INVALID",
      },
    });

    renderProviderCard();

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid API key")).toBeInTheDocument();
    });

    expect(toast.error).toHaveBeenCalledWith("Anthropic: Invalid API key");
  });

  it("loads full key from server when reveal is toggled on", async () => {
    mockGetMasked.mockResolvedValue({
      success: true,
      data: { masked: "sk-proj-****abcd" },
    });
    mockGetRevealed.mockResolvedValue({
      success: true,
      data: { key: "sk-proj-1234abcd" },
    });

    renderConfiguredProviderCard();

    await waitFor(() => {
      expect(screen.getByText("sk-proj-****abcd")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /reveal key/i }));

    await waitFor(() => {
      expect(screen.getByText("sk-proj-1234abcd")).toBeInTheDocument();
    });
  });
});
