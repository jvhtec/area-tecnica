import { useEffect, useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { HeaderStatus } from "@/components/ui/header-status"
import { ReloadButton } from "@/components/ui/reload-button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth"
import { useActivityRealtime } from "@/features/activity/hooks/useActivityRealtime"
import { useRouteSubscriptions } from "@/hooks/useRouteSubscriptions"
import { useSubscriptionContext } from "@/providers/SubscriptionProvider"
import { getDashboardPath } from "@/utils/roleBasedRouting"
import type { UserRole } from "@/types/user"
import { cn } from "@/lib/utils"

import { AboutCard } from "./AboutCard"
import { HelpButton } from "./HelpButton"
import { MobileNavBar } from "./MobileNavBar"
import { NotificationBadge } from "./NotificationBadge"
import {
  NavigationItem,
  SidebarNavigation,
  SidebarNavigationProps,
  buildNavigationItems,
} from "./SidebarNavigation"
import { ThemeToggle } from "./ThemeToggle"
import { UserInfo } from "./UserInfo"

const Layout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const {
    session,
    userRole,
    userDepartment,
    hasSoundVisionAccess,
    isLoading,
    logout,
  } = useOptimizedAuth()

  const { requiredTables } = useRouteSubscriptions()
  const { forceSubscribe } = useSubscriptionContext()

  const userId = session?.user?.id ?? null

  useActivityRealtime({
    userId: session?.user?.id,
  })

  useEffect(() => {
    if (requiredTables.length > 0) {
      const subscriptionObjects = requiredTables.map((table) => ({
        table,
        queryKey: table,
      }))
      forceSubscribe(subscriptionObjects)
    }
  }, [requiredTables, forceSubscribe])

  useEffect(() => {
    if (isLoading || !session) {
      return
    }

    if (location.pathname === "/" || location.pathname === "/dashboard") {
      const dashboardPath = getDashboardPath((userRole as UserRole | null) ?? null)
      if (dashboardPath && dashboardPath !== location.pathname) {
        navigate(dashboardPath, { replace: true })
      }
    }
  }, [isLoading, session, userRole, location.pathname, navigate])

  const handleSignOut = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error("Error during sign out:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleReload = async () => {
    await queryClient.refetchQueries()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
      </div>
    )
  }

  if (!session) {
    navigate("/auth", { replace: true })
    return null
  }

  const navigationProps = useMemo<SidebarNavigationProps>(
    () => ({
      userRole,
      userDepartment,
      hasSoundVisionAccess,
    }),
    [userRole, userDepartment, hasSoundVisionAccess],
  )

  const navigationItems = useMemo(
    () => buildNavigationItems(navigationProps),
    [navigationProps],
  )

  const sortedMobileItems = useMemo(() => {
    if (navigationItems.length <= 1) {
      return navigationItems
    }

    return [...navigationItems].sort(
      (a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99),
    )
  }, [navigationItems])

  const primaryItems = useMemo(() => {
    const maxPrimary = 4
    if (!sortedMobileItems.length) {
      return []
    }

    const selected: NavigationItem[] = []
    const used = new Set<string>()

    for (const item of sortedMobileItems) {
      if (selected.length >= maxPrimary) break
      if (item.mobileSlot === "primary") {
        selected.push(item)
        used.add(item.id)
      }
    }

    for (const item of sortedMobileItems) {
      if (selected.length >= Math.min(maxPrimary, sortedMobileItems.length)) {
        break
      }
      if (!used.has(item.id)) {
        selected.push(item)
        used.add(item.id)
      }
    }

    const profileItem = sortedMobileItems.find((item) => item.id === "profile")
    if (profileItem && !used.has(profileItem.id)) {
      if (selected.length < maxPrimary) {
        selected.push(profileItem)
      } else if (selected.length > 0) {
        const replaced = selected[selected.length - 1]
        used.delete(replaced.id)
        selected[selected.length - 1] = profileItem
      }
      used.add(profileItem.id)
    }

    return selected
  }, [sortedMobileItems])

  const trayItems = useMemo(() => {
    if (!sortedMobileItems.length) {
      return []
    }
    const used = new Set(primaryItems.map((item) => item.id))
    return sortedMobileItems.filter((item) => !used.has(item.id))
  }, [sortedMobileItems, primaryItems])

  const notificationProps = useMemo(() => {
    if (!userId || !userRole) {
      return undefined
    }
    return {
      userId,
      userRole,
      userDepartment: userDepartment ?? null,
    }
  }, [userId, userRole, userDepartment])

  const suppressChrome = useMemo(() => {
    const suppressedPrefixes = ["/wallboard"]
    if (suppressedPrefixes.some((prefix) => location.pathname.startsWith(prefix))) {
      return true
    }

    if (!location.search) {
      return false
    }

    const params = new URLSearchParams(location.search)
    const fullscreenParam = params.get("fullscreen")?.toLowerCase()
    return fullscreenParam === "1" || fullscreenParam === "true"
  }, [location.pathname, location.search])

  const showMobileNav =
    isMobile &&
    !suppressChrome &&
    Boolean(userRole) &&
    (primaryItems.length > 0 || trayItems.length > 0)

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border/50 bg-sidebar text-sidebar-foreground">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarNavigation {...navigationProps} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <ThemeToggle className="w-full" />
            <UserInfo />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={handleSignOut}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4" />
              <span>{isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</span>
            </Button>
            <AboutCard
              userRole={userRole ?? undefined}
              userEmail={session.user?.email ?? undefined}
            />
            <SidebarSeparator />
            <div className="px-2 py-4">
              <img
                src="/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png"
                alt="Sector Pro Logo"
                className="h-6 w-auto dark:invert"
                draggable="false"
              />
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-1 flex-col">
          {!suppressChrome && (
            <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-3 pb-2 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.75rem))] shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="h-9 w-9" />
                  <HeaderStatus className="text-xs text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1.5">
                  {notificationProps && (
                    <NotificationBadge
                      {...notificationProps}
                      display="icon"
                    />
                  )}
                  <ThemeToggle display="icon" />
                  <ReloadButton
                    onReload={handleReload}
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    ariaLabel="Recargar datos"
                  />
                  <HelpButton />
                </div>
              </div>
            </header>
          )}
          <main
            className={cn(
              "flex-1 overflow-y-auto px-3 pt-4 sm:px-6 sm:pt-6",
              suppressChrome
                ? "pb-6"
                : isMobile
                  ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
                  : "pb-10",
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>
      {showMobileNav && (
        <MobileNavBar
          primaryItems={primaryItems}
          trayItems={trayItems}
          navigationProps={navigationProps}
          onSignOut={handleSignOut}
          isLoggingOut={isLoggingOut}
          notificationProps={notificationProps}
        />
      )}
    </SidebarProvider>
  )
}

export default Layout
