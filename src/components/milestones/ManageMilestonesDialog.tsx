import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Department } from "@/types/department";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface ManageMilestonesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
}

export const ManageMilestonesDialog = ({ open, onOpenChange, jobId }: ManageMilestonesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);

  const { data: definitions } = useQuery({
    queryKey: ["milestone-definitions"],
    queryFn: async () => {
      console.log("Fetching milestone definitions...");
      const { data, error } = await supabase
        .from("milestone_definitions")
        .select("*")
        .order("priority", { ascending: true });

      if (error) {
        console.error("Error fetching milestone definitions:", error);
        throw error;
      }
      console.log("Fetched milestone definitions:", data);
      return data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("Starting deletion process for milestone definition:", id);
      
      // First, delete any job_milestones that reference this definition
      const { error: milestonesError } = await supabase
        .from("job_milestones")
        .delete()
        .eq("definition_id", id);

      if (milestonesError) {
        console.error("Error deleting related job milestones:", milestonesError);
        throw milestonesError;
      }

      // Then delete the milestone definition
      const { error: definitionError } = await supabase
        .from("milestone_definitions")
        .delete()
        .eq("id", id);

      if (definitionError) {
        console.error("Error deleting milestone definition:", definitionError);
        throw definitionError;
      }
      
      console.log("Successfully deleted milestone definition and related records");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-definitions"] });
      toast({
        title: "Success",
        description: "Milestone definition deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: "Failed to delete milestone definition",
        variant: "destructive",
      });
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (milestone: Omit<any, 'id'>) => {
      console.log("Creating milestone:", milestone);
      const { data, error } = await supabase
        .from("milestone_definitions")
        .insert([{ ...milestone, department: selectedDepartments }])
        .select()
        .single();

      if (error) {
        console.error("Error creating milestone:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-definitions"] });
      toast({
        title: "Success",
        description: "Milestone definition created successfully",
      });
      setIsEditing(false);
      setEditingMilestone(null);
      setSelectedDepartments([]);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (milestone: any) => {
      console.log("Updating milestone:", milestone);
      const { data, error } = await supabase
        .from("milestone_definitions")
        .update({ ...milestone, department: selectedDepartments })
        .eq("id", milestone.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating milestone:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-definitions"] });
      toast({
        title: "Success",
        description: "Milestone definition updated successfully",
      });
      setIsEditing(false);
      setEditingMilestone(null);
      setSelectedDepartments([]);
    },
  });

  // Save as Default mutation
  const saveAsDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID provided");
      console.log("Saving milestones as default for job:", jobId);
      
      // First, get all milestones for the current job
      const { data: jobMilestones, error: fetchError } = await supabase
        .from("job_milestones")
        .select(`
          *,
          definition:milestone_definitions(*)
        `)
        .eq("job_id", jobId);

      if (fetchError) {
        console.error("Error fetching job milestones:", fetchError);
        throw fetchError;
      }
      if (!jobMilestones?.length) throw new Error("No milestones found for this job");

      // Create new milestone definitions from the job's milestones
      const updates = jobMilestones.map(milestone => ({
        name: milestone.name,
        default_offset: milestone.offset_days,
        department: milestone.definition?.department || [],
        category: milestone.definition?.category || 'planning',
        priority: milestone.definition?.priority || 1,
        description: milestone.definition?.description || ''
      }));

      console.log("Creating new milestone definitions:", updates);
      
      // Delete existing milestone definitions first - FIXED THIS PART
      const { error: deleteError } = await supabase
        .from("milestone_definitions")
        .delete();

      if (deleteError) {
        console.error("Error deleting existing milestones:", deleteError);
        throw deleteError;
      }

      // Insert new milestone definitions
      const { error: insertError } = await supabase
        .from("milestone_definitions")
        .insert(updates);

      if (insertError) {
        console.error("Error saving default milestones:", insertError);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-definitions"] });
      toast({
        title: "Success",
        description: "Current milestones saved as default templates",
      });
    },
  });

  const handleSave = () => {
    if (!editingMilestone) return;

    if (editingMilestone.id) {
      updateMutation.mutate(editingMilestone);
    } else {
      const { id, ...newMilestone } = editingMilestone;
      createMutation.mutate(newMilestone);
    }
  };

  const availableDepartments: Department[] = ["sound", "lights", "video", "logistics", "production", "administrative"];

  const handleDepartmentToggle = (dept: Department) => {
    setSelectedDepartments(prev => 
      prev.includes(dept) 
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Manage Milestone Definitions</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-6">
            <div className="flex justify-between items-center">
              <Button
                onClick={() => {
                  setEditingMilestone({
                    id: '',
                    name: '',
                    default_offset: 0,
                    category: 'planning',
                    priority: 1,
                    description: '',
                  });
                  setSelectedDepartments([]);
                  setIsEditing(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Milestone
              </Button>

              {jobId && (
                <Button 
                  variant="outline"
                  onClick={() => saveAsDefaultMutation.mutate()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Default
                </Button>
              )}
            </div>

            {isEditing && editingMilestone && (
              <div className="space-y-4 p-4 border rounded-lg">
                <Input
                  placeholder="Milestone name"
                  value={editingMilestone.name}
                  onChange={(e) =>
                    setEditingMilestone({ ...editingMilestone, name: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Default offset (days)"
                  value={editingMilestone.default_offset}
                  onChange={(e) =>
                    setEditingMilestone({
                      ...editingMilestone,
                      default_offset: parseInt(e.target.value),
                    })
                  }
                />
                <div className="space-y-2">
                  <Label>Departments</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableDepartments.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dept-${dept}`}
                          checked={selectedDepartments.includes(dept)}
                          onCheckedChange={() => handleDepartmentToggle(dept)}
                        />
                        <Label htmlFor={`dept-${dept}`}>
                          {dept.charAt(0).toUpperCase() + dept.slice(1)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Select
                  value={editingMilestone.category}
                  onValueChange={(value: any) =>
                    setEditingMilestone({
                      ...editingMilestone,
                      category: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="administrative">Administrative</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Priority"
                  value={editingMilestone.priority}
                  onChange={(e) =>
                    setEditingMilestone({
                      ...editingMilestone,
                      priority: parseInt(e.target.value),
                    })
                  }
                />
                <Input
                  placeholder="Description"
                  value={editingMilestone.description || ''}
                  onChange={(e) =>
                    setEditingMilestone({
                      ...editingMilestone,
                      description: e.target.value,
                    })
                  }
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingMilestone(null);
                      setSelectedDepartments([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save</Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Offset Days</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions?.map((definition) => (
                  <TableRow key={definition.id}>
                    <TableCell>{definition.name}</TableCell>
                    <TableCell>{definition.department?.join(', ') || 'All'}</TableCell>
                    <TableCell>{definition.category}</TableCell>
                    <TableCell>{definition.default_offset}</TableCell>
                    <TableCell>{definition.priority}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingMilestone(definition);
                            setSelectedDepartments(definition.department || []);
                            setIsEditing(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(definition.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
