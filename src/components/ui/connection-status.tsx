
import { memo, useEffect, useState } from 'react';
import { WifiIcon, WifiOffIcon, SignalIcon } from 'lucide-react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

/**
 * Component to display the connection status to realtime subscriptions
 * Memoized to prevent unnecessary re-renders
 */
export const ConnectionStatus = memo(function ConnectionStatus({
  variant = 'default',
  className = '',
}: ConnectionStatusProps) {
  const { connectionStatus } = useSubscriptionContext();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Listen for network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {connectionStatus === 'connected' ? (
          <>
            <WifiIcon className="h-3 w-3 text-green-500" />
            <span className="text-xs text-muted-foreground">Connected</span>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <SignalIcon className="h-3 w-3 text-amber-500" />
            <span className="text-xs text-muted-foreground">Connecting</span>
          </>
        ) : (
          <>
            <WifiOffIcon className="h-3 w-3 text-red-500" />
            <span className="text-xs text-muted-foreground">Disconnected</span>
          </>
        )}
      </div>
    );
  }
  
  if (variant === 'compact') {
    return (
      <div className={cn('relative', className)}>
        {connectionStatus === 'connected' ? (
          <WifiIcon className="h-4 w-4 text-green-500" />
        ) : connectionStatus === 'connecting' ? (
          <SignalIcon className="h-4 w-4 text-amber-500" />
        ) : (
          <WifiOffIcon className="h-4 w-4 text-red-500" />
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {connectionStatus === 'connected' ? (
        <>
          <WifiIcon className="h-4 w-4 text-green-500" />
          <span>Connected to realtime updates</span>
        </>
      ) : connectionStatus === 'connecting' ? (
        <>
          <SignalIcon className="h-4 w-4 text-amber-500" />
          <span>Connecting to realtime updates</span>
        </>
      ) : (
        <>
          <WifiOffIcon className="h-4 w-4 text-red-500" />
          <span>
            {isOnline ? 'Disconnected from realtime' : 'You are offline'}
          </span>
        </>
      )}
    </div>
  );
});
