
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShiftTimeCalculator } from "./ShiftTimeCalculator";

interface CreateShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onShiftCreated: () => void;
  date: string;
}

const formSchema = z.object({
  name: z.string().min(1, "El nombre del turno es requerido"),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Se requiere formato de hora válido (HH:MM)"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Se requiere formato de hora válido (HH:MM)"),
  stage: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const CreateShiftDialog = ({ 
  open, 
  onOpenChange, 
  jobId, 
  onShiftCreated,
  date 
}: CreateShiftDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      stage: "",
      department: "",
      notes: "",
    },
  });

  const handleApplyCalculatedTimes = (startTime: string, endTime: string) => {
    form.setValue("start_time", startTime);
    form.setValue("end_time", endTime);
  };

  const handleSubmit = async (values: FormValues) => {
    console.log("Creating shift with values:", values);
    console.log("For job ID:", jobId);
    console.log("On date:", date);
    
    setIsSubmitting(true);
    try {
      const shiftData = {
        job_id: jobId,
        date: date,
        name: values.name,
        start_time: values.start_time,
        end_time: values.end_time,
        stage: values.stage ? parseInt(values.stage) : null,
        department: values.department || null,
        notes: values.notes || null,
      };
      
      console.log("Submitting shift data:", shiftData);
      
      const { data, error } = await supabase.from("festival_shifts").insert(shiftData).select();

      if (error) {
        console.error("Error creating shift:", error);
        throw error;
      }
      
      console.log("Shift created successfully:", data);
      form.reset();
      onShiftCreated();

      toast({
        title: "Éxito",
        description: "Turno creado exitosamente",
      });
    } catch (error: any) {
      console.error("Error creating shift:", error);
      toast({
        title: "Error",
        description: `No se pudo crear el turno: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Crear Turno</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Turno</Label>
            <Input
              id="name"
              placeholder="Turno Mañana, Soundcheck, etc."
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <ShiftTimeCalculator 
            jobId={jobId} 
            date={date} 
            stage={form.watch("stage") ? parseInt(form.watch("stage")) : undefined}
            onApplyTimes={handleApplyCalculatedTimes}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora de Inicio</Label>
              <Input
                id="start_time"
                type="time"
                {...form.register("start_time")}
              />
              {form.formState.errors.start_time && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.start_time.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">Hora de Fin</Label>
              <Input
                id="end_time"
                type="time"
                {...form.register("end_time")}
              />
              {form.formState.errors.end_time && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.end_time.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Stage (opcional)</Label>
              <Select onValueChange={(value) => form.setValue("stage", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Stage 1</SelectItem>
                  <SelectItem value="2">Stage 2</SelectItem>
                  <SelectItem value="3">Stage 3</SelectItem>
                  <SelectItem value="4">Stage 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Departamento (opcional)</Label>
              <Select onValueChange={(value) => form.setValue("department", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sound">Sonido</SelectItem>
                  <SelectItem value="lights">Luces</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="logistics">Logística</SelectItem>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Turno"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
