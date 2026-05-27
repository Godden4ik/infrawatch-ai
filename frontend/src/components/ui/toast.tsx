"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToasts, removeToast, type Toast, type ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ToastVariantConfig = {
  icon: React.ReactNode;
  className: string;
  eyebrow: string;
};

const variantConfig: Record<ToastVariant, ToastVariantConfig> = {
  success: {
    icon: <CheckCircle2 className="size-4 shrink-0" />,
    className: "border-status-healthy/30 bg-status-healthy-soft text-status-healthy",
    eyebrow: "Success",
  },
  error: {
    icon: <AlertCircle className="size-4 shrink-0" />,
    className: "border-status-critical/30 bg-status-critical-soft text-status-critical",
    eyebrow: "Error",
  },
  info: {
    icon: <Info className="size-4 shrink-0" />,
    className: "border-brand/30 bg-brand-soft text-brand",
    eyebrow: "Info",
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const config = variantConfig[toast.variant] ?? {
    icon: <Info className="size-4 shrink-0" />,
    className: "border-border bg-card text-foreground",
    eyebrow: "Notice",
  };
  const { icon, className, eyebrow } = config;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "flex w-80 items-start gap-3 rounded-sm border px-3 py-2.5",
        className,
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
          {eyebrow}
        </span>
        <p className="text-sm leading-snug text-foreground">{toast.message}</p>
      </div>
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
