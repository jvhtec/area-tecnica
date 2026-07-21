// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentationJobPicker } from "@/features/technical-tools/jobs/DocumentationJobPicker";

describe("DocumentationJobPicker", () => {
  it("searches active jobs by title and selects the matching job", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DocumentationJobPicker
        jobs={[
          { id: "job-1", title: "Festival Norte", start_time: "2026-08-01T10:00:00Z" },
          { id: "job-2", title: "Gala Madrid", start_time: "2026-08-02T10:00:00Z" },
        ]}
        onValueChange={onValueChange}
        value=""
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Trabajo" }));
    await user.type(await screen.findByPlaceholderText("Buscar por nombre o fecha..."), "Gala");
    await user.click(await screen.findByText(/Gala Madrid/));

    expect(onValueChange).toHaveBeenCalledWith("job-2");
  });
});
