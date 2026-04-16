import { BrainCircuit } from "lucide-react";
import { Anthropic, OpenAI, Google, Ollama } from "@lobehub/icons";
import type { FC } from "react";

// IconType from @lobehub/icons is a React FC that accepts size, style, className
// We use a compatible signature accepted by both lobehub icons and lucide icons.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderIconComponent = FC<any>;

export type ProviderDisplay = {
  icon: ProviderIconComponent;
  color: string;
  description: string;
};

const PROVIDER_DISPLAY: Record<string, ProviderDisplay> = {
  anthropic: {
    icon: Anthropic,
    color: "#D97757",
    description: "Claude models",
  },
  openai: {
    icon: OpenAI,
    color: "#10A37F",
    description: "GPT models",
  },
  google: {
    icon: Google,
    color: "#4285F4",
    description: "Gemini models",
  },
  ollama: {
    icon: Ollama,
    color: "#FFFFFF",
    description: "Local models",
  },
};

const DEFAULT_DISPLAY: ProviderDisplay = {
  icon: BrainCircuit,
  color: "#888888",
  description: "Custom provider",
};

export function getProviderDisplay(id: string): ProviderDisplay {
  return PROVIDER_DISPLAY[id] ?? DEFAULT_DISPLAY;
}
