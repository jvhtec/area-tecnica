import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPath } from '@/utils/roleBasedRouting';
import { UserRole } from '@/types/user';

/**
 * Ensures the current user is authorized for the route and redirects them to their dashboard if not.
 *
 * While authentication is loading this hook does nothing. If the authenticated user's role is not
 * one of `allowedRoles`, or their department does not match `requiredDepartment` (when provided,
 * compared case-insensitively), the user is redirected to their dashboard via navigation (history
 * replacement).
 *
 * @param allowedRoles - Roles permitted to access the guarded route
 * @param requiredDepartment - Optional department name that the user must belong to (case-insensitive)
 */
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