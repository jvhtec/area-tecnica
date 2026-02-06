import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, X, Plus, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { useJobAssignmentsRealtime } from '@/hooks/useJobAssignmentsRealtime';
import { useAvailableTechnicians } from '@/hooks/useAvailableTechnicians';
import { useToast } from '@/hooks/use-toast';
import { roleOptionsForDiscipline, labelForCode } from '@/utils/roles';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTechnicianTheme } from '@/hooks/useTechnicianTheme';

interface MobileAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  department: string;
  userRole?: string | null;
}

export const MobileAssignmentsDialog: React.FC<MobileAssignmentsDialogProps> = ({
  open,
  onOpenChange,
  job,
  department,
  userRole,
}) => {
  const jobId = job?.id;
  const { toast } = useToast();
  const { theme, isDark } = useTechnicianTheme();
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [singleDay, setSingleDay] = useState(false);
  const [selectedJobDate, setSelectedJobDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canManageAssignments = ['admin', 'management', 'house_tech'].includes(userRole || '');

  const roleOptions = useMemo(() => roleOptionsForDiscipline(department) || [], [department]);

  useEffect(() => {
    if (roleOptions.length > 0) {
      setSelectedRole(roleOptions[0].code);
    }
  }, [roleOptions]);

  const {
    assignments,
    isLoading: assignmentsLoading,
    isRefreshing,
    refetch,
    addAssignment,
    removeAssignment,
    isRemoving,
  } = useJobAssignmentsRealtime(jobId);

  const { data: jobMeta } = useQuery({
    queryKey: ['mobile-job-meta', jobId],
    enabled: open && !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, start_time, end_time, job_date_types(date, type)')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const jobDates = useMemo(() => {
    if (!jobMeta) return [] as Date[];

    const typedDates = Array.isArray(jobMeta.job_date_types)
      ? (jobMeta.job_date_types as any[])
          .filter((dt) => dt?.date)
          .filter((dt) => {
            const type = (dt?.type || '').toLowerCase();
            return type !== 'off' && type !== 'travel';
          })
          .map((dt) => {
            const d = new Date(`${dt.date}T00:00:00`);
            d.setHours(0, 0, 0, 0);
            return d;
          })
      : [];

    if (typedDates.length > 0) {
      return typedDates.sort((a, b) => a.getTime() - b.getTime());
    }

    if (jobMeta.start_time) {
      const start = new Date(jobMeta.start_time);
      start.setHours(0, 0, 0, 0);
      if (jobMeta.end_time) {
        const end = new Date(jobMeta.end_time);
        end.setHours(0, 0, 0, 0);
        return eachDayOfInterval({ start, end });
      }
      return [start];
    }

    return [];
  }, [jobMeta]);

  useEffect(() => {
    if (!singleDay) {
      setSelectedJobDate(null);
      return;
    }
    if (singleDay && jobDates.length > 0 && (!selectedJobDate || !jobDates.some(d => d.getTime() === selectedJobDate.getTime()))) {
      setSelectedJobDate(jobDates[0]);
    }
  }, [singleDay, jobDates, selectedJobDate]);

  const {
    technicians: availableTechnicians = [],
    isLoading: isLoadingTechnicians,
  } = useAvailableTechnicians({
    department,
    jobId: jobId || '',
    jobStartTime: jobMeta?.start_time || job?.start_time || '',
    jobEndTime: jobMeta?.end_time || job?.end_time || '',
    assignmentDate: singleDay && selectedJobDate ? format(selectedJobDate, 'yyyy-MM-dd') : null,
    enabled: open && !!jobId,
  });

  const handleAddAssignment = async () => {
    if (!canManageAssignments) return;
    if (!selectedTech) {
      toast({
        title: 'Selecciona un técnico',
        description: 'Elige un técnico disponible antes de asignar',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedRole) {
      toast({
        title: 'Selecciona un rol',
        description: 'Elige un rol para la asignación',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const soundRole = department === 'sound' ? selectedRole : 'none';
      const lightsRole = department === 'lights' ? selectedRole : 'none';

      await addAssignment(selectedTech, soundRole, lightsRole, {
        singleDay,
        singleDayDate: singleDay && selectedJobDate ? format(selectedJobDate, 'yyyy-MM-dd') : null,
      });
      setSelectedTech(null);
    } finally {
      setIsSaving(false);
    }
  };

  const timeRange = useMemo(() => {
    if (!job?.start_time) return '';
    const start = format(new Date(job.start_time), 'HH:mm');
    const end = job.end_time ? format(new Date(job.end_time), 'HH:mm') : null;
    return end ? `${start} - ${end}` : start;
  }, [job]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none">
        <div className={`${theme.bg} ${theme.textMain} rounded-2xl border ${theme.card} w-[95vw] max-w-xl max-h-[85vh] overflow-hidden flex flex-col`}>
          <div className={`flex items-center justify-between p-4 border-b ${theme.divider}`}>
            <div>
              <p className={`text-xs ${theme.textMuted} uppercase tracking-[0.08em]`}>Asignaciones</p>
              <h3 className="text-lg font-semibold leading-tight">{job?.title}</h3>
              <p className={`text-xs ${theme.textMuted} flex items-center gap-1 mt-1`}>
                <CalendarIcon className="h-3 w-3" />
                {job?.start_time ? format(new Date(job.start_time), "d 'de' MMMM yyyy", { locale: es }) : 'Fecha sin definir'}
                {timeRange && ` • ${timeRange}`}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">Departamento: {department}</div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-200 hover:bg-white/10"
                onClick={refetch}
                disabled={isRefreshing || assignmentsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-slate-300" />
                <h4 className="text-sm font-semibold">Asignaciones actuales</h4>
                <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-slate-200">
                  {assignments.length}
                </Badge>
              </div>

              {assignmentsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-xs text-slate-500 border border-dashed border-white/10 rounded-lg p-4 text-center">
                  No hay asignaciones para este trabajo.
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment: any) => {
                    const name = `${assignment.profiles?.first_name ?? ''} ${assignment.profiles?.last_name ?? ''}`.trim() || 'Técnico';
                    const roleCode = department === 'sound' ? assignment.sound_role : assignment.lights_role || assignment.video_role;
                    const roleLabel = labelForCode(roleCode) || 'Asignado';
                    const singleDayLabel = assignment.single_day && assignment.assignment_date
                      ? format(new Date(`${assignment.assignment_date}T00:00:00`), "d 'de' MMM", { locale: es })
                      : null;

                    return (
                      <div
                        key={assignment.technician_id}
                        className="border border-white/10 rounded-lg p-3 bg-white/5 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{name}</p>
                          <p className="text-xs text-slate-400">{roleLabel}</p>
                          {singleDayLabel && (
                            <p className="text-[11px] text-amber-400 mt-1">Solo {singleDayLabel}</p>
                          )}
                        </div>
                        {canManageAssignments && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-300 hover:bg-red-500/10"
                            onClick={() => removeAssignment(assignment.technician_id)}
                            disabled={isRemoving[assignment.technician_id]}
                          >
                            {isRemoving[assignment.technician_id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Eliminar'
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {canManageAssignments && (
              <div className="space-y-3 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-slate-300" />
                  <h4 className="text-sm font-semibold">Agregar técnico</h4>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Técnico disponible</label>
                  <Select value={selectedTech || undefined} onValueChange={(val) => setSelectedTech(val)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder={isLoadingTechnicians ? 'Cargando...' : 'Selecciona un técnico'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {isLoadingTechnicians && (
                        <SelectItem value="loading" disabled>
                          Cargando...
                        </SelectItem>
                      )}
                      {!isLoadingTechnicians && availableTechnicians.length === 0 && (
                        <SelectItem value="none" disabled>
                          No hay técnicos disponibles
                        </SelectItem>
                      )}
                      {availableTechnicians.map((tech: any) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.first_name} {tech.last_name} {tech.role === 'house_tech' ? '(House)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Rol</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {roleOptions.map((role) => (
                        <SelectItem key={role.code} value={role.code}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                  <div>
                    <p className="text-sm font-semibold">Asignar un solo día</p>
                    <p className="text-xs text-slate-400">Elige una fecha específica si aplica</p>
                  </div>
                  <Switch checked={singleDay} onCheckedChange={setSingleDay} />
                </div>

                {singleDay && (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Fecha de asignación</label>
                    <Select
                      value={selectedJobDate ? format(selectedJobDate, 'yyyy-MM-dd') : undefined}
                      onValueChange={(val) => setSelectedJobDate(new Date(`${val}T00:00:00`))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecciona una fecha" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {jobDates.length === 0 && (
                          <SelectItem value="none" disabled>
                            No hay fechas disponibles
                          </SelectItem>
                        )}
                        {jobDates.map((date) => {
                          const value = format(date, 'yyyy-MM-dd');
                          const label = format(date, "d 'de' MMMM", { locale: es });
                          return (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={handleAddAssignment}
                  disabled={isSaving || isLoadingTechnicians || !selectedTech}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Asignar técnico'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
