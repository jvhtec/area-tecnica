
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PresetCreationManager } from './PresetCreationManager';

interface PresetManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PresetManagementDialog({ open, onOpenChange }: PresetManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Presets</DialogTitle>
        </DialogHeader>
        <PresetCreationManager onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
