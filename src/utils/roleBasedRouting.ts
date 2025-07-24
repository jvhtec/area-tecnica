
import { UserRole } from "@/types/user";

export const getDashboardPath = (userRole: UserRole | null): string => {
  switch (userRole) {
    case 'technician':
    case 'house_tech':
      return '/technician-dashboard';
    case 'admin':
    case 'management':
    case 'logistics':
    default:
      return '/dashboard';
  }
};
