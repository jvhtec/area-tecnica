import React, { type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TimesheetFormData } from "@/types/timesheet";

export const TimesheetEditForm: React.FC<{
  formData: TimesheetFormData;
  setFormData: Dispatch<SetStateAction<TimesheetFormData>>;
  onSave: () => void;
  onCancel: () => void;
}> = ({ formData, setFormData, onSave, onCancel }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div>
      <Label htmlFor="start_time">Hora de Inicio</Label>
      <Input
        id="start_time"
        type="time"
        value={formData.start_time}
        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
      />
    </div>
    <div>
      <Label htmlFor="end_time">Hora de Fin</Label>

      <Input
        id="end_time"
        type="time"
        value={formData.end_time}
        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
      />
    </div>
    <div>
      <Label htmlFor="break_minutes">Descanso (minutos)</Label>
      <Input
        id="break_minutes"
        type="number"
        value={formData.break_minutes}
        onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
      />
      <p className="text-[10px] text-muted-foreground mt-1">
        Solo para descansos por convenio o montajes/desmontajes, no para comidas.
      </p>
    </div>
    <div className="flex items-center gap-2 mt-6">
      <input
        id="ends_next_day"
        type="checkbox"
        checked={!!formData.ends_next_day}
        onChange={(e) => setFormData({ ...formData, ends_next_day: e.target.checked })}
      />
      <Label htmlFor="ends_next_day">Termina al día siguiente</Label>
      {formData.end_time < formData.start_time && (
        <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
          Auto-detectado
        </Badge>
      )}
    </div>
    <div>
      <Label htmlFor="category">Categoría</Label>
      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as any })}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tecnico">técnico</SelectItem>
          <SelectItem value="especialista">especialista</SelectItem>
          <SelectItem value="responsable">responsable</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <Label htmlFor="overtime_hours">Horas Extra</Label>
      <Input
        id="overtime_hours"
        type="number"
        step="0.5"
        value={formData.overtime_hours}
        onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
      />
    </div>
    <div className="col-span-2 md:col-span-4">
      <Label htmlFor="notes">Notas</Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        placeholder="Notas adicionales..."
      />
    </div>
    <div className="col-span-2 md:col-span-4 flex gap-2">
      <Button onClick={onSave}>Guardar Cambios</Button>
      <Button variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  </div>
);

