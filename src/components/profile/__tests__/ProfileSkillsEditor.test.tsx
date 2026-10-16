// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ActiveSkill } from "@/hooks/useActiveSkills";

const catalog = vi.hoisted(() => ({ skills: [] as ActiveSkill[] }));

vi.mock("@/hooks/useActiveSkills", () => ({
  useActiveSkills: () => ({ data: catalog.skills }),
}));

const realtime = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/realtime/useSkillCatalogRealtime", () => ({
  useSkillCatalogRealtime: realtime,
}));

vi.mock("@/services/dataLayerClient", () => {
  const result = (data: unknown) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) builder[method] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data, error: null });
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: "ps-1", skill_id: "foh", proficiency: 3, is_primary: true, skills: [{ name: "foh", category: "sound-specialty" }] }], error: null }).then(resolve);
    return builder;
  };
  return {
    dataLayerClient: {
      from: (table: string) => result(table === "profiles" ? { department: "sound" } : null),
    },
  };
});

import { ProfileSkillsEditor } from "../ProfileSkillsEditor";

describe("ProfileSkillsEditor", () => {
  it("offers every catalog skill the profile lacks, its department first, and stays live", async () => {
    catalog.skills = [
      { id: "foh", name: "foh", category: "sound-specialty" },
      { id: "pa", name: "pa", category: "sound" },
      { id: "altura", name: "trabajo en altura", category: "general" },
      { id: "dimmer", name: "dimmer", category: "lights" },
    ];
    renderWithProviders(<ProfileSkillsEditor profileId="tech-1" />);

    // Embedded skill may come back as an array; it still reads its name.
    expect(await screen.findByText("foh")).toBeInTheDocument();
    expect(realtime).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Añadir habilidad/ }));
    const headings = (await screen.findAllByText(/^(Sonido|General|Iluminación)$/)).map((el) => el.textContent);
    expect(headings).toEqual(["Sonido", "General", "Iluminación"]);
    // A sound profile can now be given general and other departments' skills.
    expect(screen.getByText("trabajo en altura")).toBeInTheDocument();
    expect(screen.getByText("dimmer")).toBeInTheDocument();
    // Already held, so not offered again.
    expect(screen.getAllByText("foh")).toHaveLength(1);
  });
});
