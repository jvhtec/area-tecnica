import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useLocationManagement, type LocationDetails } from "@/hooks/useLocationManagement";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";

type PlacePick = { name: string; address: string; coordinates?: { lat: number; lng: number }; place_id?: string };

/**
 * A logistics event's own place (`logistics_events.location_id`), edited through the
 * same `locations` rows jobs use. `locationId` is the stored row, a fresh pick is
 * resolved to a row on submit, and clearing the input drops both.
 */
export function useLogisticsEventLocation(open: boolean) {
  const [locationId, setLocationId] = useState<string | null>(null);
  const [picked, setPicked] = useState<LocationDetails | null>(null);
  const [input, setInput] = useState("");
  const { getOrCreateLocationWithDetails } = useLocationManagement();

  // The stored place, so an edit shows its name without a fresh search.
  const { data: stored } = useQuery({
    queryKey: queryKeys.scope("logistics-event-location", locationId ?? ""),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("locations")
        .select("id, name, formatted_address")
        .eq("id", locationId ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && Boolean(locationId) && !picked,
  });

  useEffect(() => {
    if (stored && !picked) setInput(stored.name);
  }, [stored, picked]);

  /** Called when the dialog (re)opens: start from the stored row, if any. */
  const reset = useCallback((storedId: string | null) => {
    setLocationId(storedId);
    setPicked(null);
    setInput("");
  }, []);

  const onInputChange = useCallback((value: string) => {
    setInput(value);
    // Typing after either a stored value or an autocomplete pick invalidates the
    // old selection. Keeping the old id here made the UI display one place while
    // resolve() silently saved another.
    setPicked(null);
    const storedName = stored?.name?.trim() ?? "";
    if (!value.trim() || value.trim() !== storedName) {
      setLocationId(null);
    }
  }, [stored?.name]);

  const onSelect = useCallback((result: PlacePick) => {
    setInput(result.name);
    setPicked({ name: result.name, address: result.address, coordinates: result.coordinates, place_id: result.place_id });
  }, []);

  /** Row id to store: a fresh pick becomes a `locations` row, an untouched field keeps its id. */
  const resolve = useCallback(async (): Promise<string | null> => {
    if (picked) return getOrCreateLocationWithDetails(picked);
    // onInputChange clears locationId when the user actually clears or edits the
    // field. Keeping it here preserves an untouched stored place even if its
    // display name is still loading when the form is submitted.
    return locationId;
  }, [picked, locationId, getOrCreateLocationWithDetails]);

  return { input, reset, onInputChange, onSelect, resolve };
}

export type LogisticsEventLocation = ReturnType<typeof useLogisticsEventLocation>;
