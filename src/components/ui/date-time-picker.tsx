
import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "./input";
import { utcToLocalInput, localInputToUTC } from "@/utils/timezoneUtils";

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  timezone?: string;
}

export function DateTimePicker({ value, onChange, timezone = 'Europe/Madrid' }: DateTimePickerProps) {
  // Convert UTC value to local input format
  const localValue = utcToLocalInput(value, timezone);
  const [date, setDate] = React.useState<Date>(value);
  const [time, setTime] = React.useState(localValue.split('T')[1] || format(value, "HH:mm"));

  // Update parent when either date or time changes
  React.useEffect(() => {
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    
    // Convert local datetime to UTC considering the job's timezone
    const utcDate = localInputToUTC(format(newDate, "yyyy-MM-dd'T'HH:mm"), timezone);
    onChange(utcDate);
  }, [date, time, onChange, timezone]);

  // Update local state when value prop changes
  React.useEffect(() => {
    const localInput = utcToLocalInput(value, timezone);
    const [datePart, timePart] = localInput.split('T');
    setDate(new Date(datePart + 'T00:00:00'));
    setTime(timePart || format(value, "HH:mm"));
  }, [value, timezone]);

  return (
    <div className="flex flex-col md:flex-row gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "justify-start text-left font-normal w-full md:w-[240px]",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => newDate && setDate(newDate)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full md:w-[120px]"
      />
    </div>
  );
}
