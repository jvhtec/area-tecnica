import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "../card"
import { GlassSurface, type GlassSurfaceProps } from "./GlassSurface"

export interface GlassCardProps extends React.ComponentProps<typeof Card> {
  glassDisabled?: boolean
  glassSurfaceClassName?: string
  glassContentClassName?: string
  mobileOptions?: GlassSurfaceProps["mobileOptions"]
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    { className, glassDisabled, glassSurfaceClassName, glassContentClassName, mobileOptions, ...props },
    ref,
  ) => {
    return (
      <GlassSurface
        className={cn("glass-card-surface", glassSurfaceClassName)}
        contentClassName={cn("flex h-full w-full flex-col", glassContentClassName)}
        disabled={glassDisabled}
        mobileOptions={{ allowDesktop: true, ...mobileOptions }}
        displacementScale={0.6}
        blurAmount={20}
        cornerRadius={22}
      >
        <Card
          ref={ref}
          className={cn(
            "relative z-[2] h-full border-transparent bg-transparent shadow-none",
            className,
          )}
          {...props}
        />
      </GlassSurface>
    )
  },
)

GlassCard.displayName = "GlassCard"
