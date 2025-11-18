
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Mail, User, Building, Phone, IdCard, Award, Plus, MapPin, Refrigerator, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ManageSkillsDialog } from '@/components/users/ManageSkillsDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
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
    skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
  };
  height: number;
  isFridge?: boolean;
  compact?: boolean;
}

const TechnicianRowComp = ({ technician, height, isFridge = false, compact = false }: TechnicianRowProps) => {
  const { userRole } = useOptimizedAuth();
  const isAdmin = userRole === 'admin';
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
  const [skillsOpen, setSkillsOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const qc = useQueryClient();
  const [togglingFridge, setTogglingFridge] = React.useState(false);

  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [metrics, setMetrics] = React.useState<{ monthConfirmed: number; yearConfirmed: number }>({ monthConfirmed: 0, yearConfirmed: 0 });
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
      const mStart = startOfMonth(now).toISOString();
      const mEnd = endOfMonth(now).toISOString();
      const yStart = startOfYear(now).toISOString();
      const yEnd = endOfYear(now).toISOString();

      // Count confirmed assignments within a date range via inner join to jobs; avoid HEAD to prevent 400s
      const countInRange = async (fromISO: string, toISO: string) => {
        const { count, error } = await supabase
          .from('job_assignments')
          .select('job_id,jobs!inner(id)', { count: 'exact' })
          .eq('technician_id', technician.id)
          .eq('status', 'confirmed')
          .gte('jobs.start_time', fromISO)
          .lte('jobs.end_time', toISO)
          .limit(1);
        if (error) {
          console.warn('Metrics count error', error);
          return 0;
        }
        return count || 0;
      };

      const [m, y] = await Promise.all([
        countInRange(mStart, mEnd),
        countInRange(yStart, yEnd)
      ]);
      setMetrics({ monthConfirmed: m, yearConfirmed: y });
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

      toast({ title: 'User updated', description: 'Changes saved successfully.' });
      setIsEditing(false);
    } catch (e: any) {
      toast({ title: 'Failed to update user', description: e?.message || 'Unknown error', variant: 'destructive' });
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

  const deptAbbrev = (technician.department || '').slice(0, 3).toUpperCase();

  return (
    <>
    <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <div
          className="border-b hover:bg-accent/50 cursor-pointer transition-colors"
          style={{
            height,
            padding: compact ? '0.25rem' : '0.75rem',
            backgroundColor: technician.bg_color || undefined
          }}
          title={compact ? displayName : undefined}
        >
          {compact ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                {isFridge && (
                  <Refrigerator className="absolute -top-1 -right-1 h-3.5 w-3.5 text-sky-600" />
                )}
              </div>
              <div className="mt-1 text-[10px] leading-none text-muted-foreground">{deptAbbrev}</div>
            </div>
          ) : (
            <div className="flex items-center gap-3 h-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {displayName}
                  {isFridge && (
                    <Refrigerator className="inline-block h-3.5 w-3.5 ml-1 text-sky-600" />
                  )}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getDepartmentColor(technician.department)}`}
                  >
                    {technician.department}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getRoleColor(technician.role)}`}
                  >
                    {technician.role === 'house_tech' ? 'House Tech' : 'Technician'}
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
              <AvatarFallback>
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-semibold">
                {displayName}
              </div>
              <div className="text-sm text-muted-foreground">
                {technician.role === 'house_tech' ? 'House Technician' : 'Technician'}
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
                <Label htmlFor="first_name" className="text-xs">First Name</Label>
                <Input
                  id="first_name"
                  value={editedData.first_name}
                  onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                  className="h-8"
                />
              </div>

              <div>
                <Label htmlFor="nickname" className="text-xs">Nickname</Label>
                <Input
                  id="nickname"
                  value={editedData.nickname}
                  onChange={(e) => setEditedData({ ...editedData, nickname: e.target.value })}
                  className="h-8"
                  placeholder="Optional"
                />
              </div>

              <div>
                <Label htmlFor="last_name" className="text-xs">Last Name</Label>
                <Input
                  id="last_name"
                  value={editedData.last_name}
                  onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                  className="h-8"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editedData.email}
                  onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                  className="h-8"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs">Phone</Label>
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
                  placeholder="Optional"
                />
              </div>

              <div>
                <CityAutocomplete
                  id="residencia"
                  value={editedData.residencia}
                  onChange={(city) => setEditedData(prev => ({ ...prev, residencia: city }))}
                  placeholder="Enter city"
                  label="Residencia"
                  className="space-y-2"
                />
              </div>

              <div>
                <Label htmlFor="department" className="text-xs">Department</Label>
                <Select value={editedData.department} onValueChange={(value) => setEditedData({ ...editedData, department: value })}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sound">Sound</SelectItem>
                    <SelectItem value="lights">Lights</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role" className="text-xs">Role</Label>
                <Select value={editedData.role} onValueChange={(value) => setEditedData({ ...editedData, role: value })}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="house_tech">House Tech</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bg_color" className="text-xs">Row Background Color</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { color: '#DC2626', name: 'Red' },
                    { color: '#2563EB', name: 'Blue' },
                    { color: '#16A34A', name: 'Green' },
                    { color: '#CA8A04', name: 'Yellow' },
                    { color: '#9333EA', name: 'Purple' },
                    { color: '#EA580C', name: 'Orange' },
                    { color: '#DB2777', name: 'Pink' },
                    { color: '#0891B2', name: 'Cyan' },
                    { color: '#65A30D', name: 'Lime' },
                    { color: '#7C3AED', name: 'Violet' },
                    { color: '#0D9488', name: 'Teal' },
                    { color: '#64748B', name: 'Slate' },
                  ].map(({ color, name }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditedData(prev => ({ ...prev, bg_color: color }))}
                      className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                        editedData.bg_color === color ? 'border-white ring-2 ring-white' : 'border-gray-300'
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
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveEdit} disabled={isSaving} size="sm" className="flex-1">
                  <Save className="h-4 w-4 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={handleCancelEdit} disabled={isSaving} size="sm" variant="outline" className="flex-1">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Department:</span>
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
                  <span className="text-sm text-muted-foreground">Loading…</span>
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
                <span className="text-sm">Role:</span>
                <Badge variant="outline" className={getRoleColor(technician.role)}>
                  {technician.role === 'house_tech' ? 'House Tech' : 'Technician'}
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
                  <div className="text-sm font-medium mb-1">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {technician.skills
                      ?.slice(0, 8)
                      .map((s, i) => (
                        <Badge key={(s.name || '') + i} variant={s.is_primary ? 'default' : 'secondary'} className="text-xs" title={`${s.name}${s.proficiency != null ? ` (lvl ${s.proficiency})` : ''}`}>
                          {s.name}
                        </Badge>
                      ))}
                    {technician.skills!.length > 8 && (
                      <Badge variant="outline" className="text-xs">+{technician.skills!.length - 8} more</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Metrics */}
              <div className="pt-2 border-t">
                <div className="text-sm font-medium mb-1">Activity</div>
                {metricsLoading ? (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Gigs/Month: {metrics.monthConfirmed}</Badge>
                    <Badge variant="outline" className="text-xs">Gigs/Year: {metrics.yearConfirmed}</Badge>
                  </div>
                )}
              </div>

              {isManagementUser && (
                <div className="pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setSkillsOpen(true)} className="gap-2 h-8">
                    <Plus className="h-4 w-4" /> Add skill
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
