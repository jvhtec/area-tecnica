import { useState } from "react";
import { ArrowLeft, Calculator, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const SysCalc = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const sysCalcUrl = "https://mistrnick.com/calc.html";
  const [iframeStatus, setIframeStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [iframeKey, setIframeKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Calculator className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-bold">System Calculator</h1>
          </div>
        </div>
      </div>

      {/* Calculator iframe */}
      <div className="w-full h-[calc(100vh-73px)] relative">
        <iframe
          key={iframeKey}
          src={sysCalcUrl}
          className="w-full h-full border-0"
          title="System Calculator - Audio Engineering Tools"
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setIframeStatus("loaded")}
          onError={() => setIframeStatus("error")}
        />
        {iframeStatus !== "loaded" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            {iframeStatus === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando SysCalc…
              </div>
            ) : (
              <div className="mx-auto max-w-md px-6 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  No se pudo cargar SysCalc. Puedes reintentar o abrirlo en una pestaña nueva.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIframeStatus("loading");
                      setIframeKey((prev) => prev + 1);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reintentar
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={sysCalcUrl} target="_blank" rel="noreferrer noopener">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile helper text */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
          <p className="font-medium">💡 Tip: Rotate your device to landscape for better viewing</p>
        </div>
      )}
    </div>
  );
};

export default SysCalc;
