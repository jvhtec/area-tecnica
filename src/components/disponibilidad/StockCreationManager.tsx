
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { supabase } from '@/lib/supabase';
import type { AvailabilityStatus } from '@/types/availability';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, format, isSameDay, isWeekend } from 'date-fns';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';

export function StockCreationManager() {
  const { session, userDepartment } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });
  const [pattern, setPattern] = useState<'daily' | 'weekdays' | 'weekends'>('daily');

  const createBatchAvailabilityMutation = useMutation({
    mutationFn: async ({ status }: { status: AvailabilityStatus }) => {
      if (!session?.user?.id || !userDepartment || !dateRange.from || !dateRange.to) {
        throw new Error('Missing required data');
      }

      const dates: Date[] = [];
      let currentDate = dateRange.from;

      while (!isSameDay(currentDate, dateRange.to)) {
        if (
          pattern === 'daily' ||
          (pattern === 'weekdays' && !isWeekend(currentDate)) ||
          (pattern === 'weekends' && isWeekend(currentDate))
        ) {
          dates.push(currentDate);
        }
        currentDate = addDays(currentDate, 1);
      }
      // Include the end date if it matches the pattern
      if (
        pattern === 'daily' ||
        (pattern === 'weekdays' && !isWeekend(dateRange.to)) ||
        (pattern === 'weekends' && isWeekend(dateRange.to))
      ) {
        dates.push(dateRange.to);
      }

      const { error } = await supabase
        .from('availability_schedules')
        .upsert(
          dates.map(date => ({
            user_id: session.user.id,
            department: userDepartment,
            date: format(date, 'yyyy-MM-dd'),
            status
          })),
          { onConflict: 'user_id,department,date' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['availability', session?.user?.id, userDepartment]
      });
      toast({
        title: "Success",
        description: "Batch availability created successfully"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create batch availability"
      });
      console.error('Error creating batch availability:', error);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Creation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={(range) => {
            if (range) {
              setDateRange({
                from: range.from || undefined,
                to: range.to || range.from || undefined
              });
            } else {
              setDateRange({ from: undefined, to: undefined });
            }
          }}
          className="rounded-md border"
          numberOfMonths={2}
        />
        
        <div className="flex gap-2">
          <Button
            variant={pattern === 'daily' ? 'default' : 'outline'}
            onClick={() => setPattern('daily')}
          >
            Daily
          </Button>
          <Button
            variant={pattern === 'weekdays' ? 'default' : 'outline'}
            onClick={() => setPattern('weekdays')}
          >
            Weekdays
          </Button>
          <Button
            variant={pattern === 'weekends' ? 'default' : 'outline'}
            onClick={() => setPattern('weekends')}
          >
            Weekends
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            className="bg-green-500 hover:bg-green-600"
            onClick={() => createBatchAvailabilityMutation.mutate({ status: 'available' })}
            disabled={!dateRange.from || !dateRange.to}
          >
            Set Available
          </Button>
          <Button
            className="bg-yellow-500 hover:bg-yellow-600"
            onClick={() => createBatchAvailabilityMutation.mutate({ status: 'tentative' })}
            disabled={!dateRange.from || !dateRange.to}
          >
            Set Tentative
          </Button>
          <Button
            className="bg-red-500 hover:bg-red-600"
            onClick={() => createBatchAvailabilityMutation.mutate({ status: 'unavailable' })}
            disabled={!dateRange.from || !dateRange.to}
          >
            Set Unavailable
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
