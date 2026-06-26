// @vitest-environment jsdom
import React from "react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog"
import { DirectMessageCard } from "@/components/messages/DirectMessageCard"
import type { DirectMessage } from "@/components/messages/types"

const message: DirectMessage = {
  id: "msg-1",
  content: "Hola equipo",
  created_at: new Date("2026-06-01T10:00:00Z").toISOString(),
  status: "read",
  sender: { id: "u-sender", first_name: "Ana", last_name: "García" },
  recipient: { id: "u-me", first_name: "Yo", last_name: "Mismo" },
  sender_id: "u-sender",
  recipient_id: "u-me",
}

function renderCard(onDelete: (id: string) => void) {
  return render(
    <ConfirmDialogProvider>
      <DirectMessageCard
        message={message}
        currentUserId="u-me"
        onDelete={onDelete}
        onMarkAsRead={() => {}}
      />
    </ConfirmDialogProvider>,
  )
}

describe("DirectMessageCard delete confirmation (useConfirm migration)", () => {
  it("does not delete until the themed dialog is confirmed", async () => {
    const onDelete = vi.fn()
    renderCard(onDelete)

    // No native confirm should be involved.
    const nativeConfirm = vi.spyOn(window, "confirm")

    act(() => {
      screen.getByTitle("Eliminar mensaje").click()
    })

    // The AlertDialog appears with our copy; nothing deleted yet.
    expect(await screen.findByText("Eliminar mensaje")).toBeInTheDocument()
    expect(
      screen.getByText("¿Seguro que deseas eliminar este mensaje de forma permanente?"),
    ).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    const confirmBtn = screen.getByRole("button", { name: "Eliminar" })
    await act(async () => {
      confirmBtn.click()
    })

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith("msg-1")
    expect(nativeConfirm).not.toHaveBeenCalled()
  })

  it("does not delete when the dialog is cancelled", async () => {
    const onDelete = vi.fn()
    renderCard(onDelete)

    act(() => {
      screen.getByTitle("Eliminar mensaje").click()
    })

    const cancelBtn = await screen.findByRole("button", { name: "Cancelar" })
    await act(async () => {
      cancelBtn.click()
    })

    expect(onDelete).not.toHaveBeenCalled()
  })
})
