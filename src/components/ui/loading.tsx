import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shared loading primitives.
 *
 * Replaces the ad-hoc `<Loader2 className="animate-spin" />` spinners scattered
 * across the app (see docs/UI_UX_AUDIT.md, H-6 / M-5). All variants expose an
 * accessible status region so screen readers announce loading transitions
 * (WCAG 4.1.3), and the spinner is paused under `prefers-reduced-motion` via the
 * global rule in index.css.
 */

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
} as const

export type SpinnerSize = keyof typeof spinnerSizes

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize
}

/** Bare animated spinner. Prefer <Loading> when there is a status to announce. */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = "md", className, ...props }, ref) => (
    <span ref={ref} className={cn("inline-flex", className)} {...props}>
      <Loader2 className={cn("animate-spin text-muted-foreground", spinnerSizes[size])} aria-hidden="true" />
    </span>
  ),
)
Spinner.displayName = "Spinner"

export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible + visible label. Defaults to the Spanish "Cargando…". */
  label?: string
  /** Hide the visible label but keep it announced to assistive tech. */
  hideLabel?: boolean
  size?: SpinnerSize
}

/**
 * Inline loading indicator with an accessible status label.
 *
 * @example
 * <Loading label="Cargando trabajos…" />
 */
export const Loading = React.forwardRef<HTMLDivElement, LoadingProps>(
  ({ label = "Cargando…", hideLabel = false, size = "md", className, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", className)}
      {...props}
    >
      <Spinner size={size} />
      <span className={cn(hideLabel && "sr-only")}>{label}</span>
    </div>
  ),
)
Loading.displayName = "Loading"

export interface PageLoadingProps extends Omit<LoadingProps, "size"> {
  /** Minimum vertical space the loader fills. Defaults to 50vh. */
  minHeightClassName?: string
}

/**
 * Full-section loading state for route/page fallbacks.
 *
 * @example
 * <Suspense fallback={<PageLoading />}>…</Suspense>
 */
export const PageLoading = React.forwardRef<HTMLDivElement, PageLoadingProps>(
  ({ label = "Cargando…", minHeightClassName = "min-h-[50vh]", className, ...props }, ref) => (
    <div ref={ref} className={cn("flex w-full items-center justify-center", minHeightClassName, className)}>
      <Loading label={label} size="lg" {...props} />
    </div>
  ),
)
PageLoading.displayName = "PageLoading"
