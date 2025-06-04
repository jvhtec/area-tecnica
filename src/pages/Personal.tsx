
import React, { useState } from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';

const Personal = () => {
  const [date, setDate] = useState<Date>(new Date());

  console.log('Personal page: Rendering with date:', date);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">House Technician Calendar</h1>
        <p className="text-muted-foreground">Track house tech assignments and availability</p>
      </div>
      
      <PersonalCalendar 
        date={date}
        onDateSelect={setDate}
      />
    </div>
  );
};

export default Personal;
