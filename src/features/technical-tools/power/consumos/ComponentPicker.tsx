import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsumosComponent } from "./config";

export const ComponentPicker: React.FC<{
  components: ConsumosComponent[];
  value: string;
  onSelect: (componentId: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}> = ({ components, value, onSelect, placeholder, searchPlaceholder, emptyText }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = components.find((component) => component.id.toString() === value);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[150px] justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selected?.name || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {components
                .filter((component) =>
                  component.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((component) => (
                  <CommandItem
                    key={component.id}
                    onSelect={() => {
                      onSelect(component.id.toString());
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === component.id.toString() ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span>{component.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
