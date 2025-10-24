import React from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ReloadButtonProps {
  onReload: () => Promise<void>
  className?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  ariaLabel?: string
}

export const ReloadButton = ({
  onReload,
  className,
  variant = "outline",
  size = "icon",
  ariaLabel,
}: ReloadButtonProps) => {
  const { toast } = useToast()
  const [isReloading, setIsReloading] = React.useState(false)

  const handleReload = async () => {
    try {
      setIsReloading(true)
      await onReload()
      toast({
        title: "Reloaded",
        description: "Data has been refreshed successfully",
      })
    } catch (error) {
      console.error("Error reloading data:", error)
      toast({
        title: "Error",
        description: "Failed to reload data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsReloading(false)
    }
  }

  const computedLabel = ariaLabel ?? "Reload data"

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleReload}
      disabled={isReloading}
      className={cn("shrink-0", className)}
      aria-label={computedLabel}
      title={computedLabel}
    >
      <RefreshCw className={cn("h-4 w-4", isReloading && "animate-spin")} />
    </Button>
  )
}
