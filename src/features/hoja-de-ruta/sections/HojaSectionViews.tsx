import type { ComponentProps } from "react";

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
import { useHojaSection } from "@/features/hoja-de-ruta/model/HojaDocumentContext";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";

export type HojaSectionRuntime = {
  hideJobSelection: boolean;
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (
    sectionId: HojaDeRutaPrintSectionId,
    isExcluded: boolean,
  ) => void;
  venue: Pick<
    ComponentProps<typeof ModernVenueSection>,
    | "images"
    | "imagePreviews"
    | "onImageUpload"
    | "onRemoveImage"
    | "onVenueMapUpload"
    | "handleVenueMapUrl"
    | "appendVenuePreviews"
  >;
};

const printProps = (runtime: HojaSectionRuntime) => ({
  isPrintSectionExcluded: runtime.isPrintSectionExcluded,
  onPrintSectionExcludedChange: runtime.onPrintSectionExcludedChange,
});

export const EventSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("event");
  return (
    <ModernEventSection
      eventData={slice.eventData}
      setEventData={slice.setEventData}
      selectedJobId={slice.selectedJobId}
      setSelectedJobId={slice.setSelectedJobId}
      jobs={slice.jobs}
      isLoadingJobs={slice.isLoadingJobs}
      jobDetails={null}
      onAutoPopulate={() => void slice.refreshFromJob(slice.selectedJobId)}
      hideJobSelection={runtime.hideJobSelection}
      {...printProps(runtime)}
    />
  );
};

export const VenueSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("venue");
  return (
    <ModernVenueSection
      eventData={slice.eventData}
      setEventData={slice.setEventData}
      {...runtime.venue}
      {...printProps(runtime)}
    />
  );
};

export const WeatherSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("weather");
  return (
    <ModernWeatherSection
      eventData={slice.eventData}
      setEventData={slice.setEventData}
      {...printProps(runtime)}
    />
  );
};

export const ContactsSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("contacts");
  return (
    <ModernContactsSection
      eventData={slice.eventData}
      onContactChange={slice.handleContactChange}
      onAddContact={slice.addContact}
      onRemoveContact={slice.removeContact}
      {...printProps(runtime)}
    />
  );
};

export const StaffSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("staff");
  return (
    <ModernStaffSection
      eventData={slice.eventData}
      onStaffChange={slice.handleStaffChange}
      onAddStaff={slice.addStaffMember}
      onRemoveStaff={slice.removeStaffMember}
      {...printProps(runtime)}
    />
  );
};

export const TravelSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("travel");
  return (
    <ModernTravelSection
      travelArrangements={slice.travelArrangements}
      onUpdate={slice.updateTravelArrangement}
      onAdd={slice.addTravelArrangement}
      onRemove={slice.removeTravelArrangement}
      {...printProps(runtime)}
    />
  );
};

export const AccommodationSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("accommodation");
  return (
    <ModernAccommodationSection
      accommodations={slice.accommodations}
      eventData={slice.eventData}
      onUpdateAccommodation={(index, data) => {
        slice.setAccommodations((previous) =>
          previous.map((accommodation, currentIndex) =>
            currentIndex === index ? { ...accommodation, ...data } : accommodation
          )
        );
      }}
      onUpdateRoom={slice.updateRoom}
      onAddAccommodation={slice.addAccommodation}
      onRemoveAccommodation={slice.removeAccommodation}
      onAddRoom={slice.addRoom}
      onRemoveRoom={slice.removeRoom}
      {...printProps(runtime)}
    />
  );
};

export const LogisticsSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("logistics");
  return (
    <ModernLogisticsSection
      eventData={slice.eventData}
      setEventData={slice.setEventData}
      onUpdateTransport={slice.updateTransport}
      onAddTransport={slice.addTransport}
      onRemoveTransport={slice.removeTransport}
      onImportTransports={slice.importTransports}
      jobId={slice.selectedJobId}
      {...printProps(runtime)}
    />
  );
};

export const ScheduleSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("schedule");
  return (
    <ModernScheduleSection
      eventData={slice.eventData}
      setEventData={slice.setEventData}
      {...printProps(runtime)}
    />
  );
};

export const RestaurantsSectionView = ({ runtime }: { runtime: HojaSectionRuntime }) => {
  const slice = useHojaSection("restaurants");
  return (
    <ModernRestaurantSection
      eventData={slice.eventData}
      onUpdateEventData={slice.setEventData}
      accommodations={slice.accommodations}
      {...printProps(runtime)}
    />
  );
};
