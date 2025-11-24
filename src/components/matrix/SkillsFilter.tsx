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
  department?: string;
}

const LIGHTS_PRESET_SKILLS: Skill[] = [
  { id: 'lights-ma2', name: 'Operador (MA2)', category: 'lights' },
  { id: 'lights-ma3', name: 'Operador (MA3)', category: 'lights' },
  { id: 'lights-hog', name: 'Operador (HOG)', category: 'lights' },
  { id: 'lights-avo', name: 'Operador (AVO)', category: 'lights' },
  { id: 'lights-dim', name: 'Dimmer', category: 'lights' },
  { id: 'lights-rig', name: 'Rigging', category: 'lights' },
  { id: 'lights-mont', name: 'Montador', category: 'lights' },
];
const SOUND_EXTRA_SKILLS: Skill[] = [
  { id: 'sound-height', name: 'Trabajo en altura', category: 'sound' },
];

export const SkillsFilter: React.FC<SkillsFilterProps> = ({ selected, onChange, department }) => {
  const [open, setOpen] = React.useState(false);
  const [skills, setSkills] = React.useState<Skill[]>([]);

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
        return;
      }

      const dept = (department || '').toLowerCase();
      const base = (data || []).filter((s) => !!s?.name);
      if (dept === 'lights') {
        // For lights, present the curated set only
        setSkills(LIGHTS_PRESET_SKILLS);
        return;
      }

      if (dept === 'sound') {
        const filtered = base.filter((s) => (s.category || '').toLowerCase().startsWith('sound'));
        const merged = [...filtered];
        SOUND_EXTRA_SKILLS.forEach((extra) => {
          if (!merged.some((s) => s.name.toLowerCase() === extra.name.toLowerCase())) {
            merged.push(extra);
          }
        });
        setSkills(merged);
        return;
      }

      setSkills(base);
    })();
    return () => { mounted = false };
  }, [department]);

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
          Habilidades
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-1">{selectedCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        {open && (
          <Command>
            <CommandList>
              <CommandEmpty>No se encontraron habilidades.</CommandEmpty>
              {grouped.map(([category, list]) => (
                <CommandGroup key={category} heading={category}>
                  {list.map(s => {
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
        )}
      </PopoverContent>
    </Popover>
  );
};
