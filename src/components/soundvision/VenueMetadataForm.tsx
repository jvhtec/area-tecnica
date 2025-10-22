import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlaceAutocomplete } from '@/components/maps/PlaceAutocomplete';

export interface VenueFormData {
  venueName: string;
  venueCity: string;
  venueStateRegion: string;
  venueCountry: string;
  venueAddress: string;
  venueCapacity: string;
  venueNotes: string;
  googlePlaceId: string;
  coordinates: { lat: number; lng: number } | null;
}

interface VenueMetadataFormProps {
  form: UseFormReturn<VenueFormData>;
}

interface PlaceResult {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  place_id?: string;
}

export const VenueMetadataForm = ({ form }: VenueMetadataFormProps) => {
  const handlePlaceSelect = (place: PlaceResult) => {
    if (!place) return;

    // For now, set basic info from the place result
    // The PlaceAutocomplete component returns name and address
    form.setValue('venueName', place.name || '');
    form.setValue('venueAddress', place.address || '');
    form.setValue('googlePlaceId', place.place_id || '');
    
    if (place.coordinates) {
      form.setValue('coordinates', place.coordinates);
    }

    // Extract city, state, country from address (basic parsing)
    // This is simplified - in production you'd want more robust parsing
    const addressParts = place.address.split(',').map(s => s.trim());
    if (addressParts.length >= 2) {
      form.setValue('venueCity', addressParts[0] || '');
      form.setValue('venueCountry', addressParts[addressParts.length - 1] || '');
      if (addressParts.length >= 3) {
        form.setValue('venueStateRegion', addressParts[addressParts.length - 2] || '');
      }
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="venueName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Venue Name *</FormLabel>
            <FormControl>
              <PlaceAutocomplete
                value={field.value}
                onSelect={handlePlaceSelect}
                placeholder="Search for venue..."
                onInputChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="venueCity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Madrid" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="venueStateRegion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State/Region</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Community of Madrid" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="venueCountry"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country *</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Spain" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="venueCapacity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Venue Capacity (optional)</FormLabel>
            <FormControl>
              <Input {...field} type="number" placeholder="5000" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="venueNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Additional Notes (optional)</FormLabel>
            <FormControl>
              <Textarea {...field} placeholder="Any additional information about the venue setup..." rows={3} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
