
import { SessionStatusIndicator } from "./session-status-indicator";
import { ConnectionStatus } from "./connection-status";
import { useRouteSubscriptions } from "@/hooks/useRouteSubscriptions";

interface HeaderStatusProps {
  className?: string;
}

/**
 * Combined header status component showing both session and connection status
 */
export function HeaderStatus({ className = "" }: HeaderStatusProps) {
  const routeStatus = useRouteSubscriptions();
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SessionStatusIndicator variant="badge" className="mr-1" />
      <ConnectionStatus variant="inline" className="text-xs" />
    </div>
  );
}
