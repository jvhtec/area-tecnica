import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VacationRequestForm } from "@/components/personal/VacationRequestForm";
import { describe, expect, it, vi } from "vitest";

describe("mobile vacation request form", () => {
  it("prevents incomplete submissions and clears the form after submit", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<VacationRequestForm onSubmit={handleSubmit} />);

    const startDateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
    const endDateInput = screen.getByLabelText(/end date/i) as HTMLInputElement;
    const reasonField = screen.getByLabelText(/reason/i) as HTMLTextAreaElement;
    const submitButton = screen.getByRole("button", { name: /submit request/i });

    expect(submitButton).toBeDisabled();

    await user.type(startDateInput, "2024-11-01");
    await user.type(endDateInput, "2024-11-05");

    // Button should still be disabled until the reason is provided.
    expect(submitButton).toBeDisabled();

    await user.type(reasonField, "Crew rotation coverage");
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith({
      startDate: "2024-11-01",
      endDate: "2024-11-05",
      reason: "Crew rotation coverage",
    });

    await waitFor(() => {
      expect(startDateInput.value).toBe("");
      expect(endDateInput.value).toBe("");
      expect(reasonField.value).toBe("");
    });
  });
});
