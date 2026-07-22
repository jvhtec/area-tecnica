import {
  isTFSpeaker,
  soundComponentDatabase,
  speakerAmplifierConfig,
} from "./constants";
import type { AmplifierResults, SpeakerSection } from "./types";

const CHANNELS_PER_AMPLIFIER = 4;
const AMPLIFIERS_PER_RACK = 3;

export interface SpeakerAmplifierCalculation {
  amps: number;
  details: string;
}

export function calculateAmplifiersForSpeaker(
  speakerId: string,
  quantity: number,
  maxLinked: number,
  mirrored = false,
): SpeakerAmplifierCalculation {
  if (!speakerId || quantity === 0) {
    return { amps: 0, details: "No speakers configured" };
  }

  const speaker = soundComponentDatabase.find((item) => item.id.toString() === speakerId);
  if (!speaker) {
    return { amps: 0, details: "Invalid speaker selection" };
  }

  const speakerName = speaker.name.trim();
  const amplifierConfig = speakerAmplifierConfig[speakerName];
  if (!amplifierConfig) {
    return { amps: 0, details: "Speaker configuration not found" };
  }

  const actualQuantity = mirrored ? quantity * 2 : quantity;
  const actualMaxLinked = Math.min(maxLinked || amplifierConfig.maxLink, amplifierConfig.maxLink);
  const groupCount = Math.ceil(actualQuantity / actualMaxLinked);
  const groupsPerAmp = Math.floor(CHANNELS_PER_AMPLIFIER / amplifierConfig.channelsRequired);
  const totalAmps = Math.ceil(groupCount / groupsPerAmp);
  const mirrorText = mirrored ? " × 2 (mirrored clusters)" : "";
  const ampType = isTFSpeaker(speakerName) ? "PLM20000D" : "LA12X";
  const channelsText = amplifierConfig.channelsRequired === 1
    ? "1 channel"
    : `${amplifierConfig.channelsRequired} channels`;

  return {
    amps: totalAmps,
    details: `${quantity} ${speakerName} speakers${mirrorText} (${channelsText} each, ${actualMaxLinked} linked) requiring ${totalAmps} ${ampType} amplifier${totalAmps !== 1 ? "s" : ""}`,
  };
}

export function calculateAmplifierResults(
  sections: Record<string, SpeakerSection>,
): AmplifierResults {
  const results: AmplifierResults = {
    totalAmplifiersNeeded: 0,
    completeRaks: 0,
    looseAmplifiers: 0,
    plmRacks: 0,
    loosePLMAmps: 0,
    laAmpsTotal: 0,
    plmAmpsTotal: 0,
    perSection: {},
  };

  let totalLAAmps = 0;
  let totalPLMAmps = 0;

  Object.entries(sections).forEach(([section, { speakers, mirrored }]) => {
    const sectionResults = {
      amps: 0,
      details: [] as string[],
      totalAmps: 0,
      mirrored,
      laAmps: 0,
      plmAmps: 0,
    };

    speakers.forEach((speaker) => {
      const speakerResults = calculateAmplifiersForSpeaker(
        speaker.speakerId,
        speaker.quantity,
        speaker.maxLinked,
        mirrored,
      );

      if (speakerResults.amps <= 0) return;

      sectionResults.amps += speakerResults.amps;
      sectionResults.details.push(speakerResults.details);
      const speakerDefinition = soundComponentDatabase.find(
        (item) => item.id.toString() === speaker.speakerId,
      );
      if (!speakerDefinition) return;

      if (isTFSpeaker(speakerDefinition.name)) {
        sectionResults.plmAmps += speakerResults.amps;
        totalPLMAmps += speakerResults.amps;
      } else {
        sectionResults.laAmps += speakerResults.amps;
        totalLAAmps += speakerResults.amps;
      }
    });

    sectionResults.totalAmps = sectionResults.amps;
    results.perSection[section] = sectionResults;
    results.totalAmplifiersNeeded += sectionResults.totalAmps;
  });

  results.completeRaks = Math.floor(totalLAAmps / AMPLIFIERS_PER_RACK);
  results.looseAmplifiers = totalLAAmps % AMPLIFIERS_PER_RACK;
  results.plmRacks = Math.floor(totalPLMAmps / AMPLIFIERS_PER_RACK);
  results.loosePLMAmps = totalPLMAmps % AMPLIFIERS_PER_RACK;
  results.laAmpsTotal = totalLAAmps;
  results.plmAmpsTotal = totalPLMAmps;

  return results;
}
