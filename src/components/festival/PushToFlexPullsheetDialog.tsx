import { Loader2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePushToFlexPullsheet } from '@/features/festival-flex/hooks/usePushToFlexPullsheet';
import { GearSectionsPicker } from './push-to-flex-pullsheet/GearSectionsPicker';
import type { PushToFlexPullsheetDialogProps } from './push-to-flex-pullsheet/model';
import { PaPresetPicker } from './push-to-flex-pullsheet/PaPresetPicker';
import { PullsheetTarget } from './push-to-flex-pullsheet/PullsheetTarget';
import { PushPreview } from './push-to-flex-pullsheet/PushPreview';
import { PushResultAlerts } from './push-to-flex-pullsheet/PushResultAlerts';

export function PushToFlexPullsheetDialog({ open, onOpenChange, gearSetup, jobId }: PushToFlexPullsheetDialogProps) {
  const push = usePushToFlexPullsheet({ open, onOpenChange, gearSetup, jobId });

  return (
    <Dialog open={open} onOpenChange={push.close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Enviar equipo a un pullsheet de Flex</DialogTitle>
          <DialogDescription>
            Elige un pullsheet existente o pega la URL de un pullsheet de Flex para añadir los artículos de equipo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <PaPresetPicker
            enabled={push.includePaPreset}
            onEnabledChange={push.setPaPresetEnabled}
            presets={push.paPresets}
            isLoading={push.isLoadingPaPresets}
            selectedId={push.paPresetId}
            onSelect={push.setPaPresetId}
            jobId={jobId}
            disabled={push.isPushing}
          />

          <GearSectionsPicker sections={push.sections} onToggle={push.toggleSection} disabled={push.isPushing} />

          <PullsheetTarget
            mode={push.mode}
            onModeChange={push.setMode}
            pullsheets={push.pullsheets}
            isLoading={push.isLoadingPullsheets}
            selectedId={push.selectedPullsheetId}
            onSelect={push.setSelectedPullsheetId}
            url={push.pullsheetUrl}
            onUrlChange={push.setPullsheetUrl}
            isValidUrl={push.isValidUrl}
            elementId={push.elementId}
            disabled={push.isPushing}
          />

          <PushPreview
            isLookingUp={push.isLookingUp}
            equipmentToPush={push.equipmentToPush}
            gearLookup={push.gearLookup}
            presetLookup={push.presetLookup}
            presetSelected={push.includePaPreset && !!push.paPresetId}
          />

          {push.pushResult && <PushResultAlerts result={push.pushResult} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={push.close} disabled={push.isPushing}>
            Cancelar
          </Button>
          <Button onClick={() => void push.push()} disabled={!push.canPush}>
            {push.isPushing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando {push.equipmentToPush.length} artículos...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar artículos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
