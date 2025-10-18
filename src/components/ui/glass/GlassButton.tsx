import * as React from "react"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "../button"
import { GlassSurface, type GlassSurfaceProps } from "./GlassSurface"

export interface GlassButtonProps extends ButtonProps {
  glassDisabled?: boolean
  glassSurfaceClassName?: string
  glassContentClassName?: string
  mobileOptions?: GlassSurfaceProps["mobileOptions"]
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      glassDisabled,
      glassSurfaceClassName,
      glassContentClassName,
      mobileOptions,
      size,
      variant = "ghost",
      ...props
    },
    ref,
  ) => {
    const radius = size === "sm" ? 14 : size === "lg" ? 22 : size === "icon" ? 999 : 18

    return (
      <GlassSurface
        className={cn("inline-flex h-full w-full items-stretch", glassSurfaceClassName)}
        contentClassName={cn("inline-flex w-full", glassContentClassName)}
        disabled={glassDisabled}
        cornerRadius={radius}
        displacementScale={0.7}
        blurAmount={16}
        aberrationIntensity={0.05}
        mobileOptions={{ allowDesktop: true, ...mobileOptions }}
      >
        <Button
          ref={ref}
          size={size}
          variant={variant}
          className={cn(
            "relative z-[2] h-full w-full justify-center border-0 bg-transparent text-current shadow-none transition-transform duration-200 hover:-translate-y-px",
            "focus-visible:ring-offset-0",
            className,
          )}
          {...props}
        />
      </GlassSurface>
    )
  },
)

GlassButton.displayName = "GlassButton"
