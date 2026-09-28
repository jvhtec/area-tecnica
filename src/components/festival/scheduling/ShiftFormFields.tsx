import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FestivalStageOption } from "@/features/festival-management/types";

import {
  formatShiftDuration,
  isOvernightShift,
  SHIFT_DEPARTMENT_OPTIONS,
  SHIFT_FORM_NONE as NONE,
  shiftDurationMinutes,
  shiftStageChoices,
  type ShiftFormValues,
} from "./shiftModel";

const TIME_VALUE = /^\d{1,2}:\d{2}/;

interface ShiftFormFieldsProps {
  form: UseFormReturn<ShiftFormValues>;
  stageOptions: readonly FestivalStageOption[];
}

/** Times, stage, department and notes shared by the create and edit shift dialogs. */
export const ShiftFormFields = ({ form, stageOptions }: ShiftFormFieldsProps) => {
  const startTime = form.watch("start_time");
  const endTime = form.watch("end_time");
  const stage = form.watch("stage");
  const department = form.watch("department");
  const { errors } = form.formState;

  const hasValidTimes = TIME_VALUE.test(startTime ?? "") && TIME_VALUE.test(endTime ?? "") && startTime !== endTime;
  const stageChoices = shiftStageChoices(stageOptions, stage && stage !== NONE ? Number(stage) : null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_time">Hora de inicio</Label>
          <Input id="start_time" type="time" {...form.register("start_time")} />
          {errors.start_time && <p className="text-destructive text-sm">{errors.start_time.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_time">Hora de fin</Label>
          <Input id="end_time" type="time" {...form.register("end_time")} />
          {errors.end_time && <p className="text-destructive text-sm">{errors.end_time.message}</p>}
        </div>
      </div>

      {hasValidTimes && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Duración: {formatShiftDuration(shiftDurationMinutes(startTime, endTime))}
          {isOvernightShift(startTime, endTime) ? " · termina al día siguiente" : ""}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="stage">Stage (opcional)</Label>
          <Select
            value={stage || NONE}
            onValueChange={(value) => form.setValue("stage", value, { shouldDirty: true })}
          >
            <SelectTrigger id="stage">
              <SelectValue placeholder="Seleccionar stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin stage</SelectItem>
              {stageChoices.map((option) => (
                <SelectItem key={option.number} value={String(option.number)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Departamento (opcional)</Label>
          <Select
            value={department || NONE}
            onValueChange={(value) => form.setValue("department", value, { shouldDirty: true })}
          >
            <SelectTrigger id="department">
              <SelectValue placeholder="Seleccionar departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin departamento</SelectItem>
              {SHIFT_DEPARTMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          placeholder="Cualquier información adicional sobre este turno"
          {...form.register("notes")}
        />
      </div>
    </>
  );
};
