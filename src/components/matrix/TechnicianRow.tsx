
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Mail, User, Building } from 'lucide-react';

interface TechnicianRowProps {
  technician: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
    role: string;
  };
  height: number;
}

export const TechnicianRow = ({ technician, height }: TechnicianRowProps) => {
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
              <div className="flex gap-1 mt-1">
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

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Role:</span>
              <Badge variant="outline" className={getRoleColor(technician.role)}>
                {technician.role === 'house_tech' ? 'House Tech' : 'Technician'}
              </Badge>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
