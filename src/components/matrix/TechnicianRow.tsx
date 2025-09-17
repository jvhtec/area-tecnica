
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Mail, User, Building, Phone, IdCard, Award, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManageSkillsDialog } from '@/components/users/ManageSkillsDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQueryClient } from '@tanstack/react-query';

interface TechnicianRowProps {
  technician: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    dni?: string | null;
    department: string;
    role: string;
    skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
  };
  height: number;
}

export const TechnicianRow = ({ technician, height }: TechnicianRowProps) => {
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
  const [skillsOpen, setSkillsOpen] = React.useState(false);
  const qc = useQueryClient();

  const handleSkillsOpenChange = (open: boolean) => {
    if (!open) {
      // Invalidate technicians list so skills refresh
      qc.invalidateQueries({ queryKey: ['optimized-matrix-technicians'] });
    }
    setSkillsOpen(open);
  };
  const getInitials = () => {
    return `${technician.first_name?.[0] || ''}${technician.last_name?.[0] || ''}`.toUpperCase();
  };

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

  return (
    <>
    <Popover>
      <PopoverTrigger asChild>
        <div 
          className="border-b p-3 hover:bg-accent/50 cursor-pointer transition-colors"
          style={{ height }}
        >
          <div className="flex items-center gap-3 h-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {technician.first_name} {technician.last_name}
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
            <div>
              <div className="font-semibold">
                {technician.first_name} {technician.last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {technician.role === 'house_tech' ? 'House Technician' : 'Technician'}
              </div>
            </div>
            {isManagementUser && (
              <div className="ml-auto">
                <Button size="sm" variant="outline" onClick={() => setSkillsOpen(true)} className="h-8">
                  <Award className="h-4 w-4 mr-1" /> Skills
                </Button>
              </div>
            )}
          </div>

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

            {isManagementUser && (
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={() => setSkillsOpen(true)} className="gap-2 h-8">
                  <Plus className="h-4 w-4" /> Add skill
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
    {/* Skills dialog (management only) */}
    {isManagementUser && (
      <ManageSkillsDialog
        profileId={technician.id}
        fullName={`${technician.first_name} ${technician.last_name}`}
        open={skillsOpen}
        onOpenChange={handleSkillsOpenChange}
      />
    )}
  </>
  );
};
