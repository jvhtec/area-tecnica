
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Mail, User, Building, Phone, IdCard, Award, Plus, MapPin, Refrigerator, Edit, Save, X, Medal, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ManageSkillsDialog } from '@/components/users/ManageSkillsDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { formatUserName } from '@/utils/userName';
import { CityAutocomplete } from '@/components/maps/CityAutocomplete';

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
  const isAdmin = userRole === 'admin';
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
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
  const [residenciaLoading, setResidenciaLoading] = React.useState(false);
  const [sendingOnboarding, setSendingOnboarding] = React.useState(false);
  const { toast } = useToast();

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editedData, setEditedData] = React.useState({
    first_name: technician.first_name,
    nickname: technician.nickname || '',
    last_name: technician.last_name,
    email: technician.email,
    phone: technician.phone || '',
    dni: technician.dni || '',
    department: technician.department,
    role: technician.role,
    residencia: residencia || '',
    bg_color: technician.bg_color || ''
  });

  const loadMetrics = React.useCallback(async () => {
    try {
      setMetricsLoading(true);
      const now = new Date();
      const lastYear = subYears(now, 1);

      const mStart = startOfMonth(now).toISOString().split('T')[0];
      const mEnd = endOfMonth(now).toISOString().split('T')[0];
      const yStart = startOfYear(now).toISOString().split('T')[0];
      const yEnd = endOfYear(now).toISOString().split('T')[0];
      const lyStart = startOfYear(lastYear).toISOString().split('T')[0];
      const lyEnd = endOfYear(lastYear).toISOString().split('T')[0];

      // Count all active timesheets (individual work dates)
      const countTotalInRange = async (fromDate: string, toDate: string) => {
        const { count, error } = await supabase
          .from('timesheets')
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
        const { count, error } = await supabase
          .from('timesheets')
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
      const { data, error } = await supabase
        .from('profiles')
        .select('residencia')
        .eq('id', technician.id)
        .single();
      if (!error) {
        const resValue = (data as any)?.residencia ?? null;
        setResidencia(resValue);
        setEditedData(prev => ({ ...prev, residencia: resValue || '' }));
      }
    } finally {
      setResidenciaLoading(false);
    }
  }, [technician.id]);

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editedData.first_name,
          nickname: editedData.nickname || null,
          last_name: editedData.last_name,
          email: editedData.email,
          phone: editedData.phone || null,
          dni: editedData.dni || null,
          department: editedData.department,
          role: editedData.role,
          residencia: editedData.residencia || null,
          bg_color: editedData.bg_color || null
        })
        .eq('id', technician.id);

      if (error) throw error;

      // Update local state
      setResidencia(editedData.residencia || null);

      // Invalidate queries to refresh data
      await qc.invalidateQueries({ queryKey: ['optimized-matrix-technicians'] });

      toast({ title: 'Usuario actualizado', description: 'Cambios guardados correctamente.' });
      setIsEditing(false);
    } catch (e: any) {
      toast({ title: 'Error al actualizar usuario', description: e?.message || 'Error desconocido', variant: 'destructive' });
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
      bg_color: technician.bg_color || ''
    });
    setIsEditing(false);
  };

  const handleSkillsOpenChange = (open: boolean) => {
    if (!open) {
      // Invalidate technicians list so skills refresh
      qc.invalidateQueries({ queryKey: ['optimized-matrix-technicians'] });
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
      const { error } = await supabase
        .from('technician_fridge')
        .upsert({ technician_id: technician.id, in_fridge: next }, { onConflict: 'technician_id' });
      if (error) throw error;
      // Invalidate fridge queries so UI updates across matrix
      await qc.invalidateQueries({ queryKey: ['technician-fridge-status'] });
    } catch (e: any) {
      console.warn('Fridge toggle error', e);
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

  const displayName = formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Technician';

  const getDepartmentColor = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'sound':
        return 'bg-blue-100 text-blue-800';
      case 'lights':
        return 'bg-yellow-100 text-yellow-800';
      case 'video':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'house_tech':
        return 'bg-green-100 text-green-800';
      case 'technician':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRandomSnarkyComment = (rank: 'gold' | 'silver' | 'bronze'): string => {
    const comments = {
      gold: [
        '¡El campeón indiscutible! ¿Será que no tiene vida fuera del trabajo?',
        'Oro puro. Probablemente duerme con el móvil debajo de la almohada.',
        'El número uno. Los demás técnicos lloran en la esquina.',
        '¡Medalla de oro! ¿Seguro que no eres un robot?',
        'Primer puesto. Tu cuenta bancaria debe estar feliz.',
        '¡Oro! Los demás están tomando notas furiosamente.',
        'Rey o reina de los bolos. ¿Cuándo descansas?',
        'Medalla dorada. Hasta tu sombra trabaja más que los demás.',
        '¡Campeón! Probablemente rechazas vacaciones por diversión.',
        'Número uno con bala. Los otros técnicos necesitan un plan.',
      ],
      silver: [
        'Plata. Cerca pero no lo suficiente. ¿Quizás el próximo mes?',
        'Segundo lugar. El primer perdedor, como dicen por ahí.',
        'Medalla de plata. Al menos no eres bronce.',
        '¡Subcampeón! Tan cerca y tan lejos a la vez.',
        'Plata reluciente. El oro te mira desde arriba.',
        'Número dos. Como Pepsi, siempre detrás de Coca-Cola.',
        'Medalla plateada. Tu esfuerzo es... respetable.',
        '¡Plata! Casi oro, pero casi no cuenta.',
        'Segundo puesto. El primero de los perdedores.',
        'Plata brillante. El oro te envía saludos desde el podio.',
      ],
      bronze: [
        'Bronce. Al menos estás en el podio... apenas.',
        'Tercer lugar. Mejor que nada, ¿no?',
        'Medalla de bronce. Los demás te miran con lástima.',
        '¡Bronce! Felicidades por ser el último en el podio.',
        'Tercero. Es como decir "casi competente".',
        'Medalla de bronce. Al menos no eres cuarto.',
        '¡Bronce! Tu mamá está orgullosa, probablemente.',
        'Tercer puesto. Los otros dos te saludan desde arriba.',
        'Bronce resplandeciente. Bueno, más o menos resplandeciente.',
        'Número tres. Podría ser peor... o mejor.',
      ]
    };

    const list = comments[rank];
    return list[Math.floor(Math.random() * list.length)];
  };

  const getLastYearSnarkyComment = (rank: 'gold' | 'silver' | 'bronze'): string => {
    const lastYear = new Date().getFullYear() - 1;
    const comments = {
      gold: [
        'Fuiste oro el año pasado. ¿Qué pasó? ¿Te jubilaste?',
        'Campeón del año pasado. Ahora... no tanto. ¿Nostalgia?',
        `Oro en ${lastYear}. ¿Dónde quedó esa energía?`,
        'Eras el número uno. Pasado perfecto, presente... dudoso.',
        '¡Medalla de oro histórica! Énfasis en "histórica".',
        'Top del año pasado. Las glorias pasadas no pagan facturas.',
        'Fuiste el rey. Ahora más bien... plebeyo.',
        'Eras imparable. ¿Te pararon?',
        `Oro ${lastYear}. ¿Ya te cansaste o simplemente te dio pereza?`,
        'Campeón que fue. La clave está en "fue".',
      ],
      silver: [
        'Plata el año pasado. Ni oro entonces, ni ahora.',
        `Segundo en ${lastYear}. Al menos eres consistente... en no ganar.`,
        'Medalla plateada histórica. ¿Sigues casi ganando?',
        'Subcampeón del pasado. ¿Cuándo será tu año de verdad?',
        `Plata en ${lastYear}. Eternamente segundo, ¿no?`,
        'Casi ganaste el año pasado. Casi. Como siempre.',
        'Segundo puesto histórico. ¿Te suena familiar?',
        'Plata vintage. Tu zona de confort es el segundo lugar.',
        'Fuiste plata. Sorpresa: sigues sin ser oro.',
        'Subcampeón perenne. El oro te envía saludos del pasado.',
      ],
      bronze: [
        'Bronce el año pasado. ¿Bajaste o ya estabas abajo?',
        `Tercero en ${lastYear}. ¿Vas pa bajo o qué?`,
        'Medalla de bronce histórica. Última del podio... qué logro.',
        'Tercer puesto del pasado. ¿Al menos mantienes el ritmo?',
        `Bronce ${lastYear}. Podio por los pelos, como siempre.`,
        'Último en el podio el año pasado. ¿Sigues ahí?',
        'Bronce vintage. Sigues siendo el tercero más motivado.',
        'Tercer lugar histórico. Los otros dos no te extrañan.',
        'Fuiste bronce. ¿Fuiste, eres o vas para allá?',
        'Podio del año pasado. Énfasis en "último del podio".',
      ]
    };

    const list = comments[rank];
    return list[Math.floor(Math.random() * list.length)];
  };

  const getMedalIcon = (rank?: 'gold' | 'silver' | 'bronze', size: 'sm' | 'md' = 'sm') => {
    if (!rank) return null;
    const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    const colorMap = {
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32'
    };

    // Generate a random comment on each render
    const comment = getRandomSnarkyComment(rank);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Medal className={sizeClass} style={{ color: colorMap[rank], cursor: 'help' }} />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{comment}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const deptAbbrev = (technician.department || '').slice(0, 3).toUpperCase();

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <div
            className="border-b hover:bg-accent/50 cursor-pointer transition-colors overflow-hidden"
            style={{
              height,
              padding: compact ? '0.25rem' : '0.5rem',
              backgroundColor: technician.bg_color || undefined
            }}
            title={compact ? displayName : undefined}
          >
            {compact ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={technician.profile_picture_url || undefined} alt={displayName} />
                    <AvatarFallback className="text-xs">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {isFridge && (
                    <Refrigerator className="absolute -top-1 -right-1 h-3.5 w-3.5 text-sky-600" />
                  )}
                  {medalRank && !isFridge && (
                    <div className="absolute -top-1 -right-1">
                      {getMedalIcon(medalRank, 'sm')}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-[10px] leading-none text-muted-foreground">{deptAbbrev}</div>
              </div>
            ) : (
              <div className="flex items-center gap-3 h-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={technician.profile_picture_url || undefined} alt={displayName} />
                  <AvatarFallback className="text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate flex items-center gap-1">
                    <span>{displayName}</span>
                    {medalRank && !isFridge && getMedalIcon(medalRank, 'sm')}
                    {isFridge && (
                      <Refrigerator className="inline-block h-3.5 w-3.5 text-sky-600" />
                    )}
                  </div>
                  <div className="flex gap-1 mt-1 flex-nowrap overflow-hidden">
                    <Badge
                      variant="secondary"
                      className={`text-xs whitespace-nowrap ${getDepartmentColor(technician.department)}`}
                    >
                      {technician.department}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs whitespace-nowrap ${getRoleColor(technician.role)}`}
                    >
                      {technician.role === 'house_tech' ? 'Técnico de Casa' : 'Técnico'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-80" side="right">
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
              <div className="space-y-3">
                <div>
                  <Label htmlFor="first_name" className="text-xs">Nombre</Label>
                  <Input
                    id="first_name"
                    value={editedData.first_name}
                    onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="nickname" className="text-xs">Apodo</Label>
                  <Input
                    id="nickname"
                    value={editedData.nickname}
                    onChange={(e) => setEditedData({ ...editedData, nickname: e.target.value })}
                    className="h-8"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <Label htmlFor="last_name" className="text-xs">Apellidos</Label>
                  <Input
                    id="last_name"
                    value={editedData.last_name}
                    onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editedData.email}
                    onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs">Teléfono</Label>
                  <Input
                    id="phone"
                    value={editedData.phone}
                    onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                    className="h-8"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <Label htmlFor="dni" className="text-xs">DNI</Label>
                  <Input
                    id="dni"
                    value={editedData.dni}
                    onChange={(e) => setEditedData({ ...editedData, dni: e.target.value })}
                    className="h-8"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <CityAutocomplete
                    id="residencia"
                    value={editedData.residencia}
                    onChange={(city) => setEditedData(prev => ({ ...prev, residencia: city }))}
                    placeholder="Ingresa ciudad"
                    label="Residencia"
                    className="space-y-2"
                  />
                </div>

                <div>
                  <Label htmlFor="department" className="text-xs">Departamento</Label>
                  <Select value={editedData.department} onValueChange={(value) => setEditedData({ ...editedData, department: value })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sound">Sonido</SelectItem>
                      <SelectItem value="lights">Iluminación</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="role" className="text-xs">Rol</Label>
                  <Select value={editedData.role} onValueChange={(value) => setEditedData({ ...editedData, role: value })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technician">Técnico</SelectItem>
                      <SelectItem value="house_tech">Técnico de Casa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bg_color" className="text-xs">Color de fondo de fila</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { color: '#DC2626', name: 'Rojo' },
                      { color: '#2563EB', name: 'Azul' },
                      { color: '#16A34A', name: 'Verde' },
                      { color: '#CA8A04', name: 'Amarillo' },
                      { color: '#9333EA', name: 'Morado' },
                      { color: '#EA580C', name: 'Naranja' },
                      { color: '#DB2777', name: 'Rosa' },
                      { color: '#0891B2', name: 'Cian' },
                      { color: '#65A30D', name: 'Lima' },
                      { color: '#7C3AED', name: 'Violeta' },
                      { color: '#0D9488', name: 'Verde azulado' },
                      { color: '#64748B', name: 'Pizarra' },
                    ].map(({ color, name }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditedData(prev => ({ ...prev, bg_color: color }))}
                        className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${editedData.bg_color === color ? 'border-white ring-2 ring-white' : 'border-gray-300'
                          }`}
                        style={{ backgroundColor: color }}
                        title={name}
                      />
                    ))}
                    {editedData.bg_color && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditedData(prev => ({ ...prev, bg_color: '' }))}
                        className="h-8"
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveEdit} disabled={isSaving} size="sm" className="flex-1">
                    <Save className="h-4 w-4 mr-1" /> {isSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button onClick={handleCancelEdit} disabled={isSaving} size="sm" variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Departamento:</span>
                  <Badge className={getDepartmentColor(technician.department)}>
                    {technician.department?.charAt(0).toUpperCase() + technician.department?.slice(1)}
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
                          const { data, error } = await supabase.functions.invoke('send-onboarding-email', {
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
                        } catch (e: any) {
                          toast({ title: 'No se pudo enviar el onboarding', description: e?.message || 'Error desconocido', variant: 'destructive' });
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
