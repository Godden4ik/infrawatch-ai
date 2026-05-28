import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "LLM Providers",
  description:
    "Configure and test API keys for Anthropic, OpenAI, Gemini, DeepSeek, and Ollama. Keys are kept server-side; only the masked status reaches the browser.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
