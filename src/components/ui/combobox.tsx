import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

export interface ComboboxItem {
  value: string;
  label: string;
}

export interface ComboboxGroup {
  heading: string;
  items: ComboboxItem[];
}

interface ComboboxProps {
  /** Flat list of items (use `groups` for grouped display) */
  items?: ComboboxItem[];
  /** Grouped items shown with section headings */
  groups?: ComboboxGroup[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function Combobox({
  items,
  groups,
  value,
  onValueChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Sin resultados.',
  className,
  triggerClassName,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Build a flat lookup for display
  const allItems = React.useMemo(() => {
    if (items) return items;
    if (groups) return groups.flatMap((g) => g.items);
    return [];
  }, [items, groups]);

  const selectedLabel = allItems.find((i) => i.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', triggerClassName)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0', className)} align="start">
        {open && (
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {groups
                ? groups.map((group, gi) => (
                    <React.Fragment key={group.heading}>
                      {gi > 0 && <CommandSeparator />}
                      <CommandGroup heading={group.heading}>
                        {group.items.map((item) => (
                          <CommandItem
                            key={item.value}
                            value={item.label}
                            onSelect={() => {
                              onValueChange(item.value === value ? '' : item.value);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', value === item.value ? 'opacity-100' : 'opacity-0')}
                            />
                            {item.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </React.Fragment>
                  ))
                : items?.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.label}
                      onSelect={() => {
                        onValueChange(item.value === value ? '' : item.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', value === item.value ? 'opacity-100' : 'opacity-0')}
                      />
                      {item.label}
                    </CommandItem>
                  ))}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
