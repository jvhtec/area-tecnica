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

interface RatesApprovalsTableProps {
  onManageTour: (tourId: string) => void;
}

export function RatesApprovalsTable({ onManageTour }: RatesApprovalsTableProps) {
  const { data: rows = [], isLoading } = useRatesApprovals();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all'|'tour'|'job'>('all');
  const [approvalFilter, setApprovalFilter] = React.useState<'all'|'pending'|'approved'>('all');
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;

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
                        <Badge variant="secondary">{
                          row.jobType === 'festival' ? 'Festival' : row.jobType === 'single' ? 'Trabajo' : (row.jobType || 'Trabajo')
                        }</Badge>
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
                            const isCritical = issue === 'Approval required';
                            const translated = issue === 'Approval required' ? 'Se requiere aprobación'
                              : issue === 'No tour dates' ? 'Sin fechas de gira'
                              : issue === 'No assignments' ? 'Sin asignaciones'
                              : issue === 'No timesheets' ? 'Sin partes'
                              : issue === 'Timesheets pending' ? 'Partes pendientes'
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
                    <TableCell className="text-right space-x-2">
                      {row.entityType === 'tour' ? (
                        <Button size="sm" onClick={() => onManageTour(row.id)}>
                          Gestionar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/management/rates?tab=timesheets&jobId=${row.id}`}>Revisar partes</Link>
                        </Button>
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
    </Card>
  );
}
