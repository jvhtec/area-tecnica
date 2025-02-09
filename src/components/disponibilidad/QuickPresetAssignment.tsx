
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useSessionManager } from "@/hooks/useSessionManager";
import { supabase } from "@/lib/supabase";
import { PresetWithItems } from "@/types/equipment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Loader2, Trash2 } from "lucide-react";

interface QuickPresetAssignmentProps {
  selectedDate: Date;
  onAssign?: () => void;
}

export function QuickPresetAssignment({ selectedDate, onAssign }: QuickPresetAssignmentProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's presets
  const { data: presets } = useQuery({
    queryKey: ['presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presets')
        .select(`
          *,
          items:preset_items(
            *,
            equipment(*)
          )
        `)
        .eq('user_id', session?.user?.id);
      
      if (error) throw error;
      return data as PresetWithItems[];
    },
    enabled: !!session?.user?.id
  });

  // Fetch current preset assignment
  const { data: currentAssignment } = useQuery({
    queryKey: ['preset-assignment', session?.user?.id, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select(`
          *,
          preset:presets (
            *,
            items:preset_items (
              *,
              equipment:equipment (*)
            )
          )
        `)
        .eq('user_id', session?.user?.id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!session?.user?.id && !!selectedDate
  });

  const assignPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      if (!session?.user?.id) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('day_preset_assignments')
        .upsert({
          date: format(selectedDate, 'yyyy-MM-dd'),
          preset_id: presetId,
          user_id: session.user.id
        }, {
          onConflict: 'date,user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['preset-assignment'] });
      toast({
        title: "Success",
        description: "Preset assigned successfully"
      });
      onAssign?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign preset"
      });
    }
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('day_preset_assignments')
        .delete()
        .eq('user_id', session.user.id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['preset-assignment'] });
      toast({
        title: "Success",
        description: "Preset assignment removed"
      });
      onAssign?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove preset assignment"
      });
    }
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="mr-2 h-4 w-4" />
          Assign Preset
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Assign Preset</h4>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, 'PP')}
            </p>
          </div>

          {currentAssignment && (
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentAssignment.preset.name}</p>
                  <p className="text-sm text-muted-foreground">Current Assignment</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAssignmentMutation.mutate()}
                  disabled={removeAssignmentMutation.isPending}
                >
                  {removeAssignmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {presets?.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => assignPresetMutation.mutate(preset.id)}
                disabled={
                  assignPresetMutation.isPending ||
                  currentAssignment?.preset_id === preset.id
                }
              >
                {assignPresetMutation.isPending &&
                assignPresetMutation.variables === preset.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
