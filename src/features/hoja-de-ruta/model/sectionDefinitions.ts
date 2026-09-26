export const HOJA_SECTION_DEFINITIONS = [
  { id: "event", label: "Evento", filenameLabel: "Evento", printParts: ["event-details", "aux-needs"] },
  { id: "venue", label: "Lugar", filenameLabel: "Lugar", printParts: ["venue"] },
  { id: "weather", label: "Clima", filenameLabel: "Clima", printParts: ["weather"] },
  { id: "contacts", label: "Contactos", filenameLabel: "Contactos", printParts: ["contacts"] },
  { id: "staff", label: "Personal", filenameLabel: "Personal", printParts: ["staff"] },
  { id: "travel", label: "Viajes", filenameLabel: "Viajes", printParts: ["travel"] },
  { id: "accommodation", label: "Alojamiento", filenameLabel: "Alojamiento", printParts: ["accommodation"] },
  {
    id: "logistics",
    label: "Logística",
    filenameLabel: "Logistica",
    printParts: ["logistics-transport", "logistics-details"],
  },
  {
    id: "schedule",
    label: "Programa",
    filenameLabel: "Programa",
    printParts: ["program", "schedule-notes", "power"],
  },
  { id: "restaurants", label: "Restaurantes", filenameLabel: "Restaurantes", printParts: ["restaurants"] },
] as const;

export type HojaSectionId = (typeof HOJA_SECTION_DEFINITIONS)[number]["id"];
export type HojaPrintPartId =
  (typeof HOJA_SECTION_DEFINITIONS)[number]["printParts"][number];

export const HOJA_PRINT_PART_DEFINITIONS = [
  { id: "event-details", label: "Información del Evento", parentSectionId: "event" },
  { id: "aux-needs", label: "Necesidades Auxiliares", parentSectionId: "event" },
  { id: "venue", label: "Lugar", parentSectionId: "venue" },
  { id: "weather", label: "Clima", parentSectionId: "weather" },
  { id: "contacts", label: "Contactos", parentSectionId: "contacts" },
  { id: "staff", label: "Personal", parentSectionId: "staff" },
  { id: "travel", label: "Viajes", parentSectionId: "travel" },
  { id: "accommodation", label: "Alojamiento", parentSectionId: "accommodation" },
  { id: "logistics-transport", label: "Transporte", parentSectionId: "logistics" },
  { id: "logistics-details", label: "Logística del Evento", parentSectionId: "logistics" },
  { id: "program", label: "Programa", parentSectionId: "schedule" },
  { id: "schedule-notes", label: "Programa (Texto Libre)", parentSectionId: "schedule" },
  { id: "power", label: "Requisitos de Energía", parentSectionId: "schedule" },
  { id: "restaurants", label: "Restaurantes", parentSectionId: "restaurants" },
] as const satisfies readonly {
  id: HojaPrintPartId;
  label: string;
  parentSectionId: HojaSectionId;
}[];
