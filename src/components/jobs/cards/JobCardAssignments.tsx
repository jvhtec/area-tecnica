
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { Department } from "@/types/department";

interface JobCardAssignmentsProps {
  assignments: any[];
  department: Department;
}

export const JobCardAssignments: React.FC<JobCardAssignmentsProps> = ({
  assignments,
  department
}) => {
  const assignedTechnicians = assignments
    .map((assignment: any) => {
      let role = null;
      switch (department) {
        case "sound":
          role = assignment.sound_role;
          break;
        case "lights":
          role = assignment.lights_role;
          break;
        case "video":
          role = assignment.video_role;
          break;
        default:
          role = assignment.sound_role || assignment.lights_role || assignment.video_role;
      }
      if (!role) return null;
      return {
        id: assignment.technician_id,
        name: `${assignment.profiles?.first_name || ""} ${assignment.profiles?.last_name || ""}`.trim(),
        role
      };
    })
    .filter(Boolean);

  if (assignedTechnicians.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-wrap gap-1">
        {assignedTechnicians.map((tech) => (
          <Badge key={tech.id} variant="secondary" className="text-xs">
            {tech.name} {tech.role && `(${tech.role})`}
          </Badge>
        ))}
      </div>
    </div>
  );
};
