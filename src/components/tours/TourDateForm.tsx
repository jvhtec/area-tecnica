
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


import { queryKeys } from "@/lib/react-query";
interface TourDateFormProps {
  tourId: string;
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TourDateForm = ({
  tourId,
  initialData,
  onSuccess,
  onCancel,
}: TourDateFormProps) => {
  const [date, setDate] = useState(initialData?.date || "");
  const [locationName, setLocationName] = useState(initialData?.location?.name || "");
  const queryClient = useQueryClient();

  const { mutateAsync: saveTourDate, isPending } = useMutation({
    mutationFn: async () => {
      let locationId = null;

      // Create or find location if name is provided
      if (locationName.trim()) {
        const { data: existingLocation } = await dataLayerClient.from('locations')
          .select('id')
          .eq('name', locationName.trim())
          .single();

        if (existingLocation) {
          locationId = existingLocation.id;
        } else {
          const { data: newLocation, error: locationError } = await dataLayerClient.from('locations')
            .insert({
              name: locationName.trim(),
              formatted_address: locationName.trim()
            })
            .select('id')
            .single();

          if (locationError) throw locationError;
          locationId = newLocation.id;
        }
      }

      if (initialData?.id) {
        // Update existing tour date
        const { error } = await dataLayerClient.from('tour_dates')
          .update({
            date,
            start_date: date,
            end_date: date,
            location_id: locationId
          })
          .eq('id', initialData.id);

        if (error) throw error;
      } else {
        // Create new tour date
        const { error } = await dataLayerClient.from('tour_dates')
          .insert({
            tour_id: tourId,
            date,
            start_date: date,
            end_date: date,
            location_id: locationId
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-dates', tourId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tours') });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('my-tours') });
      toast.success(initialData ? 'Tour date updated successfully' : 'Tour date created successfully');
      onSuccess();
    },
    onError: (error) => {
      console.error('Error saving tour date:', error);
      toast.error('Failed to save tour date');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    await saveTourDate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="location">Location (Optional)</Label>
        <Input
          id="location"
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Enter location name"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
