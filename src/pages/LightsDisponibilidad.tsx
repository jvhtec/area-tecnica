import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { Button } from '@/components/ui/button';
import { Box, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PresetManagementDialog } from '@/components/equipment/PresetManagementDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { endOfDay, format, startOfDay } from 'date-fns';
import { WeeklySummary } from '@/components/disponibilidad/WeeklySummary';
import { QuickPresetAssignment } from '@/components/disponibilidad/QuickPresetAssignment';
import { SubRentalManager } from '@/components/equipment/SubRentalManager';
import { DepartmentProvider } from '@/contexts/DepartmentContext';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';
import { useOptimizedJobs } from '@/hooks/useOptimizedJobs';

export default function LightsDisponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const navigate = useNavigate();
  const { session } = useOptimizedAuth();
  const { toast } = useToast();

  const dayStart = startOfDay(selectedDate);
  const dayEnd = endOfDay(selectedDate);
  const { data: jobsToday = [] } = useOptimizedJobs('lights' as any, dayStart, dayEnd);

  const { data: assignedPresets } = useQuery({
    queryKey: ['preset-assignments', 'lights', selectedDate],
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
        .eq('preset.department', 'lights')
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

  const jobIds = useMemo(() => (
    (assignedPresets || [])
      .map((a: any) => a?.preset?.job?.id)
      .filter(Boolean)
  ), [assignedPresets]);
  const [logoMap, setLogoMap] = useState<Record<string, string | undefined>>({});
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
  }, [jobIds]);

  return (
    <DepartmentProvider department="lights">
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Presets de Equipamiento</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate('/equipment-management')}
          >
            <Box className="mr-2 h-4 w-4" />
            Gestionar Inventario
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowPresetDialog(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Gestionar Presets
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
          <div className="flex justify-end">
            <QuickPresetAssignment selectedDate={selectedDate} />
          </div>
        </div>
        <div className="space-y-4">
          {selectedDate && (
            <div className="rounded-lg border p-4 max-w-md mx-auto lg:mx-0">
              <h2 className="text-lg font-semibold mb-4">
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
                          <img src={logo} alt="logo" className="h-8 w-8 rounded-md object-cover border" />
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
                            <img src={logo} alt="logo" className="h-8 w-8 rounded-md object-cover border" />
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
