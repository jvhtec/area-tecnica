import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSpanSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export const TimeSpanSelector = ({ value, onValueChange }: TimeSpanSelectorProps) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select time span">
          {value === "1week" && "Next Week"}
          {value === "2weeks" && "Next 2 Weeks"}
          {value === "1month" && "Next Month"}
          {value === "3months" && "Next 3 Months"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1week">Next Week</SelectItem>
        <SelectItem value="2weeks">Next 2 Weeks</SelectItem>
        <SelectItem value="1month">Next Month</SelectItem>
        <SelectItem value="3months">Next 3 Months</SelectItem>
      </SelectContent>
    </Select>
  );
};