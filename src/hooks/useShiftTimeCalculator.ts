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
  isaftermidnight?: boolean;
  stage?: number;
}

interface CalculatedShift {
  name: string;
  start_time: string;
  end_time: string;
  duration: number;
  overlap?: string;
}

export const useShiftTimeCalculator = (jobId: string, date: string, stage?: number) => {
  const [artists, setArtists] = useState<ArtistSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLastDay, setIsLastDay] = useState(false);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!jobId || !date) return;
      
      setIsLoading(true);
      try {
        // Build query with optional stage filter
        let query = supabase
          .from("festival_artists")
          .select("id, name, soundcheck, soundcheck_start, show_start, show_end, isaftermidnight, stage")
          .eq("job_id", jobId)
          .eq("date", date);

        // Add stage filter if provided
        if (stage !== undefined) {
          query = query.eq("stage", stage);
        }

        const { data: artistData, error: artistError } = await query;

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
  }, [jobId, date, stage]);

  const calculateOptimalShifts = (numberOfShifts: number): CalculatedShift[] => {
    if (artists.length === 0) return [];

    // Convert time string to minutes since midnight
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const minutesToTime = (minutes: number): string => {
      // Handle times that go beyond 24 hours (next day)
      if (minutes >= 24 * 60) {
        // For times after midnight, show as next day time
        const nextDayMinutes = minutes - 24 * 60;
        const hours = Math.floor(nextDayMinutes / 60);
        const mins = nextDayMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }
    };

    // Find earliest and latest times
    let earliestMinutes = 24 * 60; // Start with end of day
    let latestMinutes = 0; // Start with beginning of day

    artists.forEach(artist => {
      // Check soundcheck start (always on the same day)
      if (artist.soundcheck && artist.soundcheck_start) {
        const soundcheckMinutes = timeToMinutes(artist.soundcheck_start);
        if (soundcheckMinutes < earliestMinutes) {
          earliestMinutes = soundcheckMinutes;
        }
      }
      
      // Check show start - handle midnight crossover
      if (artist.show_start) {
        let showStartMinutes = timeToMinutes(artist.show_start);
        
        // If show starts after midnight, add 24 hours
        if (artist.isaftermidnight) {
          showStartMinutes += 24 * 60;
        }
        
        // Only consider as earliest if it's on the same day (not after midnight)
        if (!artist.isaftermidnight && showStartMinutes < earliestMinutes) {
          earliestMinutes = showStartMinutes;
        }
      }

      // Check show end - handle midnight crossover
      if (artist.show_end) {
        let showEndMinutes = timeToMinutes(artist.show_end);
        
        // If show ends after midnight, add 24 hours
        if (artist.isaftermidnight) {
          showEndMinutes += 24 * 60;
        }
        
        if (showEndMinutes > latestMinutes) {
          latestMinutes = showEndMinutes;
        }
      }
    });

    // Add 30-minute buffer before first soundcheck
    earliestMinutes -= 30;

    // Add 4 hours for teardown if it's the last day
    if (isLastDay) {
      latestMinutes += 4 * 60;
    }

    const totalMinutes = latestMinutes - earliestMinutes;
    const overlapMinutes = 60; // 1 hour overlap
    
    // Simple correct formula:
    // Shift Duration = (totalMinutes + overlapMinutes) / numberOfShifts
    // Start Interval = (totalMinutes - overlapMinutes) / (numberOfShifts - 1)
    
    const shiftDurationMinutes = Math.ceil((totalMinutes + overlapMinutes) / numberOfShifts);
    const shiftStartInterval = numberOfShifts > 1 ? 
      Math.ceil((totalMinutes - overlapMinutes) / (numberOfShifts - 1)) : 
      totalMinutes;

    const shifts: CalculatedShift[] = [];

    for (let i = 0; i < numberOfShifts; i++) {
      const shiftStartMinutes = earliestMinutes + (i * shiftStartInterval);
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

    // Convert time string to minutes for proper comparison
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const minutesToTime = (minutes: number): string => {
      // Handle times that go beyond 24 hours (next day)
      if (minutes >= 24 * 60) {
        // For times after midnight, show as next day time
        const nextDayMinutes = minutes - 24 * 60;
        const hours = Math.floor(nextDayMinutes / 60);
        const mins = nextDayMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }
    };

    let earliestMinutes = 24 * 60;
    let latestMinutes = 0;

    artists.forEach(artist => {
      // Soundcheck times (always same day)
      if (artist.soundcheck && artist.soundcheck_start) {
        const soundcheckMinutes = timeToMinutes(artist.soundcheck_start);
        if (soundcheckMinutes < earliestMinutes) {
          earliestMinutes = soundcheckMinutes;
        }
      }
      
      // Show start times
      if (artist.show_start) {
        let showStartMinutes = timeToMinutes(artist.show_start);
        
        // If show starts after midnight, add 24 hours
        if (artist.isaftermidnight) {
          showStartMinutes += 24 * 60;
        }
        
        // Only consider as earliest if it's on the same day
        if (!artist.isaftermidnight && showStartMinutes < earliestMinutes) {
          earliestMinutes = showStartMinutes;
        }
      }

      // Show end times
      if (artist.show_end) {
        let showEndMinutes = timeToMinutes(artist.show_end);
        
        // Handle midnight crossover
        if (artist.isaftermidnight) {
          showEndMinutes += 24 * 60;
        }
        
        if (showEndMinutes > latestMinutes) {
          latestMinutes = showEndMinutes;
        }
      }
    });

    // Add 30-minute buffer before first soundcheck
    const bufferedEarliestMinutes = earliestMinutes - 30;
    
    // Add teardown time if last day
    const finalLatestMinutes = isLastDay ? latestMinutes + 4 * 60 : latestMinutes;
    
    const totalHours = Math.round((finalLatestMinutes - bufferedEarliestMinutes) / 60 * 10) / 10;
    
    const earliest = minutesToTime(bufferedEarliestMinutes);
    const latest = minutesToTime(finalLatestMinutes);
    const teardownText = isLastDay ? " + 4h teardown" : "";
    const stageText = stage ? ` (Stage ${stage})` : "";
    
    return `${earliest} → ${latest}${teardownText}${stageText} | Total: ${totalHours}h`;
  };

  return {
    artists,
    isLoading,
    isLastDay,
    calculateOptimalShifts,
    getScheduleSummary
  };
};
