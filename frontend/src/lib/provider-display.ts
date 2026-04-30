import { BrainCircuit } from "lucide-react";
import Anthropic from "@lobehub/icons/es/Anthropic";
import OpenAI from "@lobehub/icons/es/OpenAI";
import Gemini from "@lobehub/icons/es/Gemini";
import DeepSeek from "@lobehub/icons/es/DeepSeek";
import Ollama from "@lobehub/icons/es/Ollama";
import type { FC } from "react";

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
    color: "#FFFFFF",
    description: "GPT models",
  },
  gemini: {
    icon: Gemini.Color,
    color: "#4285F4",
    description: "Gemini models",
  },
  deepseek: {
    icon: DeepSeek,
    color: "#4D6BFE",
    description: "DeepSeek models",
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
