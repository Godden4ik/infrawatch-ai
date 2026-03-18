export const ragKeys = {
  all: ["rag"] as const,
  evaluation: (query: string) => [...ragKeys.all, "eval", query] as const,
};
