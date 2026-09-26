import type { ReactNode } from "react";
import {
  Activity,
  Bed,
  Building2,
  Calendar,
  Car,
  CloudSun,
  MapPin,
  Phone,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";

import {
  AccommodationSectionView,
  ContactsSectionView,
  EventSectionView,
  LogisticsSectionView,
  RestaurantsSectionView,
  ScheduleSectionView,
  StaffSectionView,
  TravelSectionView,
  VenueSectionView,
  WeatherSectionView,
  type HojaSectionRuntime,
} from "@/features/hoja-de-ruta/sections/HojaSectionViews";
import {
  HOJA_SECTION_DEFINITIONS,
  type HojaPrintPartId,
  type HojaSectionId,
} from "@/features/hoja-de-ruta/model/sectionDefinitions";
import type {
  Accommodation,
  EventData,
  TravelArrangement,
} from "@/types/hoja-de-ruta";

export type HojaSectionCompletionContext = {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
};

export type HojaSectionRegistryEntry = {
  id: HojaSectionId;
  label: string;
  filenameLabel: string;
  icon: LucideIcon;
  color: string;
  printParts: readonly HojaPrintPartId[];
  isComplete: (ctx: HojaSectionCompletionContext) => boolean;
  render: (runtime: HojaSectionRuntime) => ReactNode;
  exportRow: (ctx: HojaSectionCompletionContext) => readonly [string, string, string];
};

const definitionById = new Map(
  HOJA_SECTION_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const entry = (
  id: HojaSectionId,
  icon: LucideIcon,
  color: string,
  isComplete: HojaSectionRegistryEntry["isComplete"],
  renderContent: (runtime: HojaSectionRuntime) => ReactNode,
): HojaSectionRegistryEntry => {
  const definition = definitionById.get(id);
  if (!definition) throw new Error(`Sección de Hoja de Ruta no registrada: ${id}`);

  return {
    ...definition,
    icon,
    color,
    isComplete,
    render: (runtime) => (
      <TabsContent key={id} value={id} className="mt-0" id={`panel-${id}`} role="tabpanel">
        {renderContent(runtime)}
      </TabsContent>
    ),
    exportRow: (ctx) => [
      definition.label,
      isComplete(ctx) ? "Completa" : "Pendiente",
      definition.printParts.join(", "),
    ] as const,
  };
};

export const HOJA_SECTION_REGISTRY: readonly HojaSectionRegistryEntry[] = [
  entry(
    "event",
    Calendar,
    "text-blue-600",
    ({ eventData }) => Boolean(eventData.eventName && eventData.eventDates),
    (runtime) => <EventSectionView runtime={runtime} />,
  ),
  entry(
    "venue",
    MapPin,
    "text-green-600",
    ({ eventData }) => Boolean(eventData.venue.name && eventData.venue.address),
    (runtime) => <VenueSectionView runtime={runtime} />,
  ),
  entry(
    "weather",
    CloudSun,
    "text-sky-600",
    ({ eventData }) => Boolean(eventData.weather?.length),
    (runtime) => <WeatherSectionView runtime={runtime} />,
  ),
  entry(
    "contacts",
    Phone,
    "text-purple-600",
    ({ eventData }) =>
      eventData.contacts.some((contact) =>
        Boolean(contact.name && (contact.phone || contact.email))
      ),
    (runtime) => <ContactsSectionView runtime={runtime} />,
  ),
  entry(
    "staff",
    Users,
    "text-orange-600",
    ({ eventData }) =>
      eventData.staff.some((staff) => Boolean(staff.name && staff.position)),
    (runtime) => <StaffSectionView runtime={runtime} />,
  ),
  entry(
    "travel",
    Car,
    "text-cyan-600",
    ({ travelArrangements }) =>
      travelArrangements.some((travel) => Boolean(travel.transportation_type)),
    (runtime) => <TravelSectionView runtime={runtime} />,
  ),
  entry(
    "accommodation",
    Bed,
    "text-pink-600",
    ({ accommodations }) =>
      accommodations.some((accommodation) =>
        Boolean(
          accommodation.hotel_name
          || accommodation.rooms.some((room) => room.room_type),
        )
      ),
    (runtime) => <AccommodationSectionView runtime={runtime} />,
  ),
  entry(
    "logistics",
    Building2,
    "text-indigo-600",
    ({ eventData }) =>
      Boolean(
        eventData.logistics.transport.length
        || eventData.logistics.loadingDetails
        || eventData.logistics.unloadingDetails
        || eventData.logistics.equipmentLogistics,
      ),
    (runtime) => <LogisticsSectionView runtime={runtime} />,
  ),
  entry(
    "schedule",
    Activity,
    "text-red-600",
    ({ eventData }) =>
      Boolean(
        eventData.schedule
        || eventData.programScheduleDays?.some((day) => day.rows.length)
        || eventData.powerRequirements,
      ),
    (runtime) => <ScheduleSectionView runtime={runtime} />,
  ),
  entry(
    "restaurants",
    UtensilsCrossed,
    "text-emerald-600",
    ({ eventData }) =>
      Boolean(eventData.restaurants?.some((restaurant) => restaurant.isSelected)),
    (runtime) => <RestaurantsSectionView runtime={runtime} />,
  ),
] as const;

export const getHojaSectionRegistryEntry = (
  id: HojaSectionId,
): HojaSectionRegistryEntry | undefined =>
  HOJA_SECTION_REGISTRY.find((section) => section.id === id);
