import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock } from "lucide-react";

interface TourDateFormFieldsProps {
  location: string;
  setLocation: (value: string) => void;
  tourDateType: 'show' | 'rehearsal' | 'travel';
  setTourDateType: (value: 'show' | 'rehearsal' | 'travel') => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const TourDateFormFields: React.FC<TourDateFormFieldsProps> = ({
  location,
  setLocation,
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
    if (tourDateType === 'show' || tourDateType === 'travel') {
      setEndDate(value);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rehearsal': return <Clock className="h-4 w-4" />;
      case 'travel': return <MapPin className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
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
            <SelectItem value="show">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Show
              </div>
            </SelectItem>
            <SelectItem value="rehearsal">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Rehearsal
              </div>
            </SelectItem>
            <SelectItem value="travel">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Travel Day
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          type="text"
          placeholder="Enter location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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

        {tourDateType === 'rehearsal' && (
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

      {tourDateType === 'rehearsal' && startDate && endDate && (
        <div className="text-sm text-muted-foreground">
          Duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
        </div>
      )}
    </div>
  );
};