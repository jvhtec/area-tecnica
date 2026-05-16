import type { TabId } from "./types";

export const JOB_TYPE_LABELS: Record<string, string> = {
  single: "Un solo día",
  tour: "Gira",
  tourdate: "Fecha de gira",
  festival: "Festival",
  ciclo: "Ciclo",
  dryhire: "Alquiler seco",
  evento: "Evento",
};

export const DETAILS_MODAL_TABS: { id: TabId; label: string }[] = [
  { id: "Info", label: "Info" },
  { id: "Ubicación", label: "Ubicación" },
  { id: "Transp.", label: "Transp." },
  { id: "Personal", label: "Personal" },
  { id: "Docs", label: "Docs" },
  { id: "Restau.", label: "Restau." },
  { id: "Clima", label: "Clima" },
];
