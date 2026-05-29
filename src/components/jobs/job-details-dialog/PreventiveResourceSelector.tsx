import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSetPreventiveResource } from '@/hooks/usePreventiveResource';
import {
  getPreventiveResourceOptions,
  getTechnicianDisplayName,
  PREVENTIVE_RESOURCE_EXTRA_EUR,
} from '@/utils/preventiveResource';

const UNASSIGNED_VALUE = '__unassigned__';

interface PreventiveResourceSelectorProps {
  jobId: string;
  assignments: any[];
  selectedTechnicianId?: string | null;
  selectedProfile?: {
    first_name?: string | null;
    last_name?: string | null;
    department?: string | null;
  } | null;
  canManage: boolean;
}

export const PreventiveResourceSelector: React.FC<PreventiveResourceSelectorProps> = ({
  jobId,
  assignments,
  selectedTechnicianId,
  selectedProfile,
  canManage,
}) => {
  const options = useMemo(() => getPreventiveResourceOptions(assignments), [assignments]);
  const mutation = useSetPreventiveResource(jobId);
  const selectedOption = options.find((option) => option.id === selectedTechnicianId);
  const selectedName = selectedOption?.name || getTechnicianDisplayName(selectedProfile);
  const selectedDepartment = selectedOption?.department || selectedProfile?.department || null;
  const hasSelectedTechnician = Boolean(selectedTechnicianId);
  const selectOptions = selectedOption || !selectedTechnicianId
    ? options
    : [
        {
          id: selectedTechnicianId,
          name: selectedName,
          department: selectedDepartment,
          role: null,
        },
        ...options,
      ];

  const handleChange = (value: string) => {
    mutation.mutate(value === UNASSIGNED_VALUE ? null : value);
  };

  return (
    <Card className="p-3 border-dashed bg-amber-500/5 border-amber-500/30">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span className="font-medium">Recurso preventivo</span>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-200">
              +{PREVENTIVE_RESOURCE_EXTRA_EUR}€ por trabajo
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasSelectedTechnician
              ? `${selectedName}${selectedDepartment ? ` · ${selectedDepartment}` : ''}`
              : 'Sin recurso preventivo asignado'}
          </p>
        </div>

        {canManage && (
          <Select
            value={selectedTechnicianId || UNASSIGNED_VALUE}
            onValueChange={handleChange}
            disabled={mutation.isPending || (options.length === 0 && !hasSelectedTechnician)}
          >
            <SelectTrigger className="w-full md:w-[300px] bg-background">
              <SelectValue placeholder="Seleccionar técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_VALUE}>Sin recurso preventivo</SelectItem>
              {selectOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}{option.department ? ` · ${option.department}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {canManage && options.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Solo se puede designar a técnicos confirmados en este trabajo.
        </p>
      )}
    </Card>
  );
};
