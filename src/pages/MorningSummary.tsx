import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, ArrowLeft, Users, Briefcase, Home, Plane, Heart, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type TimesheetWithRelations = {
  technician_id: string;
  job_id: string;
  date: string;
  jobs: {
    id: string;
    title: string;
    start_time: string;
  };
  profiles: {
    first_name: string;
    last_name: string;
    nickname: string | null;
    department: string;
    role: string;
  };
};

type MorningSummaryData = {
  department: string;
  assignments: Array<{
    job_title: string;
    techs: string[];
  }>;
  warehouse: string[];
  vacation: string[];
  travel: string[];
  sick: string[];
  dayOff: string[];
  totalTechs: number;
  availableTechs: number;
};

const DEPARTMENT_CONFIG = {
  sound: { label: 'Sonido', emoji: '🎤', color: 'bg-purple-100 dark:bg-purple-900' },
  lights: { label: 'Iluminación', emoji: '💡', color: 'bg-yellow-100 dark:bg-yellow-900' },
  video: { label: 'Vídeo', emoji: '📹', color: 'bg-blue-100 dark:bg-blue-900' },
  logistics: { label: 'Logística', emoji: '🚚', color: 'bg-green-100 dark:bg-green-900' },
  production: { label: 'Producción', emoji: '🎬', color: 'bg-red-100 dark:bg-red-900' },
};

export default function MorningSummary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MorningSummaryData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const departmentsParam = searchParams.get('departments');
  const departments = departmentsParam ? departmentsParam.split(',') : [];

  useEffect(() => {
    fetchSummaryData();
  }, [date, departmentsParam]);

  const fetchSummaryData = async () => {
    if (departments.length === 0) {
      setError('No departments specified');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const tomorrowDate = nextDate.toISOString().split('T')[0];

      const summaries: MorningSummaryData[] = [];

      for (const dept of departments) {
        // Get assignments from timesheets (source of truth)
        const { data: timesheetData } = await supabase
          .from('timesheets')
          .select(`
            technician_id,
            job_id,
            date,
            jobs!inner(id, title, start_time),
            profiles!fk_timesheets_technician_id!inner(first_name, last_name, nickname, department, role)
          `)
          .eq('date', date)
          .eq('is_active', true)
          .eq('profiles.department', dept)
          .eq('profiles.role', 'house_tech')
          .gte('jobs.start_time', date)
          .lt('jobs.start_time', tomorrowDate) as { data: TimesheetWithRelations[] | null };

        // Get unavailable
      const { data: unavailable } = await supabase
        .from('availability_schedules')
        .select(`
          user_id,
          source,
          profile:profiles!availability_schedules_user_id_fkey!inner(first_name, last_name, nickname, department, role)
        `)
        .eq('date', date)
        .eq('status', 'unavailable')
        .eq('profile.department', dept)
        .eq('profile.role', 'house_tech');

        // Get all house techs (population)
      const { data: allTechs } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .eq('department', dept)
        .eq('role', 'house_tech');

        // Legacy fallback: include legacy per-day marks so counts match the Personal calendar
        let unavailableMerged = unavailable || [];
        try {
          const techIds = (allTechs || []).map(t => t.id);
          if (techIds.length) {
            const { data: legacyRows } = await supabase
              .from('technician_availability')
              .select('technician_id, date, status')
              .in('technician_id', techIds)
              .eq('date', date)
              .in('status', ['vacation','travel','sick','day_off']);
            if (legacyRows && legacyRows.length) {
              const existing = new Set((unavailable || []).map((u: any) => u.user_id));
              for (const row of legacyRows as any[]) {
                if (!existing.has(row.technician_id)) {
                  const prof = (allTechs || []).find(t => t.id === row.technician_id);
                  if (prof) {
                    unavailableMerged = [
                      ...unavailableMerged,
                      {
                        user_id: row.technician_id,
                        source: row.status,
                        profile: {
                          first_name: prof.first_name,
                          last_name: prof.last_name,
                          nickname: prof.nickname,
                          department: dept,
                          role: 'house_tech',
                        }
                      }
                    ];
                    existing.add(row.technician_id);
                  }
                }
              }
            }
          }
        } catch (_) {
          // Legacy table may not exist in some environments
        }

        // Process data
        const jobGroups: Record<string, string[]> = {};
        for (const timesheet of timesheetData || []) {
          const jobTitle = timesheet.jobs?.title ?? 'Unknown';
          const techName = timesheet.profiles?.nickname || timesheet.profiles?.first_name || 'Unknown';
          if (!jobGroups[jobTitle]) {
            jobGroups[jobTitle] = [];
          }
          jobGroups[jobTitle].push(techName);
        }

        const assignedIds = new Set((timesheetData || []).map((t: TimesheetWithRelations) => t.technician_id));
        const unavailableIds = new Set((unavailableMerged || []).map((u: any) => u.user_id));
        const warehouse = (allTechs || [])
          .filter(t => !assignedIds.has(t.id) && !unavailableIds.has(t.id))
          .map(t => t.nickname || t.first_name);

        const bySource: Record<string, string[]> = {};
        for (const u of (unavailableMerged || [])) {
          const source = (u as any).source || 'other';
          if (!bySource[source]) bySource[source] = [];
          bySource[source].push((u as any).profile.nickname || (u as any).profile.first_name);
        }

        summaries.push({
          department: dept,
          assignments: Object.entries(jobGroups).map(([job_title, techs]) => ({ job_title, techs })),
          warehouse,
          vacation: bySource.vacation || [],
          travel: bySource.travel || [],
          sick: bySource.sick || [],
          dayOff: bySource.day_off || [],
          totalTechs: (allTechs || []).length,
          availableTechs: warehouse.length,
        });
      }

      setData(summaries);
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError('Error loading summary data');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = format(new Date(date + 'T00:00:00Z'), "EEEE d 'de' MMMM", { locale: es });

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => navigate('/personal')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/personal')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al calendario
        </Button>
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6" />
          <h1 className="text-3xl font-bold capitalize">{formattedDate}</h1>
        </div>
      </div>

      {/* Department Summaries */}
      <div className="space-y-6">
        {data.map((summary) => {
          const deptConfig = DEPARTMENT_CONFIG[summary.department as keyof typeof DEPARTMENT_CONFIG];
          if (!deptConfig) return null;

          return (
            <Card key={summary.department} className={`${deptConfig.color} border-2`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <span className="text-4xl">{deptConfig.emoji}</span>
                  <span>{deptConfig.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Assignments */}
                {summary.assignments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                      <Briefcase className="h-5 w-5" />
                      <span>En Trabajos</span>
                    </div>
                    <div className="pl-7 space-y-1">
                      {summary.assignments.map((assignment, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <div>
                            <span className="font-medium">{assignment.job_title}:</span>{' '}
                            <span>{assignment.techs.join(', ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warehouse */}
                {summary.warehouse.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                      <Home className="h-5 w-5" />
                      <span>En Almacén</span>
                    </div>
                    <div className="pl-7">
                      <p>{summary.warehouse.join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Vacation */}
                {summary.vacation.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                      <Sun className="h-5 w-5" />
                      <span>De Vacaciones</span>
                    </div>
                    <div className="pl-7">
                      <p>{summary.vacation.join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Travel */}
                {summary.travel.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                      <Plane className="h-5 w-5" />
                      <span>De Viaje</span>
                    </div>
                    <div className="pl-7">
                      <p>{summary.travel.join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Sick */}
                {summary.sick.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                      <Heart className="h-5 w-5" />
                      <span>Enfermos</span>
                    </div>
                    <div className="pl-7">
                      <p>{summary.sick.join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Day Off */}
                {summary.dayOff.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                      <Calendar className="h-5 w-5" />
                      <span>Día Libre</span>
                    </div>
                    <div className="pl-7">
                      <p>{summary.dayOff.join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Users className="h-5 w-5" />
                    <span>
                      {summary.availableTechs}/{summary.totalTechs} técnicos disponibles
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
