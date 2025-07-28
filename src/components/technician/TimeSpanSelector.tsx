import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSpanSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  viewMode: 'upcoming' | 'past';
}

export const TimeSpanSelector = ({ value, onValueChange, viewMode }: TimeSpanSelectorProps) => {
  const getDisplayText = () => {
    const prefix = viewMode === 'upcoming' ? 'Next' : 'Past';
    switch (value) {
      case "1week": return `${prefix} Week`;
      case "2weeks": return `${prefix} 2 Weeks`;
      case "1month": return `${prefix} Month`;
      case "3months": return `${prefix} 3 Months`;
      default: return `${prefix} Week`;
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select time span">
          {getDisplayText()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1week">{viewMode === 'upcoming' ? 'Next' : 'Past'} Week</SelectItem>
        <SelectItem value="2weeks">{viewMode === 'upcoming' ? 'Next' : 'Past'} 2 Weeks</SelectItem>
        <SelectItem value="1month">{viewMode === 'upcoming' ? 'Next' : 'Past'} Month</SelectItem>
        <SelectItem value="3months">{viewMode === 'upcoming' ? 'Next' : 'Past'} 3 Months</SelectItem>
      </SelectContent>
    </Select>
  );
};