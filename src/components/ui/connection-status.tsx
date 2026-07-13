
import { useState, useEffect } from "react";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "./button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface ConnectionStatusProps {
  variant?: 'card' | 'inline';
  className?: string;
}

export function ConnectionStatus({ 
  variant = 'card',
  className
}: ConnectionStatusProps) {
  const { 
    connectionStatus, 
    lastRefreshTime,
    refreshSubscriptions
  } = useSubscriptionContext();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Calculate stale status
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000; // 5 minutes
  
  // Show connection status briefly when there's an issue or on initial load
  useEffect(() => {
    if (connectionStatus === 'connecting') {
      // Always show when connecting
      setIsVisible(true);
    }
    else if (connectionStatus !== 'connected' || isStale) {
      setIsVisible(true);
      setHasError(true);
      
      // Keep visible while issues persist
    } else if (hasError) {
      // If we've recovered from an error, show briefly then hide
      setIsVisible(true);
      setHasError(false);
      
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    } else {
      // If everything is good, hide after 5 seconds
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [connectionStatus, isStale, hasError]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshSubscriptions();
      toast.success("Conexiones en tiempo real actualizadas");
    } catch (error) {
      console.error("Error refreshing subscriptions:", error);
      toast.error("No se pudieron actualizar las conexiones");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Format last refresh time
  let lastRefreshDisplay = "desconocida";
  try {
    lastRefreshDisplay = formatDistanceToNow(lastRefreshTime, { addSuffix: true, locale: es });
  } catch (error) {
    console.error("Error formatting time:", error);
  }
  
  // If using inline variant, render simpler version
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`} role="status" aria-live="polite">
        {connectionStatus === 'connecting' ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : connectionStatus === 'connected' ? (
          isStale ? (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <Wifi className="h-4 w-4 text-green-500" />
          )
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        
        <span className="text-sm">
          {connectionStatus === 'connecting' ? "Conectando..." :
           connectionStatus === 'connected' 
            ? (isStale ? "Los datos pueden estar desactualizados" : "Conectado")
            : "Sin conexión"}
        </span>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing || connectionStatus === 'connecting'}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Actualizar conexión</span>
        </Button>
      </div>
    );
  }
  
  return (
    <div
      className={`fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-3 z-30 max-w-[calc(100vw-1.5rem)] transition-all duration-300 ease-in-out md:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:right-4 md:z-50 ${className || ''}`}
      role="status"
      aria-live="polite"
    >
      {isVisible && (
        <div className={`rounded-full border px-3 py-2 shadow-lg backdrop-blur-md ${
          connectionStatus === 'connecting' ? 'border-blue-300 bg-blue-50/95 dark:border-blue-800 dark:bg-blue-950/95' :
          connectionStatus === 'connected' && !isStale
            ? 'border-green-300 bg-green-50/95 dark:border-green-800 dark:bg-green-950/95'
            : 'border-red-300 bg-red-50/95 dark:border-red-800 dark:bg-red-950/95'
        }`}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connecting' ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : connectionStatus === 'connected' ? (
                  isStale ? (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Wifi className="h-5 w-5 text-green-500" />
                  )
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {connectionStatus === 'connecting' ? "Conectando..." :
                     connectionStatus === 'connected' 
                      ? (isStale ? "Datos desactualizados" : "Conectado")
                      : "Problema de conexión"}
                  </p>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {connectionStatus === 'connecting' ? "Estableciendo conexión..." :
                     connectionStatus === 'connected' 
                      ? `Última actualización: ${lastRefreshDisplay}`
                      : "Intentando volver a conectar..."}
                  </p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing || connectionStatus === 'connecting'}
                className="h-8 w-8 shrink-0 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="sr-only">Actualizar conexión</span>
              </Button>
            </div>
        </div>
      )}
    </div>
  );
}
