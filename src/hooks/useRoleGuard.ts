import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPath } from '@/utils/roleBasedRouting';
import { UserRole } from '@/types/user';

export function useRoleGuard(allowedRoles: UserRole[], requiredDepartment?: string) {
  const { userRole, userDepartment, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    
    // Check if user has allowed role
    const hasAllowedRole = userRole && allowedRoles.includes(userRole as UserRole);
    
    // Check department if required
    const hasRequiredDepartment = !requiredDepartment || 
      (userDepartment && userDepartment.toLowerCase() === requiredDepartment.toLowerCase());
    
    if (!hasAllowedRole || !hasRequiredDepartment) {
      const dashboardPath = getDashboardPath(userRole as UserRole | null);
      navigate(dashboardPath, { replace: true });
    }
  }, [userRole, userDepartment, isLoading, allowedRoles, requiredDepartment, navigate]);
}
