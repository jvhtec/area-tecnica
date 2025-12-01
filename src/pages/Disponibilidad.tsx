import { DisponibilidadCalendar } from '@/components/disponibilidad/DisponibilidadCalendar';
import { InventoryManagementDialog } from '@/components/equipment/InventoryManagementDialog';
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
import { SubRentalDialog } from '@/components/equipment/SubRentalDialog';
import { DepartmentProvider } from '@/contexts/DepartmentContext';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';
import { useOptimizedJobs } from '@/hooks/useOptimizedJobs';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { MobileAvailabilityView } from '@/components/disponibilidad/MobileAvailabilityView';

type DisponibilidadDepartment = 'sound' | 'lights';

const DEPARTMENT_LABELS: Record<DisponibilidadDepartment, string> = {
  sound: 'Sonido',
  lights: 'Luces'
};

export default function Disponibilidad() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const navigate = useNavigate();
  const { session, userDepartment, userRole } = useOptimizedAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const normalizedDepartment = userDepartment?.toLowerCase();
  const isAdmin = userRole === 'admin';
  const isManagement = userRole === 'management';
  const hasManagementDepartmentAccess =
    userRole === 'management' &&
    (normalizedDepartment === 'sound' || normalizedDepartment === 'lights');

  const [adminDepartment, setAdminDepartment] = useState<DisponibilidadDepartment>('sound');

  useEffect(() => {
    if (isAdmin && hasManagementDepartmentAccess && normalizedDepartment) {
      setAdminDepartment(normalizedDepartment as DisponibilidadDepartment);
    }
  }, [isAdmin, hasManagementDepartmentAccess, normalizedDepartment]);

  const department: DisponibilidadDepartment | null = isAdmin
    ? adminDepartment
    : hasManagementDepartmentAccess
      ? (normalizedDepartment as DisponibilidadDepartment)
      : null;

  if (isManagement && !hasManagementDepartmentAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <h1 className="text-2xl font-semibold mb-4">Acceso restringido</h1>
        <p className="text-muted-foreground max-w-xl">
          Esta sección solo está disponible para los departamentos de Sonido y Luces.
          Solicita acceso a uno de estos departamentos para continuar.
        </p>
      </div>
    );
  }

  if (!department) {
    return null;
  }

  const departmentLabel = DEPARTMENT_LABELS[department];

  // Jobs happening on the selected date for this department
  const dayStart = startOfDay(selectedDate);
  const dayEnd = endOfDay(selectedDate);
  const { data: jobsToday = [] } = useOptimizedJobs(department as any, dayStart, dayEnd);

  const { data: assignedPresets } = useQuery({
    queryKey: ['preset-assignments', department, selectedDate],
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
        .eq('preset.department', department)
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

  // Prefetch tiny logos for the jobs referenced by the presets
  const jobIds = useMemo(() => {
    const fromPresets = (assignedPresets || [])
      .map((a: any) => a?.preset?.job?.id)
      .filter(Boolean) as string[];
    const fromJobs = (jobsToday || []).map((j: any) => j.id) as string[];
    return Array.from(new Set([...fromPresets, ...fromJobs]));
  }, [assignedPresets, jobsToday]);

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

  if (isMobile) {
    return (
      <DepartmentProvider department={department}>
        <MobileAvailabilityView
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          jobs={jobsToday}
          assignedPresets={assignedPresets || []}
          logoMap={logoMap}
        />
      </DepartmentProvider>
    );
  }

  return (
    <DepartmentProvider department={department}>
      <div className="w-full px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Disponibilidad · {departmentLabel}</h1>
          {isAdmin && (
            <div className="flex gap-2">
              {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                <Button
                  key={value}
                  variant={department === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdminDepartment(value as DisponibilidadDepartment)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <InventoryManagementDialog />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPresetDialog(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Gestionar Presets
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Area: Weekly Summary (Red - Huge) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="rounded-xl border shadow-sm bg-card p-1">
              <WeeklySummary
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>
          </div>

          {/* Sidebar: Stacked Tools (Green, Blue, Yellow, Purple) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            {/* Calendar (Green) */}
            <div className="rounded-xl border shadow-sm bg-card">
              <DisponibilidadCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
            </div>

            {/* Selected Day Details (Blue) */}
            {selectedDate && (
              <div className="rounded-xl border shadow-sm p-4 bg-card">
                <h2 className="text-base font-semibold mb-3">
                  {format(selectedDate, 'PPP')}
                </h2>
                {(jobsToday && jobsToday.length > 0) ? (
                  <div className="space-y-2">
                    {jobsToday.map((job: any) => {
                      const title = job.title;
                      const location = job.location?.name;
                      const logo = logoMap[job.id];
                      return (
                        <div key={job.id} className="flex items-center gap-3 p-2 rounded-lg border bg-accent/10 hover:bg-accent/20 transition-colors">
                          {logo ? (
                            <img src={logo} alt="logo" className="h-8 w-8 rounded-md object-cover border" />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center border text-xs font-semibold">
                              {String(title || '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate text-sm">{title}</div>
                            {location && (
                              <div className="text-xs text-muted-foreground truncate">{location}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  assignedPresets && assignedPresets.length > 0 ? (
                    <div className="space-y-2">
                      {assignedPresets.map((assignment: any) => {
                        const job = assignment?.preset?.job;
                        const title = job?.title || assignment?.preset?.name;
                        const location = job?.location?.name;
                        const logo = job?.id ? logoMap[job.id] : undefined;
                        return (
                          <div key={assignment.id} className="flex items-center gap-3 p-2 rounded-lg border bg-accent/10 hover:bg-accent/20 transition-colors">
                            {logo ? (
                              <img src={logo} alt="logo" className="h-8 w-8 rounded-md object-cover border" />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center border text-xs font-semibold">
                                {String(title || '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate text-sm">{title}</div>
                              {location && (
                                <div className="text-xs text-muted-foreground truncate">{location}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground bg-accent/5 rounded-lg border border-dashed">
                      <p className="text-sm">No jobs or presets</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Quick Assignment (Yellow) */}
            <div className="rounded-xl border shadow-sm bg-card p-4">
              <h3 className="font-semibold mb-3 text-sm">Asignación Rápida</h3>
              <QuickPresetAssignment
                selectedDate={selectedDate}
              />
            </div>

            {/* Sub-Rentals Modal Trigger (Purple) */}
            <SubRentalDialog />
          </div>
        </div>

        <PresetManagementDialog
          open={showPresetDialog}
          onOpenChange={setShowPresetDialog}
          selectedDate={selectedDate}
        />
      </div>
    </DepartmentProvider>
  );
}
