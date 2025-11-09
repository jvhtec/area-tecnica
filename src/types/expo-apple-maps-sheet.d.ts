declare module 'expo-apple-maps-sheet' {
  export interface AppleMapsPlacePickerResult {
    status?: string;
    place?: AppleMapsPlace;
    value?: AppleMapsPlace;
  }

  export interface AppleMapsPlace {
    name?: string;
    title?: string;
    displayName?: string;
    subtitle?: string;
    secondaryText?: string;
    formattedAddress?: string;
    coordinate?: { latitude?: number; longitude?: number };
    location?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
    lat?: number;
    lng?: number;
  }

  export function presentAppleMapsPlacePicker(options?: { searchQuery?: string }): Promise<AppleMapsPlacePickerResult | AppleMapsPlace | null>;
  export const presentPlacePicker: typeof presentAppleMapsPlacePicker | undefined;
  export const presentAppleMapsSheet: typeof presentAppleMapsPlacePicker | undefined;
}
