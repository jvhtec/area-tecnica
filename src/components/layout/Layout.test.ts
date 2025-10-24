import { describe, expect, it } from "vitest"
import type { SidebarNavigationProps } from "./SidebarNavigation"

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
      "department-sound",
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
      "department-lights",
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
