
import { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { DosPlayer } from "js-dos";

interface WolfensteinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WolfensteinDialog = ({ open, onOpenChange }: WolfensteinDialogProps) => {
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
        console.log('Initializing DOS emulator...');
        // Dynamically import js-dos
        const jsdos = await import("js-dos/dist/js-dos");
        const Dos = jsdos.default;
        
        // Create a new DOS instance with local path
        console.log('Creating DOS instance with local wdosbox...');
        const ci = await Dos(canvasRef.current, {
          wdosboxUrl: "/js-dos/wdosbox.js"
        });
        
        dosRef.current = ci;

        // Mount and run Wolfenstein 3D using local bundle
        console.log('Mounting Wolfenstein 3D bundle...');
        await ci.mount("/WOLF3D.jsdos");
        
        console.log('Running WOLF3D.EXE...');
        await ci.run("WOLF3D.EXE");

        console.log('Wolfenstein 3D initialized successfully');
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize DOS:', err);
        let errorMessage = 'Failed to load Wolfenstein 3D. ';
        
        // Check for specific error conditions
        if (err instanceof Error) {
          if (err.message.includes('wdosbox.wasm')) {
            errorMessage += 'WebAssembly file not found.';
          } else if (err.message.includes('WOLF3D.jsdos')) {
            errorMessage += 'Game bundle not found.';
          } else if (err.message.includes('WebGL')) {
            errorMessage += 'WebGL support is required.';
          } else {
            errorMessage += err.message;
          }
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initDos();

    return () => {
      if (dosRef.current) {
        try {
          console.log('Cleaning up DOS instance...');
          dosRef.current.exit();
        } catch (err) {
          console.error('Error cleaning up DOS:', err);
        }
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 gap-0 bg-black border border-blue-500">
        <div className="flex flex-col h-full w-full bg-black text-blue-500 font-mono relative">
          <div className="flex justify-between items-center p-2 border-b border-blue-500">
            <div className="text-sm">WOLF3D.EXE</div>
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-500 hover:text-blue-400"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-black">
            {isLoading ? (
              <div className="text-center space-y-2 animate-pulse">
                <div className="text-xl">Loading Wolfenstein 3D...</div>
                <div className="text-sm">Please wait...</div>
              </div>
            ) : error ? (
              <div className="text-center text-blue-500 space-y-2">
                <div className="text-xl">{error}</div>
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="text-blue-500 border-blue-500 hover:bg-blue-950"
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
          
          <div className="p-2 border-t border-blue-500 text-xs">
            C:\WOLF3D&gt; _ {error && <span className="text-red-500">Error detected</span>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
