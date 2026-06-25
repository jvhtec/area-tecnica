import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shared empty-state primitive.
 *
 * Standardizes the "no hay resultados" / "sin datos" treatment that is
 * currently reimplemented ad hoc across lists and tables
 * (see docs/UI_UX_AUDIT.md, M-9). Pairs an optional icon, a title, an optional
 * description, and an optional call-to-action in a consistent, token-themed
 * layout that works in light and dark mode.
 *
 * @example
 * <EmptyState
 *   icon={Inbox}
 *   title="No hay trabajos"
 *   description="Cuando se creen trabajos aparecerán aquí."
 *   action={<Button onClick={onCreate}>Crear trabajo</Button>}
 * />
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  ),
)
EmptyState.displayName = "EmptyState"
