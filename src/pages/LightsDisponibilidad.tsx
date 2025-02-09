
import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { Button } from '@/components/ui/button';
import { Box, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PresetManagementDialog } from '@/components/equipment/PresetManagementDialog';

export default function LightsDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
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
      <div className="space-y-6">
        <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
      </div>
      <PresetManagementDialog 
        open={showPresetDialog} 
        onOpenChange={setShowPresetDialog}
      />
    </div>
  );
}
