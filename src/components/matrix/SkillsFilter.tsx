import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import { useActiveSkills } from '@/hooks/useActiveSkills';
import { groupSkillsForDepartment, normalizeSkillKey, skillCategoryLabel } from '@/utils/skillCatalog';

interface SkillsFilterProps {
  selected: string[]; // skill names
  onChange: (skills: string[]) => void;
  department?: string;
}

export const SkillsFilter: React.FC<SkillsFilterProps> = ({ selected, onChange, department }) => {
  const [open, setOpen] = React.useState(false);
  const { data: catalog } = useActiveSkills();
  const grouped = React.useMemo(() => groupSkillsForDepartment(catalog ?? [], department), [catalog, department]);
  const selectedKeys = React.useMemo(() => new Set(selected.map(normalizeSkillKey)), [selected]);

  const toggle = (name: string, checked: boolean) => {
    const key = normalizeSkillKey(name);
    const next = selected.filter((value) => normalizeSkillKey(value) !== key);
    if (checked) next.push(name);
    onChange(next);
  };

  const selectedCount = selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Habilidades
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-1">{selectedCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        {open && (
          <Command>
            <CommandInput placeholder="Buscar habilidad…" />
            <CommandList>
              <CommandEmpty>No se encontraron habilidades.</CommandEmpty>
              {grouped.map(([category, list]) => (
                <CommandGroup key={category} heading={skillCategoryLabel(category)}>
                  {list.map(s => {
                    const checked = selectedKeys.has(normalizeSkillKey(s.name));
                    return (
                      <CommandItem key={s.id} onSelect={() => toggle(s.name, !checked)}>
                        <div className="mr-2">
                          <Checkbox checked={checked} onCheckedChange={(v) => toggle(s.name, !!v)} />
                        </div>
                        <span>{s.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};
