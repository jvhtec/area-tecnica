import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { getDashboardPath } from '@/utils/roleBasedRouting';
import { UserRole } from '@/types/user';

export function useRoleGuard(allowedRoles: UserRole[]) {
  const { userRole, isLoading } = useOptimizedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    
    if (!userRole || !allowedRoles.includes(userRole as UserRole)) {
      const dashboardPath = getDashboardPath(userRole as UserRole | null);
      navigate(dashboardPath, { replace: true });
    }
  }, [userRole, isLoading, allowedRoles, navigate]);
}
