import React from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';

const Personal = () => {
  const handleDateSelect = (newDate: Date) => {
    console.log('Date selected:', newDate);
    // Do any additional logic here if needed
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">House Technician Calendar</h1>
        <p className="text-muted-foreground">Track house tech assignments and availability</p>
      </div>
      
      <PersonalCalendar 
        initialDate={new Date()}
        onDateSelect={handleDateSelect} // Optional callback
      />
    </div>
  );
};

export default Personal;