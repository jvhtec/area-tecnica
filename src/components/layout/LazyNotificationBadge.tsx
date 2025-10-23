import { lazy, Suspense } from "react";

// Lazy load the NotificationBadge component
const NotificationBadge = lazy(() => 
  import("./NotificationBadge").then(module => ({ 
    default: module.NotificationBadge 
  }))
);

interface LazyNotificationBadgeProps {
  userId: string;
  userRole: string | null;
  userDepartment: string | null;
}

export const LazyNotificationBadge = ({ userId, userRole, userDepartment }: LazyNotificationBadgeProps) => {
  // Don't render if essential props are missing
  if (!userId || !userRole) return null;

  return (
    <Suspense fallback={null}>
      <NotificationBadge 
        userId={userId} 
        userRole={userRole} 
        userDepartment={userDepartment} 
      />
    </Suspense>
  );
};