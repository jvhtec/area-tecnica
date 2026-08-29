
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ManageSkillsDialog } from '@/components/users/ManageSkillsDialog';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { dataLayerClient } from '@/services/dataLayerClient';
import type { UserRole } from '@/types/user';
import { isAdminRole, isManagementRole } from '@/utils/permissions';
import { getCalendarPeriodDateKeys } from '@/utils/timezoneUtils';
import { formatUserName } from '@/utils/userName';
import { useQueryClient } from '@tanstack/react-query';
import { subYears } from 'date-fns';
import { Building, ChevronDown, ChevronUp, Edit, IdCard, Mail, MapPin, Medal, Phone, Plus, Refrigerator, User } from 'lucide-react';
import React from 'react';


import { DEPARTMENT_LABELS } from "@/types/department";

import { TechnicianRowEditForm, type TechnicianEditData } from "@/components/matrix/TechnicianRowEditForm";
import {
  currentYearMedalComment,
  lastYearMedalComment,
  MEDAL_COLORS,
  type MedalRank,
} from "@/components/matrix/technicianMedalComments";
import { queryKeys } from "@/lib/react-query";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Error desconocido";

interface TechnicianRowProps {
  technician: {
    id: string;
    first_name: string;
    nickname?: string | null;
    last_name: string;
    email: string;
    phone?: string | null;
    dni?: string | null;
    department: string;
    role: string;
    bg_color?: string | null;
    profile_picture_url?: string | null;
    skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
  };
  height: number;
  isFridge?: boolean;
  compact?: boolean;
  medalRank?: 'gold' | 'silver' | 'bronze';
  lastYearMedalRank?: 'gold' | 'silver' | 'bronze';
}

const TechnicianRowComp = ({ technician, height, isFridge = false, compact = false, medalRank, lastYearMedalRank }: TechnicianRowProps) => {
  const { userRole } = useOptimizedAuth();
  const isAdmin = isAdminRole(userRole);
  const isManagementUser = isManagementRole(userRole);
  const [skillsOpen, setSkillsOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const qc = useQueryClient();
  const [togglingFridge, setTogglingFridge] = React.useState(false);

  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [metricsExpanded, setMetricsExpanded] = React.useState(false);
  const [metrics, setMetrics] = React.useState<{
    monthTotal: number;
    yearTotal: number;
    lastYearTotal: number;
    monthUpcoming: number;
    yearUpcoming: number;
    lastYearUpcoming: number;
  }>({ monthTotal: 0, yearTotal: 0, lastYearTotal: 0, monthUpcoming: 0, yearUpcoming: 0, lastYearUpcoming: 0 });
  const [residencia, setResidencia] = React.useState<string | null>(null);
  const [homeLatitude, setHomeLatitude] = React.useState<number | null>(null);
  const [homeLongitude, setHomeLongitude] = React.useState<number | null>(null);
  const [residenciaLoading, setResidenciaLoading] = React.useState(false);
  const [sendingOnboarding, setSendingOnboarding] = React.useState(false);
  const { toast } = useToast();

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editedData, setEditedData] = React.useState<TechnicianEditData>({
    first_name: technician.first_name,
    nickname: technician.nickname || '',
    last_name: technician.last_name,
    email: technician.email,
    phone: technician.phone || '',
    dni: technician.dni || '',
    department: technician.department,
    role: technician.role,
    residencia: residencia || '',
    home_latitude: homeLatitude,
    home_longitude: homeLongitude,
    bg_color: technician.bg_color || ''
  });

  const loadMetrics = React.useCallback(async () => {
    try {
      setMetricsLoading(true);
      const period = getCalendarPeriodDateKeys();
      const mStart = period.monthStart;
      const mEnd = period.monthEnd;
      const yStart = period.yearStart;
      const yEnd = period.yearEnd;
      const lyStart = period.previousYearStart;
      const lyEnd = period.previousYearEnd;

      // Count all active timesheets (individual work dates)
      const countTotalInRange = async (fromDate: string, toDate: string) => {
        const { count, error } = await dataLayerClient.from('timesheets')
          .select('*', { count: 'exact', head: true })
          .eq('technician_id', technician.id)
          .eq('is_active', true)
          .gte('date', fromDate)
          .lte('date', toDate);
        if (error) {
          console.warn('Total metrics count error', error);
          return 0;
        }
        return count || 0;
      };

      // Count upcoming/draft timesheets
      const countUpcomingInRange = async (fromDate: string, toDate: string) => {
        const { count, error } = await dataLayerClient.from('timesheets')
          .select('*', { count: 'exact', head: true })
          .eq('technician_id', technician.id)
          .eq('is_active', true)
          .eq('status', 'draft')
          .gte('date', fromDate)
          .lte('date', toDate);
        if (error) {
          console.warn('Upcoming metrics count error', error);
          return 0;
        }
        return count || 0;
      };

      const [mTotal, yTotal, lyTotal, mUpcoming, yUpcoming, lyUpcoming] = await Promise.all([
        countTotalInRange(mStart, mEnd),
        countTotalInRange(yStart, yEnd),
        countTotalInRange(lyStart, lyEnd),
        countUpcomingInRange(mStart, mEnd),
        countUpcomingInRange(yStart, yEnd),
        countUpcomingInRange(lyStart, lyEnd)
      ]);

      setMetrics({
        monthTotal: mTotal,
        yearTotal: yTotal,
        lastYearTotal: lyTotal,
        monthUpcoming: mUpcoming,
        yearUpcoming: yUpcoming,
        lastYearUpcoming: lyUpcoming
      });
    } finally {
      setMetricsLoading(false);
    }
  }, [technician.id]);

  const loadProfileResidencia = React.useCallback(async () => {
    try {
      setResidenciaLoading(true);
      const { data, error } = await dataLayerClient.from('profiles')
        .select('residencia, home_latitude, home_longitude')
        .eq('id', technician.id)
        .single();
      if (!error) {
        const resValue = data?.residencia ?? null;
        const lat = data?.home_latitude ?? null;
        const lng = data?.home_longitude ?? null;
        setResidencia(resValue);
        setHomeLatitude(lat);
        setHomeLongitude(lng);
        setEditedData(prev => ({
          ...prev,
          residencia: resValue || '',
          home_latitude: lat,
          home_longitude: lng
        }));
      }
    } finally {
      setResidenciaLoading(false);
    }
  }, [technician.id]);

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      const { error } = await dataLayerClient.from('profiles')
        .update({
          first_name: editedData.first_name,
          nickname: editedData.nickname || null,
          last_name: editedData.last_name,
          email: editedData.email,
          phone: editedData.phone || null,
          dni: editedData.dni || null,
          department: editedData.department,
          role: editedData.role as UserRole,
          residencia: editedData.residencia || null,
          home_latitude: editedData.home_latitude,
          home_longitude: editedData.home_longitude,
          bg_color: editedData.bg_color || null
        })
        .eq('id', technician.id);

      if (error) throw error;

      // Update local state
      setResidencia(editedData.residencia || null);
      setHomeLatitude(editedData.home_latitude);
      setHomeLongitude(editedData.home_longitude);

      // Invalidate queries to refresh data
      await qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-technicians') });

      toast({ title: 'Usuario actualizado', description: 'Cambios guardados correctamente.' });
      setIsEditing(false);
    } catch (error: unknown) {
      toast({ title: 'Error al actualizar usuario', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = () => {
    // Sync current data before entering edit mode
    setEditedData({
      first_name: technician.first_name,
      nickname: technician.nickname || '',
      last_name: technician.last_name,
      email: technician.email,
      phone: technician.phone || '',
      dni: technician.dni || '',
      department: technician.department,
      role: technician.role,
      residencia: residencia || '',
      home_latitude: homeLatitude,
      home_longitude: homeLongitude,
      bg_color: technician.bg_color || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedData({
      first_name: technician.first_name,
      nickname: technician.nickname || '',
      last_name: technician.last_name,
      email: technician.email,
      phone: technician.phone || '',
      dni: technician.dni || '',
      department: technician.department,
      role: technician.role,
      residencia: residencia || '',
      home_latitude: homeLatitude,
      home_longitude: homeLongitude,
      bg_color: technician.bg_color || ''
    });
    setIsEditing(false);
  };

  const handleSkillsOpenChange = (open: boolean) => {
    if (!open) {
      // Invalidate technicians list so skills refresh
      qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-technicians') });
    }
    setSkillsOpen(open);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) {
      loadMetrics();
      // Fetch residencia lazily when opening
      if (residencia === null) {
        loadProfileResidencia();
      }
    }
  };

  const toggleFridge = async () => {
    try {
      setTogglingFridge(true);
      const next = !isFridge;
      const { error } = await dataLayerClient.from('technician_fridge')
        .upsert({ technician_id: technician.id, in_fridge: next }, { onConflict: 'technician_id' });
      if (error) throw error;
      // Invalidate fridge queries so UI updates across matrix
      await qc.invalidateQueries({ queryKey: queryKeys.scope('technician-fridge-status') });
    } catch (error: unknown) {
      console.warn('Fridge toggle error', error);
    } finally {
      setTogglingFridge(false);
    }
  };
  const getInitials = () => {
    const firstInitial = technician.first_name?.[0] ?? '';
    const secondSource = technician.nickname || technician.last_name || '';
    const secondInitial = secondSource?.[0] ?? '';
    const initials = `${firstInitial}${secondInitial}`.trim();
    return initials ? initials.toUpperCase() : 'T';
  };

  const displayName = formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico';

  // Tinted chips rather than fixed light-mode pastels: the matrix is read on
  // dark FOH laptops as often as on a bright office screen.
  const getDepartmentColor = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'sound':
        return 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300';
      case 'lights':
        return 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300';
      case 'video':
        return 'border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300';
      case 'production':
        return 'border-teal-500/40 bg-teal-500/15 text-teal-700 dark:text-teal-300';
      case 'logistics':
        return 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300';
      default:
        return 'border-border bg-muted text-muted-foreground';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'house_tech':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      case 'technician':
        return 'border-border bg-muted/60 text-muted-foreground';
      default:
        return 'border-border bg-muted/60 text-muted-foreground';
    }
  };

  const getLastYearSnarkyComment = (rank: MedalRank): string => {
    const lastYear = new Date().getFullYear() - 1;
    return lastYearMedalComment(technician.id, rank, lastYear);
  };

  const getMedalIcon = (rank?: MedalRank, size: 'sm' | 'md' = 'sm') => {
    if (!rank) return null;
    const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Medal className={sizeClass} style={{ color: MEDAL_COLORS[rank], cursor: 'help' }} />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{currentYearMedalComment(technician.id, rank)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const deptAbbrev = (technician.department || '').slice(0, 3).toUpperCase();
  // The UI language is Spanish; `technician.department` is the English enum value.
  const departmentLabel =
    DEPARTMENT_LABELS[technician.department as keyof typeof DEPARTMENT_LABELS] || technician.department;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <div
            className="group/tech relative cursor-pointer overflow-hidden border-b border-border/60 transition-colors hover:bg-accent/40"
            style={{
              height,
              padding: compact ? '0.25rem' : '0.5rem 0.625rem',
              backgroundColor: technician.bg_color || undefined
            }}
            title={compact ? displayName : undefined}
          >
            {compact ? (
              <div className="h-full flex flex-col items-center justify-center w-full min-w-0">
                <div className="relative">
                  <Avatar className="h-7 w-7 rounded-lg">
                    <AvatarImage src={technician.profile_picture_url || undefined} alt={displayName} />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {isFridge && (
                    <Refrigerator className="absolute -top-1 -right-1 h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  )}
                  {medalRank && !isFridge && (
                    <div className="absolute -top-1 -right-1">
                      {getMedalIcon(medalRank, 'sm')}
                    </div>
                  )}
                </div>
                {/* Initials alone are unidentifiable on touch, where there is no
                    hover to reveal the title. */}
                <div className="mt-0.5 w-full truncate text-center text-xs font-medium leading-tight">
                  {displayName}
                </div>
                <div className="text-[10px] leading-none text-muted-foreground">{deptAbbrev}</div>
              </div>
            ) : (
              <div className="flex h-full items-center gap-2.5">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9 rounded-xl ring-1 ring-border">
                    <AvatarImage src={technician.profile_picture_url || undefined} alt={displayName} />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {isFridge ? (
                    <span
                      className="absolute -top-1 -right-1 rounded-full bg-background p-[1px] shadow-sm"
                      title="En la nevera"
                    >
                      <Refrigerator className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    </span>
                  ) : medalRank ? (
                    <span className="absolute -top-1 -right-1 rounded-full bg-background p-[1px] shadow-sm">
                      {getMedalIcon(medalRank, 'sm')}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-tight transition-colors group-hover/tech:text-primary">
                    {displayName}
                  </div>
                  <div className="mt-1 flex flex-nowrap gap-1 overflow-hidden">
                    <span
                      className={`inline-flex h-5 items-center whitespace-nowrap rounded-md border px-1.5 text-xs font-semibold leading-none ${getDepartmentColor(technician.department)}`}
                    >
                      {departmentLabel}
                    </span>
                    <span
                      className={`inline-flex h-5 items-center whitespace-nowrap rounded-md border px-1.5 text-xs font-medium leading-none ${getRoleColor(technician.role)}`}
                    >
                      {technician.role === 'house_tech' ? 'Técnico de Casa' : 'Técnico'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className={compact ? 'w-[calc(100vw-1.5rem)] max-w-sm' : 'w-80'}
          side={compact ? 'bottom' : 'right'}
          align={compact ? 'start' : 'center'}
          collisionPadding={12}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={technician.profile_picture_url || undefined} alt={displayName} />
                <AvatarFallback>
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">
                  <span>{displayName}</span>
                  {medalRank && getMedalIcon(medalRank, 'md')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {technician.role === 'house_tech' ? 'Técnico de Casa' : 'Técnico'}
                </div>
              </div>
              {isAdmin && !isEditing && (
                <Button size="sm" variant="ghost" onClick={handleStartEdit} className="h-8">
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isEditing ? (
              <TechnicianRowEditForm
                editedData={editedData}
                setEditedData={setEditedData}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                isSaving={isSaving}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Departamento:</span>
                  <Badge variant="outline" className={getDepartmentColor(technician.department)}>
                    {departmentLabel}
                  </Badge>
                </div>

                {technician.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{technician.email}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Residencia:</span>
                  {residenciaLoading ? (
                    <span className="text-sm text-muted-foreground">Cargando...</span>
                  ) : (
                    <span className="text-sm truncate">{residencia || '—'}</span>
                  )}
                </div>

                {technician.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{technician.phone}</span>
                  </div>
                )}

                {technician.dni && (
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{technician.dni}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Rol:</span>
                  <Badge variant="outline" className={getRoleColor(technician.role)}>
                    {technician.role === 'house_tech' ? 'Técnico de Casa' : 'Técnico'}
                  </Badge>
                </div>

                {isManagementUser && (
                  <div className="pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2 h-8 w-full mb-2"
                      disabled={sendingOnboarding || !technician.email}
                      onClick={async () => {
                        if (!technician.email) return;
                        try {
                          setSendingOnboarding(true);
                          const { data, error } = await dataLayerClient.functions.invoke('send-onboarding-email', {
                            body: {
                              email: technician.email,
                              firstName: technician.first_name,
                              lastName: technician.last_name,
                              department: technician.department,
                            }
                          });
                          if (error) throw error;
                          if (!data?.success) throw new Error('Failed to send onboarding email');
                          toast({ title: 'Onboarding enviado', description: `Se envió a ${technician.email}.` });
                        } catch (error: unknown) {
                          toast({ title: 'No se pudo enviar el onboarding', description: getErrorMessage(error), variant: 'destructive' });
                        } finally {
                          setSendingOnboarding(false);
                        }
                      }}
                    >
                      <Mail className="h-4 w-4" /> {sendingOnboarding ? 'Enviando…' : 'Enviar Onboarding'}
                    </Button>
                    <Button variant={isFridge ? 'secondary' : 'destructive'} size="sm" onClick={toggleFridge} className="gap-2 h-8" disabled={togglingFridge}>
                      <Refrigerator className="h-4 w-4" />
                      {isFridge ? 'Descongelar' : 'A la nevera'}
                    </Button>
                  </div>
                )}

                {/* Skills */}
                {!!(technician.skills && technician.skills.length) && (
                  <div className="pt-2">
                    <div className="text-sm font-medium mb-1">Habilidades</div>
                    <div className="flex flex-wrap gap-1">
                      {technician.skills
                        ?.slice(0, 8)
                        .map((s, i) => (
                          <Badge key={(s.name || '') + i} variant={s.is_primary ? 'default' : 'secondary'} className="text-xs" title={`${s.name}${s.proficiency != null ? ` (lvl ${s.proficiency})` : ''}`}>
                            {s.name}
                          </Badge>
                        ))}
                      {technician.skills!.length > 8 && (
                        <Badge variant="outline" className="text-xs">+{technician.skills!.length - 8} más</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium">Actividad</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setMetricsExpanded(!metricsExpanded)}
                    >
                      {metricsExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Más
                        </>
                      )}
                    </Button>
                  </div>
                  {metricsLoading ? (
                    <div className="text-xs text-muted-foreground">Cargando...</div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Este mes</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="default" className="text-xs">
                            {metrics.monthTotal} total
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {metrics.monthUpcoming} programados
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Este año</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="default" className="text-xs">
                            {metrics.yearTotal} total
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {metrics.yearUpcoming} programados
                          </Badge>
                        </div>
                      </div>
                      {metricsExpanded && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-muted-foreground">
                              Año pasado ({subYears(new Date(), 1).getFullYear()})
                            </div>
                            {lastYearMedalRank && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Medal
                                      className="h-4 w-4"
                                      style={{
                                        color: lastYearMedalRank === 'gold' ? '#FFD700' :
                                          lastYearMedalRank === 'silver' ? '#C0C0C0' : '#CD7F32',
                                        cursor: 'help',
                                        opacity: 0.7
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{getLastYearSnarkyComment(lastYearMedalRank)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="default" className="text-xs">
                              {metrics.lastYearTotal} total
                            </Badge>
                            <Badge variant="outline" className="text-xs opacity-50">
                              {metrics.lastYearUpcoming} programados*
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            *Datos históricos de programación
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isManagementUser && (
                  <div className="pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setSkillsOpen(true)} className="gap-2 h-8">
                      <Plus className="h-4 w-4" /> Añadir habilidad
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {/* Skills dialog (management only) */}
      {isManagementUser && (
        <ManageSkillsDialog
          profileId={technician.id}
          fullName={displayName}
          open={skillsOpen}
          onOpenChange={handleSkillsOpenChange}
        />
      )}
    </>
  );
};

export const TechnicianRow = React.memo(TechnicianRowComp);
