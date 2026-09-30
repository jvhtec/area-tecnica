import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { createFestivalShift, updateFestivalShift } from "@/features/festival-scheduling/api";
import { buildFallbackStageOptions } from "@/features/festival-management/selectors";
import type { Tables } from "@/integrations/supabase/types";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { getErrorMessage } from "@/utils/errorMessage";

import { ShiftCrewSection } from "./ShiftCrewSection";
import { ShiftFormFields } from "./ShiftFormFields";
import { ShiftTimeCalculator } from "./ShiftTimeCalculator";
import {
  formatShiftDuration,
  formatShiftTime,
  SHIFT_FORM_NONE,
  shiftDepartmentLabel,
  shiftDurationMinutes,
  shiftFormDefaults,
  shiftFormSchema,
  shiftFormToRow,
  shiftNextDayNote,
  shiftStageLabel,
  type ShiftFormValues,
} from "./shiftModel";

/** What the sheet is open on: a new shift (optionally pre-filled) or an existing one by id. */
export type ShiftSheetTarget =
  | { kind: "create"; prefill?: Partial<ShiftFormValues> }
  | { kind: "edit"; shiftId: string };

interface ShiftSheetProps {
  target: ShiftSheetTarget | null;
  onClose: () => void;
  jobId: string;
  date: string;
  /** The day's shifts from the live query: the sheet reads its shift from here so the crew is never a snapshot. */
  shifts: readonly ShiftWithAssignments[];
  /**
   * True while the day's shifts are loading or refreshing, or the last refresh failed: the sheet then
   * does not conclude that its shift is gone, only that it cannot tell yet.
   */
  isShiftListUnsettled?: boolean;
  stageOptions?: readonly FestivalStageOption[];
  dayStartTime: string;
  isViewOnly?: boolean;
  /** A new shift was saved: put it in the day's list and switch the sheet to it. */
  onCreated: (created: Tables<"festival_shifts">) => Promise<void> | void;
  onSaved: () => Promise<void> | void;
  /** Resolves true once the shift is deleted; false (after telling the user) when it could not be. */
  onDelete: (shiftId: string) => Promise<boolean>;
}

const DEFAULT_STAGE_OPTIONS = buildFallbackStageOptions(1);

/**
 * One place for a shift: its times, stage and department together with its crew. It stays open
 * after creating a shift, so a staffed shift takes one sheet instead of two dialogs.
 */
export const ShiftSheet = ({ target, onClose, shifts, isShiftListUnsettled = false, isViewOnly = false, ...rest }: ShiftSheetProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const shift = target?.kind === "edit" ? (shifts.find((candidate) => candidate.id === target.shiftId) ?? null) : null;

  // A shift removed elsewhere while its sheet was open: close rather than show a ghost.
  useEffect(() => {
    if (target?.kind === "edit" && !shift && !isShiftListUnsettled) {
      toast({ title: "Turno no disponible", description: "Este turno ya no existe.", variant: "destructive" });
      onClose();
    }
  }, [target, shift, isShiftListUnsettled, onClose, toast]);

  const isCreating = target?.kind === "create";
  const title = isCreating ? "Crear turno" : isViewOnly ? (shift?.name ?? "Turno") : "Editar turno";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "max-h-[92vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-lg"}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {isViewOnly
              ? "Horario y personal de este turno."
              : "Los cambios de personal se guardan al momento; los del turno, al pulsar Guardar."}
          </SheetDescription>
        </SheetHeader>

        {target && (
          // Keyed so opening another shift (or a just-created one) starts from its own values, while
          // a refetch of the same shift never overwrites what is being typed.
          <ShiftSheetBody
            key={target.kind === "edit" ? `edit:${target.shiftId}` : "create"}
            target={target}
            shift={shift}
            onClose={onClose}
            isViewOnly={isViewOnly}
            {...rest}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};

type ShiftSheetBodyProps = Omit<ShiftSheetProps, "shifts" | "isShiftListUnsettled"> & {
  target: ShiftSheetTarget;
  shift: ShiftWithAssignments | null;
};

const ShiftSheetBody = ({
  target,
  shift,
  onClose,
  jobId,
  date,
  stageOptions = DEFAULT_STAGE_OPTIONS,
  dayStartTime,
  isViewOnly = false,
  onCreated,
  onSaved,
  onDelete,
}: ShiftSheetBodyProps) => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCreating = target.kind === "create";

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: target.kind === "create" ? { ...shiftFormDefaults(), ...target.prefill } : shiftFormDefaults(shift ?? undefined),
  });

  const applyCalculatedTimes = (startTime: string, endTime: string) => {
    form.setValue("start_time", startTime, { shouldValidate: true, shouldDirty: true });
    form.setValue("end_time", endTime, { shouldValidate: true, shouldDirty: true });
  };

  const handleSubmit = async (values: ShiftFormValues) => {
    setIsSubmitting(true);
    try {
      if (isCreating) {
        const created = await createFestivalShift({ job_id: jobId, date, ...shiftFormToRow(values) });
        toast({ title: "Turno creado", description: `${values.name.trim()} se ha añadido. Ya puedes asignar personal.` });
        await onCreated(created);
      } else if (shift) {
        await updateFestivalShift(shift.id, shiftFormToRow(values));
        toast({ title: "Turno actualizado", description: `${values.name.trim()} se ha guardado.` });
        await onSaved();
        form.reset(values);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, isCreating ? "No se pudo crear el turno" : "No se pudo actualizar el turno"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!shift) return;
    const confirmed = await confirm({
      title: "Eliminar turno",
      description: `¿Seguro que quieres eliminar «${shift.name}»? También se quitará el personal asignado.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;
    if (await onDelete(shift.id)) onClose();
  };

  const watchedStage = form.watch("stage");
  const waitingForShift = target.kind === "edit" && !shift;

  return (
    <div className="mt-4 space-y-6">
      {waitingForShift ? (
        <Loading label="Cargando turno…" className="p-6" />
      ) : isViewOnly && shift ? (
        <ShiftReadOnlyDetails shift={shift} stageOptions={stageOptions} dayStartTime={dayStartTime} />
      ) : (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" aria-label="Datos del turno">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del turno</Label>
            <Input id="name" placeholder="Mañana, Montaje, Noche…" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <ShiftTimeCalculator
            jobId={jobId}
            date={shift?.date ?? date}
            stage={watchedStage && watchedStage !== SHIFT_FORM_NONE ? Number.parseInt(watchedStage, 10) : undefined}
            onApplyTimes={applyCalculatedTimes}
          />

          <ShiftFormFields form={form} stageOptions={stageOptions} />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {shift ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => void handleDelete()}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar turno
              </Button>
            ) : (
              <span />
            )}
            <SubmitButton
              type="submit"
              loading={isSubmitting}
              loadingText={isCreating ? "Creando…" : "Guardando…"}
              disabled={!isCreating && !form.formState.isDirty}
            >
              {isCreating ? "Crear turno" : "Guardar cambios"}
            </SubmitButton>
          </div>
        </form>
      )}

      {shift ? (
        // Keyed by department: another department has other roles, so the role picked for new people
        // (and the picks made under the old one) must not carry over.
        <ShiftCrewSection
          key={`${shift.id}:${shift.department ?? ""}`}
          shift={shift}
          isViewOnly={isViewOnly}
          onChanged={() => void onSaved()}
        />
      ) : isCreating ? (
        <p className="text-sm text-muted-foreground">Crea el turno para poder asignarle personal.</p>
      ) : null}
    </div>
  );
};

const ShiftReadOnlyDetails = ({
  shift,
  stageOptions,
  dayStartTime,
}: {
  shift: ShiftWithAssignments;
  stageOptions: readonly FestivalStageOption[];
  dayStartTime: string;
}) => {
  const nextDayNote = shiftNextDayNote(shift.start_time, shift.end_time, dayStartTime);
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <dt className="sr-only">Horario</dt>
        <dd className="font-medium">
          {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
        </dd>
        <dd className="text-muted-foreground">
          {formatShiftDuration(shiftDurationMinutes(shift.start_time, shift.end_time))}
        </dd>
        {nextDayNote && (
          <Badge variant="outline" title={nextDayNote}>
            +1 día
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground">
        {shiftStageLabel(shift.stage, stageOptions)} · {shiftDepartmentLabel(shift.department)}
      </div>
      {shift.notes && <div>{shift.notes}</div>}
    </dl>
  );
};
