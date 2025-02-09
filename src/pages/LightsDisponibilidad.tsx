
import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { AvailabilityActions } from '@/components/disponibilidad/AvailabilityActions';
import { PresetManagement } from '@/components/disponibilidad/PresetManagement';
import { StockCreationManager } from '@/components/disponibilidad/StockCreationManager';
import { useState } from 'react';

export default function LightsDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Lights Department Availability</h1>
      <div className="grid gap-6 md:grid-cols-3">
        <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
        <AvailabilityActions selectedDate={selectedDate} />
        <div className="space-y-6">
          <PresetManagement />
          <StockCreationManager />
        </div>
      </div>
    </div>
  );
}
