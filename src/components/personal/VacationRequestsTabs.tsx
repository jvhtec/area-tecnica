import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVacationRequests } from "@/hooks/useVacationRequests";
import { format } from "date-fns";
import { CalendarDays, CheckCircle, XCircle, Clock, Users, Download } from "lucide-react";
import { VacationRequestForm } from "./VacationRequestForm";
import { VacationRequestHistory } from "./VacationRequestHistory";
import type { VacationRequest } from "@/lib/vacation-requests";
import { downloadVacationRequestPDF } from "@/utils/vacationRequestPdfExport";
import { useIsMobile } from "@/hooks/use-mobile";
import { Theme } from "@/components/technician/types";

interface VacationRequestsTabsProps {
  userRole: 'house_tech' | 'management' | 'admin';
  onVacationRequestSubmit: (request: { startDate: string; endDate: string; reason: string }) => Promise<void>;
  isSubmitting: boolean;
  theme: Theme;
  isDark: boolean;
}

export const VacationRequestsTabs: React.FC<VacationRequestsTabsProps> = ({
  userRole,
  onVacationRequestSubmit,
  isSubmitting,
  theme,
  isDark
}) => {
  const isMobile = useIsMobile();
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const {
    userRequests,
    departmentRequests,
    isLoadingDepartmentRequests,
    approveRequests,
    rejectRequests,
    isApproving,
    isRejecting,
  } = useVacationRequests();

  const handleSelectRequest = (id: string, isChecked: boolean) => {
    setSelectedRequests(prev =>
      isChecked ? [...prev, id] : prev.filter(requestId => requestId !== id)
    );
  };

  const handleSelectAllRequests = (isChecked: boolean, requests: VacationRequest[]) => {
    if (isChecked) {
      setSelectedRequests(requests.map(req => req.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleApproveSelected = () => {
    if (selectedRequests.length === 0) return;
    approveRequests(selectedRequests);
    setSelectedRequests([]);
  };

  const handleRejectSelected = () => {
    if (selectedRequests.length === 0) return;
    rejectRequests({ requestIds: selectedRequests });
    setSelectedRequests([]);
  };

  const handleExportPDF = async (request: VacationRequest) => {
    try {
      const approverName = request.technicians
        ? `${request.technicians.first_name} ${request.technicians.last_name}`
        : undefined;

      await downloadVacationRequestPDF({ request, approverName });
    } catch (error) {
      console.error('Error exporting vacation request PDF:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Aprobada</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Inline component: Status badge with hover popover to show collisions
  const StatusWithConflicts: React.FC<{ request: VacationRequest }> = ({ request }) => {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [collisions, setCollisions] = React.useState<any[] | null>(null);

    const fetchCollisions = async () => {
      if (!request?.technician_id || !request?.start_date || !request?.end_date) return;
      setLoading(true);
      try {
        const startRange = new Date(`${request.start_date}T00:00:00`);
        const endRange = new Date(`${request.end_date}T23:59:59.999`);
        const { data, error } = await supabase
          .from('job_assignments')
          .select(`
            jobs!inner (
              id,
              title,
              start_time,
              end_time,
              locations(name)
            )
          `)
          .eq('technician_id', request.technician_id)
          .lte('jobs.start_time', endRange.toISOString())
          .gte('jobs.end_time', startRange.toISOString());

        if (error) throw error;
        // Normalize joined shape
        const rows = (data || []).map((row: any) => Array.isArray(row.jobs) ? row.jobs[0] : row.jobs).filter(Boolean);
        setCollisions(rows);
      } catch (e) {
        console.error('Error checking collisions for request', request.id, e);
        setCollisions([]);
      } finally {
        setLoading(false);
      }
    };

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (next && collisions === null) {
        fetchCollisions();
      }
    };

    // Prefetch collisions so badge can show a dot/count immediately
    React.useEffect(() => {
      // Only prefetch once
      if (collisions === null) {
        fetchCollisions();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const conflictsCount = collisions?.length ?? 0;

    return (
      <HoverCard open={open} onOpenChange={handleOpenChange}>
        <HoverCardTrigger asChild>
          <div className="relative inline-flex cursor-default" title={conflictsCount > 0 ? `${conflictsCount} conflictos` : undefined}>
            {getStatusBadge(request.status)}
            {collisions && conflictsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[3px] rounded-full bg-red-600 text-white text-[10px] leading-[16px] text-center font-semibold shadow">
                {conflictsCount}
              </span>
            )}
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-96" side="top" align="center">
          <div className="space-y-2">
            <div className="font-medium">Conflictos de asignación</div>
            {loading && <div className="text-sm text-muted-foreground">Comprobando…</div>}
            {!loading && collisions && collisions.length === 0 && (
              <div className="text-sm text-green-700">No se detectaron conflictos en este periodo.</div>
            )}
            {!loading && collisions && collisions.length > 0 && (
              <div className="max-h-64 overflow-auto space-y-2">
                {collisions.map((job: any) => {
                  const start = new Date(job.start_time);
                  const end = new Date(job.end_time);
                  const locName = job.locations && Array.isArray(job.locations) && job.locations[0]?.name ? ` • ${job.locations[0].name}` : '';
                  return (
                    <div key={job.id} className="rounded-md border p-2">
                      <div className="text-sm font-medium">
                        <a className="text-blue-600 hover:underline" href={`/jobs/view/${job.id}`} target="_blank" rel="noopener noreferrer">
                          {job.title || 'Trabajo'}
                        </a>
                        {locName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(start, 'PPpp')} – {format(end, 'PPpp')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!loading && collisions === null && (
              <div className="text-sm text-muted-foreground">Pasa el cursor para comprobar conflictos.</div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const renderDepartmentRequests = () => {
    if (isLoadingDepartmentRequests) {
      return (
        <Card className={theme.card}>
          <CardContent className="flex items-center justify-center py-8">
            <div className={theme.textMuted}>Cargando solicitudes del departamento...</div>
          </CardContent>
        </Card>
      );
    }

    const pendingDepartmentRequests = departmentRequests.filter(req => req.status === 'pending');

    return (
      <Card className={theme.card}>
        <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
          <CardTitle className={`flex items-center gap-2 ${theme.textMain}`}>
            <Users className="h-5 w-5" />
            Solicitudes de vacaciones del departamento
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {pendingDepartmentRequests.length === 0 ? (
            <div className={`text-center py-8 ${theme.textMuted}`}>
              No hay solicitudes pendientes en tu departamento.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4">
                <Button
                  onClick={handleApproveSelected}
                  disabled={selectedRequests.length === 0 || isApproving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Aprobar seleccionadas ({selectedRequests.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectSelected}
                  disabled={selectedRequests.length === 0 || isRejecting}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  Rechazar seleccionadas ({selectedRequests.length})
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? "border-slate-800 hover:bg-slate-900/50" : "border-slate-200"}>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedRequests.length === pendingDepartmentRequests.length && pendingDepartmentRequests.length > 0}
                          onCheckedChange={(checked) => handleSelectAllRequests(checked as boolean, pendingDepartmentRequests)}
                        />
                      </TableHead>
                      <TableHead className={theme.textMuted}>Técnico</TableHead>
                      <TableHead className={`hidden sm:table-cell ${theme.textMuted}`}>Departamento</TableHead>
                      <TableHead className={theme.textMuted}>Inicio</TableHead>
                      <TableHead className={theme.textMuted}>Fin</TableHead>
                      <TableHead className={`hidden lg:table-cell ${theme.textMuted}`}>Motivo</TableHead>
                      <TableHead className={`hidden md:table-cell ${theme.textMuted}`}>Solicitada</TableHead>
                      <TableHead className={theme.textMuted}>Estado</TableHead>
                      <TableHead className={`w-[80px] ${theme.textMuted}`}>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDepartmentRequests.map(request => (
                      <TableRow key={request.id} className={isDark ? "border-slate-800 hover:bg-slate-900/50" : "border-slate-200"}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRequests.includes(request.id)}
                            onCheckedChange={(isChecked: boolean) => handleSelectRequest(request.id, isChecked)}
                          />
                        </TableCell>
                        <TableCell className={theme.textMain}>
                          {request.technicians
                            ? `${request.technicians.first_name} ${request.technicians.last_name}`
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell className={`hidden sm:table-cell ${theme.textMain}`}>
                          {request.technicians?.department || 'N/A'}
                        </TableCell>
                        <TableCell className={theme.textMain}>{format(new Date(request.start_date), 'd MMM yyyy')}</TableCell>
                        <TableCell className={theme.textMain}>{format(new Date(request.end_date), 'd MMM yyyy')}</TableCell>
                        <TableCell className={`hidden lg:table-cell max-w-[200px] truncate ${theme.textMain}`}>{request.reason}</TableCell>
                        <TableCell className={`hidden md:table-cell ${theme.textMain}`}>{format(new Date(request.created_at), 'd MMM yyyy')}</TableCell>
                        <TableCell>
                          <StatusWithConflicts request={request as unknown as VacationRequest} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPDF(request)}
                            className={`h-8 w-8 p-0 ${theme.textMain}`}
                            title="Exportar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | null>(null);

  const toggleFilter = (status: 'pending' | 'approved' | 'rejected') => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  if (isMobile) {
    const rows = departmentRequests;

    const pending = rows.filter((r) => r.status === 'pending').length;
    const approved = rows.filter((r) => r.status === 'approved').length;
    const rejected = rows.filter((r) => r.status === 'rejected').length;

    return (
      <div className={`${theme.bg} rounded-[28px] p-4 space-y-4 shadow-inner border ${isDark ? "border-[#1f232e]" : "border-slate-200"} w-full max-w-full overflow-hidden`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-500">Vacaciones</p>
            <h3 className={`text-xl font-bold ${theme.textMain}`}>Gestión de solicitudes</h3>
            <p className={`text-xs ${theme.textMuted}`}>Envía, revisa y exporta desde el móvil.</p>
          </div>
        </div>

        <Tabs defaultValue="my-requests" className="w-full">
          <TabsList className={`w-full ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <TabsTrigger value="my-requests" className="flex-1 flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Mis solicitudes
            </TabsTrigger>
            {(userRole === 'management' || userRole === 'admin') && (
              <TabsTrigger value="department-requests" className="flex-1 flex items-center justify-center gap-2">
                <Users className="h-4 w-4" />
                Dpto.
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-requests" className="space-y-4 mt-4">
            <div className="space-y-3">
              <VacationRequestForm onSubmit={onVacationRequestSubmit} isSubmitting={isSubmitting} theme={theme} isDark={isDark} />
              <VacationRequestHistory theme={theme} isDark={isDark} source="user" />
            </div>
          </TabsContent>

          {(userRole === 'management' || userRole === 'admin') && (
            <TabsContent value="department-requests" className="space-y-4 mt-4">
              <Card className={`${theme.card} rounded-2xl`}>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      onClick={() => toggleFilter('pending')}
                      className={`rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors ${statusFilter === 'pending' || statusFilter === null
                        ? 'bg-amber-500/20 border-amber-500/50 ring-1 ring-amber-500/50'
                        : isDark ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                      <p className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Pendientes</p>
                      <p className={`text-lg font-bold ${theme.textMain}`}>{pending}</p>
                    </div>
                    <div
                      onClick={() => toggleFilter('approved')}
                      className={`rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors ${statusFilter === 'approved'
                        ? 'bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/50'
                        : isDark ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                      <p className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Aprobadas</p>
                      <p className={`text-lg font-bold text-emerald-500`}>{approved}</p>
                    </div>
                    <div
                      onClick={() => toggleFilter('rejected')}
                      className={`rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors ${statusFilter === 'rejected'
                        ? 'bg-red-500/20 border-red-500/50 ring-1 ring-red-500/50'
                        : isDark ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                      <p className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Rechazadas</p>
                      <p className={`text-lg font-bold text-red-500`}>{rejected}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {statusFilter ? (
                      <span>Filtrando por: <span className="font-semibold capitalize">{statusFilter === 'pending' ? 'Pendientes' : statusFilter === 'approved' ? 'Aprobadas' : 'Rechazadas'}</span></span>
                    ) : (
                      <span>Mostrando solicitudes pendientes de aprobación.</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {(!statusFilter || statusFilter === 'pending') ? (
                renderDepartmentRequests()
              ) : (
                <VacationRequestHistory theme={theme} isDark={isDark} filter={statusFilter} source="department" />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  }

  return (
    <Tabs defaultValue="my-requests" className="w-full overflow-x-auto">
      <TabsList className={`w-full ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
        <TabsTrigger value="my-requests" className="flex-1 flex items-center justify-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Mis solicitudes
        </TabsTrigger>
        {(userRole === 'management' || userRole === 'admin') && (
          <TabsTrigger value="department-requests" className="flex-1 flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            Solicitudes del departamento
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="my-requests" className="space-y-4">
        <VacationRequestForm
          onSubmit={onVacationRequestSubmit}
          isSubmitting={isSubmitting}
          theme={theme}
          isDark={isDark}
        />
        <VacationRequestHistory theme={theme} isDark={isDark} source="user" />
      </TabsContent>

      {(userRole === 'management' || userRole === 'admin') && (
        <TabsContent value="department-requests" className="space-y-4">
          <Card className={`${theme.card} rounded-2xl`}>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div
                  onClick={() => toggleFilter('pending')}
                  className={`rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors ${statusFilter === 'pending' || statusFilter === null
                    ? 'bg-amber-500/20 border-amber-500/50 ring-1 ring-amber-500/50'
                    : isDark ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  <p className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Pendientes</p>
                  <p className={`text-lg font-bold ${theme.textMain}`}>{departmentRequests.filter(r => r.status === 'pending').length}</p>
                </div>
                <div
                  onClick={() => toggleFilter('approved')}
                  className={`rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors ${statusFilter === 'approved'
                    ? 'bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/50'
                    : isDark ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  <p className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Aprobadas</p>
                  <p className={`text-lg font-bold text-emerald-500`}>{departmentRequests.filter(r => r.status === 'approved').length}</p>
                </div>
                <div
                  onClick={() => toggleFilter('rejected')}
                  className={`rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors ${statusFilter === 'rejected'
                    ? 'bg-red-500/20 border-red-500/50 ring-1 ring-red-500/50'
                    : isDark ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  <p className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Rechazadas</p>
                  <p className={`text-lg font-bold text-red-500`}>{departmentRequests.filter(r => r.status === 'rejected').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(!statusFilter || statusFilter === 'pending') ? (
            renderDepartmentRequests()
          ) : (
            <VacationRequestHistory theme={theme} isDark={isDark} filter={statusFilter} source="department" />
          )}
        </TabsContent>
      )}
    </Tabs>
  );
};
