import React from 'react';
import { Navigate } from 'react-router-dom';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { getDashboardPath } from '@/utils/roleBasedRouting';
import { UserRole } from '@/types/user';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { userRole, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  if (!userRole || !allowedRoles.includes(userRole as UserRole)) {
    const dashboardPath = getDashboardPath(userRole as UserRole | null);
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
};
