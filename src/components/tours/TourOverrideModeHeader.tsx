
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Settings } from 'lucide-react';

interface TourOverrideModeHeaderProps {
  tourName: string;
  tourDate: string;
  locationName: string;
  defaultsCount: number;
  overridesCount: number;
  department: string;
}

export const TourOverrideModeHeader = ({
  tourName,
  tourDate,
  locationName,
  defaultsCount,
  overridesCount,
  department
}: TourOverrideModeHeaderProps) => {
  const formattedDate = new Date(tourDate).toLocaleDateString('en-GB');
  
  return (
    <Card className="mb-6 bg-blue-50 border-blue-200">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-blue-900">
            Override Mode - {department.charAt(0).toUpperCase() + department.slice(1)}
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-900">Tour:</span>
            <span className="text-blue-700">{tourName}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Date:</span>
            <span className="text-blue-700">{formattedDate}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Location:</span>
            <span className="text-blue-700">{locationName}</span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {defaultsCount} Default{defaultsCount !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            {overridesCount} Override{overridesCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <p className="text-sm text-blue-600 mt-3">
          Any tables created here will be saved as overrides for this specific tour date.
          These will be combined with defaults when exporting PDFs.
        </p>
      </CardContent>
    </Card>
  );
};
