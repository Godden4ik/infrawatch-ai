import { cn } from "@/lib/utils";

type Status = "healthy" | "unhealthy" | "unreachable";

export function StatusIndicator({
  status,
  size = "sm",
}: {
  status: Status;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        size === "sm" && "h-2 w-2",
        size === "md" && "h-2.5 w-2.5",
        status === "healthy" &&
          "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
        status === "unhealthy" &&
          "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]",
        status === "unreachable" &&
          "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
      )}
    />
  );
}
