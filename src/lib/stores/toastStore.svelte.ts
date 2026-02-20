// Simple toast notification store using Svelte 5 runes

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

export function getToasts(): Toast[] {
  return toasts;
}

export function addToast(
  message: string,
  type: ToastType = "info",
  duration = 3000
): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, type, duration }];

  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
}

export function removeToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
}

// Convenience helpers
export function toastInfo(message: string, duration = 3000): void {
  addToast(message, "info", duration);
}

export function toastSuccess(message: string, duration = 2500): void {
  addToast(message, "success", duration);
}

export function toastWarning(message: string, duration = 4000): void {
  addToast(message, "warning", duration);
}

export function toastError(message: string, duration = 5000): void {
  addToast(message, "error", duration);
}
