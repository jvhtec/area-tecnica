import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Trash2, Edit, CheckCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type BugReport = {
  id: string;
  title: string;
  description: string;
  reproduction_steps: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  reporter_email: string;
  github_issue_url: string | null;
  github_issue_number: number | null;
  screenshot_url: string | null;
  console_logs: Array<{ type: string; message: string; timestamp: string }> | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
  app_version: string | null;
  environment_info: Record<string, unknown> | null;
};

type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  use_case: string | null;
  status: "pending" | "under_review" | "accepted" | "rejected" | "completed";
  reporter_email: string;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
};

const severityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const bugStatusColors = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
};

const featureStatusColors = {
  pending: "bg-gray-100 text-gray-800",
  under_review: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const [showFeatureDialog, setShowFeatureDialog] = useState(false);
  const [showDeleteBugDialog, setShowDeleteBugDialog] = useState(false);
  const [showDeleteFeatureDialog, setShowDeleteFeatureDialog] = useState(false);
  const [bugToDelete, setBugToDelete] = useState<string | null>(null);
  const [featureToDelete, setFeatureToDelete] = useState<string | null>(null);

  // Fetch bug reports (excluding heavy fields for list view)
  const { data: bugReports = [], isLoading: loadingBugs } = useQuery({
    queryKey: ["bug_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("id, title, severity, status, reporter_email, github_issue_url, github_issue_number, created_at, updated_at, resolved_at, resolved_by, admin_notes, description, reproduction_steps, app_version, environment_info")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BugReport[];
    },
  });

  // Fetch feature requests
  const { data: featureRequests = [], isLoading: loadingFeatures } = useQuery({
    queryKey: ["feature_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FeatureRequest[];
    },
  });

  // Fetch full bug report details when dialog opens (including heavy fields)
  const { data: fullBugDetails, isLoading: loadingFullBug } = useQuery({
    queryKey: ["bug_report", selectedBug?.id],
    queryFn: async () => {
      if (!selectedBug?.id) return null;
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .eq("id", selectedBug.id)
        .single();
      if (error) throw error;
      return data as BugReport;
    },
    enabled: !!selectedBug?.id,
  });

  // Reset admin notes to DB value when full bug details load (prevent stale edits)
  useEffect(() => {
    if (fullBugDetails && selectedBug && fullBugDetails.id === selectedBug.id) {
      setSelectedBug({ ...selectedBug, admin_notes: fullBugDetails.admin_notes });
    }
  }, [fullBugDetails?.id, fullBugDetails?.admin_notes, selectedBug?.id]);

  // Update bug report
  const updateBugMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BugReport> }) => {
      const { error } = await supabase.from("bug_reports").update(updates).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      // Snapshot the current state before mutation
      const previousBug = selectedBug;

      // Optimistically update the UI
      if (selectedBug && selectedBug.id === id) {
        setSelectedBug({ ...selectedBug, ...updates });
      }

      // Return context with previous state for potential rollback
      return { previousBug };
    },
    onError: (error, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousBug) {
        setSelectedBug(context.previousBug);
      }

      toast({
        title: "Error updating bug report",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch to ensure UI is in sync with server
      queryClient.invalidateQueries({ queryKey: ["bug_reports"] });
    },
    onSuccess: () => {
      toast({ title: "Bug report updated successfully" });
    },
  });

  // Update feature request
  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeatureRequest> }) => {
      const { error } = await supabase.from("feature_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["feature_requests"] });

      // Snapshot the current state before mutation
      const previousFeature = selectedFeature;

      // Optimistically update the UI
      if (selectedFeature && selectedFeature.id === id) {
        setSelectedFeature({ ...selectedFeature, ...updates });
      }

      // Return context with previous state for potential rollback
      return { previousFeature };
    },
    onError: (error, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousFeature) {
        setSelectedFeature(context.previousFeature);
      }

      toast({
        title: "Error updating feature request",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch to ensure UI is in sync with server
      queryClient.invalidateQueries({ queryKey: ["feature_requests"] });
    },
    onSuccess: () => {
      toast({ title: "Feature request updated successfully" });
    },
  });

  // Delete bug report
  const deleteBugMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bug_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bug_reports"] });
      toast({ title: "Bug report deleted successfully" });
      setShowBugDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting bug report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete feature request
  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feature_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature_requests"] });
      toast({ title: "Feature request deleted successfully" });
      setShowFeatureDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting feature request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send resolution email
  const sendResolutionEmailMutation = useMutation({
    mutationFn: async (bugReportId: string) => {
      const { error } = await supabase.functions.invoke("send-bug-resolution-email", {
        body: { bugReportId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Resolution email sent successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error sending email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResolveBug = async (bug: BugReport) => {
    const previousStatus = bug.status;
    const previousResolvedAt = bug.resolved_at;

    try {
      // Mark bug as resolved first (backend requires this before sending email)
      await updateBugMutation.mutateAsync({
        id: bug.id,
        updates: { status: "resolved", resolved_at: new Date().toISOString() },
      });

      // Then send the resolution email
      await sendResolutionEmailMutation.mutateAsync(bug.id);

      setShowBugDialog(false);
    } catch (error) {
      // If email send fails, revert the status back to previous state
      console.error("Failed to resolve bug:", error);

      // Attempt to revert status
      try {
        await updateBugMutation.mutateAsync({
          id: bug.id,
          updates: { status: previousStatus, resolved_at: previousResolvedAt },
        });
        toast({
          title: "Failed to send resolution email",
          description: "Bug status has been reverted. Please try again.",
          variant: "destructive",
        });
      } catch (revertError) {
        console.error("Failed to revert bug status:", revertError);
        toast({
          title: "Critical error",
          description: "Bug marked as resolved but email failed to send. Please manually retry.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Panel de gestión</CardTitle>
          <CardDescription>
            Administra informes de errores y solicitudes de funciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bugs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bugs">
                Informes de errores ({bugReports.length})
              </TabsTrigger>
              <TabsTrigger value="features">
                Solicitudes de funciones ({featureRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bugs" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingBugs ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : bugReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          No hay informes de errores
                        </TableCell>
                      </TableRow>
                    ) : (
                      bugReports.map((bug) => (
                        <TableRow key={bug.id}>
                          <TableCell className="font-medium">{bug.title}</TableCell>
                          <TableCell>
                            <Badge className={severityColors[bug.severity]}>
                              {bug.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={bugStatusColors[bug.status]}>
                              {bug.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(bug.created_at), "PPP", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedBug(bug);
                                setShowBugDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingFeatures ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : featureRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          No hay solicitudes de funciones
                        </TableCell>
                      </TableRow>
                    ) : (
                      featureRequests.map((feature) => (
                        <TableRow key={feature.id}>
                          <TableCell className="font-medium">{feature.title}</TableCell>
                          <TableCell>
                            <Badge className={featureStatusColors[feature.status]}>
                              {feature.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(feature.created_at), "PPP", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedFeature(feature);
                                setShowFeatureDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bug Report Detail Dialog */}
      <Dialog open={showBugDialog} onOpenChange={setShowBugDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBug?.title}</DialogTitle>
            <DialogDescription>ID: {selectedBug?.id}</DialogDescription>
          </DialogHeader>

          {selectedBug && (
            <div className="space-y-6">
              {loadingFullBug ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Cargando detalles...</div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Severidad</Label>
                      <Select
                        value={selectedBug.severity}
                        onValueChange={(value) => {
                          updateBugMutation.mutate({
                            id: selectedBug.id,
                            updates: { severity: value as BugReport["severity"] },
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Estado</Label>
                      <Select
                        value={selectedBug.status}
                        onValueChange={(value) => {
                          updateBugMutation.mutate({
                            id: selectedBug.id,
                            updates: { status: value as BugReport["status"] },
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Abierto</SelectItem>
                          <SelectItem value="in_progress">En progreso</SelectItem>
                          <SelectItem value="resolved">Resuelto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Descripción</Label>
                    <p className="mt-2 text-sm">{selectedBug.description}</p>
                  </div>

                  {selectedBug.reproduction_steps && (
                    <div>
                      <Label>Pasos para reproducir</Label>
                      <p className="mt-2 text-sm whitespace-pre-wrap">
                        {selectedBug.reproduction_steps}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Correo del reportero</Label>
                    <p className="mt-2 text-sm">{selectedBug.reporter_email}</p>
                  </div>

                  {selectedBug.github_issue_url && (
                    <div>
                      <Label>GitHub Issue</Label>
                      <a
                        href={selectedBug.github_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center text-sm text-blue-600 hover:underline"
                      >
                        #{selectedBug.github_issue_number} <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {fullBugDetails?.screenshot_url && (
                    <div>
                      <Label>Captura de pantalla</Label>
                      <img
                        src={fullBugDetails.screenshot_url}
                        alt="Screenshot"
                        className="mt-2 rounded-md border max-w-full h-auto"
                      />
                    </div>
                  )}

                  {fullBugDetails?.console_logs && fullBugDetails.console_logs.length > 0 && (
                    <div>
                      <Label>Registros de consola</Label>
                      <div className="mt-2 rounded-md bg-gray-100 p-4 max-h-60 overflow-y-auto">
                        <pre className="text-xs">
                          {fullBugDetails.console_logs
                            .map(
                              (log) =>
                                `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
                            )
                            .join("\n")}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Notas del administrador</Label>
                    <Textarea
                      value={selectedBug.admin_notes || ""}
                      onChange={(e) => setSelectedBug({ ...selectedBug, admin_notes: e.target.value })}
                      placeholder="Añadir notas internas..."
                      className="mt-2"
                    />
                  </div>
                </>
              )}

              <DialogFooter className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setBugToDelete(selectedBug.id);
                    setShowDeleteBugDialog(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    updateBugMutation.mutate({
                      id: selectedBug.id,
                      updates: { admin_notes: selectedBug.admin_notes },
                    });
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Guardar notas
                </Button>
                {selectedBug.status !== "resolved" && (
                  <Button onClick={() => handleResolveBug(selectedBug)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como resuelto
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Feature Request Detail Dialog */}
      <Dialog open={showFeatureDialog} onOpenChange={setShowFeatureDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedFeature?.title}</DialogTitle>
            <DialogDescription>ID: {selectedFeature?.id}</DialogDescription>
          </DialogHeader>

          {selectedFeature && (
            <div className="space-y-6">
              <div>
                <Label>Estado</Label>
                <Select
                  value={selectedFeature.status}
                  onValueChange={(value) => {
                    updateFeatureMutation.mutate({
                      id: selectedFeature.id,
                      updates: { status: value as FeatureRequest["status"] },
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="under_review">En revisión</SelectItem>
                    <SelectItem value="accepted">Aceptada</SelectItem>
                    <SelectItem value="rejected">Rechazada</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Descripción</Label>
                <p className="mt-2 text-sm">{selectedFeature.description}</p>
              </div>

              {selectedFeature.use_case && (
                <div>
                  <Label>Caso de uso</Label>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{selectedFeature.use_case}</p>
                </div>
              )}

              <div>
                <Label>Correo del reportero</Label>
                <p className="mt-2 text-sm">{selectedFeature.reporter_email}</p>
              </div>

              <div>
                <Label>Notas del administrador</Label>
                <Textarea
                  value={selectedFeature.admin_notes || ""}
                  onChange={(e) =>
                    setSelectedFeature({ ...selectedFeature, admin_notes: e.target.value })
                  }
                  placeholder="Añadir notas internas..."
                  className="mt-2"
                />
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setFeatureToDelete(selectedFeature.id);
                    setShowDeleteFeatureDialog(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
                <Button
                  onClick={() => {
                    updateFeatureMutation.mutate({
                      id: selectedFeature.id,
                      updates: { admin_notes: selectedFeature.admin_notes },
                    });
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Guardar notas
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Bug Confirmation Dialog */}
      <AlertDialog open={showDeleteBugDialog} onOpenChange={setShowDeleteBugDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente este reporte de error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bugToDelete) {
                  deleteBugMutation.mutate(bugToDelete);
                  setShowDeleteBugDialog(false);
                  setShowBugDialog(false);
                  setBugToDelete(null);
                }
              }}
              disabled={deleteBugMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBugMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Feature Request Confirmation Dialog */}
      <AlertDialog open={showDeleteFeatureDialog} onOpenChange={setShowDeleteFeatureDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente esta solicitud de función.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (featureToDelete) {
                  deleteFeatureMutation.mutate(featureToDelete);
                  setShowDeleteFeatureDialog(false);
                  setShowFeatureDialog(false);
                  setFeatureToDelete(null);
                }
              }}
              disabled={deleteFeatureMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFeatureMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
