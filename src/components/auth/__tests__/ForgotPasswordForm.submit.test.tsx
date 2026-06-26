// @vitest-environment jsdom
import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authState = vi.fn()
vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => authState(),
}))

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm"

describe("ForgotPasswordForm submit button (SubmitButton adoption)", () => {
  beforeEach(() => {
    authState.mockReset()
  })

  it("disables the submit button and marks aria-busy while loading", () => {
    authState.mockReturnValue({ requestPasswordReset: vi.fn(), isLoading: true })
    render(<ForgotPasswordForm onBack={() => {}} />)

    const submit = screen.getByRole("button", { name: /Sending Reset Link/i })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute("aria-busy", "true")
  })

  it("is enabled and not busy when idle", () => {
    authState.mockReturnValue({ requestPasswordReset: vi.fn(), isLoading: false })
    render(<ForgotPasswordForm onBack={() => {}} />)

    const submit = screen.getByRole("button", { name: "Send Reset Link" })
    expect(submit).toBeEnabled()
    expect(submit).not.toHaveAttribute("aria-busy")
  })
})
