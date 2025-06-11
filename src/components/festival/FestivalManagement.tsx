
import React from 'react';
import { Button } from '@/components/ui/button';
import { type Festival } from '@/hooks/useFestival';

interface FestivalManagementProps {
  festival: Festival;
}

export function FestivalManagement({ festival }: FestivalManagementProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{festival.name}</h1>
        <div className="flex gap-2">
          <Button variant="outline">Edit Festival</Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-md">
          <h2 className="font-semibold text-lg mb-2">Festival Details</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Start Date:</span> {new Date(festival.start_date).toLocaleDateString()}</p>
            <p><span className="font-medium">End Date:</span> {new Date(festival.end_date).toLocaleDateString()}</p>
            {festival.location && (
              <p><span className="font-medium">Location:</span> {festival.location}</p>
            )}
            {festival.status && (
              <p><span className="font-medium">Status:</span> {festival.status}</p>
            )}
          </div>
        </div>
        
        <div className="p-4 border rounded-md">
          <h2 className="font-semibold text-lg mb-2">Description</h2>
          <p>{festival.description || 'No description available.'}</p>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Festival Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button className="h-32 flex flex-col items-center justify-center" variant="outline">
            <span className="text-lg">Artist Management</span>
            <span className="text-sm text-muted-foreground">Manage performers</span>
          </Button>
          
          <Button className="h-32 flex flex-col items-center justify-center" variant="outline">
            <span className="text-lg">Scheduling</span>
            <span className="text-sm text-muted-foreground">Manage shifts and staff</span>
          </Button>
          
          <Button className="h-32 flex flex-col items-center justify-center" variant="outline">
            <span className="text-lg">Equipment</span>
            <span className="text-sm text-muted-foreground">Manage gear setups</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
