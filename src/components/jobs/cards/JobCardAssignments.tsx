
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
      
      // Handle both direct assignments and tour-sourced assignments
      const name = assignment.profiles
        ? `${assignment.profiles.first_name || ""} ${assignment.profiles.last_name || ""}`.trim()
        : assignment.external_technician_name || 'Unknown';
      
      const isFromTour = assignment.assignment_source === 'tour';
      
      return {
        id: assignment.technician_id || assignment.id,
        name,
        role,
        isFromTour,
        isExternal: !assignment.profiles && assignment.external_technician_name
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
        {assignedTechnicians.map((tech, index) => (
          <Badge 
            key={tech.id || index} 
            variant={tech.isFromTour ? "outline" : "secondary"} 
            className={`text-xs ${tech.isFromTour ? 'border-blue-300 text-blue-700' : ''}`}
          >
            {tech.name} {tech.role && `(${tech.role})`}
            {tech.isFromTour && ' 🎪'}
            {tech.isExternal && ' 👤'}
          </Badge>
        ))}
      </div>
    </div>
  );
};
