import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { useJobSelection } from "@/hooks/useJobSelection";
import { supabase } from "@/lib/supabase";
import type {
  Accommodation,
  EventData,
  HojaDeRutaImageRecord,
  Transport,
  TravelArrangement,
} from "@/types/hoja-de-ruta";
import { createHojaDocumentSnapshot } from "@/utils/hoja-de-ruta/documentSnapshot";
import {
  adjustAccommodationsForStaffRemoval,
  syncTransportsWithLogistics,
} from "@/utils/hoja-de-ruta/staffSync";

import { useHojaDeRutaInitialization } from "./hoja-de-ruta/useHojaDeRutaInitialization";
import { useHojaDeRutaSave } from "./hoja-de-ruta/useHojaDeRutaSave";
import { useHojaDeRutaPersistence } from "./useHojaDeRutaPersistence";
import { useHojaDeRutaState } from "./hoja-de-ruta/useHojaDeRutaState";

type UseHojaDeRutaFormOptions = {
  prepareImagesForSave: (jobId: string) => Promise<HojaDeRutaImageRecord[]>;
  commitImageSave: () => Promise<void>;
  isImageDirty: boolean;
};

export const useHojaDeRutaForm = ({
  prepareImagesForSave,
  commitImageSave,
  isImageDirty,
}: UseHojaDeRutaFormOptions) => {
  const { toast } = useToast();
  const {
    eventData,
    setEventData,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    selectedJobId,
    setSelectedJobId,
    isInitialized,
    setIsInitialized,
  } = useHojaDeRutaState();

  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection(selectedJobId);

  const [hasSavedData, setHasSavedData] = useState(false);
  const [hasBasicJobData, setHasBasicJobData] = useState(false);
  const [dataSource, setDataSource] = useState<"none" | "saved" | "job" | "mixed">("none");
  const [lastSaveTime, setLastSaveTime] = useState(0);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [hasExternalConflict, setHasExternalConflict] = useState(false);

  const {
    hojaDeRuta,
    isLoading: isLoadingHojaDeRuta,
    isFetching: isFetchingHojaDeRuta,
    fetchError,
    saveAll,
    isSaving,
    forceRefetch,
  } = useHojaDeRutaPersistence(selectedJobId);

  const { autoPopulateBasicJobData } = useHojaDeRutaInitialization(
    selectedJobId,
    hojaDeRuta,
    isLoadingHojaDeRuta || isFetchingHojaDeRuta,
    isInitialized,
    setEventData,
    setTravelArrangements,
    setAccommodations,
    setIsInitialized,
    setHasSavedData,
    setHasBasicJobData,
    setDataSource,
  );

  const snapshot = useMemo(
    () => createHojaDocumentSnapshot(eventData, travelArrangements, accommodations),
    [eventData, travelArrangements, accommodations],
  );
  const savedSnapshotRef = useRef<string | null>(null);
  const baselineJobRef = useRef("");

  useEffect(() => {
    if (baselineJobRef.current === selectedJobId) return;
    baselineJobRef.current = selectedJobId;
    savedSnapshotRef.current = null;
    setDocumentVersion(0);
    setHasExternalConflict(false);
    setHasSavedData(false);
    setHasBasicJobData(false);
    setDataSource("none");
    setLastSaveTime(0);
    if (selectedJobId) void forceRefetch();
  }, [forceRefetch, selectedJobId]);

  useEffect(() => {
    if (!isInitialized || savedSnapshotRef.current !== null) return;
    savedSnapshotRef.current = snapshot;
    setDocumentVersion(Number(hojaDeRuta?.document_version || 0));
  }, [hojaDeRuta?.document_version, isInitialized, snapshot]);

  const markSaved = useCallback(() => {
    savedSnapshotRef.current = snapshot;
    setHasExternalConflict(false);
    setHasSavedData(true);
  }, [snapshot]);

  const isDirty = Boolean(
    isInitialized
    && savedSnapshotRef.current !== null
    && (savedSnapshotRef.current !== snapshot || isImageDirty),
  );

  const { handleSaveAll } = useHojaDeRutaSave({
    selectedJobId,
    eventData,
    travelArrangements,
    accommodations,
    expectedVersion: documentVersion,
    saveAll,
    prepareImagesForSave,
    commitImageSave,
    setLastSaveTime,
    markSaved,
    onSavedVersion: setDocumentVersion,
  });

  useEffect(() => {
    if (!fetchError) return;
    toast({
      title: "Error",
      description: "No se pudieron cargar los datos guardados. Inténtalo de nuevo.",
      variant: "destructive",
    });
  }, [fetchError, toast]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Detect a newer document version saved by another editor. The RPC remains
  // the final authority and rejects stale writes with SQLSTATE 40001.
  useEffect(() => {
    if (!selectedJobId || !isInitialized) return;

    const channel = supabase
      .channel(`hoja-editor:${selectedJobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hoja_de_ruta",
          filter: `job_id=eq.${selectedJobId}`,
        },
        (payload) => {
          const nextVersion = Number((payload.new as { document_version?: unknown }).document_version || 0);
          if (!isSaving && nextVersion > documentVersion) {
            setHasExternalConflict(true);
            toast({
              title: "Cambios externos",
              description: "Otra persona ha guardado una versión más reciente de esta Hoja de Ruta.",
              variant: "destructive",
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [documentVersion, isInitialized, isSaving, selectedJobId, toast]);

  const handleContactChange = useCallback((index: number, field: string, value: string) => {
    setEventData((prev) => ({
      ...prev,
      contacts: (prev.contacts || []).map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    }));
  }, [setEventData]);

  const addContact = useCallback(() => {
    setEventData((prev) => ({
      ...prev,
      contacts: [
        ...(prev.contacts || []),
        { id: crypto.randomUUID(), name: "", role: "", phone: "", email: "" },
      ],
    }));
  }, [setEventData]);

  const removeContact = useCallback((index: number) => {
    setEventData((prev) => {
      const next = (prev.contacts || []).filter((_, i) => i !== index);
      return {
        ...prev,
        contacts: next.length
          ? next
          : [{ id: crypto.randomUUID(), name: "", role: "", phone: "", email: "" }],
      };
    });
  }, [setEventData]);

  const handleStaffChange = useCallback((index: number, field: string, value: string) => {
    setEventData((prev) => ({
      ...prev,
      staff: (prev.staff || []).map((staff, i) =>
        i === index ? { ...staff, [field]: value } : staff
      ),
    }));
  }, [setEventData]);

  const addStaffMember = useCallback(() => {
    setEventData((prev) => ({
      ...prev,
      staff: [
        ...(prev.staff || []),
        {
          id: crypto.randomUUID(),
          name: "",
          surname1: "",
          surname2: "",
          position: "",
          dni: "",
        },
      ],
    }));
  }, [setEventData]);

  const removeStaffMember = useCallback((index: number) => {
    const removedEntry = eventData.staff?.[index];
    setEventData((prev) => {
      const next = (prev.staff || []).filter((_, i) => i !== index);
      return {
        ...prev,
        staff: next.length
          ? next
          : [{
              id: crypto.randomUUID(),
              name: "",
              surname1: "",
              surname2: "",
              position: "",
              dni: "",
            }],
      };
    });
    setAccommodations((prev) => adjustAccommodationsForStaffRemoval(prev, index, removedEntry));
  }, [eventData.staff, setAccommodations, setEventData]);

  const updateTravelArrangement = useCallback((
    index: number,
    field: string,
    value: string | undefined,
  ) => {
    setTravelArrangements((prev) =>
      prev.map((arrangement, i) =>
        i === index ? { ...arrangement, [field]: value } : arrangement
      )
    );
  }, [setTravelArrangements]);

  const addTravelArrangement = useCallback(() => {
    setTravelArrangements((prev) => [...prev, {
      id: crypto.randomUUID(),
      transportation_type: "van",
      pickup_address: "",
      pickup_time: "",
      departure_time: "",
      arrival_time: "",
      flight_train_number: "",
      driver_name: "",
      driver_phone: "",
      plate_number: "",
      notes: "",
    }]);
  }, [setTravelArrangements]);

  const removeTravelArrangement = useCallback((index: number) => {
    setTravelArrangements((prev) => prev.filter((_, i) => i !== index));
  }, [setTravelArrangements]);

  const updateAccommodation = useCallback((index: number, field: string, value: unknown) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === index ? { ...accommodation, [field]: value } : accommodation
      )
    );
  }, [setAccommodations]);

  const addAccommodation = useCallback(() => {
    setAccommodations((prev) => [...prev, {
      id: crypto.randomUUID(),
      hotel_name: "",
      address: "",
      check_in: "",
      check_out: "",
      rooms: [],
    }]);
  }, [setAccommodations]);

  const removeAccommodation = useCallback((index: number) => {
    setAccommodations((prev) => prev.filter((_, i) => i !== index));
  }, [setAccommodations]);

  const updateRoom = useCallback((
    accommodationIndex: number,
    roomIndex: number,
    field: string,
    value: string,
  ) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === accommodationIndex
          ? {
              ...accommodation,
              rooms: accommodation.rooms.map((room, j) =>
                j === roomIndex ? { ...room, [field]: value } : room
              ),
            }
          : accommodation
      )
    );
  }, [setAccommodations]);

  const addRoom = useCallback((accommodationIndex: number) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === accommodationIndex
          ? {
              ...accommodation,
              rooms: [...accommodation.rooms, {
                id: crypto.randomUUID(),
                room_type: "single",
                room_number: "",
                staff_member1_id: "",
                staff_member2_id: "",
              }],
            }
          : accommodation
      )
    );
  }, [setAccommodations]);

  const removeRoom = useCallback((accommodationIndex: number, roomIndex: number) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === accommodationIndex
          ? { ...accommodation, rooms: accommodation.rooms.filter((_, j) => j !== roomIndex) }
          : accommodation
      )
    );
  }, [setAccommodations]);

  const updateTransport = useCallback((index: number, field: string, value: unknown) => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: prev.logistics.transport.map((transport, i) =>
          i === index ? { ...transport, [field]: value } : transport
        ),
      },
    }));
  }, [setEventData]);

  const addTransport = useCallback(() => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: [...prev.logistics.transport, {
          id: crypto.randomUUID(),
          transport_type: "trailer",
          driver_name: "",
          driver_phone: "",
          license_plate: "",
          has_return: false,
          is_hoja_relevant: true,
          logistics_categories: [],
        }],
      },
    }));
  }, [setEventData]);

  const removeTransport = useCallback((index: number) => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: prev.logistics.transport.filter((_, i) => i !== index),
      },
    }));
  }, [setEventData]);

  const importTransports = useCallback((transports: Transport[]) => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: syncTransportsWithLogistics(
          Array.isArray(prev.logistics.transport) ? prev.logistics.transport : [],
          transports,
        ),
      },
    }));
  }, [setEventData]);

  const reloadLatest = useCallback(async () => {
    savedSnapshotRef.current = null;
    setHasExternalConflict(false);
    setIsInitialized(false);
    await forceRefetch();
  }, [forceRefetch, setIsInitialized]);

  return {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    isLoadingJobs,
    isLoadingHojaDeRuta,
    isSaving,
    jobs,
    hojaDeRuta,
    handleSaveAll,
    autoPopulateFromJob: autoPopulateBasicJobData,
    autoPopulateBasicJobData,
    refreshData: forceRefetch,
    reloadLatest,
    isInitialized,
    hasSavedData,
    hasBasicJobData,
    dataSource,
    isDirty,
    hasExternalConflict,
    documentVersion,
    handleContactChange,
    addContact,
    removeContact,
    handleStaffChange,
    addStaffMember,
    removeStaffMember,
    updateTravelArrangement,
    addTravelArrangement,
    removeTravelArrangement,
    updateAccommodation,
    addAccommodation,
    removeAccommodation,
    updateRoom,
    addRoom,
    removeRoom,
    updateTransport,
    addTransport,
    removeTransport,
    importTransports,
    fetchError,
    lastSaveTime,
  };
};
