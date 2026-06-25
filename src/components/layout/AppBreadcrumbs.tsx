import { Fragment, useMemo } from "react"
import { Link, useLocation } from "react-router-dom"
import { Home } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth"
import { getBreadcrumbsForPathname } from "@/routes/app-route-manifest"
import { getDashboardPath } from "@/utils/roleBasedRouting"
import type { UserRole } from "@/types/user"
import { cn } from "@/lib/utils"

type Crumb = { label: string; path: string }

/**
 * Renders the breadcrumb trail for the active route, driven entirely by the
 * `breadcrumb` config on the route manifest. A role-aware "home" crumb is
 * prepended so every page exposes a working path back up the hierarchy instead
 * of relying on per-page back buttons (which were inconsistent or absent).
 */
export const AppBreadcrumbs = ({ className }: { className?: string }) => {
  const location = useLocation()
  const { userRole } = useOptimizedAuth()

  const crumbs = useMemo<Crumb[]>(() => {
    const routeCrumbs = getBreadcrumbsForPathname(location.pathname)

    if (routeCrumbs.length === 0) {
      return []
    }

    const homePath = getDashboardPath((userRole as UserRole | null) ?? null)
    const home: Crumb = { label: "Inicio", path: homePath }

    // Avoid a duplicate home link when the route already roots at the dashboard.
    const trail =
      routeCrumbs[0]?.path === homePath ? routeCrumbs : [home, ...routeCrumbs]

    return trail
  }, [location.pathname, userRole])

  // Nothing useful to show for a lone crumb (e.g. the dashboard itself).
  if (crumbs.length <= 1) {
    return null
  }

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap overflow-x-auto">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          const isHome = index === 0

          return (
            <Fragment key={`${crumb.path}-${index}`}>
              <BreadcrumbItem className="shrink-0">
                {isLast ? (
                  <BreadcrumbPage className="max-w-[40vw] truncate sm:max-w-none">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.path}
                      className="inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      {isHome && <Home className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span className="max-w-[28vw] truncate sm:max-w-none">
                        {crumb.label}
                      </span>
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="shrink-0" />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default AppBreadcrumbs
