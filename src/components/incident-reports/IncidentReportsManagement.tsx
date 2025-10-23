import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Download, Trash2, Calendar, Filter, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useIncidentReports } from "@/hooks/useIncidentReports";
import { IncidentReportsNotificationBadge } from "./IncidentReportsNotificationBadge";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

export const IncidentReportsManagement = () => {
  const isMobile = useIsMobile();
  const { reports, isLoading, deleteReport, isDeleting, downloadReport } = useIncidentReports();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<'uploaded_at' | 'file_name' | 'job_title'>('uploaded_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [userRole, setUserRole] = useState<string>('');

  // Get user role for notifications
  React.useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUserRole(profile.role);
        }
      }
    };
    getUserRole();
  }, []);

  const filteredReports = reports
    .filter(report => {
      const searchLower = searchTerm.toLowerCase();
      return (
        report.file_name.toLowerCase().includes(searchLower) ||
        report.job?.title.toLowerCase().includes(searchLower) ||
        (report.uploaded_by_profile?.first_name?.toLowerCase().includes(searchLower)) ||
        (report.uploaded_by_profile?.last_name?.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando reportes de incidencias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Incident Reports Management
              </CardTitle>
              <CardDescription>
                View, download, and manage incident reports from all jobs
              </CardDescription>
            </div>
            <IncidentReportsNotificationBadge userRole={userRole} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre de archivo, trabajo o técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Fechas
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron reportes de incidencias</p>
                {searchTerm && <p className="text-sm">Intenta con otros términos de búsqueda</p>}
              </div>
            ) : (
              filteredReports.map((report) => (
                <Card key={report.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" />
                          <h3 className="font-medium">{report.file_name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            PDF
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <strong>Trabajo:</strong> {report.job?.title || "N/A"}
                          </div>
                          <div>
                            <strong>Técnico:</strong> {
                              report.uploaded_by_profile 
                                ? `${report.uploaded_by_profile.first_name} ${report.uploaded_by_profile.last_name}`
                                : "N/A"
                            }
                          </div>
                          <div>
                            <strong>Fecha:</strong> {
                              format(new Date(report.uploaded_at), "dd/MM/yyyy HH:mm", { locale: es })
                            }
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Tamaño: {formatFileSize(report.file_size)}</span>
                          {report.job && (
                            <span>
                              Trabajo: {format(new Date(report.job.start_time), "dd/MM/yyyy", { locale: es })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadReport(report)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar reporte?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. El reporte "{report.file_name}" será eliminado permanentemente del sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteReport(report.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {filteredReports.length > 0 && (
            <div className="mt-6 text-sm text-muted-foreground text-center">
              Mostrando {filteredReports.length} de {reports.length} reportes
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};