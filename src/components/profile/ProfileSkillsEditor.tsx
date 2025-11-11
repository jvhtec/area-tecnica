import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Skill = { id: string; name: string; category: string | null };
type ProfileSkill = { id: string; skill_id: string; name: string; category: string | null; proficiency: number | null; is_primary: boolean };

interface ProfileSkillsEditorProps {
  profileId: string;
}

export const ProfileSkillsEditor: React.FC<ProfileSkillsEditorProps> = ({ profileId }) => {
  const [allSkills, setAllSkills] = React.useState<Skill[]>([]);
  const [profileSkills, setProfileSkills] = React.useState<ProfileSkill[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addingOpen, setAddingOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [profileDepartment, setProfileDepartment] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [sres, psres, pres] = await Promise.all([
      supabase.from('skills').select('id,name,category').eq('active', true).order('category').order('name'),
      supabase.from('profile_skills')
        .select('id,skill_id,proficiency,is_primary,skills:skill_id(name,category)')
        .eq('profile_id', profileId)
        .order('is_primary', { ascending: false })
        .order('proficiency', { ascending: false }),
      supabase.from('profiles').select('department').eq('id', profileId).maybeSingle()
    ]);
    if (!sres.error) setAllSkills(sres.data || []);
    if (!psres.error) {
      const mapped: ProfileSkill[] = (psres.data || []).map((r: any) => ({
        id: r.id,
        skill_id: r.skill_id,
        name: r.skills?.name || '',
        category: r.skills?.category || null,
        proficiency: r.proficiency,
        is_primary: !!r.is_primary,
      }));
      setProfileSkills(mapped);
    }
    if (!pres.error) setProfileDepartment(pres.data?.department ?? null);
    setLoading(false);
  }, [profileId]);

  React.useEffect(() => { load(); }, [load]);

  const availableAll = allSkills.filter(s => !profileSkills.some(ps => ps.skill_id === s.id));
  const available = React.useMemo(() => {
    if ((profileDepartment || '').toLowerCase() === 'sound') {
      // Restrict to sound categories for sound profiles
      return availableAll.filter(s => (s.category || '').startsWith('sound'));
    }
    return availableAll;
  }, [availableAll, profileDepartment]);

  const addSkill = async (skill: Skill) => {
    const { data, error } = await supabase
      .from('profile_skills')
      .insert({ profile_id: profileId, skill_id: skill.id, proficiency: 3, is_primary: false })
      .select('id')
      .maybeSingle();
    if (!error) {
      setProfileSkills(prev => [...prev, { id: data!.id, skill_id: skill.id, name: skill.name, category: skill.category, proficiency: 3, is_primary: false }]);
    }
    setAddingOpen(false);
  };

  const updateSkill = async (ps: ProfileSkill, patch: Partial<ProfileSkill>) => {
    const { error } = await supabase
      .from('profile_skills')
      .update({
        proficiency: patch.proficiency ?? ps.proficiency,
        is_primary: patch.is_primary ?? ps.is_primary,
      })
      .eq('id', ps.id);
    if (!error) {
      setProfileSkills(prev => prev.map(x => x.id === ps.id ? { ...x, ...patch } : x));
    }
  };

  const removeSkill = async (ps: ProfileSkill) => {
    const { error } = await supabase.from('profile_skills').delete().eq('id', ps.id);
    if (!error) setProfileSkills(prev => prev.filter(x => x.id !== ps.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading skills…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {profileSkills.length === 0 && (
                <div className="text-sm text-muted-foreground">No skills yet. Add some below.</div>
              )}
              {profileSkills.map(ps => (
                <div key={ps.id} className="flex items-center gap-2 border rounded-md px-2 py-1">
                  <Badge variant={ps.is_primary ? 'default' : 'secondary'}>{ps.name}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Lvl</span>
                    <Slider
                      className="w-24"
                      min={0}
                      max={5}
                      step={1}
                      value={[Number(ps.proficiency ?? 0)]}
                      onValueChange={([v]) => updateSkill(ps, { proficiency: v })}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox checked={ps.is_primary} onCheckedChange={v => updateSkill(ps, { is_primary: !!v })} />
                    <span className="text-xs">Primary</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeSkill(ps)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Popover open={addingOpen} onOpenChange={setAddingOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Add skill
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-80" align="start">
                {addingOpen && (
                  <Command>
                    <CommandInput placeholder="Search skills…" value={query} onValueChange={setQuery} />
                    <CommandList>
                      <CommandEmpty>No skills.</CommandEmpty>
                      <CommandGroup heading="Available">
                        {available
                          .filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()))
                          .map(s => (
                            <CommandItem key={s.id} onSelect={() => addSkill(s)}>
                              <span>{s.name}</span>
                              {s.category && (
                                <Badge variant="outline" className="ml-auto text-xs">{s.category}</Badge>
                              )}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
