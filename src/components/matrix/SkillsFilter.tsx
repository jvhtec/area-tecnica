import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Skill = { id: string; name: string; category: string | null };

interface SkillsFilterProps {
  selected: string[]; // skill names
  onChange: (skills: string[]) => void;
}

export const SkillsFilter: React.FC<SkillsFilterProps> = ({ selected, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('id,name,category')
        .eq('active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (!mounted) return;
      if (error) {
        console.warn('Failed to fetch skills:', error);
        setSkills([]);
      } else {
        setSkills(data || []);
      }
    })();
    return () => { mounted = false };
  }, []);

  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(name); else next.delete(name);
    onChange(Array.from(next));
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of skills) {
      const key = s.category || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [skills]);

  const selectedCount = selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Skills
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-1">{selectedCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        <Command>
          <CommandInput placeholder="Search skills..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No skills found.</CommandEmpty>
            {grouped.map(([category, list]) => (
              <CommandGroup key={category} heading={category}>
                {list
                  .filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()))
                  .map(s => {
                    const checked = selected.includes(s.name);
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
      </PopoverContent>
    </Popover>
  );
};
