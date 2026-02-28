import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import { LocationDetails } from "@/hooks/useLocationManagement";
import { DateType, isSingleDayDateType, TOUR_DATE_TYPE_OPTIONS } from "@/constants/dateTypes";

interface TourDateFormFieldsProps {
  location: string;
  setLocation: (value: string) => void;
  setLocationDetails?: (value: LocationDetails | null) => void;
  tourDateType: DateType;
  setTourDateType: (value: DateType) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const TourDateFormFields: React.FC<TourDateFormFieldsProps> = ({
  location,
  setLocation,
  setLocationDetails,
  tourDateType,
  setTourDateType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    // Auto-set end date for single-day events
    if (isSingleDayDateType(tourDateType)) {
      setEndDate(value);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="tourDateType">Type</Label>
        <Select value={tourDateType} onValueChange={setTourDateType}>
          <SelectTrigger>
            <SelectValue placeholder="Select date type" />
          </SelectTrigger>
          <SelectContent>
            {TOUR_DATE_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;

              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${option.iconClassName}`} />
                    {option.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <PlaceAutocomplete
          value={location}
          onInputChange={(value) => {
            setLocation(value);
            setLocationDetails?.(null);
          }}
          onSelect={(result) => {
            setLocation(result.name);
            setLocationDetails?.({
              name: result.name,
              address: result.address,
              coordinates: result.coordinates,
              place_id: result.place_id,
            });
          }}
          placeholder="Enter location"
          label="Location"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">
            {tourDateType === 'rehearsal' ? 'Start Date' : 'Date'}
          </Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </div>

        {!isSingleDayDateType(tourDateType) && (
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        )}
      </div>

      {!isSingleDayDateType(tourDateType) && startDate && endDate && (
        <div className="text-sm text-muted-foreground">
          Duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
        </div>
      )}
    </div>
  );
};
