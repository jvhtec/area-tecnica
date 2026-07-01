
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArtistSectionProps } from "@/types/artist-form";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";
import { useEffect } from "react";
import { FESTIVAL_CONSOLE_OPTIONS } from "@/constants/festivalConsoleOptions";
import { WavesModelPicker } from "../shared/WavesModelPicker";
import { FOH_DRIVE_OPTIONS, CONSOLE_POSITION_OPTIONS, MON_CONSOLE_POSITION_OPTIONS } from "@/constants/consoleDrive";

export const ConsoleSetupSection = ({ formData, onChange, gearSetup, isFieldLocked, language = "es" }: ArtistSectionProps) => {
  const { models } = useEquipmentModels();
  const locked = (field: string) => isFieldLocked?.(field) ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  // Get console options from database with fallback
  const fohConsoleOptions = models
    .filter(model => model.category === 'foh_console')
    .map(model => model.name);
  const monConsoleOptions = models
    .filter(model => model.category === 'mon_console')
    .map(model => model.name);

  const allFohOptions = Array.from(new Set([...fohConsoleOptions, ...FESTIVAL_CONSOLE_OPTIONS]));
  const allMonOptions = Array.from(new Set([...monConsoleOptions, ...FESTIVAL_CONSOLE_OPTIONS]));

  const fohOptions = allFohOptions;
  const monOptions = allMonOptions;

  useEffect(() => {
    if (!formData.monitors_from_foh) return;

    if (
      formData.mon_console ||
      (formData.mon_waves_models && formData.mon_waves_models.length > 0) ||
      formData.mon_outboard ||
      formData.mon_console_provided_by !== "festival" ||
      formData.mon_waves_provided_by !== "festival" ||
      formData.mon_position
    ) {
      onChange({
        mon_console: "",
        mon_console_provided_by: "festival",
        mon_waves_models: [],
        mon_outboard: "",
        mon_waves_provided_by: "festival",
        mon_position: "",
      });
    }
  }, [
    formData.mon_console,
    formData.mon_console_provided_by,
    formData.mon_waves_models,
    formData.mon_outboard,
    formData.mon_waves_provided_by,
    formData.mon_position,
    formData.monitors_from_foh,
    onChange,
  ]);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{tx("Configuración de Consolas", "Console Setup")}</h3>

      {/* FOH Console */}
      <div className="space-y-4">
        <h4 className="font-medium">{tx("Consola FOH", "FOH Console")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>{tx("Modelo de Consola", "Console Model")}</Label>
            <Select
              value={formData.foh_console || ""}
              onValueChange={(value) => onChange({ foh_console: value })}
              disabled={locked("foh_console")}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    formData.foh_console_provided_by === "festival" && fohOptions.length === 0
                      ? tx("Sin consolas FOH disponibles", "No FOH consoles available")
                      : tx("Seleccionar consola", "Select console")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {fohOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.foh_console_provided_by === "festival" && fohOptions.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {tx(
                  "No hay consolas FOH cargadas en el gear setup del festival.",
                  "No FOH consoles loaded in festival gear setup."
                )}
              </p>
            )}
          </div>
          <div>
            <Label>{tx("Proporcionado por", "Provided by")}</Label>
            <Select
              value={formData.foh_console_provided_by || "festival"}
              onValueChange={(value) => onChange({ foh_console_provided_by: value })}
              disabled={locked("foh_console_provided_by")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="band">{tx("Banda", "Band")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>{tx("Drive", "Drive")}</Label>
            <Select
              value={formData.foh_drive || ""}
              onValueChange={(value) => onChange({ foh_drive: value })}
              disabled={locked("foh_drive")}
            >
              <SelectTrigger>
                <SelectValue placeholder={tx("Seleccionar drive", "Select drive")} />
              </SelectTrigger>
              <SelectContent>
                {FOH_DRIVE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Posición", "Position")}</Label>
            <Select
              value={formData.foh_drive_position || ""}
              onValueChange={(value) => onChange({ foh_drive_position: value })}
              disabled={locked("foh_drive_position")}
            >
              <SelectTrigger>
                <SelectValue placeholder={tx("Seleccionar posición", "Select position")} />
              </SelectTrigger>
              <SelectContent>
                {CONSOLE_POSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="foh-tech"
            checked={formData.foh_tech}
            onCheckedChange={(checked) => onChange({ foh_tech: checked })}
            disabled={locked("foh_tech")}
          />
          <Label htmlFor="foh-tech">{tx("Requiere Técnico FOH", "Requires FOH engineer")}</Label>
        </div>
        <WavesModelPicker
          idPrefix="foh-waves"
          waveModelsLabel={tx("Servidor Waves FOH", "FOH Waves Server")}
          outboardLabel={tx("Outboard FOH", "FOH Outboard")}
          outboardPlaceholder={tx("Ej: outboard analógico adicional", "Ex: additional analog outboard")}
          selectedModels={formData.foh_waves_models || []}
          outboard={formData.foh_outboard || ""}
          onModelsChange={(models) => onChange({ foh_waves_models: models })}
          onOutboardChange={(outboard) => onChange({ foh_outboard: outboard })}
          providedBy={formData.foh_waves_provided_by || "festival"}
          onProvidedByChange={(providedBy) => onChange({ foh_waves_provided_by: providedBy })}
          providedByLabel={tx("Waves/Outboard FOH proporcionado por", "FOH Waves/Outboard provided by")}
          disabled={locked("foh_waves_models")}
          language={language}
        />
      </div>

      {/* Monitor Console */}
      <div className="space-y-4">
        <h4 className="font-medium">{tx("Consola de Monitores", "MON Console")}</h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="monitors-from-foh"
            checked={formData.monitors_from_foh}
            onCheckedChange={(checked) => onChange({ monitors_from_foh: checked === true })}
            disabled={locked("monitors_from_foh")}
          />
          <Label htmlFor="monitors-from-foh">{tx("Monitores desde FOH", "Monitors from FOH")}</Label>
        </div>
        {!formData.monitors_from_foh ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{tx("Modelo de Consola", "Console Model")}</Label>
                <Select
                  value={formData.mon_console || ""}
                  onValueChange={(value) => onChange({ mon_console: value })}
                  disabled={locked("mon_console")}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formData.mon_console_provided_by === "festival" && monOptions.length === 0
                          ? tx("Sin consolas MON disponibles", "No MON consoles available")
                          : tx("Seleccionar consola", "Select console")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {monOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.mon_console_provided_by === "festival" && monOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {tx(
                      "No hay consolas de monitor cargadas en el gear setup del festival.",
                      "No monitor consoles loaded in festival gear setup."
                    )}
                  </p>
                )}
              </div>
              <div>
                <Label>{tx("Proporcionado por", "Provided by")}</Label>
                <Select
                  value={formData.mon_console_provided_by || "festival"}
                  onValueChange={(value) => onChange({ mon_console_provided_by: value })}
                  disabled={locked("mon_console_provided_by")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="festival">Festival</SelectItem>
                    <SelectItem value="band">{tx("Banda", "Band")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("Posición", "Position")}</Label>
                <Select
                  value={formData.mon_position || ""}
                  onValueChange={(value) => onChange({ mon_position: value })}
                  disabled={locked("mon_position")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tx("Seleccionar posición", "Select position")} />
                  </SelectTrigger>
                  <SelectContent>
                    {MON_CONSOLE_POSITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <WavesModelPicker
              idPrefix="mon-waves"
              waveModelsLabel={tx("Servidor Waves MON", "MON Waves Server")}
              outboardLabel={tx("Outboard MON", "MON Outboard")}
              outboardPlaceholder={tx("Ej: outboard adicional para monitores", "Ex: additional outboard for monitors")}
              selectedModels={formData.mon_waves_models || []}
              outboard={formData.mon_outboard || ""}
              onModelsChange={(models) => onChange({ mon_waves_models: models })}
              onOutboardChange={(outboard) => onChange({ mon_outboard: outboard })}
              providedBy={formData.mon_waves_provided_by || "festival"}
              onProvidedByChange={(providedBy) => onChange({ mon_waves_provided_by: providedBy })}
              providedByLabel={tx("Waves/Outboard MON proporcionado por", "MON Waves/Outboard provided by")}
              disabled={locked("mon_waves_models")}
              language={language}
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {tx("El setup de monitores se resuelve desde FOH.", "Monitor setup is handled from FOH.")}
          </p>
        )}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="mon-tech"
            checked={formData.mon_tech}
            onCheckedChange={(checked) => onChange({ mon_tech: checked })}
            disabled={locked("mon_tech")}
          />
          <Label htmlFor="mon-tech">{tx("Requiere Técnico de Monitores", "Requires MON engineer")}</Label>
        </div>
      </div>
    </div>
  );
};
