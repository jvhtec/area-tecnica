import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { buildFallbackStageOptions } from "@/features/festival-management/selectors";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { useToast } from "@/hooks/use-toast";
import { createFestivalShift } from "@/features/festival-scheduling/api";
import { getErrorMessage } from "@/utils/errorMessage";

import { ShiftFormFields } from "./ShiftFormFields";
import { ShiftTimeCalculator } from "./ShiftTimeCalculator";
import { SHIFT_FORM_NONE, shiftFormDefaults, shiftFormSchema, shiftFormToRow, type ShiftFormValues } from "./shiftModel";

interface CreateShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onShiftCreated: () => void;
  date: string;
  /** The festival's stages (names from `festival_stages`, count from the gear setup). */
  stageOptions?: readonly FestivalStageOption[];
}

const DEFAULT_STAGE_OPTIONS = buildFallbackStageOptions(1);

export const CreateShiftDialog = ({
  open,
  onOpenChange,
  jobId,
  onShiftCreated,
  date,
  stageOptions = DEFAULT_STAGE_OPTIONS,
}: CreateShiftDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: shiftFormDefaults(),
  });

  // Start every opening from a clean form, not from the last shift created.
  useEffect(() => {
    if (open) form.reset(shiftFormDefaults());
  }, [form, open]);

  const handleApplyCalculatedTimes = (startTime: string, endTime: string) => {
    form.setValue("start_time", startTime, { shouldValidate: true });
    form.setValue("end_time", endTime, { shouldValidate: true });
  };

  const handleSubmit = async (values: ShiftFormValues) => {
    setIsSubmitting(true);
    try {
      await createFestivalShift({ job_id: jobId, date, ...shiftFormToRow(values) });

      onShiftCreated();
      toast({ title: "Turno creado", description: `${values.name.trim()} se ha añadido a la programación.` });
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo crear el turno"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedStage = form.watch("stage");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Crear turno</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del turno</Label>
            <Input id="name" placeholder="Mañana, Montaje, Noche…" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>

          <ShiftTimeCalculator
            jobId={jobId}
            date={date}
            stage={watchedStage && watchedStage !== SHIFT_FORM_NONE ? Number.parseInt(watchedStage, 10) : undefined}
            onApplyTimes={handleApplyCalculatedTimes}
          />

          <ShiftFormFields form={form} stageOptions={stageOptions} />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <SubmitButton type="submit" loading={isSubmitting} loadingText="Creando…">
              Crear Turno
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
