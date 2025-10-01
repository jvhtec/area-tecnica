import { useParams, useSearchParams } from "react-router-dom";
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
  BarChart3,
  UserCheck,
  Eye,
  ArrowLeft,
  Info,
  Printer,
  Loader2,
  Euro,
  MessageCircle
} from "lucide-react";
import { TourRatesManagerDialog } from "@/components/tours/TourRatesManagerDialog";
import { useTourRatesApproval } from "@/hooks/useTourRatesApproval";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TourManagementDialog } from "@/components/tours/TourManagementDialog";
import { TourLogisticsDialog } from "@/components/tours/TourLogisticsDialog";
import { TourDateManagementDialog } from "@/components/tours/TourDateManagementDialog";
import { TourDefaultsManager } from "@/components/tours/TourDefaultsManager";
import { TourAssignmentDialog } from "@/components/tours/TourAssignmentDialog";
import { TourDocumentsDialog } from "@/components/tours/TourDocumentsDialog";
import { format } from "date-fns";
import { useTourAssignments } from "@/hooks/useTourAssignments";
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { fetchTourLogo } from "@/utils/pdf/tourLogoUtils";
import { exportTourPDF } from "@/lib/tourPdfExport";
import { useToast } from "@/hooks/use-toast";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import createFolderIcon from "@/assets/icons/icon.png";
import { TourDateFlexButton } from "@/components/tours/TourDateFlexButton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TourManagementProps {
  tour: any;
}

export const TourManagement = ({ tour }: TourManagementProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const isTechnicianView = mode === 'technician' || ['technician', 'house_tech'].includes(userRole || '');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatesOpen, setIsDatesOpen] = useState(false);
  const [isDefaultsManagerOpen, setIsDefaultsManagerOpen] = useState(false);
  const [isAssignmentsOpen, setIsAssignmentsOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isRatesManagerOpen, setIsRatesManagerOpen] = useState(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [tourLogoUrl, setTourLogoUrl] = useState<string | undefined>();
  const [isPrintingSchedule, setIsPrintingSchedule] = useState(false);
  const [isWaDialogOpen, setIsWaDialogOpen] = useState(false);
  const [waSelectedDateId, setWaSelectedDateId] = useState<string | null>(null);
  const [waDepartment, setWaDepartment] = useState<'sound'|'lights'|'video'>('sound');
  const [isCreatingWaGroup, setIsCreatingWaGroup] = useState(false);

  const { assignments } = useTourAssignments(tour?.id);
  const { data: approvalRow, refetch: refetchApproval } = useTourRatesApproval(tour?.id);
  const tourRatesApproved = !!approvalRow?.rates_approved;
  // Use tour.id directly - the service now handles tours properly
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists } = useFlexUuid(tour?.id || '');

  // Load tour logo
  useEffect(() => {
    if (tour?.id) {
      fetchTourLogo(tour.id).then(setTourLogoUrl);
    }
  }, [tour?.id]);

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

  const getSortedTourDates = () => {
    if (!tour?.tour_dates) return [];
    
    return [...tour.tour_dates].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const openWaDialog = () => {
    const sorted = getSortedTourDates();
    const upcoming = sorted.find(d => new Date(d.date) >= new Date()) || sorted[0];
    setWaSelectedDateId(upcoming?.id || null);
    setIsWaDialogOpen(true);
  };

  const handleCreateWaGroup = async () => {
    try {
      if (!waSelectedDateId) {
        toast({ title: 'Select a date', description: 'Please choose a tour date to target.' , variant: 'destructive'});
        return;
      }
      setIsCreatingWaGroup(true);
      // Resolve job for this tour date
      const { data: jobRow, error: jobErr } = await supabase
        .from('jobs')
        .select('id, title, start_time, end_time')
        .eq('tour_date_id', waSelectedDateId)
        .maybeSingle();
      if (jobErr || !jobRow) {
        toast({ title: 'No job found', description: 'No job linked to the selected tour date.' , variant: 'destructive'});
        setIsCreatingWaGroup(false);
        return;
      }

      // Optional pre-check: warn about missing phones for selected department
      const { data: rows } = await supabase
        .from('job_assignments')
        .select('sound_role, lights_role, video_role, profiles!job_assignments_technician_id_fkey(first_name,last_name,phone)')
        .eq('job_id', jobRow.id);
      const deptKey = waDepartment === 'sound' ? 'sound_role' : waDepartment === 'lights' ? 'lights_role' : 'video_role';
      const crew = (rows || []).filter((r: any) => !!r[deptKey]);
      const missing: string[] = [];
      let validPhones = 0;
      for (const r of crew) {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const full = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Técnico';
        const ph = (profile?.phone || '').trim();
        if (!ph) missing.push(full); else validPhones += 1;
      }
      if (validPhones === 0) {
        toast({ title: 'No phones', description: 'No valid phone numbers found for the selected department on this date.', variant: 'destructive' });
        setIsCreatingWaGroup(false);
        return;
      }
      if (missing.length > 0) {
        toast({ title: 'Some missing phones', description: `Members without phone: ${missing.slice(0,3).join(', ')}${missing.length>3?'…':''}` });
      }

      // Invoke the existing edge function
      const { data: fnRes, error: fnErr } = await supabase.functions.invoke('create-whatsapp-group', {
        body: { job_id: jobRow.id, department: waDepartment }
      });
      if (fnErr) {
        toast({ title: 'Failed to create group', description: fnErr.message, variant: 'destructive' });
      } else {
        toast({ title: 'Requested', description: 'WhatsApp group creation requested. It will finalize shortly.' });
        setIsWaDialogOpen(false);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setIsCreatingWaGroup(false);
    }
  };

  const handlePowerDefaults = () => {
    navigate(`/sound/consumos?tourId=${tour.id}&mode=tour-defaults`);
  };

  const handleWeightDefaults = () => {
    navigate(`/sound/pesos?tourId=${tour.id}&mode=tour-defaults`);
  };

  const handlePrintSchedule = async () => {
    setIsPrintingSchedule(true);
    try {
      await exportTourPDF(tour);
      toast({
        title: "Success",
        description: "Tour schedule exported successfully",
      });
    } catch (error: any) {
      console.error("Error exporting tour schedule:", error);
      toast({
        title: "Error",
        description: "Failed to export tour schedule",
        variant: "destructive",
      });
    } finally {
      setIsPrintingSchedule(false);
    }
  };

  const totalAssignments = assignments.length;
  const assignedDepartments = new Set(assignments.map(a => a.department)).size;

  // Filter quick actions based on view mode
  const quickActions = [
    {
      title: "Tour Dates & Locations",
      description: "View tour dates, venues, and locations",
      icon: Calendar,
      onClick: () => setIsDatesOpen(true),
      badge: `${totalDates} dates`,
      viewOnly: true
    },
    {
      title: "Team Assignments",
      description: isTechnicianView 
        ? "View tour team members (automatically applied to all jobs)" 
        : "Assign crew members to the entire tour (auto-syncs to all jobs)",
      icon: UserCheck,
      onClick: () => setIsAssignmentsOpen(true),
      badge: `${totalAssignments} assigned`,
      viewOnly: isTechnicianView,
      hasAutoSync: true
    },
    {
      title: "Document Management",
      description: "Upload, organize, and share tour documents",
      icon: FileText,
      onClick: () => setIsDocumentsOpen(true),
      badge: "Available",
      viewOnly: false
    },
    {
      title: "Rates & Extras Manager",
      description: "Set extras and resolve rate issues",
      icon: Euro,
      onClick: () => setIsRatesManagerOpen(true),
      badge: tourRatesApproved ? "Rates Approved" : "Needs Approval",
      showForTechnician: false
    },
    {
      title: "Tour Configuration",
      description: "Power & weight defaults, technical settings",
      icon: Settings,
      onClick: () => setIsDefaultsManagerOpen(true),
      badge: "Settings",
      showForTechnician: false
    },
    {
      title: "Power Requirements",
      description: "Set default power calculations for all dates",
      icon: Calculator,
      onClick: handlePowerDefaults,
      badge: "Defaults",
      showForTechnician: false
    },
    {
      title: "Weight Calculations",
      description: "Configure weight defaults and calculations",
      icon: Weight,
      onClick: handleWeightDefaults,
      badge: "Defaults",
      showForTechnician: false
    },
    {
      title: "Scheduling & Timeline",
      description: "Tour timeline and scheduling management",
      icon: Clock,
      onClick: () => {},
      badge: "Coming Soon",
      viewOnly: true
    },
    {
      title: "Logistics",
      description: "Tour‑wide transport with per‑date overrides",
      icon: Truck,
      onClick: () => setIsLogisticsOpen(true),
      badge: "Available",
      showForTechnician: false
    }
  ].filter(action => {
    if (isTechnicianView && action.showForTechnician === false) {
      return false;
    }
    return true;
  });

  const handleBackToTechnicianDashboard = () => {
    navigate('/technician-dashboard');
  };

  const handleFlexClick = () => {
    if (isFlexLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we load the Flex folder...",
      });
      return;
    }

    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    } else if (flexError) {
      toast({
        title: "Error",
        description: flexError,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Info",
        description: "Flex folder not available for this tour",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Tour Logo */}
          {tourLogoUrl && (
            <div className="flex-shrink-0">
              <img 
                src={tourLogoUrl} 
                alt={`${tour.name} logo`}
                className="w-16 h-16 object-contain rounded-lg border border-border"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
          
          <div className="flex-1">
            {isTechnicianView && (
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" onClick={handleBackToTechnicianDashboard} className="p-0 h-auto">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Dashboard
                </Button>
                <Badge variant="outline" className="ml-2">
                  <Eye className="h-3 w-3 mr-1" />
                  Technician View
                </Badge>
              </div>
            )}
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
              {totalAssignments > 0 && (
                <Badge variant="outline">
                  {totalAssignments} crew assigned
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {!isTechnicianView && (
          <div className="flex gap-2">
            <Button 
              onClick={handlePrintSchedule}
              variant="outline"
              disabled={isPrintingSchedule}
            >
              <Printer className="h-4 w-4 mr-2" />
              {isPrintingSchedule ? 'Printing...' : 'Print Schedule'}
            </Button>
            {/* Only show Flex button if folder exists or is loading */}
            {(folderExists || isFlexLoading) && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleFlexClick}
                disabled={!flexUuid || isFlexLoading}
              >
                {isFlexLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <img src={createFolderIcon} alt="Flex" className="h-4 w-4" />
                )}
                {isFlexLoading ? 'Loading...' : 'Flex'}
              </Button>
            )}
            {(userRole === 'management' || userRole === 'admin') && (
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={openWaDialog}>
                <MessageCircle className="h-4 w-4" />
                WhatsApp Group
              </Button>
            )}
            <Button onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Tour Settings
            </Button>
          </div>
        )}
      </div>

      {/* Auto-sync info for management users */}
      {!isTechnicianView && (
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Automatic Job Synchronization</p>
              <p>Tour assignments are automatically applied to all jobs in this tour. Team members assigned to the tour will instantly appear on all individual job assignments, and removing them from the tour removes them from all jobs.</p>
            </div>
          </div>
        </div>
      )}

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
            <CardTitle className="text-sm font-medium">Assigned Crew</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              {assignedDepartments} departments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {isTechnicianView ? 'Tour Information' : 'Management Areas'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" onClick={action.onClick}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <action.icon className="h-6 w-6" style={{ color: tour.color }} />
                    {action.hasAutoSync && !isTechnicianView && (
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                        Auto-sync
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={action.badge === "Coming Soon" ? "secondary" : tourRatesApproved && action.title === 'Rates & Extras Manager' ? 'default' : 'outline'}>
                      {action.badge}
                    </Badge>
                    {!isTechnicianView && action.title === 'Rates & Extras Manager' && (
                      tourRatesApproved ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await supabase
                              .from('tours')
                              .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                              .eq('id', tour.id);
                            refetchApproval();
                          }}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { data: u } = await supabase.auth.getUser();
                            await supabase
                              .from('tours')
                              .update({ rates_approved: true, rates_approved_at: new Date().toISOString(), rates_approved_by: u?.user?.id || null } as any)
                              .eq('id', tour.id);
                            refetchApproval();
                          }}
                        >
                          Approve
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <CardTitle className="text-sm">{action.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{action.description}</p>
                {action.viewOnly && isTechnicianView && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    View Only
                  </Badge>
                )}
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
                  <TourDateFlexButton tourDateId={date.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Management Dialogs - Modified for technician view */}
      {!isTechnicianView && (
        <TourManagementDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          tour={tour}
        />
      )}

      {/* Rates & Extras Manager */}
      {!isTechnicianView && (
        <TourRatesManagerDialog 
          open={isRatesManagerOpen}
          onOpenChange={setIsRatesManagerOpen}
          tourId={tour.id}
        />
      )}

      <TourDateManagementDialog
        open={isDatesOpen}
        onOpenChange={setIsDatesOpen}
        tourId={tour.id}
        tourDates={getSortedTourDates()}
        readOnly={isTechnicianView}
      />

      {!isTechnicianView && (
        <TourDefaultsManager
          open={isDefaultsManagerOpen}
          onOpenChange={setIsDefaultsManagerOpen}
          tour={tour}
        />
      )}

      <TourAssignmentDialog
        open={isAssignmentsOpen}
        onOpenChange={setIsAssignmentsOpen}
        tourId={tour.id}
        readOnly={isTechnicianView}
      />

      <TourDocumentsDialog
        open={isDocumentsOpen}
        onOpenChange={setIsDocumentsOpen}
        tourId={tour.id}
        tourName={tour.name}
      />

      {/* Logistics – tour‑wide with per‑date overrides */}
      {!isTechnicianView && (
        <TourLogisticsDialog
          open={isLogisticsOpen}
          onOpenChange={setIsLogisticsOpen}
          tourId={tour.id}
        />
      )}

      {/* Create WhatsApp Group Dialog */}
      <Dialog open={isWaDialogOpen} onOpenChange={setIsWaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create WhatsApp Group</DialogTitle>
            <DialogDescription>
              Choose a tour date and department. The group will include the assigned crew for that date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Tour Date</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={waSelectedDateId || ''}
                onChange={(e) => setWaSelectedDateId(e.target.value || null)}
              >
                {getSortedTourDates().map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {format(new Date(d.date), 'PPPP')}{d.location?.name ? ` · ${d.location.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="wa-dept" checked={waDepartment==='sound'} onChange={() => setWaDepartment('sound')} />
                  <span>Sound</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="wa-dept" checked={waDepartment==='lights'} onChange={() => setWaDepartment('lights')} />
                  <span>Lights</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="wa-dept" checked={waDepartment==='video'} onChange={() => setWaDepartment('video')} />
                  <span>Video</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWaDialogOpen(false)} disabled={isCreatingWaGroup}>Cancel</Button>
            <Button onClick={handleCreateWaGroup} disabled={isCreatingWaGroup}>
              {isCreatingWaGroup ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TourManagement;
