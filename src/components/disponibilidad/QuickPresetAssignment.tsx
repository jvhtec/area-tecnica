
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { PresetWithItems, mapPresetWithItemsRow } from "@/types/equipment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { Calendar, Loader2, Trash2 } from "lucide-react";
import { useDepartment } from '@/contexts/DepartmentContext';

interface QuickPresetAssignmentProps {
  selectedDate: Date;
  onAssign?: () => void;
  className?: string;
}

export function QuickPresetAssignment({ selectedDate, onAssign, className }: QuickPresetAssignmentProps) {
  const { department } = useDepartment();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Validate selectedDate
  const isValidDate = selectedDate && isValid(selectedDate);

  // Fetch presets with their items
  const { data: presets = [] } = useQuery({
    queryKey: ['presets', department],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from('presets')
        .select(`
          *,
          items:preset_items (
            *,
            equipment:equipment (*)
          )
        `)
        .eq('department', department)
        .order('name');
      
      if (error) throw error;
      return (data || []).map(mapPresetWithItemsRow);
    },
    enabled: !!session?.user?.id
  });

  // Fetch current assignments
  const { data: currentAssignments = [] } = useQuery({
    queryKey: ['preset-assignments', department, selectedDate],
    queryFn: async () => {
      if (!isValidDate) return [];

      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select('*, preset:presets!inner(name, department)')
        .eq('preset.department', department)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .order('order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!session?.user?.id && isValidDate
  });

  const assignPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      if (!session?.user?.id) throw new Error('Must be logged in');
      if (!isValidDate) throw new Error('Invalid date selected');

      // Get the next order number
      const maxOrder = currentAssignments?.reduce((max, assignment) => 
        Math.max(max, assignment.order || 0), -1) || -1;

      const { error } = await supabase
        .from('day_preset_assignments')
        .insert({
          date: format(selectedDate, 'yyyy-MM-dd'),
          preset_id: presetId,
          user_id: session.user.id,
          order: maxOrder + 1
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
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
    mutationFn: async (assignmentId: string) => {
      if (!session?.user?.id) throw new Error('Must be logged in');
      if (!isValidDate) throw new Error('Invalid date selected');

      const { error } = await supabase
        .from('day_preset_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
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

  if (!isValidDate) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
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

          {currentAssignments && currentAssignments.length > 0 && (
            <Card className="p-3">
              <div className="space-y-2">
                <p className="font-medium">Current Assignments</p>
                {currentAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between">
                    <span>{assignment.preset.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                      disabled={removeAssignmentMutation.isPending}
                    >
                      {removeAssignmentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => assignPresetMutation.mutate(preset.id)}
                disabled={assignPresetMutation.isPending}
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
