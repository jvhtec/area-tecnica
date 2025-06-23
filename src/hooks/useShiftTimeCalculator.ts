
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, parseISO, addHours, setHours, setMinutes } from "date-fns";

interface ArtistSchedule {
  id: string;
  name: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  show_start: string;
  show_end: string;
}

interface CalculatedShift {
  name: string;
  start_time: string;
  end_time: string;
  duration: number;
  overlap?: string;
}

export const useShiftTimeCalculator = (jobId: string, date: string) => {
  const [artists, setArtists] = useState<ArtistSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLastDay, setIsLastDay] = useState(false);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!jobId || !date) return;
      
      setIsLoading(true);
      try {
        // Fetch artists for the selected date
        const { data: artistData, error: artistError } = await supabase
          .from("festival_artists")
          .select("id, name, soundcheck, soundcheck_start, show_start, show_end")
          .eq("job_id", jobId)
          .eq("date", date);

        if (artistError) throw artistError;

        // Check if this is the last day of the festival
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("end_time")
          .eq("id", jobId)
          .single();

        if (jobError) throw jobError;

        const jobEndDate = format(parseISO(jobData.end_time), 'yyyy-MM-dd');
        setIsLastDay(date === jobEndDate);
        setArtists(artistData || []);
      } catch (error) {
        console.error("Error fetching artist data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtistData();
  }, [jobId, date]);

  const calculateOptimalShifts = (numberOfShifts: number): CalculatedShift[] => {
    if (artists.length === 0) return [];

    // Find earliest and latest times
    let earliestTime = "23:59";
    let latestTime = "00:00";

    artists.forEach(artist => {
      // Check soundcheck start
      if (artist.soundcheck && artist.soundcheck_start) {
        if (artist.soundcheck_start < earliestTime) {
          earliestTime = artist.soundcheck_start;
        }
      }
      
      // Check show start
      if (artist.show_start && artist.show_start < earliestTime) {
        earliestTime = artist.show_start;
      }

      // Check show end
      if (artist.show_end && artist.show_end > latestTime) {
        latestTime = artist.show_end;
      }
    });

    // Convert times to minutes for calculation
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const minutesToTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60) % 24;
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    let startMinutes = timeToMinutes(earliestTime);
    let endMinutes = timeToMinutes(latestTime);

    // Handle midnight crossover
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours
    }

    // Add 4 hours for teardown if it's the last day
    if (isLastDay) {
      endMinutes += 4 * 60;
    }

    const totalMinutes = endMinutes - startMinutes;
    const overlapMinutes = 60; // 1 hour overlap
    
    // Calculate shift duration with overlap
    const shiftDurationMinutes = Math.ceil(totalMinutes / numberOfShifts) + overlapMinutes;
    const actualShiftInterval = Math.ceil((totalMinutes - overlapMinutes) / (numberOfShifts - 1));

    const shifts: CalculatedShift[] = [];

    for (let i = 0; i < numberOfShifts; i++) {
      const shiftStartMinutes = startMinutes + (i * actualShiftInterval);
      const shiftEndMinutes = shiftStartMinutes + shiftDurationMinutes;

      const shift: CalculatedShift = {
        name: `Shift ${i + 1}`,
        start_time: minutesToTime(shiftStartMinutes),
        end_time: minutesToTime(shiftEndMinutes),
        duration: Math.round(shiftDurationMinutes / 60 * 10) / 10,
        overlap: i > 0 ? "1 hour overlap with previous shift" : undefined
      };

      shifts.push(shift);
    }

    return shifts;
  };

  const getScheduleSummary = () => {
    if (artists.length === 0) return "No artists scheduled";

    let earliest = "23:59";
    let latest = "00:00";

    artists.forEach(artist => {
      if (artist.soundcheck && artist.soundcheck_start && artist.soundcheck_start < earliest) {
        earliest = artist.soundcheck_start;
      }
      if (artist.show_start && artist.show_start < earliest) {
        earliest = artist.show_start;
      }
      if (artist.show_end && artist.show_end > latest) {
        latest = artist.show_end;
      }
    });

    const teardownText = isLastDay ? " + 4h teardown" : "";
    return `${earliest} → ${latest}${teardownText}`;
  };

  return {
    artists,
    isLoading,
    isLastDay,
    calculateOptimalShifts,
    getScheduleSummary
  };
};
