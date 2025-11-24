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
      className="fixed inset-x-0 bottom-0 z-40 bg-[#05070a]/95 backdrop-blur-xl border-t border-[#1f232e] px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.5)] md:hidden"
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
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070a]",
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#151820]",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-blue-400")} aria-hidden="true" />
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
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold text-[#94a3b8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070a] hover:text-white hover:bg-[#151820]",
                  (open || activeInTray) && "bg-blue-600/20 text-blue-400",
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
