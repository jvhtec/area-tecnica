import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Promise-based confirmation dialog.
 *
 * Replaces blocking, unstyled `window.confirm` calls (see docs/UI_UX_AUDIT.md,
 * M-1) with a themed, accessible AlertDialog while keeping call sites nearly
 * identical:
 *
 *   if (!window.confirm("¿Eliminar?")) return
 *   // becomes
 *   if (!(await confirm({ description: "¿Eliminar?" }))) return
 *
 * Mount <ConfirmDialogProvider> once near the app root, then call useConfirm().
 */

export interface ConfirmOptions {
  title?: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** Style the confirm action as destructive (red). */
  destructive?: boolean
}

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingState | null>(null)
  // Mirror of `pending` for reading the in-flight request synchronously without
  // adding it to callback deps (which would churn the context value identity).
  const pendingRef = React.useRef<PendingState | null>(null)

  const settle = React.useCallback((value: boolean) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    // Resolve outside the state updater so the promise settles as a plain
    // side effect rather than during render (StrictMode-safe).
    current?.resolve(value)
  }, [])

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // If a request is already in flight, settle it as a cancel first so its
      // promise never leaks unresolved when a new confirm() overwrites it.
      pendingRef.current?.resolve(false)
      const next: PendingState = { ...options, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          // Closing via overlay/escape counts as a cancel.
          if (!open) settle(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title ?? "¿Confirmar acción?"}</AlertDialogTitle>
            {pending?.description && (
              <AlertDialogDescription>{pending.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {pending?.cancelText ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(pending?.destructive && buttonVariants({ variant: "destructive" }))}
              onClick={() => settle(true)}
            >
              {pending?.confirmText ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

/**
 * Returns an async `confirm(options)` that resolves to true/false.
 * Throws if used outside <ConfirmDialogProvider>.
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider")
  }
  return ctx
}
