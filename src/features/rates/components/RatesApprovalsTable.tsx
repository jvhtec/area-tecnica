import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { useRatesApprovals } from '@/features/rates/hooks/useRatesApprovals';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateTourRatesSummaryPDF } from '@/utils/rates-pdf-export';
import { buildTourRatesExportPayload } from '@/services/tourRatesExport';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobPayoutTotalsPanel } from '@/components/jobs/JobPayoutTotalsPanel';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import type { RatesApprovalRow } from '@/services/ratesService';

interface RatesApprovalsTableProps {
  onManageTour: (tourId: string) => void;
}

export function RatesApprovalsTable({ onManageTour }: RatesApprovalsTableProps) {
  const { data: rows = [], isLoading } = useRatesApprovals();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all'|'tour'|'job'>('all');
  const [approvalFilter, setApprovalFilter] = React.useState<'all'|'pending'|'approved'>('all');
  const [page, setPage] = React.useState(1);
  const [selectedJob, setSelectedJob] = React.useState<RatesApprovalRow | null>(null);
  const PAGE_SIZE = 10;
  const { userRole } = useOptimizedAuth();
  const isManagementUser = React.useMemo(() => ['management', 'admin'].includes(userRole || ''), [userRole]);

  const handleOpenJob = React.useCallback((row: RatesApprovalRow) => {
    setSelectedJob(row);
  }, []);

  const resetSelectedJob = React.useCallback(() => setSelectedJob(null), []);

  const getJobTypeLabel = React.useCallback((jobType?: string | null) => {
    const normalized = (jobType || '').toLowerCase();
    if (normalized === 'festival') return 'Festival';
    if (normalized === 'single') return 'Trabajo';
    if (normalized === 'tour') return 'Gira';
    if (!jobType) return 'Trabajo';
    return jobType;
  }, []);

  const filtered = React.useMemo(() => {
    let list = rows;
    // Hard exclude dryhire from rates UI (defense-in-depth)
    list = list.filter(r => (r.jobType || '').toLowerCase() !== 'dryhire');
    if (typeFilter !== 'all') list = list.filter(r => r.entityType === typeFilter);
    if (approvalFilter !== 'all') list = list.filter(r => (approvalFilter === 'approved') === Boolean(r.ratesApproved));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(s));
    }
    return list;
  }, [rows, typeFilter, approvalFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Jump to the page nearest to today's date on load/when filters change
  React.useEffect(() => {
    const today = new Date();
    let idx = filtered.findIndex(r => r.startDate && new Date(r.startDate) >= today);
    if (idx === -1) idx = filtered.length - 1; // fallback to last (all past)
    const newPage = Math.max(1, Math.min(totalPages, Math.floor(idx / PAGE_SIZE) + 1));
    setPage(newPage);
  }, [filtered, totalPages]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Aprobaciones de tarifas</CardTitle>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="w-full md:w-64">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar trabajos o giras" />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="tour">Giras</SelectItem>
                <SelectItem value="job">Trabajos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v as any)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Aprobación" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay elementos que coincidan con tus filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Trabajos</TableHead>
                  <TableHead className="text-right">Asignaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium leading-tight">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.endDate ? `Termina ${format(new Date(row.endDate), 'PPP', { locale: es })}` : 'Fecha fin por definir'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.entityType === 'tour' ? (
                        <Badge variant="outline">Gira</Badge>
                      ) : (
                        <Badge variant="secondary">{getJobTypeLabel(row.jobType)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.startDate ? format(new Date(row.startDate), 'PPP', { locale: es }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.jobCount}</TableCell>
                    <TableCell className="text-right">{row.assignmentCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.pendingIssues.length === 0 ? (
                          <Badge variant="outline">Listo</Badge>
                        ) : (
                          row.pendingIssues.map((issue) => {
                            const isCritical = issue === 'Approval required' || issue === 'Timesheets rejected' || issue === 'Extras rejected';
                            const translated = issue === 'Approval required' ? 'Se requiere aprobación'
                              : issue === 'No tour jobs' ? 'Sin trabajos de gira'
                              : issue === 'No assignments' ? 'Sin asignaciones'
                              : issue === 'No timesheets' ? 'Sin partes'
                              : issue === 'Timesheets pending' ? 'Partes pendientes'
                              : issue === 'Timesheets rejected' ? 'Partes rechazados'
                              : issue === 'Extras pending' ? 'Extras pendientes'
                              : issue === 'Extras rejected' ? 'Extras rechazados'
                              : issue;
                            return (
                              <Badge key={issue} variant={isCritical ? 'destructive' : 'secondary'}>
                                {translated}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.entityType === 'tour' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const { data: tourJobs, error } = await supabase
                                  .from('jobs')
                                  .select('id, title, start_time, end_time, job_type')
                                  .eq('tour_id', row.id)
                                  .order('start_time', { ascending: true });

                                if (error) throw error;

                                const eligibleTourJobs = (tourJobs || []).filter((job) => (job.job_type ?? '').toLowerCase() !== 'dryhire');

                                if (eligibleTourJobs.length === 0) {
                                  toast.error('No hay trabajos de gira para exportar');
                                  return;
                                }

                                const jobsForExport = eligibleTourJobs.map((job) => ({
                                  id: job.id,
                                  title: job.title,
                                  start_time: job.start_time,
                                  end_time: job.end_time ?? null,
                                  job_type: job.job_type ?? null,
                                }));

                                const { jobsWithQuotes, profiles } = await buildTourRatesExportPayload(
                                  row.id,
                                  jobsForExport
                                );

                                if (!jobsWithQuotes.length) {
                                  toast.error('No hay asignaciones con tarifas para exportar.');
                                  return;
                                }

                                await generateTourRatesSummaryPDF(
                                  row.name,
                                  jobsWithQuotes,
                                  profiles
                                );
                                toast.success('PDF de gira generado');
                              } catch (err) {
                                console.error('Error exporting tour summary', err);
                                toast.error('No se pudo generar el PDF de la gira');
                              }
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => onManageTour(row.id)}>
                            Gestionar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {isManagementUser && (
                            <Button size="sm" onClick={() => handleOpenJob(row)}>
                              Ver totales
                            </Button>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/management/rates?tab=timesheets&jobId=${row.id}`}>Revisar partes</Link>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-3 mt-3">
                <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" disabled={page<=1} onClick={() => setPage(p=>Math.max(1,p-1))}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page>=totalPages} onClick={() => setPage(p=>Math.min(totalPages,p+1))}>Siguiente</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <Dialog open={Boolean(selectedJob)} onOpenChange={(open) => {
        if (!open) {
          resetSelectedJob();
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Totales de pagos del trabajo</DialogTitle>
            <DialogDescription>
              Consulta los totales aprobados, LPO y exporta el PDF con el mismo formato que las giras.
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-base leading-tight">{selectedJob.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedJob.startDate
                        ? `Comienza ${format(new Date(selectedJob.startDate), 'PPP', { locale: es })}`
                        : 'Fecha de inicio por definir'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{getJobTypeLabel(selectedJob.jobType)}</Badge>
                    <Badge variant={selectedJob.ratesApproved ? 'outline' : 'destructive'}>
                      {selectedJob.ratesApproved ? 'Tarifas aprobadas' : 'Aprobación pendiente'}
                    </Badge>
                  </div>
                </div>
              </div>
              <JobPayoutTotalsPanel jobId={selectedJob.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
