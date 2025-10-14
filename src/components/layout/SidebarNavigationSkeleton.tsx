import { Skeleton } from "@/components/ui/skeleton";

export const SidebarNavigationSkeleton = () => {
  return (
    <div className="space-y-2">
      {/* Dashboard skeleton */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Personal Calendar skeleton */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      
      {/* Removed timesheets skeleton (moved under Rates & Extras) */}
      
      {/* Department pages skeleton */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>
      
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-18" />
      </div>
      
      {/* Profile skeleton */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
};
