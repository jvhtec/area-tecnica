import { useMemo, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  Database,
  Euro,
  FileText,
  Grid3X3,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Megaphone,
  Music2,
  Settings,
  SlidersHorizontal,
  Tent,
  Truck,
  UserCircle,
  Video,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { SidebarNavigationSkeleton } from "./SidebarNavigationSkeleton"

export interface NavigationContext {
  userRole: string | null
  userDepartment?: string | null
  hasSoundVisionAccess: boolean
}

export interface SidebarNavigationProps extends NavigationContext {
  onNavigate?: () => void
}

export interface NavigationItem {
  id: string
  label: string
  mobileLabel: string
  to: string
  icon: LucideIcon
  mobilePriority?: number
  mobileSlot: "primary" | "secondary"
  isActive: (pathname: string) => boolean
  badge?: ReactNode
}

type LabelSource = string | ((context: NavigationContext) => string | null)
type IconSource = LucideIcon | ((context: NavigationContext) => LucideIcon | null)

interface NavigationItemConfig {
  id: string
  label: LabelSource
  mobileLabel?: LabelSource
  icon: IconSource
  mobilePriority?: number
  mobileSlot?: "primary" | "secondary"
  getPath: (context: NavigationContext) => string | null
  isVisible: (context: NavigationContext) => boolean
  match?: (pathname: string, context: NavigationContext, to: string) => boolean
}

const departmentLabelMap: Record<string, string> = {
  sound: "Sonido",
  lights: "Luces",
  video: "Vídeo",
}

const baseNavigationConfig: NavigationItemConfig[] = [
  {
    id: "management-dashboard",
    label: "Panel principal",
    mobileLabel: "Panel",
    icon: LayoutDashboard,
    mobilePriority: 1,
    mobileSlot: "primary",
    getPath: () => "/dashboard",
    isVisible: ({ userRole }) => userRole === "management",
  },
  {
    id: "technician-dashboard",
    label: "Panel técnico",
    mobileLabel: "Panel",
    icon: LayoutDashboard,
    mobilePriority: 1,
    mobileSlot: "primary",
    getPath: () => "/technician-dashboard",
    isVisible: ({ userRole }) =>
      userRole === "technician" || userRole === "house_tech",
  },
  {
    id: "technician-unavailability",
    label: "Mis bloqueos de disponibilidad",
    mobileLabel: "Bloqueos",
    icon: Clock,
    mobilePriority: 3,
    mobileSlot: "primary",
    getPath: () => "/dashboard/unavailability",
    isVisible: ({ userRole }) =>
      userRole === "technician" || userRole === "house_tech",
  },
  {
    id: "soundvision-files",
    label: "Archivos SoundVision",
    mobileLabel: "SoundVision",
    icon: Database,
    mobilePriority: 9,
    mobileSlot: "secondary",
    getPath: () => "/soundvision-files",
    isVisible: ({ userRole }) => userRole !== "management",
  },
  {
    id: "personal",
    label: "Agenda personal",
    mobileLabel: "Agenda",
    icon: Calendar,
    mobilePriority: 2,
    mobileSlot: "secondary",
    getPath: () => "/personal",
    isVisible: ({ userRole }) => userRole !== "technician",
  },
  {
    id: "job-assignment-matrix",
    label: "Matriz de asignaciones",
    mobileLabel: "Matriz",
    icon: Grid3X3,
    mobilePriority: 11,
    mobileSlot: "secondary",
    getPath: () => "/job-assignment-matrix",
    isVisible: ({ userRole }) => userRole === "management",
  },
  {
    id: "management-rates",
    label: "Tarifas y extras",
    mobileLabel: "Tarifas",
    icon: Euro,
    mobilePriority: 10,
    mobileSlot: "secondary",
    getPath: () => "/management/rates",
    isVisible: ({ userRole }) => userRole === "management",
  },
  {
    id: "department-sound",
    label: "Sonido",
    mobileLabel: "Sonido",
    icon: Music2,
    mobilePriority: 6,
    mobileSlot: "secondary",
    getPath: () => "/sound",
    isVisible: ({ userRole }) => userRole === "management",
  },
  {
    id: "department-lights",
    label: "Luces",
    mobileLabel: "Luces",
    icon: Lightbulb,
    mobilePriority: 7,
    mobileSlot: "secondary",
    getPath: () => "/lights",
    isVisible: ({ userRole }) => userRole === "management",
  },
  {
    id: "department-video",
    label: "Vídeo",
    mobileLabel: "Vídeo",
    icon: Video,
    mobilePriority: 8,
    mobileSlot: "secondary",
    getPath: () => "/video",
    isVisible: ({ userRole }) => userRole === "management",
  },
  {
    id: "house-department",
    label: ({ userDepartment }) =>
      departmentLabelMap[userDepartment?.toLowerCase() ?? ""] ||
      userDepartment ||
      null,
    mobileLabel: ({ userDepartment }) =>
      departmentLabelMap[userDepartment?.toLowerCase() ?? ""] ||
      "Departamento",
    icon: (({ userDepartment }) => {
      const dept = userDepartment?.toLowerCase()
      if (dept === "sound") return Music2
      if (dept === "lights") return Lightbulb
      if (dept === "video") return Video
      return null
    }) as (context: NavigationContext) => LucideIcon | null,
    mobilePriority: 2,
    mobileSlot: "primary",
    getPath: ({ userDepartment }) =>
      userDepartment ? `/${userDepartment.toLowerCase()}` : null,
    isVisible: ({ userRole, userDepartment }) =>
      userRole === "house_tech" && Boolean(userDepartment),
  },
  {
    id: "tours",
    label: "Giras",
    mobileLabel: "Giras",
    icon: MapPin,
    mobilePriority: 4,
    mobileSlot: "primary",
    getPath: () => "/tours",
    isVisible: ({ userRole }) =>
      userRole === "management" || userRole === "house_tech",
  },
  {
    id: "festivals",
    label: "Festivales",
    mobileLabel: "Festivales",
    icon: Tent,
    mobilePriority: 6,
    mobileSlot: "secondary",
    getPath: () => "/festivals",
    isVisible: ({ userRole }) =>
      userRole === "management" || userRole === "house_tech",
  },
  {
    id: "disponibilidad",
    label: "Disponibilidad",
    mobileLabel: "Disponibilidad",
    icon: CalendarCheck,
    mobilePriority: 7,
    mobileSlot: "secondary",
    getPath: () => "/disponibilidad",
    isVisible: ({ userRole }) =>
      userRole === "management" || userRole === "house_tech",
  },
  {
    id: "project-management",
    label: "Gestión de proyectos",
    mobileLabel: "Proyectos",
    icon: ClipboardList,
    mobilePriority: 8,
    mobileSlot: "secondary",
    getPath: () => "/project-management",
    isVisible: ({ userRole }) =>
      userRole === "admin" ||
      userRole === "management" ||
      userRole === "logistics",
  },
  {
    id: "logistics",
    label: "Logística",
    mobileLabel: "Logística",
    icon: Truck,
    mobilePriority: 3,
    mobileSlot: "primary",
    getPath: () => "/logistics",
    isVisible: ({ userRole }) =>
      userRole === "admin" ||
      userRole === "management" ||
      userRole === "logistics" ||
      userRole === "house_tech",
  },
  {
    id: "profile",
    label: "Perfil",
    mobileLabel: "Perfil",
    icon: UserCircle,
    mobilePriority: 5,
    mobileSlot: "primary",
    getPath: () => "/profile",
    isVisible: ({ userRole }) => Boolean(userRole),
  },
  {
    id: "wallboard-presets",
    label: "Wallboard",
    mobileLabel: "Wallboard",
    icon: SlidersHorizontal,
    mobilePriority: 12,
    mobileSlot: "secondary",
    getPath: () => "/management/wallboard-presets",
    isVisible: ({ userRole }) => userRole === "admin" || userRole === "management",
  },
  {
    id: "announcements",
    label: "Anuncios",
    mobileLabel: "Anuncios",
    icon: Megaphone,
    mobilePriority: 12,
    mobileSlot: "secondary",
    getPath: () => "/announcements",
    isVisible: ({ userRole }) =>
      userRole === "admin" || userRole === "management",
  },
  {
    id: "incident-reports",
    label: "Partes de incidencias",
    mobileLabel: "Incidencias",
    icon: FileText,
    mobilePriority: 13,
    mobileSlot: "secondary",
    getPath: () => "/incident-reports",
    isVisible: ({ userRole }) =>
      userRole === "admin" || userRole === "management",
  },
  {
    id: "activity",
    label: "Actividad",
    mobileLabel: "Actividad",
    icon: Activity,
    mobilePriority: 14,
    mobileSlot: "secondary",
    getPath: () => "/activity",
    isVisible: ({ userRole }) =>
      userRole === "admin" || userRole === "management",
  },
  {
    id: "settings",
    label: "Ajustes",
    mobileLabel: "Ajustes",
    icon: Settings,
    mobilePriority: 15,
    mobileSlot: "secondary",
    getPath: () => "/settings",
    isVisible: ({ userRole }) =>
      userRole === "admin" || userRole === "management",
  },
]

const resolveLabel = (
  source: LabelSource,
  context: NavigationContext,
): string | null => {
  if (typeof source === "function") {
    return source(context)
  }
  return source
}

const resolveIcon = (
  source: IconSource,
  context: NavigationContext,
): LucideIcon | null => {
  if (typeof source === "function") {
    return source(context) as LucideIcon | null
  }
  return source as LucideIcon
}

export const buildNavigationItems = (
  context: NavigationContext,
): NavigationItem[] => {
  if (!context.userRole) {
    return []
  }

  return baseNavigationConfig
    .map((config) => {
      if (!config.isVisible(context)) {
        return null
      }

      const to = config.getPath(context)
      if (!to) {
        return null
      }

      const label = resolveLabel(config.label, context)
      const icon = resolveIcon(config.icon, context)

      if (!label || !icon) {
        return null
      }

      const mobileLabel =
        resolveLabel(config.mobileLabel ?? config.label, context) ?? label
      const mobileSlot = config.mobileSlot ?? "secondary"

      const isActive = config.match
        ? (pathname: string) => config.match?.(pathname, context, to) ?? false
        : (pathname: string) => pathname === to

      return {
        id: config.id,
        label,
        mobileLabel,
        to,
        icon,
        mobilePriority: config.mobilePriority,
        mobileSlot,
        isActive,
      } satisfies NavigationItem
    })
    .filter(Boolean) as NavigationItem[]
}

export const SidebarNavigation = ({
  userRole,
  userDepartment,
  hasSoundVisionAccess,
  onNavigate,
}: SidebarNavigationProps) => {
  const location = useLocation()

  if (!userRole) {
    return <SidebarNavigationSkeleton />
  }

  const navigationItems = useMemo(
    () =>
      buildNavigationItems({
        userRole,
        userDepartment,
        hasSoundVisionAccess,
      }),
    [userRole, userDepartment, hasSoundVisionAccess],
  )

  if (!navigationItems.length) {
    return null
  }

  return (
    <div className="space-y-2">
      <nav className="flex flex-col gap-1">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive(location.pathname)

          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className="block"
            >
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                data-active={isActive}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Button>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
