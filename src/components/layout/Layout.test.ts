import { Activity } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import type {
  NavigationItemConfig,
  SidebarNavigationProps,
} from "./SidebarNavigation"

const storage = new Map<string, string>()
const localStorageMock = {
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  removeItem: (key: string) => {
    storage.delete(key)
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value)
  },
}

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
})

const { buildNavigationItems } = await import("./SidebarNavigation")
const { selectPrimaryNavigationItems } = await import("./Layout")

const sortNavigationItems = (items: ReturnType<typeof buildNavigationItems>) => {
  return [...items].sort(
    (a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99),
  )
}

const buildContext = (
  overrides: Partial<SidebarNavigationProps> = {},
): SidebarNavigationProps => ({
  userRole: "management",
  userDepartment: null,
  hasSoundVisionAccess: false,
  ...overrides,
})

describe("selectPrimaryNavigationItems", () => {
  it("uses the sound department order", () => {
    const context = buildContext({ userDepartment: "sound" })
    const items = sortNavigationItems(buildNavigationItems(context))

    const primary = selectPrimaryNavigationItems({
      items,
      userDepartment: context.userDepartment,
      userRole: context.userRole,
    })

    expect(primary.map((item) => item.id)).toEqual([
      "management-department",
      "project-management",
      "tours",
      "festivals",
    ])
  })

  it("uses the lights department order", () => {
    const context = buildContext({ userDepartment: "lights" })
    const items = sortNavigationItems(buildNavigationItems(context))

    const primary = selectPrimaryNavigationItems({
      items,
      userDepartment: context.userDepartment,
      userRole: context.userRole,
    })

    expect(primary.map((item) => item.id)).toEqual([
      "project-management",
      "management-department",
      "disponibilidad",
      "logistics",
    ])
  })

  it("uses the production profile order for management", () => {
    const context = buildContext({ userDepartment: "production" })
    const items = sortNavigationItems(buildNavigationItems(context))

    const primary = selectPrimaryNavigationItems({
      items,
      userDepartment: context.userDepartment,
      userRole: context.userRole,
    })

    expect(primary.map((item) => item.id)).toEqual([
      "management-dashboard",
      "project-management",
      "logistics",
      "job-assignment-matrix",
    ])
  })
})

describe("buildNavigationItems - management department navigation", () => {
  it("omits the department link when userDepartment is missing", () => {
    const context = buildContext({ userRole: "management", userDepartment: null })
    const items = buildNavigationItems(context)

    const managementDept = items.find((item) => item.id === "management-department")
    expect(managementDept).toBeUndefined()
  })

  it("creates a department link that matches the assigned department", () => {
    const context = buildContext({ userRole: "management", userDepartment: "lights" })
    const items = buildNavigationItems(context)

    const managementDept = items.find((item) => item.id === "management-department")
    expect(managementDept).toBeDefined()
    expect(managementDept?.label).toBe("Luces")
    expect(managementDept?.to).toBe("/lights")
  })
})

describe("buildNavigationItems - SoundVision visibility", () => {
  it("shows SoundVision item for technician without access", () => {
    const context = buildContext({ userRole: "technician", hasSoundVisionAccess: false })
    const items = buildNavigationItems(context)

    const soundVisionItem = items.find((item) => item.id === "soundvision-files")
    expect(soundVisionItem).toBeDefined()
  })

  it("shows SoundVision item for technician with access", () => {
    const context = buildContext({ userRole: "technician", hasSoundVisionAccess: true })
    const items = buildNavigationItems(context)

    const soundVisionItem = items.find((item) => item.id === "soundvision-files")
    expect(soundVisionItem).toBeDefined()
  })

  it("shows SoundVision item for house_tech without access", () => {
    const context = buildContext({ userRole: "house_tech", hasSoundVisionAccess: false })
    const items = buildNavigationItems(context)

    const soundVisionItem = items.find((item) => item.id === "soundvision-files")
    expect(soundVisionItem).toBeDefined()
  })

  it("shows SoundVision item for house_tech with access", () => {
    const context = buildContext({ userRole: "house_tech", hasSoundVisionAccess: true })
    const items = buildNavigationItems(context)

    const soundVisionItem = items.find((item) => item.id === "soundvision-files")
    expect(soundVisionItem).toBeDefined()
  })

  it("hides SoundVision item for management role", () => {
    const context = buildContext({ userRole: "management", hasSoundVisionAccess: true })
    const items = buildNavigationItems(context)

    const soundVisionItem = items.find((item) => item.id === "soundvision-files")
    expect(soundVisionItem).toBeUndefined()
  })
})

describe("buildNavigationItems - admin visibility", () => {
  it("includes routes from every role except technician-only links", () => {
    const context = buildContext({ userRole: "admin" })
    const items = buildNavigationItems(context)

    expect(items.find((item) => item.id === "management-dashboard")).toBeDefined()
    expect(items.find((item) => item.id === "technician-dashboard")).toBeUndefined()
    expect(
      items.find((item) => item.id === "technician-unavailability"),
    ).toBeUndefined()
    expect(items.find((item) => item.id === "admin-lights")).toBeDefined()
    expect(items.find((item) => item.id === "admin-video")).toBeDefined()
    expect(items.find((item) => item.id === "logistics")).toBeDefined()
    expect(items.find((item) => item.id === "soundvision-files")).toBeDefined()
  })

  it("automatically renders future routes for admins", () => {
    const context = buildContext({ userRole: "admin" })
    const futureRoute: NavigationItemConfig = {
      id: "future-route",
      label: "Future route",
      icon: Activity,
      getPath: () => "/future",
      isVisible: () => false,
    }

    const adminItems = buildNavigationItems(context, [futureRoute])
    const managerItems = buildNavigationItems(buildContext(), [futureRoute])

    expect(adminItems.map((item) => item.id)).toContain("future-route")
    expect(managerItems.map((item) => item.id)).not.toContain("future-route")
  })

  it("bypasses per-route visibility logic for admins", () => {
    const context = buildContext({ userRole: "admin" })
    const isVisible = vi.fn(() => false)
    const guardedRoute: NavigationItemConfig = {
      id: "guarded-route",
      label: "Guarded route",
      icon: Activity,
      getPath: () => "/guarded",
      isVisible,
    }

    const adminItems = buildNavigationItems(context, [guardedRoute])
    const managerItems = buildNavigationItems(buildContext(), [guardedRoute])

    expect(isVisible).toHaveBeenCalledTimes(1)
    expect(adminItems.map((item) => item.id)).toContain("guarded-route")
    expect(managerItems.map((item) => item.id)).not.toContain("guarded-route")
  })
})
