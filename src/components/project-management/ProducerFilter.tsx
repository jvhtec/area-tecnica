import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ReactNode } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { UNASSIGNED_PRODUCER, producerOptionLabel, type ProducerOption } from "./producerFilter";

interface ProducerFilterProps {
  options: ProducerOption[];
  selectedProducerIds: string[];
  onToggle: (producerId: string) => void;
  onClear: () => void;
}

export const ProducerFilter = ({ options, selectedProducerIds, onToggle, onClear }: ProducerFilterProps) => {
  const item = (id: string, label: string) => (
    <DropdownMenuItem
      key={id}
      onClick={(event) => {
        event.preventDefault();
        onToggle(id);
      }}
      className="gap-2 cursor-pointer"
    >
      <Checkbox checked={selectedProducerIds.includes(id)} aria-hidden="true" tabIndex={-1} />
      <span className="truncate">{label}</span>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Filtrar por responsable de producción">
          <span className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            Responsable
            {selectedProducerIds.length > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
                {selectedProducerIds.length}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Responsable de producción</DropdownMenuLabel>
        {selectedProducerIds.length > 0 && (
          <DropdownMenuItem onClick={onClear} className="font-medium">
            Limpiar filtro
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {item(UNASSIGNED_PRODUCER, "Sin responsable")}
        {options.map((option) => item(option.id, producerOptionLabel(option)))}
        {options.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            Ningún trabajo de este mes tiene responsable
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface ProducerFilterAccordionItemProps extends ProducerFilterProps {
  renderOption: (option: { key: string; checked: boolean; label: string; onClick: () => void }) => ReactNode;
}

/** Mobile counterpart, rendered inside the filter sheet's accordion. */
export const ProducerFilterAccordionItem = ({
  options,
  selectedProducerIds,
  onToggle,
  onClear,
  renderOption,
}: ProducerFilterAccordionItemProps) => (
  <AccordionItem value="producer" className="rounded-md border px-3">
    <AccordionTrigger className="py-3 text-sm hover:no-underline">
      <span className="flex items-center gap-2">
        <UserRound className="h-4 w-4" />
        Responsable
        {selectedProducerIds.length > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {selectedProducerIds.length}
          </span>
        )}
      </span>
    </AccordionTrigger>
    <AccordionContent className="space-y-2 pb-3">
      {selectedProducerIds.length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="w-full justify-start">
          Limpiar filtro
        </Button>
      )}
      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {[{ id: UNASSIGNED_PRODUCER, label: "Sin responsable" }, ...options.map((o) => ({ id: o.id, label: producerOptionLabel(o) }))]
          .map(({ id, label }) => renderOption({
            key: id,
            checked: selectedProducerIds.includes(id),
            label,
            onClick: () => onToggle(id),
          }))}
      </div>
    </AccordionContent>
  </AccordionItem>
);
