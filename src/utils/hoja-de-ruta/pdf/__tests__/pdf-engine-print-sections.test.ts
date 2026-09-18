import { beforeEach, describe, expect, it, vi } from "vitest";

const contentSectionCalls: string[] = [];

const alwaysHasData = () => true;

vi.mock("@/utils/hoja-de-ruta/pdf/core/pdf-document", () => ({
  PDFDocument: class {
    addText = vi.fn();
    setText = vi.fn();
    save = vi.fn();
    outputBlob = vi.fn(() => new Blob());
    output = vi.fn(() => new Blob());
    getPageCount = vi.fn(() => 1);
  },
}));

vi.mock("@/utils/hoja-de-ruta/pdf/sections/header-section", () => ({
  HeaderSection: class {
    labels: string[] = [];
    addSectionHeader = vi.fn(() => 40);
  },
}));

vi.mock("@/utils/hoja-de-ruta/pdf/sections/cover-section", () => ({
  CoverSection: class {
    generateCoverPage = vi.fn(async () => undefined);
  },
}));

vi.mock("@/utils/hoja-de-ruta/pdf/services/logo-service", () => ({
  LogoService: { loadJobLogo: vi.fn(async () => undefined) },
}));

vi.mock("@/utils/hoja-de-ruta/pdf/services/footer-service", () => ({
  FooterService: { addFooterToAllPages: vi.fn(async () => undefined) },
}));

vi.mock("@/utils/hoja-de-ruta/pdf/sections/content-sections", () => ({
  ContentSections: class {
    hasEventDetailsData = alwaysHasData;
    hasAuxNeedsData = alwaysHasData;
    hasVenueData = alwaysHasData;
    hasWeatherData = alwaysHasData;
    hasContactsData = alwaysHasData;
    hasStaffData = alwaysHasData;
    hasTravelData = alwaysHasData;
    hasAccommodationData = alwaysHasData;
    hasRoomingData = alwaysHasData;
    hasLogisticsTransportData = alwaysHasData;
    hasLogisticsDetailsData = alwaysHasData;
    hasStructuredProgramData = alwaysHasData;
    hasScheduleTextData = alwaysHasData;
    hasProgramData = alwaysHasData;
    hasPowerData = alwaysHasData;
    hasRestaurantsData = alwaysHasData;

    addEventDetailsSection = vi.fn(() => {
      contentSectionCalls.push("event-details");
      return 40;
    });
    addAuxNeedsSection = vi.fn(() => {
      contentSectionCalls.push("aux-needs");
      return 40;
    });
    addVenueSection = vi.fn(async () => {
      contentSectionCalls.push("venue");
      return 40;
    });
    addWeatherSection = vi.fn(() => {
      contentSectionCalls.push("weather");
      return 40;
    });
    addProgramSection = vi.fn(() => {
      contentSectionCalls.push("program");
      return 40;
    });
    addPowerSection = vi.fn(() => {
      contentSectionCalls.push("power");
      return 40;
    });
    addLogisticsSection = vi.fn(() => {
      contentSectionCalls.push("logistics");
      return 40;
    });
    addContactsSection = vi.fn(() => 40);
    addStaffSection = vi.fn(() => 40);
    addTravelSection = vi.fn(async () => 40);
    addAccommodationSection = vi.fn(async () => 40);
    addRoomingSection = vi.fn(() => 40);
    addRestaurantsSection = vi.fn(async () => 40);
  },
}));

vi.mock("@/utils/hoja-de-ruta/pdf-upload", () => ({
  uploadPdfToJob: vi.fn(async () => undefined),
}));

const { PDFEngine } = await import("@/utils/hoja-de-ruta/pdf/pdf-engine");

const renderSections = async (options: {
  sections?: ("schedule" | "logistics")[];
  excludedSections?: string[];
}) => {
  contentSectionCalls.length = 0;
  const engine = new PDFEngine({
    eventData: { powerRequirements: "SOUND - PA:\nPotencia Total: 10000.00W" },
    travelArrangements: [],
    roomAssignments: [],
    imagePreviews: {},
    venueMapPreview: null,
    selectedJobId: "job-1",
    jobTitle: "Festival",
    ...options,
  } as never);
  await engine.generatePreview();
  return contentSectionCalls;
};

describe("Hoja de Ruta print-section exclusions", () => {
  beforeEach(() => {
    contentSectionCalls.length = 0;
  });

  it("prints the power summary in a Programa export by default", async () => {
    expect(await renderSections({ sections: ["schedule"] })).toContain("power");
  });

  it("honours the power exclusion when only the Programa section is exported", async () => {
    const rendered = await renderSections({
      sections: ["schedule"],
      excludedSections: ["power"],
    });

    expect(rendered).not.toContain("power");
    expect(rendered).toContain("program");
  });

  it("honours the power exclusion in the full document too", async () => {
    expect(await renderSections({ excludedSections: ["power"] })).not.toContain("power");
    expect(await renderSections({})).toContain("power");
  });

  it("keeps the program when only the free-text notes are excluded", async () => {
    const rendered = await renderSections({
      sections: ["schedule"],
      excludedSections: ["schedule-notes"],
    });

    expect(rendered).toContain("program");
    expect(rendered).toContain("power");
  });

  it("drops the Programa block entirely when both program blocks are excluded", async () => {
    const rendered = await renderSections({
      sections: ["schedule"],
      excludedSections: ["program", "schedule-notes"],
    });

    expect(rendered).not.toContain("program");
    expect(rendered).toContain("power");
  });
});
