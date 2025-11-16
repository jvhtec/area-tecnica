import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileImage, PenTool, FileDown, CheckCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { usePublicIncidentReports, EnrichedPublicIncidentReport } from "@/hooks/usePublicIncidentReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  triaged: "Revisado",
  dismissed: "Descartado",
};

const departmentLabels: Record<string, string> = {
  sound: "Sonido",
  lights: "Iluminación",
  video: "Video",
  logistics: "Logística",
};

export const PublicIncidentReportsTriage = () => {
  const { reports, isLoading, updateReport, assignJob, generatePdf, isGeneratingPdf } = usePublicIncidentReports();
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [jobSelection, setJobSelection] = useState<Record<string, string>>({});

  const { data: activeJobs = [] } = useQuery({
    queryKey: ["public-incident-active-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, start_time, end_time, status")
        .in("status", ["Confirmado", "Tentativa"])
        .order("start_time", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    }
  });

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const statusMatches = statusFilter === "all" || report.status === statusFilter;
      const deptMatches = departmentFilter === "all" || report.department?.toLowerCase() === departmentFilter;
      return statusMatches && deptMatches;
    });
  }, [reports, statusFilter, departmentFilter]);

  const handleStatusChange = async (report: EnrichedPublicIncidentReport, nextStatus: string) => {
    await updateReport({
      report,
      updates: { status: nextStatus },
      action: `status_${nextStatus}`,
      notes: notesDraft[report.id] ?? null,
    });
  };

  const handleNotesSave = async (report: EnrichedPublicIncidentReport) => {
    await updateReport({
      report,
      updates: { triage_notes: notesDraft[report.id] ?? null },
      action: "notes_updated",
      notes: notesDraft[report.id] ?? null,
    });
  };

  const handleAssignJob = async (report: EnrichedPublicIncidentReport) => {
    const selected = jobSelection[report.id];
    if (!selected) return;
    await assignJob({ report, jobId: selected });
  };

  const handleGeneratePdf = async (report: EnrichedPublicIncidentReport) => {
    await generatePdf({ report });
  };

  const handleDownloadPhoto = async (report: EnrichedPublicIncidentReport) => {
    if (!report.photo_path) return;
    const { data, error } = await supabase.storage
      .from("public-incident-photos")
      .createSignedUrl(report.photo_path, 60 * 5);

    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const renderSignature = (report: EnrichedPublicIncidentReport) => {
    if (!report.signature_data) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <PenTool className="h-4 w-4" /> Firma obligatoria
        </p>
        <div className="border rounded-md bg-background p-3">
          <img src={report.signature_data} alt="Firma digital" className="max-h-40 object-contain" />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando reportes públicos...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Reportes públicos de QR
              </CardTitle>
              <CardDescription>
                Revisa, asigna trabajos y convierte en PDF los reportes capturados desde los códigos QR públicos.
              </CardDescription>
            </div>
            <Badge variant="outline">{reports.length} totales</Badge>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder="Filtrar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="triaged">Revisados</SelectItem>
                <SelectItem value="dismissed">Descartados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {Object.entries(departmentLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No hay reportes que coincidan con los filtros seleccionados.
          </div>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} className="rounded-lg border p-4 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold">{report.equipment_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {departmentLabels[report.department?.toLowerCase() ?? ""] ?? report.department}
                    {report.barcode_number ? ` · Código: ${report.barcode_number}` : ""}
                    {report.stencil_number ? ` · Stencil: ${report.stencil_number}` : ""}
                  </p>
                </div>
                <Badge>{statusLabels[report.status] ?? report.status}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div>
                  <p className="font-medium">Reportado por</p>
                  <p className="text-muted-foreground">{report.reporter_name || "Anónimo"}</p>
                </div>
                <div>
                  <p className="font-medium">Contacto</p>
                  <p className="text-muted-foreground">{report.contact || "Sin datos"}</p>
                </div>
                <div>
                  <p className="font-medium">Fecha</p>
                  <p className="text-muted-foreground">
                    {format(new Date(report.created_at), "dd 'de' MMMM HH:mm", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Descripción de la incidencia</p>
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    {report.issue_description}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Acciones realizadas</p>
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    {report.actions_taken || "No se registraron acciones"}
                  </div>
                </div>
              </div>

              {renderSignature(report)}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Trabajo asociado</p>
                  <div className="flex flex-col gap-2">
                    <Select
                      value={jobSelection[report.id] ?? report.job_id ?? ""}
                      onValueChange={(value) => setJobSelection(prev => ({ ...prev, [report.id]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar trabajo" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeJobs.map(job => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title} ({format(new Date(job.start_time), "dd/MM", { locale: es })})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => handleAssignJob(report)} disabled={!jobSelection[report.id]}>
                      Vincular trabajo
                    </Button>
                    {report.job && (
                      <p className="text-xs text-muted-foreground">
                        Actual: {report.job.title}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Notas de triaje</p>
                  <Textarea
                    rows={3}
                    placeholder="Notas internas en español"
                    value={notesDraft[report.id] ?? report.triage_notes ?? ""}
                    onChange={(event) => setNotesDraft(prev => ({ ...prev, [report.id]: event.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleNotesSave(report)}>
                      Guardar notas
                    </Button>
                    {report.photo_path && (
                      <Button size="sm" variant="outline" onClick={() => handleDownloadPhoto(report)}>
                        <FileImage className="h-4 w-4 mr-2" /> Ver foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {report.triage_log && Array.isArray(report.triage_log) && report.triage_log.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Auditoría</p>
                  <div className="rounded-md border divide-y">
                    {(report.triage_log as any[]).map((entry, index) => (
                      <div key={index} className="text-xs p-2 flex justify-between">
                        <span className="font-medium">{entry.action}</span>
                        <span className="text-muted-foreground">{entry.at ? format(new Date(entry.at), "dd/MM HH:mm") : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleStatusChange(report, "triaged")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Marcar como revisado
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleStatusChange(report, "dismissed")}>
                  <PenTool className="h-4 w-4 mr-2" /> Descartar duplicado
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(report, "pending")}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reabrir
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleGeneratePdf(report)}
                  disabled={isGeneratingPdf || !report.job_id}
                >
                  <FileDown className="h-4 w-4 mr-2" /> Generar PDF
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
