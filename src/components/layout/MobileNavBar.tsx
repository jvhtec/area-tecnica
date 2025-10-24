import { Link, useLocation } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

import { NavigationItem } from "./SidebarNavigation"
import { MobileActionTray } from "./MobileActionTray"

interface MobileNavBarProps {
  primaryItems: NavigationItem[]
  trayItems: NavigationItem[]
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

export const MobileNavBar = ({
  primaryItems,
  trayItems,
  onSignOut,
  isLoggingOut,
  notificationProps,
  userRole,
  userEmail,
}: MobileNavBarProps) => {
  const { pathname } = useLocation()
  const hasNavigation = primaryItems.length > 0 || trayItems.length > 0
  // Always render the tray trigger so persistent actions like Sign Out and About
  // remain accessible for all roles, even when there are no additional tray items.
  const shouldShowTrayTrigger = true

  if (!hasNavigation) {
    return null
  }

  const activeInTray = trayItems.some((item) => item.isActive(pathname))

  return (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(2,6,23,0.18)] backdrop-blur supports-[backdrop-filter]:backdrop-blur md:hidden"
    >
      <div className="mx-auto flex w-full max-w-3xl items-stretch justify-evenly gap-1">
        {primaryItems.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive(pathname)

          return (
            <Link
              key={item.id}
              to={item.to}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} aria-hidden="true" />
              <span className="max-w-[5rem] truncate">{item.mobileLabel}</span>
            </Link>
          )
        })}
        {shouldShowTrayTrigger && (
          <MobileActionTray
            trayItems={trayItems}
            onSignOut={onSignOut}
            isLoggingOut={isLoggingOut}
            notificationProps={notificationProps}
            userRole={userRole}
            userEmail={userEmail}
            renderTrigger={(open) => (
              <button
                type="button"
                aria-label="Más opciones"
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  (open || activeInTray) && "bg-primary/10 text-primary",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-[5rem] truncate">Más</span>
              </button>
            )}
          />
        )}
      </div>
    </nav>
  )
}
