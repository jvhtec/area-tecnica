import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { NavigationItem } from "./SidebarNavigation"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBadge } from "./NotificationBadge"
import { AboutCard } from "./AboutCard"

interface MobileActionTrayProps {
  trayItems: NavigationItem[]
  renderTrigger: (open: boolean) => React.ReactNode
  onSignOut: () => Promise<void> | void
  isLoggingOut: boolean
  notificationProps?: {
    userId: string
    userRole: string
    userDepartment: string | null
  }
  userRole?: string
  userEmail?: string
}

export const MobileActionTray = ({
  trayItems,
  renderTrigger,
  onSignOut,
  isLoggingOut,
  notificationProps,
  userRole,
  userEmail,
}: MobileActionTrayProps) => {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

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
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-1">
              <AboutCard userRole={userRole} userEmail={userEmail} />
            </div>
            {trayItems.length > 0 && (
              <>
                <Separator className="bg-border/60" />
                <div className="grid grid-cols-2 gap-2">
                  {trayItems.map((item) => {
                    const Icon = item.icon
                    const isActive = item.isActive(pathname)

                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className={cn(
                          "h-full justify-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-3 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isActive && "border-primary/60 bg-primary/10 text-primary",
                        )}
                        data-active={isActive}
                        asChild
                      >
                        <Link
                          to={item.to}
                          onClick={handleNavigate}
                          aria-label={item.label}
                          aria-current={isActive ? "page" : undefined}
                          className="flex h-full flex-col items-center justify-center gap-2"
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                          <span className="text-center leading-tight">{item.mobileLabel}</span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="rounded-full px-2 py-0 text-[10px] font-semibold"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </Button>
                    )
                  })}
                </div>
              </>
            )}
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
