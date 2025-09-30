
import { UserRole } from "@/types/user";

export const getDashboardPath = (userRole: UserRole | null): string => {
  // Wallboard role doesn't exist in UserRole type, but we handle it here for runtime
  if (userRole === 'wallboard' as any) {
    return '/wallboard';
  }
  
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
