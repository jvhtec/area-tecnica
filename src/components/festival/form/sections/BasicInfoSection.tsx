
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArtistSectionProps } from "@/types/artist-form";

interface BasicInfoSectionProps extends ArtistSectionProps {
  stageNames?: Record<number, string>;
  showInternalFlags?: boolean;
}

export const BasicInfoSection = ({
  formData,
  onChange,
  gearSetup,
  isFieldLocked,
  language = "es",
  stageNames,
  showInternalFlags = true,
}: BasicInfoSectionProps) => {
  // Get max stages from gearSetup or default to 3
  const maxStages = gearSetup?.max_stages || 3;
  const locked = (field: string) => isFieldLocked?.(field) ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{tx("Información Básica", "Basic Info")}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{tx("Nombre del Artista/Banda", "Artist/Band Name")}</Label>
          <Input
            value={formData.name || ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={tx("Ingrese el nombre del artista", "Enter artist name")}
            disabled={locked("name")}
          />
        </div>
        <div>
          <Label>{tx("Escenario", "Stage")}</Label>
          <Select
            value={formData.stage?.toString() || "1"}
            onValueChange={(value) => onChange({ stage: parseInt(value) })}
            disabled={locked("stage")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxStages }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {stageNames?.[i + 1] || `${tx("Escenario", "Stage")} ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>{tx("Fecha", "Date")}</Label>
        <Input
          type="date"
          value={formData.date || ""}
          onChange={(e) => onChange({ date: e.target.value })}
          disabled={locked("date")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{tx("Inicio del Show", "Show Start")}</Label>
          <Input
            type="time"
            value={formData.show_start || ""}
            onChange={(e) => onChange({ show_start: e.target.value })}
            disabled={locked("show_start")}
          />
        </div>
        <div>
          <Label>{tx("Fin del Show", "Show End")}</Label>
          <Input
            type="time"
            value={formData.show_end || ""}
            onChange={(e) => onChange({ show_end: e.target.value })}
            disabled={locked("show_end")}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="soundcheck"
            checked={formData.soundcheck}
            onCheckedChange={(checked) => onChange({ soundcheck: checked })}
            disabled={locked("soundcheck")}
          />
          <Label htmlFor="soundcheck">{tx("Requiere Soundcheck", "Requires Soundcheck")}</Label>
        </div>

        {formData.soundcheck && (
          <div className="grid grid-cols-2 gap-4 ml-6">
            <div>
              <Label>{tx("Inicio del Soundcheck", "Soundcheck Start")}</Label>
              <Input
                type="time"
                value={formData.soundcheck_start || ""}
                onChange={(e) => onChange({ soundcheck_start: e.target.value })}
                disabled={locked("soundcheck_start")}
              />
            </div>
            <div>
              <Label>{tx("Fin del Soundcheck", "Soundcheck End")}</Label>
              <Input
                type="time"
                value={formData.soundcheck_end || ""}
                onChange={(e) => onChange({ soundcheck_end: e.target.value })}
                disabled={locked("soundcheck_end")}
              />
            </div>
          </div>
        )}
      </div>

      {showInternalFlags && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="after-midnight"
              checked={formData.isaftermidnight}
              onCheckedChange={(checked) => onChange({ isaftermidnight: checked })}
              disabled={locked("isaftermidnight")}
            />
            <Label htmlFor="after-midnight">{tx("El show es después de medianoche", "Show is after midnight")}</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rider-missing"
              checked={formData.rider_missing}
              onCheckedChange={(checked) => onChange({ rider_missing: checked })}
              disabled={locked("rider_missing")}
            />
            <Label htmlFor="rider-missing">{tx("El rider está faltando", "Rider is missing")}</Label>
          </div>
        </div>
      )}
    </div>
  );
};
