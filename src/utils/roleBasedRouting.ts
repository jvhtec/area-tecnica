
import { UserRole } from "@/types/user";

export const getDashboardPath = (userRole: UserRole | null): string => {
  switch (userRole) {
    case 'wallboard':
      return '/wallboard';
    case 'technician':
    case 'house_tech':
      // Route technician users to the new TechnicianSuperApp interface
      return '/tech-app';
    case 'admin':
    case 'management':
    case 'logistics':
    default:
      return '/dashboard';
  }
};
