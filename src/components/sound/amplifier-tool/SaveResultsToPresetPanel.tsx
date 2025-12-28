import React, { type Dispatch, type SetStateAction } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AmplifierResults } from "./types";

export const SaveResultsToPresetPanel: React.FC<{
  results: AmplifierResults;
  totalCalculatedAmps: number;
  presetOptions: Array<{ id: string; name: string }>;
  ampOptions: Array<{ id: string; name: string; category: string | null }>;
  createNewPreset: boolean;
  setCreateNewPreset: Dispatch<SetStateAction<boolean>>;
  newPresetName: string;
  setNewPresetName: Dispatch<SetStateAction<string>>;
  selectedPresetId: string;
  setSelectedPresetId: Dispatch<SetStateAction<string>>;
  laRakEquipmentId: string | null;
  setLaRakEquipmentId: Dispatch<SetStateAction<string | null>>;
  laAmpEquipmentId: string | null;
  setLaAmpEquipmentId: Dispatch<SetStateAction<string | null>>;
  plmRakEquipmentId: string | null;
  setPlmRakEquipmentId: Dispatch<SetStateAction<string | null>>;
  plmAmpEquipmentId: string | null;
  setPlmAmpEquipmentId: Dispatch<SetStateAction<string | null>>;
  isLoadingPresets: boolean;
  isLoadingAmpOptions: boolean;
  isSavingPreset: boolean;
  onSave: () => void;
}> = ({
  results,
  totalCalculatedAmps,
  presetOptions,
  ampOptions,
  createNewPreset,
  setCreateNewPreset,
  newPresetName,
  setNewPresetName,
  selectedPresetId,
  setSelectedPresetId,
  laRakEquipmentId,
  setLaRakEquipmentId,
  laAmpEquipmentId,
  setLaAmpEquipmentId,
  plmRakEquipmentId,
  setPlmRakEquipmentId,
  plmAmpEquipmentId,
  setPlmAmpEquipmentId,
  isLoadingPresets,
  isLoadingAmpOptions,
  isSavingPreset,
  onSave,
}) => (
  <div className="mt-4 border rounded-lg p-4 space-y-4">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h4 className="font-semibold text-sm">Guardar en preset</h4>
        <p className="text-xs text-muted-foreground">
          Inserta los amplificadores calculados como items de preset (subsystem amplification).
        </p>
      </div>
      <div className="text-xs text-muted-foreground">{totalCalculatedAmps} amplificadores calculados</div>
    </div>

    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Preset de sonido</Label>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              setCreateNewPreset(!createNewPreset);
              setNewPresetName("");
            }}
          >
            {createNewPreset ? "Seleccionar existente" : "Crear nuevo"}
          </Button>
        </div>
        {createNewPreset ? (
          <Input
            placeholder="Nombre del nuevo preset..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            disabled={isSavingPreset}
          />
        ) : (
          <Select
            value={selectedPresetId}
            onValueChange={setSelectedPresetId}
            disabled={isLoadingPresets || presetOptions.length === 0 || isSavingPreset}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingPresets ? "Cargando presets..." : "Selecciona un preset"} />
            </SelectTrigger>
            <SelectContent>
              {presetOptions.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {results.completeRaks > 0 && (
        <div className="space-y-2">
          <Label>Equipo LA-RAK (racks completos)</Label>
          <Select
            value={laRakEquipmentId || ""}
            onValueChange={setLaRakEquipmentId}
            disabled={isLoadingAmpOptions || ampOptions.length === 0 || isSavingPreset}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingAmpOptions ? "Cargando equipos..." : "Selecciona LA-RAK"} />
            </SelectTrigger>
            <SelectContent>
              {ampOptions.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Racks calculados: {results.completeRaks}</p>
        </div>
      )}

      {results.looseAmplifiers > 0 && (
        <div className="space-y-2">
          <Label>Equipo LA12X (amplificadores sueltos)</Label>
          <Select
            value={laAmpEquipmentId || ""}
            onValueChange={setLaAmpEquipmentId}
            disabled={isLoadingAmpOptions || ampOptions.length === 0 || isSavingPreset}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingAmpOptions ? "Cargando equipos..." : "Selecciona LA12X"} />
            </SelectTrigger>
            <SelectContent>
              {ampOptions.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Amplificadores sueltos: {results.looseAmplifiers}</p>
        </div>
      )}

      {results.plmRacks > 0 && (
        <div className="space-y-2">
          <Label>Equipo PLM-RAK (racks completos)</Label>
          <Select
            value={plmRakEquipmentId || ""}
            onValueChange={setPlmRakEquipmentId}
            disabled={isLoadingAmpOptions || ampOptions.length === 0 || isSavingPreset}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingAmpOptions ? "Cargando equipos..." : "Selecciona PLM-RAK"} />
            </SelectTrigger>
            <SelectContent>
              {ampOptions.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Racks calculados: {results.plmRacks}</p>
        </div>
      )}

      {results.loosePLMAmps > 0 && (
        <div className="space-y-2">
          <Label>Equipo PLM20000D (amplificadores sueltos)</Label>
          <Select
            value={plmAmpEquipmentId || ""}
            onValueChange={setPlmAmpEquipmentId}
            disabled={isLoadingAmpOptions || ampOptions.length === 0 || isSavingPreset}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingAmpOptions ? "Cargando equipos..." : "Selecciona PLM20000D"} />
            </SelectTrigger>
            <SelectContent>
              {ampOptions.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Amplificadores sueltos: {results.loosePLMAmps}</p>
        </div>
      )}
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Los items se guardan con subsystem &quot;amplification&quot; y source &quot;amp_calculator&quot;.
      </p>
      <Button
        onClick={onSave}
        disabled={
          isSavingPreset ||
          (!createNewPreset && !selectedPresetId) ||
          (createNewPreset && !newPresetName.trim()) ||
          (results.completeRaks > 0 && !laRakEquipmentId) ||
          (results.looseAmplifiers > 0 && !laAmpEquipmentId) ||
          (results.plmRacks > 0 && !plmRakEquipmentId) ||
          (results.loosePLMAmps > 0 && !plmAmpEquipmentId)
        }
        className="w-full sm:w-auto gap-2"
      >
        {isSavingPreset ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Guardar en preset
          </>
        )}
      </Button>
    </div>
  </div>
);

