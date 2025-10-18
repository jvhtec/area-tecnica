import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { GlassSurface, type GlassSurfaceProps } from "./GlassSurface"

export {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "../sheet"

const glassSheetVariants = cva(
  "fixed z-50 gap-4 p-0 transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
)

export interface GlassSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof glassSheetVariants> {
  glassDisabled?: boolean
  glassSurfaceProps?: Partial<GlassSurfaceProps>
  glassSurfaceClassName?: string
  glassContentClassName?: string
}

export const GlassSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  GlassSheetContentProps
>(({ side = "right", className, children, glassDisabled, glassSurfaceProps, glassSurfaceClassName, glassContentClassName, ...props }, ref) => {
  const {
    className: surfaceClassName,
    contentClassName: surfaceContentClassName,
    mobileOptions: surfaceMobileOptions,
    displacementScale,
    blurAmount,
    cornerRadius,
    variant,
    disabled: surfaceDisabled,
    ...surfaceRest
  } = glassSurfaceProps ?? {}


  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md" />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          glassSheetVariants({ side }),
          "z-50 overflow-hidden border-0 bg-transparent shadow-none",
          className,
        )}
        {...props}
      >
        <GlassSurface
          {...surfaceRest}
          variant={variant ?? "dark"}
          displacementScale={displacementScale ?? 0.55}
          blurAmount={blurAmount ?? 26}
          cornerRadius={cornerRadius ?? (side === "bottom" || side === "top" ? 24 : 28)}
          mobileOptions={{ allowDesktop: true, ...surfaceMobileOptions }}
          className={cn("h-full w-full", surfaceClassName, glassSurfaceClassName)}
          contentClassName={cn(
            "relative flex h-full w-full flex-col",
            surfaceContentClassName,
            glassContentClassName,
          )}
          disabled={glassDisabled ?? surfaceDisabled}
        >
          <div className="flex-1 overflow-y-auto">{children}</div>
          <SheetPrimitive.Close className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </GlassSurface>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
})

GlassSheetContent.displayName = SheetPrimitive.Content.displayName
