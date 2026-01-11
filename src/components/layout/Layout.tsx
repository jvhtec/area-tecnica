import { useEffect, useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate, Navigate, useSearchParams } from "react-router-dom"
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
import { useFlatPendingTasks } from "@/hooks/useFlatPendingTasks"
import { useAcknowledgedTasks } from "@/hooks/useAcknowledgedTasks"
import { PendingTasksModal } from "@/components/tasks/PendingTasksModal"
import { SingleTaskPopup } from "@/components/tasks/SingleTaskPopup"
import { PendingTasksBadge } from "@/components/tasks/PendingTasksBadge"

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

const PRIMARY_NAVIGATION_PROFILE_MAP: Record<string, readonly string[]> = {
  sound: [
    "management-department",
    "project-management",
    "tours",
    "festivals",
  ],
  lights: [
    "project-management",
    "management-department",
    "disponibilidad",
    "logistics",
  ],
  production: [
    "management-dashboard",
    "project-management",
    "logistics",
    "job-assignment-matrix",
  ],
}

interface SelectPrimaryNavigationItemsParams {
  items: NavigationItem[]
  userDepartment: string | null | undefined
  userRole: string | null | undefined
  maxPrimary?: number
}

export const selectPrimaryNavigationItems = ({
  items,
  userDepartment,
  userRole,
  maxPrimary = 4,
}: SelectPrimaryNavigationItemsParams): NavigationItem[] => {
  if (!items.length || maxPrimary <= 0) {
    return []
  }

  const normalizedDepartment = userDepartment?.toLowerCase() ?? null
  const normalizedRole = userRole?.toLowerCase() ?? null

  const customProfileIds =
    (normalizedDepartment && PRIMARY_NAVIGATION_PROFILE_MAP[normalizedDepartment]) ||
    (normalizedRole && PRIMARY_NAVIGATION_PROFILE_MAP[normalizedRole]) ||
    null

  const selected: NavigationItem[] = []
  const used = new Set<string>()

  const addItem = (item: NavigationItem | undefined) => {
    if (!item) {
      return
    }
    if (selected.length >= maxPrimary) {
      return
    }
    if (used.has(item.id)) {
      return
    }
    selected.push(item)
    used.add(item.id)
  }

  if (customProfileIds) {
    for (const id of customProfileIds) {
      if (selected.length >= maxPrimary) break
      const match = items.find((item) => item.id === id)
      if (match) {
        addItem(match)
      }
    }
  }

  if (selected.length < maxPrimary) {
    for (const item of items) {
      if (selected.length >= maxPrimary) break
      if (item.mobileSlot === "primary") {
        addItem(item)
      }
    }
  }

  const maxAllowed = Math.min(maxPrimary, items.length)
  if (selected.length < maxAllowed) {
    for (const item of items) {
      if (selected.length >= maxAllowed) break
      addItem(item)
    }
  }

  const profileItem = items.find((item) => item.id === "profile")
  const shouldConsiderProfile =
    !customProfileIds || selected.length < maxPrimary
  if (profileItem && shouldConsiderProfile && !used.has(profileItem.id)) {
    if (selected.length < maxPrimary) {
      selected.push(profileItem)
      used.add(profileItem.id)
    } else if (selected.length > 0) {
      const replaced = selected[selected.length - 1]
      used.delete(replaced.id)
      selected[selected.length - 1] = profileItem
      used.add(profileItem.id)
    }
  }

  return selected
}

const Layout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showPendingTasksModal, setShowPendingTasksModal] = useState(false)
  const [showSingleTaskPopup, setShowSingleTaskPopup] = useState(false)
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [aboutAutoOpen, setAboutAutoOpen] = useState(false)

  // Handle deeplink to open About card via URL param
  useEffect(() => {
    if (searchParams.get('showAbout') === '1') {
      setAboutAutoOpen(true)
      // Remove the param from URL after triggering
      searchParams.delete('showAbout')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const {
    session,
    userRole,
    userDepartment,
    hasSoundVisionAccess,
    assignableAsTech,
    isLoading,
    logout,
  } = useOptimizedAuth()

  // Synchronous redirect for technician users - prevent any Layout rendering.
  // Preserve showAbout query param for deeplinks.
  // Allow-list technician-accessible routes that still live under Layout (e.g. SysCalc).
  const isAllowedTechnicianLayoutRoute = location.pathname === '/syscalc'

  if (!isLoading && userRole === 'technician' && !isAllowedTechnicianLayoutRoute) {
    const showAboutParam = searchParams.get('showAbout')
    const redirectPath = showAboutParam ? `/tech-app?showAbout=${showAboutParam}` : '/tech-app'
    return <Navigate to={redirectPath} replace />;
  }

  const { requiredTables } = useRouteSubscriptions()
  const { forceSubscribe } = useSubscriptionContext()

  const userId = session?.user?.id ?? null

  // Fetch pending tasks for eligible roles
  const { data: flatPendingTasks } = useFlatPendingTasks(userId, userRole)

  // Track acknowledged tasks
  const { acknowledgedTaskIds, acknowledgeTask, clearAcknowledgedTasks, isTaskAcknowledged } =
    useAcknowledgedTasks(userId)

  // Filter out acknowledged tasks to get unacknowledged ones
  const unacknowledgedTasks = useMemo(() => {
    if (!flatPendingTasks) return []
    return flatPendingTasks.filter(task => !isTaskAcknowledged(task.id))
  }, [flatPendingTasks, isTaskAcknowledged])

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

  // Clean up acknowledged tasks that no longer exist in pending tasks
  useEffect(() => {
    if (!flatPendingTasks || !userId) return

    const currentTaskIds = new Set(flatPendingTasks.map(t => t.id))
    const acknowledgedToRemove: string[] = []

    acknowledgedTaskIds.forEach(taskId => {
      if (!currentTaskIds.has(taskId)) {
        acknowledgedToRemove.push(taskId)
      }
    })

    if (acknowledgedToRemove.length > 0) {
      clearAcknowledgedTasks(acknowledgedToRemove)
    }
  }, [flatPendingTasks, acknowledgedTaskIds, clearAcknowledgedTasks, userId])

  // Auto-open single task popup on login when there are unacknowledged tasks
  useEffect(() => {
    if (!userId || !userRole || isLoading) {
      return
    }

    // Only show for eligible roles
    const isEligibleRole = ['management', 'admin', 'logistics'].includes(userRole)
    if (!isEligibleRole) {
      return
    }

    // If there are unacknowledged tasks, show the first one
    if (unacknowledgedTasks && unacknowledgedTasks.length > 0) {
      // Small delay to avoid showing popup before UI is ready
      const timer = setTimeout(() => {
        setCurrentTaskIndex(0)
        setShowSingleTaskPopup(true)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [userId, userRole, unacknowledgedTasks, isLoading])

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

  const handleSingleTaskDismiss = () => {
    if (!unacknowledgedTasks || unacknowledgedTasks.length === 0) return

    // Acknowledge current task
    const currentTask = unacknowledgedTasks[currentTaskIndex]
    if (currentTask) {
      acknowledgeTask(currentTask.id)
    }

    // Move to next task or close popup
    if (currentTaskIndex + 1 < unacknowledgedTasks.length) {
      setCurrentTaskIndex(currentTaskIndex + 1)
    } else {
      setShowSingleTaskPopup(false)
      setCurrentTaskIndex(0)
    }
  }

  const handleViewAllTasks = () => {
    setShowSingleTaskPopup(false)
    setShowPendingTasksModal(true)
  }

  const handlePendingTasksBadgeClick = () => {
    setShowPendingTasksModal(true)
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
      assignableAsTech,
    }),
    [userRole, userDepartment, hasSoundVisionAccess, assignableAsTech],
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

  const primaryItems = useMemo(
    () =>
      selectPrimaryNavigationItems({
        items: sortedMobileItems,
        userDepartment,
        userRole,
      }),
    [sortedMobileItems, userDepartment, userRole],
  )

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

  // Routes that should be full-screen on mobile but have Layout on desktop
  const mobileFullscreenRoutes = useMemo(() => {
    const routes = ["/sound"]
    return isMobile && routes.some((route) => location.pathname.startsWith(route))
  }, [isMobile, location.pathname])

  const showSidebar = !isMobile || suppressChrome

  const showMobileNav =
    isMobile &&
    !suppressChrome &&
    !mobileFullscreenRoutes &&
    Boolean(userRole) &&
    (primaryItems.length > 0 || trayItems.length > 0)

  return (
    <SidebarProvider defaultOpen={showSidebar}>
      <div className="flex min-h-screen w-full bg-background">
        {showSidebar && (
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
                autoOpen={aboutAutoOpen}
                onAutoOpenHandled={() => setAboutAutoOpen(false)}
              />
              <SidebarSeparator />
              <div className="px-2 py-4">
                <img
                  src="/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png"
                  alt="Sector Pro Logo"
                  width={794}
                  height={100}
                  decoding="async"
                  className="h-6 w-auto max-w-[190px] dark:invert"
                  draggable="false"
                />
              </div>
            </SidebarFooter>
          </Sidebar>
        )}
        <div className="flex flex-1 min-w-0 flex-col">
          {!suppressChrome && !mobileFullscreenRoutes && (
            <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-3 pb-2 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.75rem))] shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {showSidebar && <SidebarTrigger className="h-9 w-9" />}
                  <HeaderStatus className="text-xs text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1.5">
                  {notificationProps && (
                    <NotificationBadge
                      {...notificationProps}
                      display="icon"
                    />
                  )}
                  {userId && userRole && ['management', 'admin', 'logistics'].includes(userRole) && (
                    <PendingTasksBadge
                      userId={userId}
                      userRole={userRole}
                      onClick={handlePendingTasksBadgeClick}
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
              "flex-1 min-w-0 w-full overflow-y-auto px-3 pt-4 sm:px-6 sm:pt-6",
              suppressChrome || mobileFullscreenRoutes
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
          onSignOut={handleSignOut}
          isLoggingOut={isLoggingOut}
          notificationProps={notificationProps}
          userRole={userRole ?? undefined}
          userEmail={session.user?.email ?? undefined}
        />
      )}
      <PendingTasksModal
        open={showPendingTasksModal}
        onOpenChange={setShowPendingTasksModal}
        userId={userId}
        userRole={userRole}
      />
      {unacknowledgedTasks && unacknowledgedTasks.length > 0 && (
        <SingleTaskPopup
          open={showSingleTaskPopup}
          onOpenChange={setShowSingleTaskPopup}
          task={unacknowledgedTasks[currentTaskIndex] || null}
          jobOrTourName={unacknowledgedTasks[currentTaskIndex]?.jobOrTourName || ''}
          jobOrTourType={unacknowledgedTasks[currentTaskIndex]?.jobOrTourType || 'job'}
          client={unacknowledgedTasks[currentTaskIndex]?.client}
          onDismiss={handleSingleTaskDismiss}
          onViewAll={handleViewAllTasks}
          totalPendingCount={unacknowledgedTasks.length}
          currentIndex={currentTaskIndex}
        />
      )}
    </SidebarProvider>
  )
}

export default Layout
