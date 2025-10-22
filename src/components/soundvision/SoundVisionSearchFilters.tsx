import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useVenues } from '@/hooks/useVenues';

interface SoundVisionSearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  stateRegion: string;
  onStateRegionChange: (value: string) => void;
  onClearFilters: () => void;
}

export const SoundVisionSearchFilters = ({
  searchTerm,
  onSearchChange,
  city,
  onCityChange,
  country,
  onCountryChange,
  stateRegion,
  onStateRegionChange,
  onClearFilters,
}: SoundVisionSearchFiltersProps) => {
  const { data: venues } = useVenues();

  // Extract unique values for dropdowns
  const cities = [...new Set(venues?.map((v) => v.city).filter(Boolean))].sort();
  const countries = [...new Set(venues?.map((v) => v.country).filter(Boolean))].sort();
  const stateRegions = [...new Set(venues?.map((v) => v.state_region).filter(Boolean))].sort();

  const hasActiveFilters = city || country || stateRegion || searchTerm;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by venue name or file name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Select value={city} onValueChange={onCityChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={country} onValueChange={onCountryChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stateRegion} onValueChange={onStateRegionChange}>
          <SelectTrigger>
            <SelectValue placeholder="All States/Regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States/Regions</SelectItem>
            {stateRegions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="outline" onClick={onClearFilters} className="w-full">
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
};
