import { FestivalDocumentsCard } from "@/components/festival/management/FestivalDocumentsCard";
import { FestivalManagementHeader } from "@/components/festival/management/FestivalManagementHeader";
import { FestivalQuickActions } from "@/components/festival/management/FestivalQuickActions";
import { FestivalWeatherSection } from "@/components/festival/FestivalWeatherSection";
import type { FestivalManagementVm } from "@/features/festival-management/types";

import { FestivalManagementDialogs } from "./FestivalManagementDialogs";
import { FestivalManagementNavCards } from "./FestivalManagementNavCards";

export const FestivalManagementView = ({ vm }: { vm: FestivalManagementVm }) => {
  const {
    artistCount,
    canEdit,
    isArtistRoute,
    isGearRoute,
    isPlanningViewOnly,
    isSchedulingRoute,
    isViewOnly,
    jobDates,
    jobId,
    handleOpenRiderLibrary,
    navigate,
    venueData,
    workspaceProfile,
  } = vm;

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
      <FestivalManagementHeader vm={vm} />

      {!isSchedulingRoute && !isArtistRoute && !isGearRoute && (
        <>
          <FestivalManagementNavCards
            artistCount={artistCount}
            canImportRiders={canEdit}
            isPlanningViewOnly={isPlanningViewOnly}
            isViewOnly={isViewOnly}
            jobId={jobId}
            modules={workspaceProfile.modules}
            navigate={navigate}
            onOpenRiderLibrary={() => handleOpenRiderLibrary()}
          />

          <FestivalQuickActions vm={vm} />

          <FestivalWeatherSection jobId={jobId} venue={venueData} jobDates={jobDates} />

          <FestivalDocumentsCard vm={vm} />
        </>
      )}

      <FestivalManagementDialogs vm={vm} />
    </div>
  );
};
