
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { Department } from "@/types/department";
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { format } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from "@/lib/utils";

interface JobCardAssignmentsProps {
  assignments: any[];
  department: Department;
  jobTimesheets?: { technician_id: string; status: string }[];
}

export const JobCardAssignments: React.FC<JobCardAssignmentsProps> = ({ assignments, department, jobTimesheets = [] }) => {
  // Determine overall timesheet state for a technician
  const getTechTimesheetState = (techId: string): 'none' | 'draft' | 'partial' | 'submitted' | 'approved' | 'rejected' => {
    const list = jobTimesheets.filter(t => t.technician_id === techId);
    if (list.length === 0) return 'none';
    const anyRejected = list.some(t => t.status === 'rejected');
    const anyApproved = list.some(t => t.status === 'approved');
    const anySubmitted = list.some(t => t.status === 'submitted');
    const allSubmittedOrApproved = list.every(t => t.status === 'submitted' || t.status === 'approved');

    if (anyRejected) return 'rejected';
    if (anyApproved && allSubmittedOrApproved) return 'approved';
    if (allSubmittedOrApproved) return 'submitted';
    if (anySubmitted || anyApproved) return 'partial';
    return 'draft';
  };

  // Apply color classes based on state
  const getBadgeClassesForTimesheet = (techId: string) => {
    const state = getTechTimesheetState(techId);
    switch (state) {
      case 'approved':
      case 'submitted':
        return 'bg-green-500/15 text-green-700 border-green-500/30';
      case 'partial':
        return 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30';
      case 'rejected':
        return 'bg-red-500/15 text-red-700 border-red-500/30';
      default:
        return '';
    }
  };

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
    const timesheetDates: string[] = Array.isArray(assignment.timesheet_dates) ? assignment.timesheet_dates : [];
    const date = assignment.single_day && assignment.assignment_date ? assignment.assignment_date : null;
    const dateSet = new Set<string>();
    timesheetDates.forEach(d => dateSet.add(d));
    if (date && dateSet.size === 0) {
      dateSet.add(date);
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: assignment.technician_id || assignment.id,
        name,
        role: roleLabel,
        isFromTour,
        isExternal,
        dates: dateSet
      });
    } else {
      const g = grouped.get(key)!;
      // Preserve first non-null role label; otherwise keep existing
      if (!g.role && roleLabel) g.role = roleLabel;
      if (isFromTour) g.isFromTour = true;
      dateSet.forEach(value => g.dates.add(value));
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

          // Apply timesheet color coding
          const timesheetClasses = getBadgeClassesForTimesheet(tech.id);

          return (
            <Tooltip key={tech.id || index}>
              <TooltipTrigger asChild>
                <Badge
                  variant={tech.isFromTour ? "outline" : "secondary"}
                  className={cn(
                    "text-xs max-w-full border",
                    tech.isFromTour ? 'border-blue-300 text-blue-700' : '',
                    timesheetClasses
                  )}
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
