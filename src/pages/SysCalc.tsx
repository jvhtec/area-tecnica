import { ArrowLeft, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const SysCalc = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
      <div className="w-full h-[calc(100vh-73px)]">
        <iframe
          src="https://mistrnick.com/calculators.html"
          className="w-full h-full border-0"
          title="System Calculator - Audio Engineering Tools"
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
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
