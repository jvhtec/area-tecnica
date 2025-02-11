
import { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { DosPlayer } from "js-dos";

interface DoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DoomDialog = ({ open, onOpenChange }: DoomDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dosRef = useRef<DosPlayer | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const initDos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Import js-dos dynamically
        const { default: Dos } = await import("js-dos");
        
        // Create a new DOS instance
        const ci = await Dos(canvasRef.current, {
          wdosboxUrl: "/wdosbox.js"
        });
        
        dosRef.current = ci;

        // Mount and run DOOM
        await ci.mount("doom.jsdos");
        await ci.run("DOOM.EXE");  // Specify the executable name as required by js-dos 8.x

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize DOS:', err);
        setError('Failed to load DOOM. Please try again.');
        setIsLoading(false);
      }
    };

    initDos();

    return () => {
      if (dosRef.current) {
        try {
          dosRef.current.exit();
        } catch (err) {
          console.error('Error cleaning up DOS:', err);
        }
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 gap-0 bg-black border border-red-500">
        <div className="flex flex-col h-full w-full bg-black text-green-500 font-mono relative">
          <div className="flex justify-between items-center p-2 border-b border-red-500">
            <div className="text-sm">DOOM.EXE</div>
            <Button
              variant="ghost"
              size="icon"
              className="text-green-500 hover:text-green-400"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-black">
            {isLoading ? (
              <div className="text-center space-y-2 animate-pulse">
                <div className="text-xl">Loading DOOM.EXE...</div>
                <div className="text-sm">Press any key to continue</div>
              </div>
            ) : error ? (
              <div className="text-center text-red-500 space-y-2">
                <div className="text-xl">{error}</div>
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="text-red-500 border-red-500 hover:bg-red-950"
                >
                  Close
                </Button>
              </div>
            ) : (
              <canvas 
                ref={canvasRef}
                className="w-full h-full"
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
          </div>
          
          <div className="p-2 border-t border-red-500 text-xs">
            C:\DOOM&gt; _
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
