
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DoomDialog = ({ open, onOpenChange }: DoomDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
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
          
          <div className="flex-1 flex items-center justify-center">
            {isLoading ? (
              <div className="text-center space-y-2 animate-pulse">
                <div className="text-xl">Loading DOOM.EXE...</div>
                <div className="text-sm">Press any key to continue</div>
              </div>
            ) : (
              <iframe
                src="https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fdoom.jsdos?anonymous=1"
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
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
