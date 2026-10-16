import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ActiveSkill } from "@/hooks/useActiveSkills";

const catalog: ActiveSkill[] = [
  { id: "1", name: "pa", category: "sound" },
  { id: "2", name: "PA", category: "sound" },
  { id: "3", name: "foh", category: "sound-specialty" },
  { id: "4", name: "dimmer", category: "lights" },
  { id: "5", name: "rigging", category: "production" },
  { id: "6", name: "trabajo en altura", category: "general" },
  { id: "7", name: "cañón", category: "lights" },
];

vi.mock("@/hooks/useActiveSkills", () => ({
  useActiveSkills: () => ({ data: catalog }),
}));

import { SkillsFilter } from "../SkillsFilter";
import { groupSkillsForDepartment } from "@/utils/skillCatalog";

const categories = (groups: ReturnType<typeof groupSkillsForDepartment>) => groups.map(([category]) => category);
const names = (groups: ReturnType<typeof groupSkillsForDepartment>) =>
  groups.flatMap(([, list]) => list.map((skill) => skill.name));

describe("groupSkillsForDepartment", () => {
  it("lists every catalog skill once, ignoring case", () => {
    const groups = groupSkillsForDepartment(catalog);
    expect(names(groups).filter((name) => name.toLowerCase() === "pa")).toEqual(["pa"]);
    expect(names(groups)).toHaveLength(6);
  });

  it("puts the department's categories first, then general, then the rest", () => {
    expect(categories(groupSkillsForDepartment(catalog, "lights"))).toEqual([
      "lights",
      "general",
      "production",
      "sound",
      "sound-specialty",
    ]);
    expect(categories(groupSkillsForDepartment(catalog, "sound")).slice(0, 3)).toEqual([
      "sound",
      "sound-specialty",
      "general",
    ]);
  });

  it("keeps skills a department borrows from another category, such as rigging for lights", () => {
    expect(names(groupSkillsForDepartment(catalog, "lights"))).toContain("rigging");
  });

  it("sorts names in Spanish order", () => {
    const lights = groupSkillsForDepartment(catalog, "lights")[0]?.[1].map((skill) => skill.name);
    expect(lights).toEqual(["cañón", "dimmer"]);
  });
});

describe("SkillsFilter", () => {
  it("shows catalog skills under Spanish headings and toggles them case-insensitively", async () => {
    const onChange = vi.fn();
    render(<SkillsFilter selected={["PA"]} onChange={onChange} department="sound" />);

    fireEvent.click(screen.getByRole("button", { name: /Habilidades/ }));
    expect(await screen.findByText("Sonido")).toBeInTheDocument();
    expect(screen.getByText("Producción")).toBeInTheDocument();

    // "PA" from an older selection still reads as the catalog's "pa".
    fireEvent.click(screen.getByText("pa"));
    expect(onChange).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByText("foh"));
    expect(onChange).toHaveBeenLastCalledWith(["PA", "foh"]);
  });
});
