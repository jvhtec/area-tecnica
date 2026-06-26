// @vitest-environment jsdom
import React from "react"
import { render, screen } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { Loading, PageLoading, Spinner } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/empty-state"
import { SubmitButton } from "@/components/ui/submit-button"

describe("Loading", () => {
  it("exposes an accessible polite status with the default Spanish label", () => {
    render(<Loading />)
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-busy", "true")
    expect(status).toHaveTextContent("Cargando…")
  })

  it("keeps the label announced but visually hidden when hideLabel is set", () => {
    render(<Loading label="Cargando trabajos…" hideLabel />)
    const label = screen.getByText("Cargando trabajos…")
    expect(label).toHaveClass("sr-only")
  })

  it("PageLoading renders a status region", () => {
    render(<PageLoading label="Cargando datos…" />)
    expect(screen.getByRole("status")).toHaveTextContent("Cargando datos…")
  })

  it("Spinner is decorative (aria-hidden icon)", () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy()
  })
})

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No hay trabajos"
        description="Aparecerán aquí."
        action={<button type="button">Crear</button>}
      />,
    )
    expect(screen.getByRole("heading", { name: "No hay trabajos" })).toBeInTheDocument()
    expect(screen.getByText("Aparecerán aquí.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument()
  })
})

describe("SubmitButton", () => {
  it("disables and marks aria-busy while loading", () => {
    render(<SubmitButton loading>Guardar</SubmitButton>)
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
  })

  it("shows loadingText while loading and children otherwise", () => {
    const { rerender } = render(
      <SubmitButton loading loadingText="Guardando…">
        Guardar
      </SubmitButton>,
    )
    expect(screen.getByRole("button")).toHaveTextContent("Guardando…")

    rerender(<SubmitButton loadingText="Guardando…">Guardar</SubmitButton>)
    expect(screen.getByRole("button")).toHaveTextContent("Guardar")
  })

  it("is not disabled and forwards clicks when not loading", () => {
    const onClick = vi.fn()
    render(<SubmitButton onClick={onClick}>Guardar</SubmitButton>)
    const button = screen.getByRole("button")
    expect(button).not.toBeDisabled()
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
