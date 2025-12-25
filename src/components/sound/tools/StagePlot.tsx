import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "lucide-react";

export const StagePlot = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Set iframe height to fill container
    const setIframeHeight = () => {
      if (iframeRef.current) {
        iframeRef.current.style.height = "calc(90vh - 120px)";
      }
    };

    setIframeHeight();
    window.addEventListener("resize", setIframeHeight);

    return () => {
      window.removeEventListener("resize", setIframeHeight);
    };
  }, []);

  return (
    <Card className="w-full max-w-full mx-auto h-full">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layout className="h-5 w-5" />
          Plano de Escenario
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Arrastra elementos al escenario, etiqueta entradas y mezclas de monitor, y exporta un plano limpio de una página.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          ref={iframeRef}
          src="/stageplot/index.html"
          className="w-full border-0 rounded-b-lg"
          title="Plano de Escenario"
          sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
        />
      </CardContent>
    </Card>
  );
};
