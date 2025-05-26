
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  MapPin, 
  Settings, 
  Users, 
  FileText, 
  Truck,
  Calculator,
  Weight,
  Upload,
  Clock,
  BarChart3
} from "lucide-react";
import { useState } from "react";
import { TourManagementDialog } from "@/components/tours/TourManagementDialog";
import { TourDateManagementDialog } from "@/components/tours/TourDateManagementDialog";
import { format } from "date-fns";

interface TourManagementProps {
  tour: any;
}

export const TourManagement = ({ tour }: TourManagementProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatesOpen, setIsDatesOpen] = useState(false);

  if (!tour) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Tour Not Found</h1>
          <p className="text-muted-foreground">The requested tour could not be found.</p>
        </div>
      </div>
    );
  }

  const upcomingDates = tour.tour_dates?.filter(
    (date: any) => new Date(date.date) >= new Date()
  ).slice(0, 5) || [];

  const totalDates = tour.tour_dates?.length || 0;
  const completedDates = tour.tour_dates?.filter(
    (date: any) => new Date(date.date) < new Date()
  ).length || 0;

  const quickActions = [
    {
      title: "Tour Dates & Locations",
      description: "Manage tour dates, venues, and locations",
      icon: Calendar,
      onClick: () => setIsDatesOpen(true),
      badge: `${totalDates} dates`
    },
    {
      title: "Tour Configuration",
      description: "Power & weight defaults, technical settings",
      icon: Settings,
      onClick: () => setIsSettingsOpen(true),
      badge: "Settings"
    },
    {
      title: "Power Requirements",
      description: "Set default power calculations for all dates",
      icon: Calculator,
      onClick: () => {}, // Will implement later
      badge: "Defaults"
    },
    {
      title: "Weight Calculations",
      description: "Configure weight defaults and calculations",
      icon: Weight,
      onClick: () => {}, // Will implement later
      badge: "Defaults"
    },
    {
      title: "Document Management",
      description: "Upload, organize, and share tour documents",
      icon: FileText,
      onClick: () => {}, // Will implement later
      badge: "Coming Soon"
    },
    {
      title: "Technician Assignment",
      description: "Assign crew members to tour dates",
      icon: Users,
      onClick: () => {}, // Will implement later
      badge: "Coming Soon"
    },
    {
      title: "Scheduling & Timeline",
      description: "Tour timeline and scheduling management",
      icon: Clock,
      onClick: () => {}, // Will implement later
      badge: "Coming Soon"
    },
    {
      title: "Logistics Integration",
      description: "Transport, accommodation, and logistics",
      icon: Truck,
      onClick: () => {}, // Will implement later
      badge: "Coming Soon"
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{tour.name}</h1>
          {tour.description && (
            <p className="text-muted-foreground mt-1">{tour.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            {tour.start_date && tour.end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(tour.start_date), 'MMM d')} - {format(new Date(tour.end_date), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            <Badge variant="outline" style={{ borderColor: tour.color, color: tour.color }}>
              {totalDates} dates
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Tour Settings
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dates</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedDates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDates - completedDates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folders Created</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tour.flex_folders_created ? "Yes" : "No"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Management Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" onClick={action.onClick}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <action.icon className="h-6 w-6" style={{ color: tour.color }} />
                  <Badge variant={action.badge === "Coming Soon" ? "secondary" : "outline"}>
                    {action.badge}
                  </Badge>
                </div>
                <CardTitle className="text-sm">{action.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upcoming Dates Section */}
      {upcomingDates.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Upcoming Tour Dates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingDates.map((date: any) => (
              <Card key={date.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="outline">
                      {format(new Date(date.date), 'MMM d')}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">
                    {format(new Date(date.date), 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {date.location?.name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{date.location.name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Management Dialogs */}
      <TourManagementDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        tour={tour}
      />

      <TourDateManagementDialog
        open={isDatesOpen}
        onOpenChange={setIsDatesOpen}
        tour={tour}
      />
    </div>
  );
};

export default TourManagement;
