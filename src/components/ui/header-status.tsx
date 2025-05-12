
import { SessionStatusIndicator } from "./session-status-indicator";
import { ConnectionStatus } from "./connection-status";
import { useRouteSubscriptions } from "@/hooks/useRouteSubscriptions";
import { memo } from "react";

interface HeaderStatusProps {
  className?: string;
}

/**
 * Combined header status component showing both session and connection status
 * Memoized to prevent excessive re-renders
 */
export const HeaderStatus = memo(function HeaderStatus({ className = "" }: HeaderStatusProps) {
  const routeStatus = useRouteSubscriptions();
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SessionStatusIndicator variant="badge" className="mr-1" />
      <ConnectionStatus variant="inline" className="text-xs" />
    </div>
  );
});
