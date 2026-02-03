import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { Button } from '@/components/ui/button';
import { Box, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PresetManagementDialog } from '@/components/equipment/PresetManagementDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { endOfDay, format, startOfDay } from 'date-fns';
import { WeeklySummary } from '@/components/disponibilidad/WeeklySummary';
import { QuickPresetAssignment } from '@/components/disponibilidad/QuickPresetAssignment';
import { SubRentalManager } from '@/components/equipment/SubRentalManager';
import { DepartmentProvider } from '@/contexts/DepartmentContext';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';
import { useOptimizedJobs } from '@/hooks/useOptimizedJobs';
import { useOptimizedTableSubscriptions } from '@/hooks/useOptimizedSubscriptions';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * Render the Sound department presets availability view with calendar, job/preset listings, and management controls.
 *
 * Provides a date picker, daily and weekly summaries, quick assignment UI, sub-rental manager, and a dialog for managing presets; it also fetches and displays job logos and subscribes to relevant realtime updates for the "sound" department.
 *
 * @returns A React element containing the presets availability UI for the Sound department.
 */
export default function SoundDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [logoMap, setLogoMap] = useState<Record<string, string | undefined>>({});
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const dayStart = startOfDay(selectedDate);
  const dayEnd = endOfDay(selectedDate);
  const { data: jobsToday = [] } = useOptimizedJobs('sound' as any, dayStart, dayEnd);

  const { data: assignedPresets } = useQuery({
    queryKey: ['preset-assignments', 'sound', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return null;
      
      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select(`
          *,
          preset:presets!inner (
            id,
            name,
            created_by,
            department,
            job_id,
            job:jobs (
              id,
              title,
              location:locations (name)
            )
          )
        `)
        .eq('preset.department', 'sound')
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .order('order', { ascending: true });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load preset assignments"
        });
        throw error;
      }

      return data;
    },
    enabled: !!selectedDate
  });

  // Realtime: subscribe to assignments and stock affecting this view
  useOptimizedTableSubscriptions([
    { table: 'day_preset_assignments', queryKey: ['preset-assignments'], priority: 'high' },
    { table: 'preset_items', queryKey: ['preset-assignments'], priority: 'medium' },
    { table: 'presets', queryKey: ['presets'], priority: 'low' },
    { table: 'equipment', queryKey: ['equipment-with-stock', 'sound'], priority: 'low' },
    { table: 'current_stock_levels', queryKey: ['equipment-with-stock', 'sound'], priority: 'medium' },
    { table: 'sub_rentals', queryKey: ['equipment-with-stock', 'sound'], priority: 'medium' },
  ]);

  // Fetch job logos for display
  const jobIds = useMemo(() => (
    (assignedPresets || [])
      .map((a: any) => a?.preset?.job?.id)
      .filter(Boolean)
  ), [assignedPresets]);

  useEffect(() => {
    let ignore = false;
    const unique = Array.from(new Set(jobIds as string[]));
    (async () => {
      for (const id of unique) {
        if (logoMap[id]) continue;
        const url = await fetchJobLogo(id);
        if (!ignore) setLogoMap(prev => ({ ...prev, [id]: url }));
      }
    })();
    return () => { ignore = true };
  }, [jobIds, logoMap]);

  return (
    <DepartmentProvider department="sound">
      <div className="w-full max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-6 space-y-6">
        <div
          className={cn(
            "flex items-center",
            isMobile ? "flex-col gap-3 w-full" : "justify-between"
          )}
        >
          <h1 className="text-2xl font-bold">Presets de Sonido</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto"
              onClick={() => navigate('/equipment-management')}
            >
              <Box className="mr-2 h-4 w-4" />
              Gestionar Inventario
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto"
              onClick={() => setShowPresetDialog(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Gestionar Presets
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border shadow-sm">
              <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
            </div>
            <div
              className={cn(
                "flex",
                isMobile ? "justify-center w-full" : "justify-end"
              )}
            >
              <QuickPresetAssignment
                selectedDate={selectedDate}
                className={isMobile ? "w-full" : ""}
              />
            </div>
          </div>
          <div className="space-y-4">
            {selectedDate && (
              <div className="rounded-xl border shadow-sm p-4 sm:p-5 w-full md:max-w-md lg:max-w-lg mx-auto lg:mx-0">
                <h2 className="text-base md:text-lg font-semibold mb-4">
                  {format(selectedDate, 'PPP')}
                </h2>
                {(jobsToday && jobsToday.length > 0) ? (
                  <div className="space-y-3">
                    {jobsToday.map((job: any) => {
                      const title = job.title;
                      const location = job.location?.name;
                      const logo = logoMap[job.id];
                      return (
                        <div key={job.id} className="flex items-center gap-3">
                          {logo ? (
                            <img
                              src={logo}
                              alt="logo"
                              width={32}
                              height={32}
                              loading="lazy"
                              decoding="async"
                              className="h-8 w-8 rounded-md object-cover border"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center border text-xs font-semibold">
                              {String(title || '?').slice(0,1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{title}</div>
                            {location && (
                              <div className="text-sm text-muted-foreground truncate">{location}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  assignedPresets && assignedPresets.length > 0 ? (
                    <div className="space-y-3">
                      {assignedPresets.map((assignment: any) => {
                        const job = assignment?.preset?.job;
                        const title = job?.title || assignment?.preset?.name;
                        const location = job?.location?.name;
                        const logo = job?.id ? logoMap[job.id] : undefined;
                        return (
                          <div key={assignment.id} className="flex items-center gap-3">
                            {logo ? (
                              <img
                                src={logo}
                                alt="logo"
                                width={32}
                                height={32}
                                loading="lazy"
                                decoding="async"
                                className="h-8 w-8 rounded-md object-cover border"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center border text-xs font-semibold">
                                {String(title || '?').slice(0,1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{title}</div>
                              {location && (
                                <div className="text-sm text-muted-foreground truncate">{location}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No jobs or presets for this date</p>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <WeeklySummary 
          selectedDate={selectedDate} 
          onDateChange={setSelectedDate} 
        />

        <SubRentalManager />

        <PresetManagementDialog
          open={showPresetDialog} 
          onOpenChange={setShowPresetDialog}
          selectedDate={selectedDate}
        />
      </div>
    </DepartmentProvider>
  );
}