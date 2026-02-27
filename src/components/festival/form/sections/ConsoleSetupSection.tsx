
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArtistSectionProps } from "@/types/artist-form";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";
import { useEffect, useMemo } from "react";
import { FESTIVAL_CONSOLE_OPTIONS } from "@/constants/festivalConsoleOptions";

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

  const festivalFohOptions = useMemo(
    () =>
      Array.from(
        new Set((gearSetup?.foh_consoles || []).map((consoleItem) => consoleItem?.model?.trim()).filter(Boolean))
      ),
    [gearSetup?.foh_consoles]
  );

  const festivalMonOptions = useMemo(
    () =>
      Array.from(
        new Set((gearSetup?.mon_consoles || []).map((consoleItem) => consoleItem?.model?.trim()).filter(Boolean))
      ),
    [gearSetup?.mon_consoles]
  );

  const fohOptions = useMemo(() => {
    if (formData.foh_console_provided_by === "festival") return festivalFohOptions;
    return allFohOptions;
  }, [allFohOptions, festivalFohOptions, formData.foh_console_provided_by]);

  const monOptions = useMemo(() => {
    if (formData.mon_console_provided_by === "festival") return festivalMonOptions;
    return allMonOptions;
  }, [allMonOptions, festivalMonOptions, formData.mon_console_provided_by]);

  useEffect(() => {
    if (
      formData.foh_console_provided_by === "festival" &&
      formData.foh_console &&
      !fohOptions.includes(formData.foh_console)
    ) {
      onChange({ foh_console: "" });
    }
    if (
      formData.foh_console_provided_by === "band" &&
      formData.foh_console &&
      !allFohOptions.includes(formData.foh_console)
    ) {
      onChange({ foh_console: "" });
    }
  }, [allFohOptions, formData.foh_console, formData.foh_console_provided_by, fohOptions, onChange]);

  useEffect(() => {
    if (
      formData.mon_console_provided_by === "festival" &&
      formData.mon_console &&
      !monOptions.includes(formData.mon_console)
    ) {
      onChange({ mon_console: "" });
    }
    if (
      formData.mon_console_provided_by === "band" &&
      formData.mon_console &&
      !allMonOptions.includes(formData.mon_console)
    ) {
      onChange({ mon_console: "" });
    }
  }, [allMonOptions, formData.mon_console, formData.mon_console_provided_by, monOptions, onChange]);

  useEffect(() => {
    if (!formData.monitors_from_foh) return;

    if (formData.mon_console || formData.mon_waves_outboard || formData.mon_console_provided_by !== "festival") {
      onChange({
        mon_console: "",
        mon_console_provided_by: "festival",
        mon_waves_outboard: "",
      });
    }
  }, [
    formData.mon_console,
    formData.mon_console_provided_by,
    formData.mon_waves_outboard,
    formData.monitors_from_foh,
    onChange,
  ]);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{tx("Configuración de Consolas", "Console Setup")}</h3>

      {/* FOH Console */}
      <div className="space-y-4">
        <h4 className="font-medium">{tx("Consola FOH", "FOH Console")}</h4>
        <div className="grid grid-cols-2 gap-4">
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="foh-tech"
            checked={formData.foh_tech}
            onCheckedChange={(checked) => onChange({ foh_tech: checked })}
            disabled={locked("foh_tech")}
          />
          <Label htmlFor="foh-tech">{tx("Requiere Técnico FOH", "Requires FOH engineer")}</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="foh-waves-outboard">{tx("Waves / Outboard FOH", "FOH Waves / Outboard")}</Label>
          <Input
            id="foh-waves-outboard"
            value={formData.foh_waves_outboard || ""}
            onChange={(event) => onChange({ foh_waves_outboard: event.target.value })}
            placeholder={tx("Ej: Waves + outboard analógico", "Ex: Waves + analog outboard")}
            disabled={locked("foh_waves_outboard")}
          />
        </div>
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="mon-waves-outboard">{tx("Waves / Outboard MON", "MON Waves / Outboard")}</Label>
              <Input
                id="mon-waves-outboard"
                value={formData.mon_waves_outboard || ""}
                onChange={(event) => onChange({ mon_waves_outboard: event.target.value })}
                placeholder={tx("Ej: Plugins/FX para monitores", "Ex: Monitor plugins/FX")}
                disabled={locked("mon_waves_outboard")}
              />
            </div>
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
