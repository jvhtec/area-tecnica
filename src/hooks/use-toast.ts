import { toast as sonnerToast } from "sonner";
import * as React from "react";

/**
 * Toast API — single notification system (Sonner).
 *
 * This module is the shadcn-compatible `useToast()` / `toast()` surface, but it
 * renders entirely through **Sonner** (the one mounted `<Toaster>`). It exists so
 * the ~200 existing `toast({ title, description, variant })` call sites keep
 * working unchanged while there is only one toast system app-wide
 * (docs/UI_UX_AUDIT.md, H-2). New code may import `toast` from here or directly
 * from `sonner` — both render the same way.
 */

export type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

export interface ToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  // Accept any string (keeps autocomplete for known variants) so callers typed
  // loosely (e.g. PDF export `variant?: string`) stay compatible.
  variant?: ToastVariant | (string & {});
  id?: string | number;
  duration?: number;
  action?: unknown;
  [key: string]: unknown;
}

type SonnerToast = typeof sonnerToast;

// Callable form: supports the shadcn object signature
// (`{ title, description, variant }`) and plain string/element, mapping the
// `variant` to the matching Sonner method.
function baseToast(input: ToastInput | string | React.ReactNode) {
  if (typeof input === "string" || React.isValidElement(input)) {
    return sonnerToast(input as React.ReactNode);
  }

  const { title, description, variant, ...rest } = (input ?? {}) as ToastInput;
  const options = { description, ...rest } as Record<string, unknown>;

  switch (variant) {
    case "destructive":
      return sonnerToast.error(title as React.ReactNode, options);
    case "success":
      return sonnerToast.success(title as React.ReactNode, options);
    case "warning":
      return sonnerToast.warning(title as React.ReactNode, options);
    case "info":
      return sonnerToast.info(title as React.ReactNode, options);
    default:
      return sonnerToast(title as React.ReactNode, options);
  }
}

// Expose Sonner's full method surface so existing helper-style calls
// (`toast.success/error/warning/info/loading/message/promise/dismiss/custom`)
// keep working unchanged.
const toast = Object.assign(baseToast, {
  success: sonnerToast.success,
  error: sonnerToast.error,
  warning: sonnerToast.warning,
  info: sonnerToast.info,
  message: sonnerToast.message,
  loading: sonnerToast.loading,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
}) as typeof baseToast &
  Pick<
    SonnerToast,
    "success" | "error" | "warning" | "info" | "message" | "loading" | "promise" | "dismiss" | "custom"
  >;

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { toast, useToast };
