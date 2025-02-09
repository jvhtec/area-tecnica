
import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { AvailabilityActions } from '@/components/disponibilidad/AvailabilityActions';
import { useState } from 'react';

export default function LightsDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Lights Department Availability</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
        <AvailabilityActions selectedDate={selectedDate} />
      </div>
    </div>
  );
}
