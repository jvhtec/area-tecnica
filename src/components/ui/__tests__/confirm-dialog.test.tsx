// @vitest-environment jsdom
import React from "react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ConfirmDialogProvider, useConfirm } from "@/components/ui/confirm-dialog"

function Harness({ onResult }: { onResult: (value: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button
      type="button"
      onClick={async () => {
        const result = await confirm({ description: "¿Eliminar?", confirmText: "Eliminar" })
        onResult(result)
      }}
    >
      Abrir
    </button>
  )
}

describe("ConfirmDialogProvider / useConfirm", () => {
  it("resolves true when the confirm action is clicked", async () => {
    const results: boolean[] = []
    render(
      <ConfirmDialogProvider>
        <Harness onResult={(v) => results.push(v)} />
      </ConfirmDialogProvider>,
    )

    act(() => {
      screen.getByRole("button", { name: "Abrir" }).click()
    })

    const confirmBtn = await screen.findByRole("button", { name: "Eliminar" })
    await act(async () => {
      confirmBtn.click()
    })

    expect(results).toEqual([true])
  })

  it("resolves false when the cancel action is clicked", async () => {
    const results: boolean[] = []
    render(
      <ConfirmDialogProvider>
        <Harness onResult={(v) => results.push(v)} />
      </ConfirmDialogProvider>,
    )

    act(() => {
      screen.getByRole("button", { name: "Abrir" }).click()
    })

    const cancelBtn = await screen.findByRole("button", { name: "Cancelar" })
    await act(async () => {
      cancelBtn.click()
    })

    expect(results).toEqual([false])
  })

  it("throws when used outside the provider", () => {
    const Bare = (): null => {
      useConfirm()
      return null
    }
    // Silence the expected React error log from the throwing render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Bare />)).toThrow(/ConfirmDialogProvider/)
    spy.mockRestore()
  })
})
