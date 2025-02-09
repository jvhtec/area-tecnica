
import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { Button } from '@/components/ui/button';
import { Box, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PresetManagementDialog } from '@/components/equipment/PresetManagementDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { WeeklySummary } from '@/components/disponibilidad/WeeklySummary';
import { QuickPresetAssignment } from '@/components/disponibilidad/QuickPresetAssignment';

export default function LightsDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const navigate = useNavigate();
  const { session } = useSessionManager();
  const { toast } = useToast();

  // Fetch preset for selected date
  const { data: assignedPreset } = useQuery({
    queryKey: ['preset-assignment', session?.user?.id, selectedDate],
    queryFn: async () => {
      if (!session?.user?.id || !selectedDate) return null;
      
      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select(`
          *,
          preset:presets (
            *,
            items:preset_items (
              *,
              equipment:equipment (*)
            )
          )
        `)
        .eq('user_id', session.user.id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load preset assignment"
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
              {assignedPreset ? (
                <div className="space-y-4">
                  <h3 className="font-medium">{assignedPreset.preset.name}</h3>
                  <div className="space-y-2">
                    {assignedPreset.preset.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.equipment.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No preset assigned for this date</p>
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
