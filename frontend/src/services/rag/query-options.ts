export const ragKeys = {
  all: ["rag"] as const,
  evaluation: (query: string) => [...ragKeys.all, "eval", query] as const,
  mutation: () => [...ragKeys.all, "evaluate"] as const,
};
