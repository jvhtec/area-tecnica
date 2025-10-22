import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SoundVisionDatabaseDialog } from '@/components/soundvision/SoundVisionDatabaseDialog';
import { SoundVisionMap } from '@/components/soundvision/SoundVisionMap';
import { useSoundVisionFiles } from '@/hooks/useSoundVisionFiles';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardPath } from '@/utils/roleBasedRouting';
import type { UserRole } from '@/types/user';
import { Loader2, ArrowLeft } from 'lucide-react';

const SoundVisionFiles = () => {
  const { hasSoundVisionAccess, isLoading, userRole } = useOptimizedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!hasSoundVisionAccess) {
      const fallbackPath = getDashboardPath(userRole ? (userRole as UserRole) : null);
      navigate(fallbackPath, { replace: true });
    }
  }, [hasSoundVisionAccess, isLoading, navigate, userRole]);

  const { data: files = [], isLoading: isFilesLoading } = useSoundVisionFiles();

  if (isLoading || !hasSoundVisionAccess || isFilesLoading) {
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
