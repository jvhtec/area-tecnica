import type { ComponentProps, ReactNode } from "react";
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

import { ModernAccommodationSection } from "@/components/hoja-de-ruta/sections/ModernAccommodationSection";
import { ModernContactsSection } from "@/components/hoja-de-ruta/sections/ModernContactsSection";
import { ModernEventSection } from "@/components/hoja-de-ruta/sections/ModernEventSection";
import { ModernLogisticsSection } from "@/components/hoja-de-ruta/sections/ModernLogisticsSection";
import { ModernRestaurantSection } from "@/components/hoja-de-ruta/sections/ModernRestaurantSection";
import { ModernScheduleSection } from "@/components/hoja-de-ruta/sections/ModernScheduleSection";
import { ModernStaffSection } from "@/components/hoja-de-ruta/sections/ModernStaffSection";
import { ModernTravelSection } from "@/components/hoja-de-ruta/sections/ModernTravelSection";
import { ModernVenueSection } from "@/components/hoja-de-ruta/sections/ModernVenueSection";
import { ModernWeatherSection } from "@/components/hoja-de-ruta/sections/ModernWeatherSection";
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

export type HojaSectionRenderContext = {
  event: ComponentProps<typeof ModernEventSection>;
  venue: ComponentProps<typeof ModernVenueSection>;
  weather: ComponentProps<typeof ModernWeatherSection>;
  contacts: ComponentProps<typeof ModernContactsSection>;
  staff: ComponentProps<typeof ModernStaffSection>;
  travel: ComponentProps<typeof ModernTravelSection>;
  accommodation: ComponentProps<typeof ModernAccommodationSection>;
  logistics: ComponentProps<typeof ModernLogisticsSection>;
  schedule: ComponentProps<typeof ModernScheduleSection>;
  restaurants: ComponentProps<typeof ModernRestaurantSection>;
};

export type HojaSectionRegistryEntry = {
  id: HojaSectionId;
  label: string;
  filenameLabel: string;
  icon: LucideIcon;
  color: string;
  printParts: readonly HojaPrintPartId[];
  isComplete: (ctx: HojaSectionCompletionContext) => boolean;
  render: (ctx: HojaSectionRenderContext) => ReactNode;
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
  renderContent: (ctx: HojaSectionRenderContext) => ReactNode,
): HojaSectionRegistryEntry => {
  const definition = definitionById.get(id);
  if (!definition) throw new Error(`Sección de Hoja de Ruta no registrada: ${id}`);

  return {
    ...definition,
    icon,
    color,
    isComplete,
    render: (ctx) => (
      <TabsContent key={id} value={id} className="mt-0" id={`panel-${id}`} role="tabpanel">
        {renderContent(ctx)}
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
    (ctx) => <ModernEventSection {...ctx.event} />,
  ),
  entry(
    "venue",
    MapPin,
    "text-green-600",
    ({ eventData }) => Boolean(eventData.venue.name && eventData.venue.address),
    (ctx) => <ModernVenueSection {...ctx.venue} />,
  ),
  entry(
    "weather",
    CloudSun,
    "text-sky-600",
    ({ eventData }) => Boolean(eventData.weather?.length),
    (ctx) => <ModernWeatherSection {...ctx.weather} />,
  ),
  entry(
    "contacts",
    Phone,
    "text-purple-600",
    ({ eventData }) =>
      eventData.contacts.some((contact) =>
        Boolean(contact.name && (contact.phone || contact.email))
      ),
    (ctx) => <ModernContactsSection {...ctx.contacts} />,
  ),
  entry(
    "staff",
    Users,
    "text-orange-600",
    ({ eventData }) =>
      eventData.staff.some((staff) => Boolean(staff.name && staff.position)),
    (ctx) => <ModernStaffSection {...ctx.staff} />,
  ),
  entry(
    "travel",
    Car,
    "text-cyan-600",
    ({ travelArrangements }) =>
      travelArrangements.some((travel) => Boolean(travel.transportation_type)),
    (ctx) => <ModernTravelSection {...ctx.travel} />,
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
    (ctx) => <ModernAccommodationSection {...ctx.accommodation} />,
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
    (ctx) => <ModernLogisticsSection {...ctx.logistics} />,
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
    (ctx) => <ModernScheduleSection {...ctx.schedule} />,
  ),
  entry(
    "restaurants",
    UtensilsCrossed,
    "text-emerald-600",
    ({ eventData }) =>
      Boolean(eventData.restaurants?.some((restaurant) => restaurant.isSelected)),
    (ctx) => <ModernRestaurantSection {...ctx.restaurants} />,
  ),
] as const;

export const getHojaSectionRegistryEntry = (
  id: HojaSectionId,
): HojaSectionRegistryEntry | undefined =>
  HOJA_SECTION_REGISTRY.find((section) => section.id === id);
