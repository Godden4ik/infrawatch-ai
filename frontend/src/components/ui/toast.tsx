"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToasts, removeToast, type Toast, type ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; className: string }
> = {
  success: {
    icon: <CheckCircle2 className="size-4 shrink-0" />,
    className:
      "border-emerald-500/30 bg-emerald-950/80 text-emerald-300",
  },
  error: {
    icon: <AlertCircle className="size-4 shrink-0" />,
    className: "border-red-500/30 bg-red-950/80 text-red-300",
  },
  info: {
    icon: <Info className="size-4 shrink-0" />,
    className: "border-blue-500/30 bg-blue-950/80 text-blue-300",
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { icon, className } = variantConfig[toast.variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex w-80 items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="mt-0.5 shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastViewport() {
  const toasts = useToasts();

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
