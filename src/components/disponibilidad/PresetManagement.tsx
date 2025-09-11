
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

// Define AvailabilityPreference type to match global_availability_presets
type AvailabilityPreference = {
  id: string;
  name: string;
  department: string;
  day_of_week: number;
  status: 'available' | 'tentative' | 'unavailable';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AvailabilityStatus = 'available' | 'tentative' | 'unavailable';

export function PresetManagement() {
  const { session, userDepartment } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: presets, isLoading } = useQuery({
    queryKey: ['availability-presets', session?.user?.id, userDepartment],
    queryFn: async () => {
      if (!session?.user?.id || !userDepartment) return null;

      const { data, error } = await supabase
        .from('global_availability_presets')
        .select('*')
        .eq('department', userDepartment);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load availability presets"
        });
        throw error;
      }

      return data as AvailabilityPreference[];
    },
    enabled: !!session?.user?.id && !!userDepartment
  });

  const createPresetMutation = useMutation({
    mutationFn: async ({ status, dayOfWeek }: { status: AvailabilityStatus; dayOfWeek: number }) => {
      if (!session?.user?.id || !userDepartment) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('global_availability_presets')
        .upsert({
          name: `${DAYS_OF_WEEK[dayOfWeek]} Default`,
          department: userDepartment,
          day_of_week: dayOfWeek,
          status
        }, {
          onConflict: 'department,day_of_week'
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['availability-presets', session?.user?.id, userDepartment]
      });
      toast({
        title: "Success",
        description: "Preset updated successfully"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update preset"
      });
      console.error('Error creating preset:', error);
    }
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (dayOfWeek: number) => {
      if (!session?.user?.id || !userDepartment) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('global_availability_presets')
        .delete()
        .eq('department', userDepartment)
        .eq('day_of_week', dayOfWeek);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['availability-presets', session?.user?.id, userDepartment]
      });
      toast({
        title: "Success",
        description: "Preset deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete preset"
      });
      console.error('Error deleting preset:', error);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Presets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS_OF_WEEK.map((day, index) => {
          const preset = presets?.find(p => p.day_of_week === index);

          return (
            <div key={day} className="flex items-center justify-between">
              <span>{day}</span>
              <div className="flex gap-2">
                <Button
                  variant={preset?.status === 'available' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => createPresetMutation.mutate({ status: 'available', dayOfWeek: index })}
                >
                  Available
                </Button>
                <Button
                  variant={preset?.status === 'tentative' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600"
                  onClick={() => createPresetMutation.mutate({ status: 'tentative', dayOfWeek: index })}
                >
                  Tentative
                </Button>
                <Button
                  variant={preset?.status === 'unavailable' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-red-500 hover:bg-red-600"
                  onClick={() => createPresetMutation.mutate({ status: 'unavailable', dayOfWeek: index })}
                >
                  Unavailable
                </Button>
                {preset && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deletePresetMutation.mutate(index)}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
