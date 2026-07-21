import { formatInTimeZone } from "date-fns-tz";
import { Combobox } from "@/components/ui/combobox";

const MADRID_TIME_ZONE = "Europe/Madrid";

export interface DocumentationJobOption {
  id: string;
  title: string;
  start_time?: string | null;
}

interface DocumentationJobPickerProps {
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  isLoading?: boolean;
  jobs?: DocumentationJobOption[] | null;
  onValueChange: (jobId: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  value: string;
}

const formatJobLabel = (job: DocumentationJobOption) => {
  if (!job.start_time) return job.title;

  try {
    return `${job.title} · ${formatInTimeZone(job.start_time, MADRID_TIME_ZONE, "dd/MM/yyyy")}`;
  } catch {
    return job.title;
  }
};

/** Searchable picker shared by the department tools that generate job documentation. */
export const DocumentationJobPicker = ({
  ariaLabel = "Trabajo",
  disabled = false,
  id,
  isLoading = false,
  jobs,
  onValueChange,
  placeholder = "Seleccionar trabajo",
  triggerClassName,
  value,
}: DocumentationJobPickerProps) => (
  <Combobox
    ariaLabel={ariaLabel}
    className="w-[var(--radix-popover-trigger-width)] min-w-72"
    disabled={disabled || isLoading}
    emptyMessage="No hay trabajos activos que coincidan."
    items={(jobs ?? []).map((job) => ({ value: job.id, label: formatJobLabel(job) }))}
    onValueChange={(nextValue) => onValueChange(nextValue || value)}
    placeholder={isLoading ? "Cargando trabajos..." : placeholder}
    searchPlaceholder="Buscar por nombre o fecha..."
    triggerClassName={triggerClassName}
    triggerId={id}
    value={value}
  />
);
