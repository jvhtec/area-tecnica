import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  Users, 
  FileText, 
  UtensilsCrossed, 
  Truck, 
  Clock,
  Phone,
  Globe,
  Download,
  ExternalLink,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PlacesRestaurantService } from "@/utils/hoja-de-ruta/services/places-restaurant-service";
import type { Restaurant } from "@/types/hoja-de-ruta";

interface JobDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  department?: string;
}

export const JobDetailsDialog: React.FC<JobDetailsDialogProps> = ({
  open,
  onOpenChange,
  job,
  department = 'sound'
}) => {
  const [selectedTab, setSelectedTab] = useState('info');

  // Fetch comprehensive job data
  const { data: jobDetails, isLoading: isJobLoading } = useQuery({
    queryKey: ['job-details', job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          locations(*),
          job_assignments(
            *,
            profiles(id, first_name, last_name, department, role)
          ),
          job_documents(*),
          logistics_events(*)
        `)
        .eq('id', job.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Fetch nearby restaurants
  const { data: restaurants, isLoading: isRestaurantsLoading } = useQuery({
    queryKey: ['job-restaurants', job.id, jobDetails?.locations?.address],
    queryFn: async () => {
      if (!jobDetails?.locations?.address) return [];
      
      const coordinates = jobDetails.locations.latitude && jobDetails.locations.longitude 
        ? { lat: parseFloat(jobDetails.locations.latitude), lng: parseFloat(jobDetails.locations.longitude) }
        : undefined;

      return await PlacesRestaurantService.searchRestaurantsNearVenue(
        jobDetails.locations.address,
        2000,
        10,
        coordinates
      );
    },
    enabled: open && !!jobDetails?.locations?.address
  });

  const handleDownloadDocument = async (doc: any) => {
    try {
      const { data } = await supabase.storage
        .from('job_documents')
        .createSignedUrl(doc.file_path, 3600);

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const openGoogleMaps = () => {
    if (jobDetails?.locations) {
      const address = encodeURIComponent(jobDetails.locations.address || jobDetails.locations.name || '');
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
    }
  };

  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'Not set';
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, 'PPp');
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (isJobLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {jobDetails?.title || 'Job Details'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="personnel">Personnel</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <TabsContent value="info" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{jobDetails?.title}</h3>
                    {jobDetails?.description && (
                      <p className="text-muted-foreground mt-1">{jobDetails.description}</p>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Start Time</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(jobDetails?.start_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">End Time</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(jobDetails?.end_time)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Job Type</p>
                    <Badge variant="outline">{jobDetails?.job_type}</Badge>
                  </div>

                  {jobDetails?.locations && (
                    <div>
                      <p className="text-sm font-medium">Venue</p>
                      <p className="text-sm text-muted-foreground">
                        {jobDetails.locations.name}
                      </p>
                      {jobDetails.locations.address && (
                        <p className="text-sm text-muted-foreground">
                          {jobDetails.locations.address}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="location" className="space-y-4">
              <Card className="p-4">
                {jobDetails?.locations ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{jobDetails.locations.name}</h3>
                        {jobDetails.locations.address && (
                          <p className="text-muted-foreground">{jobDetails.locations.address}</p>
                        )}
                      </div>
                      <Button onClick={openGoogleMaps} size="sm">
                        <MapPin className="h-4 w-4 mr-2" />
                        Open Maps
                      </Button>
                    </div>

                    {jobDetails.locations.latitude && jobDetails.locations.longitude && (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Coordinates: {jobDetails.locations.latitude}, {jobDetails.locations.longitude}
                          </p>
                          <Button onClick={openGoogleMaps} size="sm" className="mt-2">
                            View on Google Maps
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Logistics Events */}
                    {jobDetails.logistics_events && jobDetails.logistics_events.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Logistics
                        </h4>
                        <div className="space-y-2">
                          {jobDetails.logistics_events.map((event: any) => (
                            <div key={event.id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <span className="capitalize font-medium">{event.event_type}</span>
                                <span className="text-muted-foreground ml-2">
                                  ({event.transport_type})
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {event.event_date ? format(new Date(event.event_date), 'PP') : 'No date'} at {event.event_time || 'No time'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No location information available</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="personnel" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Personnel
                </h3>
                
                {jobDetails?.job_assignments && jobDetails.job_assignments.length > 0 ? (
                  <div className="space-y-3">
                    {jobDetails.job_assignments.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium">
                            {assignment.profiles 
                              ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
                              : assignment.external_technician_name || 'Unknown'
                            }
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.profiles?.department || 'External'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {assignment.sound_role && (
                            <Badge variant="outline" className="text-xs">
                              Sound: {assignment.sound_role}
                            </Badge>
                          )}
                          {assignment.lights_role && (
                            <Badge variant="outline" className="text-xs">
                              Lights: {assignment.lights_role}
                            </Badge>
                          )}
                          {assignment.video_role && (
                            <Badge variant="outline" className="text-xs">
                              Video: {assignment.video_role}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No personnel assigned yet</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Job Documents
                </h3>
                
                {jobDetails?.job_documents && jobDetails.job_documents.length > 0 ? (
                  <div className="space-y-2">
                    {jobDetails.job_documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium">{doc.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.uploaded_at ? `Uploaded ${format(new Date(doc.uploaded_at), 'PP')}` : 'Upload date unknown'}
                          </p>
                        </div>
                        <Button 
                          onClick={() => handleDownloadDocument(doc)}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No documents uploaded yet</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="restaurants" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Nearby Restaurants
                </h3>
                
                {isRestaurantsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-muted-foreground">Finding nearby restaurants...</p>
                  </div>
                ) : restaurants && restaurants.length > 0 ? (
                  <div className="space-y-3">
                    {restaurants.map((restaurant: Restaurant) => (
                      <div key={restaurant.id} className="p-3 bg-muted rounded">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{restaurant.name}</p>
                            <p className="text-sm text-muted-foreground">{restaurant.address}</p>
                            
                            <div className="flex items-center gap-2 mt-2">
                              {restaurant.rating && (
                                <Badge variant="outline" className="text-xs">
                                  ⭐ {restaurant.rating}
                                </Badge>
                              )}
                              {restaurant.priceLevel !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  {'€'.repeat(restaurant.priceLevel + 1)}
                                </Badge>
                              )}
                              {restaurant.distance && (
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(restaurant.distance)}m away
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-1">
                            {restaurant.phone && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={`tel:${restaurant.phone}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {restaurant.website && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={restaurant.website} target="_blank" rel="noopener noreferrer">
                                  <Globe className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {jobDetails?.locations?.address 
                        ? "No restaurants found nearby" 
                        : "No venue address available to search for restaurants"
                      }
                    </p>
                  </div>
                )}
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};