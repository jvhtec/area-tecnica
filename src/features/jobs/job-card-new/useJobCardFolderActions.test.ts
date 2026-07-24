import { describe, expect, it } from "vitest";

import { parseLocalFolderStructure } from "@/features/jobs/job-card-new/useJobCardFolderActions";

describe("parseLocalFolderStructure", () => {
  it("keeps supported folder entries and filters malformed subfolders", () => {
    expect(
      parseLocalFolderStructure([
        "CAD",
        { name: "Rider", subfolders: ["OLD", 42, null] },
        { name: 12 },
        null,
      ]),
    ).toEqual([
      "CAD",
      { name: "Rider", subfolders: ["OLD"] },
    ]);
  });

  it("returns null when no valid folders remain", () => {
    expect(parseLocalFolderStructure({ name: "CAD" })).toBeNull();
    expect(parseLocalFolderStructure([null, { name: false }])).toBeNull();
  });
});
