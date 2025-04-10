import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";

interface Project {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  departments: string[];
  color: string;
}

export default function ProjectManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching projects:", error);
        throw error;
      }
      
      return data as Project[];
    },
  });
  
  const addProjectMutation = useMutation({
    mutationFn: async (newProject: Omit<Project, 'id'>) => {
      const { data, error } = await supabase
        .from("projects")
        .insert([newProject])
        .select()
        .single();
      
      if (error) {
        console.error("Error adding project:", error);
        throw error;
      }
      
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Success",
        description: "Project added successfully",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const updateProjectMutation = useMutation({
    mutationFn: async (updatedProject: Project) => {
      const { data, error } = await supabase
        .from("projects")
        .update(updatedProject)
        .eq("id", updatedProject.id)
        .select()
        .single();
      
      if (error) {
        console.error("Error updating project:", error);
        throw error;
      }
      
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      setIsDialogOpen(false);
      setEditProject(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);
      
      if (error) {
        console.error("Error deleting project:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      setDeleteProjectId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  useEffect(() => {
    const departmentParam = searchParams.get("departments");
    if (departmentParam) {
      try {
        const data = JSON.parse(departmentParam);
        if (Array.isArray(data)) {
          setSelectedDepartments(data);
        }
      } catch (error) {
        console.error("Error parsing departments from URL:", error);
      }
    }
  }, [searchParams]);
  
  const filteredProjects = projects?.filter((project) => {
    if (selectedDepartments.length === 0) {
      return true;
    }
    return project.departments.some((department) =>
      selectedDepartments.includes(department)
    );
  });
  
  const isEditable = userRole === "admin" || userRole === "management";
  
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartments([value]);
  };
  
  return (
    <div className="container mx-auto py-10">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Project Management</h1>
        {isEditable && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Button>
        )}
      </div>
      
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Filter Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="departments">Departments</Label>
          <Select
            onValueChange={handleDepartmentChange}
            defaultValue={selectedDepartments.length > 0 ? selectedDepartments[0] : undefined}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lights">Lights</SelectItem>
              <SelectItem value="sound">Sound</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="rigging">Rigging</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="power">Power</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted rounded-md p-4 h-32" />
          ))}
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>{project.title}</TableCell>
                <TableCell>{project.description}</TableCell>
                <TableCell>{format(new Date(project.start_date), "PPP")}</TableCell>
                <TableCell>{format(new Date(project.end_date), "PPP")}</TableCell>
                <TableCell>{project.status}</TableCell>
                <TableCell className="text-right">
                  {isEditable && (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditProject(project);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete
                              the project from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => setDeleteProjectId(project.id)}
                            >
                              Continue
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                {projects?.length} total projects
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No projects found.</div>
      )}
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => setIsDialogOpen(open)}>
        <DialogTrigger asChild>
          <Button>Add Project</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editProject ? "Edit Project" : "Add Project"}</DialogTitle>
            <DialogDescription>
              {editProject
                ? "Make changes to your project here. Click save when you're done."
                : "Create a new project here. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                type="text"
                id="title"
                defaultValue={editProject?.title}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                defaultValue={editProject?.description}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="departments" className="text-right mt-2">
                Departments
              </Label>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="lights" />
                  <Label htmlFor="lights">Lights</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="sound" />
                  <Label htmlFor="sound">Sound</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="video" />
                  <Label htmlFor="video">Video</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="rigging" />
                  <Label htmlFor="rigging">Rigging</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="staging" />
                  <Label htmlFor="staging">Staging</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="power" />
                  <Label htmlFor="power">Power</Label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start_date" className="text-right">
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    {selectedDate ? (
                      format(selectedDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      date > new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end_date" className="text-right">
                End Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    {selectedDate ? (
                      format(selectedDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      date > new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Input
                type="text"
                id="status"
                defaultValue={editProject?.status}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {deleteProjectId && (
        <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                project from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteProjectId(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  deleteProjectMutation.mutate(deleteProjectId);
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
