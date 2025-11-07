
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { Department } from "@/types/department";
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { format } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface JobCardAssignmentsProps {
  assignments: any[];
  department: Department;
}

export const JobCardAssignments: React.FC<JobCardAssignmentsProps> = ({ assignments, department }) => {
  // Group by technician so multi-day assignments produce a single badge per tech
  const grouped = new Map<string, {
    id: string;
    name: string;
    role: string | null;
    isFromTour: boolean;
    isExternal: boolean;
    dates: Set<string>;
  }>();

  for (const assignment of assignments) {
    let roleCode: string | null = null;
    switch (department) {
      case 'sound':
        roleCode = assignment.sound_role; break;
      case 'lights':
        roleCode = assignment.lights_role; break;
      case 'video':
        roleCode = assignment.video_role; break;
      default:
        roleCode = assignment.sound_role || assignment.lights_role || assignment.video_role;
    }
    if (!roleCode) continue;

    const isExternal = !assignment.profiles && !!assignment.external_technician_name;
    const name = assignment.profiles
      ? formatUserName(assignment.profiles.first_name, (assignment.profiles as any).nickname, assignment.profiles.last_name)
      : (assignment.external_technician_name || 'Unknown');

    // Key by technician_id when available; otherwise by a stable external name key
    const key = assignment.technician_id ? `tech:${assignment.technician_id}` : `ext:${name}`;
    const roleLabel = roleCode ? labelForCode(roleCode) : null;
    const isFromTour = assignment.assignment_source === 'tour';
    const date = assignment.single_day && assignment.assignment_date ? assignment.assignment_date : null;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: assignment.technician_id || assignment.id,
        name,
        role: roleLabel,
        isFromTour,
        isExternal,
        dates: new Set(date ? [date] : [])
      });
    } else {
      const g = grouped.get(key)!;
      // Preserve first non-null role label; otherwise keep existing
      if (!g.role && roleLabel) g.role = roleLabel;
      if (isFromTour) g.isFromTour = true;
      if (date) g.dates.add(date);
    }
  }

  const assignedTechnicians = Array.from(grouped.values());

  if (assignedTechnicians.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-wrap gap-1">
        {assignedTechnicians.map((tech, index) => {
          // Format single/multi-day suffix compactly
          const dateList = Array.from(tech.dates);
          let dateSuffix: string | null = null;
          if (dateList.length === 1) {
            try { dateSuffix = ` • ${format(new Date(`${dateList[0]}T00:00:00`), 'MMM d')}`; } catch { dateSuffix = ` • ${dateList[0]}`; }
          } else if (dateList.length > 1) {
            // Detect contiguous range; otherwise show count
            const ds = dateList.map(d => new Date(`${d}T00:00:00`)).sort((a,b)=>a.getTime()-b.getTime());
            let contiguous = true;
            for (let i=1;i<ds.length;i++) {
              const diff = (ds[i].getTime()-ds[i-1].getTime())/(24*3600*1000);
              if (diff !== 1) { contiguous = false; break; }
            }
            if (contiguous) {
              const first = ds[0];
              const last = ds[ds.length-1];
              const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
              dateSuffix = ` • ${format(first,'MMM d')}${sameMonth ? '–'+format(last,'d') : '–'+format(last,'MMM d')}`;
            } else {
              dateSuffix = ` • ${dateList.length}d`;
            }
          }
          // Build tooltip content with the exact dates list
          const tooltipText = (() => {
            if (dateList.length === 0) return null;
            try {
              const pretty = dateList
                .map(d => format(new Date(`${d}T00:00:00`), 'PPP'))
                .join('\n');
              return pretty;
            } catch {
              return dateList.join(', ');
            }
          })();

          return (
            <Tooltip key={tech.id || index}>
              <TooltipTrigger asChild>
                <Badge
                  variant={tech.isFromTour ? "outline" : "secondary"}
                  className={`text-xs ${tech.isFromTour ? 'border-blue-300 text-blue-700' : ''}`}
                >
                  {tech.name} {tech.role && `(${tech.role})`}
                  {tech.isFromTour && ' 🎪'}
                  {tech.isExternal && ' 👤'}
                  {dateSuffix}
                </Badge>
              </TooltipTrigger>
              {tooltipText && (
                <TooltipContent side="top" align="start">
                  <div className="whitespace-pre leading-tight text-xs">
                    {tooltipText}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};
