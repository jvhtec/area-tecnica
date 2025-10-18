import * as React from "react"

import { cn } from "@/lib/utils"
import { GlassSurface, type GlassSurfaceProps } from "./GlassSurface"

export interface GlassSupportProps {
  glassDisabled?: boolean
  glassSurfaceClassName?: string
  glassContentClassName?: string
  mobileOptions?: GlassSurfaceProps["mobileOptions"]
}

export function withGlassSupport<P extends { className?: string }>(
  Component: React.ComponentType<P>,
  surfaceDefaults?: Partial<GlassSurfaceProps>,
) {
  type Props = Omit<P, keyof GlassSupportProps> & GlassSupportProps

  const GlassEnhanced = React.forwardRef<unknown, Props>((props, ref) => {
    const {
      glassDisabled,
      glassSurfaceClassName,
      glassContentClassName,
      mobileOptions,
      className,
      ...rest
    } = props as Props & { className?: string }

    const componentProps = rest as P

    return (
      <GlassSurface
        {...surfaceDefaults}
        className={cn(surfaceDefaults?.className, glassSurfaceClassName)}
        contentClassName={cn(surfaceDefaults?.contentClassName, glassContentClassName)}
        disabled={glassDisabled ?? surfaceDefaults?.disabled}
        mobileOptions={{ ...surfaceDefaults?.mobileOptions, ...mobileOptions }}
      >
        <Component
          {...componentProps}
          ref={ref as React.Ref<any>}
          className={cn("relative z-[1]", className)}
        />
      </GlassSurface>
    )
  })

  GlassEnhanced.displayName = `withGlassSupport(${Component.displayName ?? Component.name ?? "Component"})`

  return GlassEnhanced
}
