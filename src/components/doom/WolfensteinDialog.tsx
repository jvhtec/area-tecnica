
import { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
// Avoid static import of js-dos types to prevent Vite pre-bundling issues
type DosPlayer = {
  mount?: (path: string) => Promise<void>;
  run: (executableOrBundle: string, args?: string[]) => Promise<void>;
  exit: () => void;
};

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
    if (!open) return;

    const initDos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('Initializing DOS emulator...');
        // Dynamically import js-dos
        // Prefer module root to get proper named export in v8
        // Load v7 UMD-compatible build; if the installed package is v8, this import will not expose Dos factory
        const jsdos: any = await import("js-dos/dist/js-dos");
        const Dos = (jsdos as any).Dos || (jsdos as any).default || (globalThis as any).Dos || (window as any).Dos;
        if (typeof Dos !== 'function') {
          throw new TypeError('Incompatible js-dos version detected. Please use js-dos v7.x for Dos() API.');
        }
        
        // Create a new DOS instance with local path
        console.log('Creating DOS instance with local wdosbox...');
        const canvas = canvasRef.current;
        if (!canvas) {
          // Canvas not yet mounted; try again on next tick
          console.warn('DOS init attempted before canvas mounted. Retrying...');
          setTimeout(initDos, 0);
          return;
        }
        const ci = await Dos(canvas, {
          wdosboxUrl: "/js-dos/wdosbox.js"
        });
        
        dosRef.current = ci;

        // Mount and run Wolfenstein 3D using local bundle
        let started = false;
        if (typeof (ci as any).mount === 'function') {
          console.log('Mounting Wolfenstein 3D bundle...');
          let mounted = false;
          try {
            await (ci as any).mount("/WOLF3D.jsdos");
            mounted = true;
          } catch (e) {
            console.warn('Mount "/WOLF3D.jsdos" failed, trying lowercase variant...', e);
            try {
              await (ci as any).mount("/wolf3d.jsdos");
              mounted = true;
            } catch (e2) {
              console.warn('Mount fallback failed; will try direct run with .jsdos');
            }
          }
          if (mounted) {
            console.log('Running WOLF3D.EXE...');
            // Start the game without awaiting so "loading" clears once mounted
            (ci as any).run("WOLF3D.EXE").catch((runErr: unknown) => {
              console.error('Error while running WOLF3D.EXE:', runErr);
              if (runErr instanceof Error) {
                setError(`Runtime error: ${runErr.message}`);
              } else {
                setError('Unknown runtime error while starting the game.');
              }
            });
            started = true;
          }
        }

        // Fallback to direct run of .jsdos bundle (v8 style)
        if (!started) {
          console.log('Attempting direct run of .jsdos bundle...');
          try {
            await (ci as any).run("/WOLF3D.jsdos");
            started = true;
          } catch (e) {
            console.warn('Direct run "/WOLF3D.jsdos" failed, trying lowercase...', e);
            await (ci as any).run("/wolf3d.jsdos");
            started = true;
          }
        }

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
          dosRef.current = null;
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
          
          <div className="flex-1 relative bg-black">
            {/* Canvas must always be present for js-dos to init */}
            <canvas 
              ref={canvasRef}
              className="w-full h-full block"
              tabIndex={0}
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center space-y-2 animate-pulse">
                  <div className="text-xl">Loading Wolfenstein 3D...</div>
                  <div className="text-sm">Please wait...</div>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-blue-500 space-y-3">
                  <div className="text-xl max-w-[80vw] mx-auto px-4 break-words">{error}</div>
                  <Button 
                    variant="outline" 
                    onClick={() => onOpenChange(false)}
                    className="text-blue-500 border-blue-500 hover:bg-blue-950"
                  >
                    Close
                  </Button>
                </div>
              </div>
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
