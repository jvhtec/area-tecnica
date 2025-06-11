
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { supabase } from '@/integrations/supabase/client';
import type { AvailabilityStatus } from '@/types/availability';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface AvailabilityActionsProps {
  selectedDate?: Date;
}

export function AvailabilityActions({ selectedDate }: AvailabilityActionsProps) {
  const { session, userDepartment } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({ status }: { status: AvailabilityStatus }) => {
      if (!session?.user?.id || !userDepartment || !selectedDate) {
        throw new Error('Missing required data');
      }

      const { data, error } = await supabase
        .from('availability_schedules')
        .upsert({
          user_id: session.user.id,
          department: userDepartment,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status
        }, {
          onConflict: 'user_id,department,date'
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['availability', session?.user?.id, userDepartment]
      });
      toast({
        title: "Success",
        description: "Availability updated successfully"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability"
      });
      console.error('Error updating availability:', error);
    }
  });

  const handleUpdateAvailability = (status: AvailabilityStatus) => {
    updateAvailabilityMutation.mutate({ status });
  };

  if (!selectedDate) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Availability</CardTitle>
        <CardDescription>
          {format(selectedDate, 'MMMM d, yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant="default"
          className="bg-green-500 hover:bg-green-600"
          onClick={() => handleUpdateAvailability('available')}
        >
          Available
        </Button>
        <Button
          variant="default"
          className="bg-yellow-500 hover:bg-yellow-600"
          onClick={() => handleUpdateAvailability('tentative')}
        >
          Tentative
        </Button>
        <Button
          variant="default"
          className="bg-red-500 hover:bg-red-600"
          onClick={() => handleUpdateAvailability('unavailable')}
        >
          Unavailable
        </Button>
      </CardContent>
    </Card>
  );
}
