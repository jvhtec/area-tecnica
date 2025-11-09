import React, { useCallback, useState } from 'react';
import type { PlaceSelection } from '@/types/places';

interface ApplePlacePickerTriggerProps {
  open: () => void;
  loading: boolean;
}

interface ApplePlacePickerProps {
  onSelect: (place: PlaceSelection) => void;
  trigger: (props: ApplePlacePickerTriggerProps) => React.ReactNode;
  initialQuery?: string;
  onBusyChange?: (busy: boolean) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

const normalizeApplePlace = (rawPlace: any): PlaceSelection => {
  const name = rawPlace?.name || rawPlace?.title || rawPlace?.displayName || '';
  const subtitle = rawPlace?.subtitle || rawPlace?.secondaryText || rawPlace?.formattedAddress;
  const address = rawPlace?.formattedAddress || subtitle || name;

  const latitude = rawPlace?.coordinate?.latitude ?? rawPlace?.location?.latitude ?? rawPlace?.location?.lat ?? rawPlace?.lat;
  const longitude = rawPlace?.coordinate?.longitude ?? rawPlace?.location?.longitude ?? rawPlace?.location?.lng ?? rawPlace?.lng;

  return {
    name,
    address: address || '',
    coordinates:
      typeof latitude === 'number' && typeof longitude === 'number'
        ? { lat: latitude, lng: longitude }
        : null,
  };
};

export const ApplePlacePicker: React.FC<ApplePlacePickerProps> = ({
  onSelect,
  trigger,
  initialQuery,
  onBusyChange,
  onError,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);

  const openPicker = useCallback(async () => {
    setLoading(true);
    onBusyChange?.(true);

    try {
      // Dynamically import native iOS module (only available in Capacitor iOS builds)
      let module;
      try {
        module = await import(/* @vite-ignore */ 'expo-apple-maps-sheet');
      } catch (importError) {
        // Module doesn't exist in web environment - this is expected
        throw new Error('Apple Maps place picker is only available on iOS devices.');
      }
      
      const present =
        module.presentAppleMapsPlacePicker ||
        module.presentPlacePicker ||
        module.presentAppleMapsSheet;

      if (typeof present !== 'function') {
        throw new Error('Apple Maps place picker is not available on this device.');
      }

      const result = await present({
        searchQuery: initialQuery,
      });

      const status = result?.status || result?.result;
      if (status && typeof status === 'string' && status.toLowerCase().startsWith('cancel')) {
        onCancel?.();
        return;
      }

      const rawPlace = result?.place || result?.value || result;
      if (!rawPlace) {
        onCancel?.();
        return;
      }

      const normalized = normalizeApplePlace(rawPlace);
      onSelect(normalized);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to open Apple Maps picker');
      console.error('ApplePlacePicker error:', err);
      onError?.(err);
    } finally {
      setLoading(false);
      onBusyChange?.(false);
    }
  }, [initialQuery, onBusyChange, onCancel, onError, onSelect]);

  return <>{trigger({ open: openPicker, loading })}</>;
};

export default ApplePlacePicker;
