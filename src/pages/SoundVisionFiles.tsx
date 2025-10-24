import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SoundVisionDatabaseDialog } from '@/components/soundvision/SoundVisionDatabaseDialog';
import { SoundVisionMap } from '@/components/soundvision/SoundVisionMap';
import { SoundVisionAccessRequestDialog } from '@/components/soundvision/SoundVisionAccessRequestDialog';
import { useSoundVisionFiles } from '@/hooks/useSoundVisionFiles';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Lock } from 'lucide-react';

const SoundVisionFiles = () => {
  const { hasSoundVisionAccess, isLoading } = useOptimizedAuth();
  const navigate = useNavigate();
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  // Auto-open dialog when user doesn't have access
  useEffect(() => {
    if (!isLoading && !hasSoundVisionAccess) {
      setShowAccessDialog(true);
    }
  }, [hasSoundVisionAccess, isLoading]);

  const { data: files = [], isLoading: isFilesLoading } = useSoundVisionFiles();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl h-[calc(100vh-6rem)] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Cargando...</span>
        </div>
      </div>
    );
  }

  // Show access request dialog if user doesn't have access
  if (!hasSoundVisionAccess) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <h1 className="text-xl font-semibold">Archivos SoundVision</h1>
          </div>
        </div>

        <Card className="p-6 md:p-8 lg:p-12 max-w-2xl mx-auto mt-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="rounded-full bg-muted p-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Acceso Restringido</h2>
              <p className="text-muted-foreground">
                No tienes acceso a los archivos de SoundVision. Solicita acceso para ver y gestionar los archivos.
              </p>
            </div>
            <Button 
              onClick={() => setShowAccessDialog(true)}
              className="mt-4"
            >
              Solicitar Acceso
            </Button>
          </div>
        </Card>

        <SoundVisionAccessRequestDialog 
          open={showAccessDialog} 
          onOpenChange={setShowAccessDialog}
        />
      </div>
    );
  }

  // Show loading state while files are being fetched
  if (isFilesLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl h-[calc(100vh-6rem)] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Cargando archivos de SoundVision...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h1 className="text-xl font-semibold">Archivos SoundVision</h1>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100%-2.5rem)]">
        {/* Map - takes 60% on desktop */}
        <Card className="lg:col-span-3 p-0 h-full overflow-hidden">
          <SoundVisionMap files={files} />
        </Card>

        {/* File Database - takes 40% on desktop */}
        <Card className="lg:col-span-2 p-6 h-full overflow-auto">
          <SoundVisionDatabaseDialog />
        </Card>
      </div>
    </div>
  );
};

export default SoundVisionFiles;
