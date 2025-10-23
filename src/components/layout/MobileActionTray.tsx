import { useState } from "react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

import { SidebarNavigation, SidebarNavigationProps } from "./SidebarNavigation"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBadge } from "./NotificationBadge"

interface MobileActionTrayProps {
  navigationProps: SidebarNavigationProps
  renderTrigger: (open: boolean) => React.ReactNode
  onSignOut: () => Promise<void> | void
  isLoggingOut: boolean
  notificationProps?: {
    userId: string
    userRole: string
    userDepartment: string | null
  }
}

export const MobileActionTray = ({
  navigationProps,
  renderTrigger,
  onSignOut,
  isLoggingOut,
  notificationProps,
}: MobileActionTrayProps) => {
  const [open, setOpen] = useState(false)

  const handleNavigate = () => {
    setOpen(false)
  }

  const handleSignOut = async () => {
    await onSignOut()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{renderTrigger(open)}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex h-[75vh] flex-col overflow-hidden rounded-t-3xl border-none bg-background px-0 pb-0 shadow-2xl [&>[data-radix-dialog-close]]:hidden"
      >
        <div className="mt-1 flex justify-center">
          <span className="mb-2 h-1.5 w-16 rounded-full bg-muted" aria-hidden="true" />
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <div className="space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <ThemeToggle className="w-full" />
            {notificationProps && (
              <NotificationBadge
                {...notificationProps}
                display="sidebar"
                className="w-full justify-start"
              />
            )}
            <Separator className="bg-border/60" />
            <SidebarNavigation {...navigationProps} onNavigate={handleNavigate} />
            <Separator className="bg-border/60" />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-center gap-2 py-4 text-base font-semibold"
              onClick={handleSignOut}
              disabled={isLoggingOut}
            >
              <LogOut className="h-5 w-5" />
              <span>{isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
