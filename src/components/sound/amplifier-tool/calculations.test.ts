import { describe, expect, it } from "vitest";
import { calculateAmplifierResults, calculateAmplifiersForSpeaker } from "@/components/sound/amplifier-tool/calculations";
import { speakerAmplifierConfig } from "@/components/sound/amplifier-tool/constants";

describe("amplifier calculations", () => {
  it("accounts for mirrored clusters and amplifier families", () => {
    const laResult = calculateAmplifiersForSpeaker("1", 2, 2, true);
    const plmResult = calculateAmplifiersForSpeaker("12", 3, 3);

    expect(laResult).toMatchObject({ amps: 2 });
    expect(laResult.details).toContain("mirrored clusters");
    expect(laResult.details).toContain("LA12X");
    expect(plmResult).toMatchObject({ amps: 1 });
    expect(plmResult.details).toContain("PLM20000D");
  });

  it("summarizes rack and loose-amplifier counts per family", () => {
    const result = calculateAmplifierResults({
      mains: {
        mirrored: true,
        speakers: [{ speakerId: "1", quantity: 2, maxLinked: 2 }],
      },
      delays: {
        speakers: [{ speakerId: "12", quantity: 9, maxLinked: 3 }],
      },
    });

    expect(result.laAmpsTotal).toBe(2);
    expect(result.plmAmpsTotal).toBe(3);
    expect(result.completeRaks).toBe(0);
    expect(result.looseAmplifiers).toBe(2);
    expect(result.plmRacks).toBe(1);
    expect(result.loosePLMAmps).toBe(0);
    expect(result.totalAmplifiersNeeded).toBe(5);
  });

  it("splits LA and PLM amplifiers within the same section", () => {
    const result = calculateAmplifierResults({
      mixed: {
        speakers: [
          { speakerId: "1", quantity: 2, maxLinked: 2 },
          { speakerId: "12", quantity: 3, maxLinked: 3 },
        ],
      },
    });

    expect(result.perSection.mixed).toMatchObject({
      laAmps: 1,
      plmAmps: 1,
      totalAmps: 2,
    });
  });

  it("returns stable empty-state errors for unusable speaker rows", () => {
    expect(calculateAmplifiersForSpeaker("", 0, 0)).toEqual({
      amps: 0,
      details: "No speakers configured",
    });
    expect(calculateAmplifiersForSpeaker("999", 1, 1)).toEqual({
      amps: 0,
      details: "Invalid speaker selection",
    });
  });

  it("reports a missing amplifier configuration for a known speaker", () => {
    const originalConfig = speakerAmplifierConfig.K1;
    delete speakerAmplifierConfig.K1;

    try {
      expect(calculateAmplifiersForSpeaker("1", 1, 1)).toEqual({
        amps: 0,
        details: "Speaker configuration not found",
      });
    } finally {
      speakerAmplifierConfig.K1 = originalConfig;
    }
  });
});
