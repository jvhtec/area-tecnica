
import { UserRole } from "@/types/user";

export const getDashboardPath = (userRole: UserRole | null): string => {
  if (!userRole) {
    return '/profile';
  }

  switch (userRole) {
    case 'wallboard':
      return '/wallboard';
    case 'technician':
      // Route technician users to the new TechnicianSuperApp interface
      return '/tech-app';
    case 'house_tech':
    case 'admin':
    case 'management':
    case 'logistics':
    case 'oscar':
    default:
      return '/dashboard';
  }
};
