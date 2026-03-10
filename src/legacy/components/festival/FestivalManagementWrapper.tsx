
import { useParams } from 'react-router-dom';
import { useFestival } from '@/hooks/useFestival';
import { TimeoutLoader } from '@/components/ui/timeout-loader';
import { FestivalManagement } from './FestivalManagement';
import { useEffect } from 'react';
import { ensureRealtimeConnection } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export function FestivalManagementWrapper() {
  const { festivalId } = useParams<{ festivalId: string }>();
  const { status: connectionStatus, recoverConnection } = useConnectionStatus();
  
  const { 
    festival, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isPaused,
    retryCount,
    maxRetries
  } = useFestival(festivalId || '');

  // Try to recover connection if we're in an error state
  useEffect(() => {
    if (isError || isPaused) {
      console.log('Festival fetch failed, attempting to recover connection');
      
      const attemptRecovery = async () => {
        // First try simple realtime reconnection
        const recovered = await ensureRealtimeConnection();
        
        if (recovered) {
          console.log('Connection recovered with ensureRealtimeConnection, retrying fetch');
          refetch();
        } else {
          // If that fails, try full connection recovery
          console.log('Simple reconnection failed, attempting full recovery');
          const fullRecoverySuccess = await recoverConnection();
          
          if (fullRecoverySuccess) {
            console.log('Full connection recovery succeeded, retrying fetch');
            refetch();
            toast.success('Conexión restaurada');
          } else {
            console.log('All recovery attempts failed');
            toast.error('Problemas de conexión persisten', {
              description: 'Por favor, verifica tu conexión de red e intenta de nuevo'
            });
          }
        }
      };
      
      attemptRecovery();
    }
  }, [isError, isPaused, refetch, recoverConnection]);

  const handleRetry = async () => {
    toast.info('Reconectando...');

    try {
      await recoverConnection();
      await refetch();
    } catch (error) {
      console.error('Error during retry:', error);
      toast.error('Error al reintentar');
    }
  };

  if (isLoading) {
    return (
      <TimeoutLoader
        isLoading={isLoading}
        isError={false}
        message="Cargando detalles del festival..."
        timeout={5000}
      />
    );
  }

  if (isError || retryCount >= maxRetries) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto text-center p-4 md:p-6">
        <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 text-destructive mb-3 md:mb-4" />
        <h2 className="text-lg md:text-xl font-bold">Error al cargar festival</h2>
        <p className="text-sm md:text-base text-muted-foreground mt-2 mb-3 md:mb-4">
          {error instanceof Error ? error.message : 'No se pudo cargar los datos del festival'}
        </p>
        <p className="text-xs md:text-sm text-muted-foreground mb-4 md:mb-6">
          Estado de la conexión: {connectionStatus}
        </p>
        <Button
          onClick={handleRetry}
          variant="default"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reconectar e Reintentar
        </Button>
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <h2 className="text-lg md:text-xl font-bold">Festival no encontrado</h2>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          No se pudo encontrar el festival solicitado o puede haber sido eliminado.
        </p>
      </div>
    );
  }

  return <FestivalManagement festival={festival} />;
}
