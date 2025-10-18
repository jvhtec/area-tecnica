import * as React from "react"
import LiquidGlass from "liquid-glass-react"

import { cn } from "@/lib/utils"
import { useGlassOnMobile, type UseGlassOnMobileOptions } from "@/hooks/use-glass-on-mobile"
import { useGlassMotion } from "@/providers/GlassMotionProvider"

export type GlassSurfaceVariant = "light" | "dark"

export interface GlassSurfaceProps
  extends Omit<React.ComponentProps<typeof LiquidGlass>, "children" | "className" | "globalMousePos"> {
  children: React.ReactNode
  /** Optional class applied to the outer LiquidGlass wrapper. */
  className?: string
  /** Optional class applied to the inner content wrapper. */
  contentClassName?: string
  /** Optional class merged with the fallback wrapper when glass is disabled. */
  fallbackClassName?: string
  /** Force-disable the effect regardless of heuristics. */
  disabled?: boolean
  /** Visual variant to align with background context. */
  variant?: GlassSurfaceVariant
  /** Apply a more elevated drop shadow. */
  elevated?: boolean
  /** Disable the procedural noise overlay. */
  disableNoise?: boolean
  /** Forwarded options used to determine if the glass effect should render. */
  mobileOptions?: UseGlassOnMobileOptions
}

export const GlassSurface = React.forwardRef<HTMLDivElement, GlassSurfaceProps>(
  (
    {
      children,
      className,
      contentClassName,
      fallbackClassName,
      disabled = false,
      variant = "light",
      elevated = false,
      disableNoise = false,
      mobileOptions,
      displacementScale = 0.9,
      blurAmount = 18,
      saturation = 1.05,
      aberrationIntensity = 0.07,
      elasticity = 0.65,
      cornerRadius = 18,
      ...rest
    },
    ref,
  ) => {
    const glassEnabled = useGlassOnMobile({ allowDesktop: true, ...mobileOptions })
    const { position, intensity } = useGlassMotion()

    const shouldRenderShader = glassEnabled && !disabled

    const surfaceClasses = cn(
      "glass-surface-base",
      variant === "dark"
        ? "bg-glass-surface-dark text-glass-foreground-dark border-glass-border-strong shadow-glass-dark"
        : "bg-glass-surface text-glass-foreground border-glass-border shadow-glass-light",
      !disableNoise && "glass-surface-noise",
      "glass-surface-highlight",
      elevated && "ring-1 ring-inset ring-white/10",
      className,
    )

    const contentClasses = cn("relative z-[1]", contentClassName)

    if (!shouldRenderShader) {
      return (
        <div ref={ref} className={cn(surfaceClasses, fallbackClassName)}>
          <div className={contentClasses}>{children}</div>
        </div>
      )
    }

    return (
      <LiquidGlass
        displacementScale={displacementScale * (1 + intensity * 0.15)}
        blurAmount={blurAmount}
        saturation={saturation}
        aberrationIntensity={aberrationIntensity}
        elasticity={elasticity}
        cornerRadius={cornerRadius}
        globalMousePos={position}
        className={surfaceClasses}
        {...rest}
      >
        <div ref={ref} className={contentClasses}>
          {children}
        </div>
      </LiquidGlass>
    )
  },
)

GlassSurface.displayName = "GlassSurface"
