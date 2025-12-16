import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SoundVisionAccessRequestDialog } from '@/components/soundvision/SoundVisionAccessRequestDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Lock } from 'lucide-react';
import { SoundVisionInteractiveMap } from '@/components/soundvision/SoundVisionInteractiveMap';
import { useTheme } from 'next-themes';

const SoundVisionFiles = () => {
  const { hasSoundVisionAccess, isLoading } = useOptimizedAuth();
  const navigate = useNavigate();
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const { theme: nextTheme } = useTheme();

  // Determine if dark mode
  const isDark = nextTheme === 'dark' || (
    nextTheme === 'system' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Auto-open dialog when user doesn't have access
  useEffect(() => {
    if (!isLoading && !hasSoundVisionAccess) {
      setShowAccessDialog(true);
    }
  }, [hasSoundVisionAccess, isLoading]);

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-6rem)] flex items-center justify-center bg-background text-foreground">
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
      <div className="w-full max-w-full px-4 lg:px-8 py-6 space-y-4 bg-background text-foreground">
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

  // Theme definition for the interactive map (matching Tech App styles)
  const mapTheme = {
    bg: isDark ? "bg-[#05070a]" : "bg-slate-50",
    nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
    card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
    textMain: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    input: isDark ? "bg-[#0a0c10] border-[#2a2e3b] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
    modalOverlay: isDark ? "bg-black/90 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-md",
    divider: isDark ? "border-[#1f232e]" : "border-slate-100",
    danger: isDark ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-red-700 bg-red-50 border-red-200",
    success: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    warning: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-700 bg-amber-50 border-amber-200",
    cluster: isDark ? "bg-white text-black" : "bg-slate-900 text-white"
  };

  return (
    <div className="w-full h-[calc(100vh-4rem)] p-0 m-0 overflow-hidden relative">
      <SoundVisionInteractiveMap
        theme={mapTheme}
        isDark={isDark}
        onClose={() => navigate(-1)}
      />
    </div>
  );
};

export default SoundVisionFiles;
