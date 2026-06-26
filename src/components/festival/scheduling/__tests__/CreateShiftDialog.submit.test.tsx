// @vitest-environment jsdom
import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: () => ({ insert: () => ({ select: () => ({ single: () => ({}) }) }) }),
  },
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/festival/scheduling/ShiftTimeCalculator", () => ({
  ShiftTimeCalculator: (): null => null,
}))

import { CreateShiftDialog } from "@/components/festival/scheduling/CreateShiftDialog"

describe("CreateShiftDialog submit button (SubmitButton adoption)", () => {
  it("renders the submit action enabled and not busy initially", () => {
    render(
      <CreateShiftDialog
        open
        onOpenChange={() => {}}
        jobId="job-1"
        onShiftCreated={() => {}}
        date="2026-06-26"
      />,
    )

    const submit = screen.getByRole("button", { name: "Crear Turno" })
    expect(submit).toBeEnabled()
    expect(submit).not.toHaveAttribute("aria-busy")
  })
})
