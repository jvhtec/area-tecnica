// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/renderWithProviders";

const { signUpFormMock } = vi.hoisted(() => ({
  signUpFormMock: vi.fn(),
}));

vi.mock("@/components/auth/SignUpForm", () => ({
  SignUpForm: (props: any) => {
    signUpFormMock(props);
    return (
      <button type="button" onClick={props.onBack}>
        Go back
      </button>
    );
  },
}));

import { CreateUserDialog } from "../CreateUserDialog";

describe("CreateUserDialog", () => {
  it("wraps SignUpForm with preventAutoLogin and closes on back", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(<CreateUserDialog open onOpenChange={onOpenChange} />);

    expect(signUpFormMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        preventAutoLogin: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: /go back/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
