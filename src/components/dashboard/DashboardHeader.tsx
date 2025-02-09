import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useEffect } from "react";

interface DashboardHeaderProps {
  timeSpan: string;
  onTimeSpanChange: (value: string) => void;
}

export const DashboardHeader = ({ timeSpan, onTimeSpanChange }: DashboardHeaderProps) => {
  const { preferences, updatePreferences } = useUserPreferences();

  useEffect(() => {
    if (preferences?.time_span && preferences.time_span !== timeSpan) {
      console.log('Applying saved time span preference:', preferences.time_span);
      onTimeSpanChange(preferences.time_span);
    }
  }, [preferences, onTimeSpanChange, timeSpan]);

  const handleTimeSpanChange = (value: string) => {
    console.log('Changing time span to:', value);
    onTimeSpanChange(value);
    updatePreferences({ time_span: value });
  };

  return (
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Select value={timeSpan} onValueChange={handleTimeSpanChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select time span" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1week">Next Week</SelectItem>
          <SelectItem value="2weeks">Next 2 Weeks</SelectItem>
          <SelectItem value="1month">Next Month</SelectItem>
          <SelectItem value="3months">Next 3 Months</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};