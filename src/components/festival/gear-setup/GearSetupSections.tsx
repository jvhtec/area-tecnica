import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toSectionFormData } from "@/features/festival-gear/model";
import type { FestivalGearSetup } from "@/types/festival";
import type { GearSetupFormData } from "@/types/festival-gear";
import { ExtraRequirementsSection } from "../form/sections/ExtraRequirementsSection";
import { FestivalConsoleSetupSection } from "../form/sections/FestivalConsoleSetupSection";
import { InfrastructureSection } from "../form/sections/InfrastructureSection";
import { MonitorSetupSection } from "../form/sections/MonitorSetupSection";
import { NotesSection } from "../form/sections/NotesSection";
import { WirelessSetupSection } from "../form/sections/WirelessSetupSection";
import { FestivalMicKitConfig } from "./FestivalMicKitConfig";
import { MicrophoneNeedsCalculator } from "./MicrophoneNeedsCalculator";

interface GearSetupSectionsProps {
  jobId: string;
  stageNumber: number;
  setup: GearSetupFormData;
  onChange: (changes: Partial<GearSetupFormData>) => void;
  globalSetup: FestivalGearSetup | null;
  readOnly: boolean;
}

const ANALYSIS_HELP =
  "Calcule las necesidades de micrófonos cableados basándose en los requisitos de los artistas y los horarios de shows.";

interface SectionEntry {
  value: string;
  /** Accordion title on phones. */
  title: string;
  /** Extra heading and help text shown above the section on desktop only. */
  desktopHeading?: { title: string };
  content: ReactNode;
}

/**
 * The gear setup sections, rendered twice from one list: stacked on desktop, as an accordion on
 * phones (both stay in the DOM and CSS picks the visible one, like the rest of the app).
 */
export const GearSetupSections = ({
  jobId,
  stageNumber,
  setup,
  onChange,
  globalSetup,
  readOnly,
}: GearSetupSectionsProps) => {
  const sectionData = toSectionFormData(setup, stageNumber);
  const isFieldLocked = () => readOnly;

  const entries: SectionEntry[] = [
    {
      value: "consoles",
      title: "Configuración de Console",
      content: <FestivalConsoleSetupSection formData={setup} onChange={onChange} readOnly={readOnly} />,
    },
    {
      value: "wireless",
      title: "Configuración de Wireless",
      content: <WirelessSetupSection formData={sectionData} onChange={onChange} readOnly={readOnly} />,
    },
    {
      value: "mics",
      title: "Kit de Micrófonos",
      content: (
        <FestivalMicKitConfig
          jobId={jobId}
          stageNumber={stageNumber}
          wiredMics={setup.wired_mics}
          onChange={(wiredMics) => onChange({ wired_mics: wiredMics })}
          readOnly={readOnly}
        />
      ),
    },
    {
      value: "monitors",
      title: "Configuración de Monitor",
      content: (
        <MonitorSetupSection
          formData={sectionData}
          onChange={onChange}
          gearSetup={globalSetup}
          isFieldLocked={isFieldLocked}
        />
      ),
    },
    {
      value: "extras",
      title: "Requisitos Adicionales",
      content: (
        <ExtraRequirementsSection
          formData={sectionData}
          onChange={onChange}
          gearSetup={globalSetup}
          isFieldLocked={isFieldLocked}
        />
      ),
    },
    {
      value: "infrastructure",
      title: "Infraestructura",
      content: (
        <InfrastructureSection
          formData={sectionData}
          onChange={onChange}
          gearSetup={globalSetup}
          isFieldLocked={isFieldLocked}
        />
      ),
    },
    {
      value: "analysis",
      title: "Análisis de Micrófonos",
      desktopHeading: { title: "Análisis de Requisitos de Micrófonos" },
      content: <MicrophoneNeedsCalculator jobId={jobId} />,
    },
    {
      value: "notes",
      title: "Notas",
      content: <NotesSection formData={sectionData} onChange={onChange} isFieldLocked={isFieldLocked} />,
    },
  ];

  return (
    <>
      <div className="hidden md:block space-y-8">
        {entries.map((entry) =>
          entry.desktopHeading ? (
            <div key={entry.value} className="space-y-4">
              <h3 className="text-lg font-semibold">{entry.desktopHeading.title}</h3>
              <p className="text-sm text-muted-foreground">{ANALYSIS_HELP}</p>
              {entry.content}
            </div>
          ) : (
            <div key={entry.value}>{entry.content}</div>
          ),
        )}
      </div>

      <div className="md:hidden">
        <Accordion type="multiple" defaultValue={["consoles", "wireless"]} className="space-y-4">
          {entries.map((entry) => (
            <AccordionItem key={entry.value} value={entry.value} className="border rounded-lg px-4">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">
                {entry.title}
              </AccordionTrigger>
              <AccordionContent>
                {entry.desktopHeading ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{ANALYSIS_HELP}</p>
                    {entry.content}
                  </div>
                ) : (
                  entry.content
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  );
};
