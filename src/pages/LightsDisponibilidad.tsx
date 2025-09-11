import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { Button } from '@/components/ui/button';
import { Box, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PresetManagementDialog } from '@/components/equipment/PresetManagementDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { WeeklySummary } from '@/components/disponibilidad/WeeklySummary';
import { QuickPresetAssignment } from '@/components/disponibilidad/QuickPresetAssignment';

export default function LightsDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const navigate = useNavigate();
  const { session } = useOptimizedAuth();
  const { toast } = useToast();

  // Fetch preset assignments (removed user_id filter)
  const { data: assignedPresets } = useQuery({
    queryKey: ['preset-assignments', selectedDate],
    queryFn: async () => {
      if (!session?.user?.id || !selectedDate) return null;
      
      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select(`
          *,
          preset:presets (
            name
          )
        `)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .order('order', { ascending: true });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load preset assignments"
        });
        throw error;
      }

      return data;
    },
    enabled: !!session?.user?.id && !!selectedDate
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Presets de Equipamiento</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate('/equipment-management')}
          >
            <Box className="mr-2 h-4 w-4" />
            Gestionar Inventario
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowPresetDialog(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Gestionar Presets
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
          <div className="flex justify-end">
            <QuickPresetAssignment selectedDate={selectedDate} />
          </div>
        </div>
        <div className="space-y-4">
          {selectedDate && (
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-4">
                {format(selectedDate, 'PPP')}
              </h2>
              {assignedPresets && assignedPresets.length > 0 ? (
                <div className="space-y-4">
                  {assignedPresets.map((assignment) => (
                    <div key={assignment.id}>
                      <h3 className="font-medium">{assignment.preset.name}</h3>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No presets assigned for this date</p>
              )}
            </div>
          )}
        </div>
      </div>

      <WeeklySummary 
        selectedDate={selectedDate} 
        onDateChange={setSelectedDate} 
      />

      <PresetManagementDialog 
        open={showPresetDialog} 
        onOpenChange={setShowPresetDialog}
        selectedDate={selectedDate}
      />
    </div>
  );
}
