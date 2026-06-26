import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Submit/action button with a built-in async guard.
 *
 * Prevents double-submit and gives consistent loading feedback for the many
 * mutations that currently wire `disabled={isPending}` by hand or not at all
 * (see docs/UI_UX_AUDIT.md, L-2 / H-4). While `loading` is true the button is
 * disabled, shows a spinner, and sets `aria-busy` so assistive tech is informed.
 *
 * @example
 * <SubmitButton loading={mutation.isPending} loadingText="Guardando…">
 *   Guardar
 * </SubmitButton>
 */
export interface SubmitButtonProps extends ButtonProps {
  loading?: boolean
  /** Optional text shown while loading. Falls back to the button's children. */
  loadingText?: React.ReactNode
}

export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ loading = false, loadingText, disabled, children, className, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading && loadingText ? loadingText : children}
    </Button>
  ),
)
SubmitButton.displayName = "SubmitButton"
