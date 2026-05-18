import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query";
import {
  createTourGuestLink,
  deleteTimelineEvent,
  deleteTravelSegment,
  fetchTourGuestLinks,
  fetchTourOpsModel,
  fetchTourOpsShare,
  migrateLegacyTravelPlan,
  revokeTourGuestLink,
  deleteAccommodation,
  saveAccommodation,
  saveProgramSchedule,
  saveTimelineEvent,
  setTourGuestLinkAccess,
  saveTravelSegment,
  syncHojaRutaOpsData,
  updateTourDocumentGuestVisibility,
} from "@/features/tour-ops/tourSchedulingService";
import type {
  TourGuestLink,
  TourOpsAllowedSections,
  TourOpsAccommodation,
  TourOpsModel,
  TourOpsProjection,
  TourOpsTimelineEvent,
  TourOpsTravelSegment,
} from "@/features/tour-ops/types";

export const tourOpsQueryKey = (tourId: string, projection: TourOpsProjection) =>
  queryKeys.scope("tour-ops", tourId, projection);

export function useTourOps(tourId: string, projection: TourOpsProjection = "management", currentUserId?: string | null) {
  return useQuery({
    queryKey: tourOpsQueryKey(tourId, projection),
    queryFn: () => fetchTourOpsModel(tourId, projection, { currentUserId }),
    enabled: Boolean(tourId),
  });
}

export function useTourOpsShare(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scope("tour-ops-share", token ?? ""),
    queryFn: () => fetchTourOpsShare(token ?? ""),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useTourOpsMutations(tourId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-ops", tourId) });

  const saveEvent = useMutation({
    mutationFn: (input: Partial<TourOpsTimelineEvent> & { tourId: string; date: string; title: string }) =>
      saveTimelineEvent(input),
    onSuccess: invalidate,
  });

  const saveProgram = useMutation({
    mutationFn: saveProgramSchedule,
    onSuccess: invalidate,
  });

  const removeEvent = useMutation({
    mutationFn: deleteTimelineEvent,
    onSuccess: invalidate,
  });

  const saveTravel = useMutation({
    mutationFn: (input: Partial<TourOpsTravelSegment> & { tourId: string }) => saveTravelSegment(input),
    onSuccess: invalidate,
  });

  const removeTravel = useMutation({
    mutationFn: deleteTravelSegment,
    onSuccess: invalidate,
  });

  const saveHotel = useMutation({
    mutationFn: (input: Partial<TourOpsAccommodation> & { tourId: string }) => saveAccommodation(input),
    onSuccess: invalidate,
  });

  const removeHotel = useMutation({
    mutationFn: (input: { id: string; source?: TourOpsAccommodation["source"] }) => deleteAccommodation(input),
    onSuccess: invalidate,
  });

  const migrateTravel = useMutation({
    mutationFn: (model: TourOpsModel) => migrateLegacyTravelPlan(model),
    onSuccess: invalidate,
  });

  const syncHojaOps = useMutation({
    mutationFn: (model: TourOpsModel) => syncHojaRutaOpsData(model),
    onSuccess: invalidate,
  });

  const setGuestDocumentVisibility = useMutation({
    mutationFn: ({ documentId, visibleToGuest }: { documentId: string; visibleToGuest: boolean }) =>
      updateTourDocumentGuestVisibility(documentId, visibleToGuest),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-documents", tourId) });
    },
  });

  return {
    saveEvent,
    saveProgram,
    removeEvent,
    saveTravel,
    removeTravel,
    saveHotel,
    removeHotel,
    migrateTravel,
    syncHojaOps,
    setGuestDocumentVisibility,
  };
}

export function useTourGuestLinks(tourId: string) {
  return useQuery({
    queryKey: queryKeys.scope("tour-guest-links", tourId),
    queryFn: () => fetchTourGuestLinks(tourId),
    enabled: Boolean(tourId),
  });
}

export function useTourGuestLinkMutations(tourId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-guest-links", tourId) });

  const createLink = useMutation({
    mutationFn: (input: { label: string; allowedSections: TourOpsAllowedSections; accessLevel?: "view" | "edit"; expiresAt?: string | null }) =>
      createTourGuestLink({ tourId, ...input }),
    onSuccess: invalidate,
  });

  const revokeLink = useMutation({
    mutationFn: (link: TourGuestLink) => revokeTourGuestLink(link.id),
    onSuccess: invalidate,
  });

  const setLinkAccess = useMutation({
    mutationFn: (input: { linkId: string; accessLevel: "disabled" | "view" | "edit" }) => setTourGuestLinkAccess(input),
    onSuccess: invalidate,
  });

  return { createLink, revokeLink, setLinkAccess };
}
