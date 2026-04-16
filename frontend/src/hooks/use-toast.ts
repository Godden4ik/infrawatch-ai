import { useSyncExternalStore } from "react";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
};

type Listener = () => void;

const EMPTY_TOASTS: Toast[] = [];
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Toast[] {
  return toasts;
}

function addToast(variant: ToastVariant, message: string, duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const t: Toast = { id, variant, message, duration };
  toasts = [...toasts, t];
  notify();
  setTimeout(() => {
    removeToast(id);
  }, duration);
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export const toast = {
  success: (message: string, duration?: number) =>
    addToast("success", message, duration),
  error: (message: string, duration?: number) =>
    addToast("error", message, duration),
  info: (message: string, duration?: number) =>
    addToast("info", message, duration),
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_TOASTS);
}
