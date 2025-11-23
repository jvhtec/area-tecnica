
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { format } from 'date-fns';
import { History, CheckCircle, XCircle, Clock, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadVacationRequestPDF } from '@/utils/vacationRequestPdfExport';
import type { VacationRequest } from '@/lib/vacation-requests';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const VacationRequestHistory = () => {
  const { userRequests, departmentRequests, isLoadingUserRequests, isLoadingDepartmentRequests } = useVacationRequests();
  const { toast } = useToast();
  const [isManager, setIsManager] = React.useState(false);
  const [sendingIds, setSendingIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let role: string | null = (user?.app_metadata as any)?.role || (user?.user_metadata as any)?.role || null;
      if (!role && user?.id) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        role = prof?.role ?? null;
      }
      if (!cancelled) setIsManager(role === 'admin' || role === 'management');
    })();
    return () => { cancelled = true; };
  }, []);

  const handleExportPDF = async (request: VacationRequest) => {
    try {
      await downloadVacationRequestPDF({ request });
    } catch (error) {
      console.error('Error exporting vacation request PDF:', error);
    }
  };

  const handleResendEmail = async (request: VacationRequest) => {
    try {
      setSendingIds(prev => [...prev, request.id]);
      const { error } = await supabase.functions.invoke('send-vacation-decision', {
        body: { request_id: request.id }
      });
      if (error) throw error;
      toast({ title: 'Correo reenviado', description: 'El correo con la decisión y PDF se ha reenviado.' });
    } catch (e: any) {
      toast({ title: 'Error al reenviar', description: e?.message || 'No se pudo reenviar el correo de decisión.', variant: 'destructive' });
    } finally {
      setSendingIds(prev => prev.filter(id => id !== request.id));
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

  const rows = isManager ? departmentRequests : userRequests;
  const isLoading = isManager ? isLoadingDepartmentRequests : isLoadingUserRequests;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Cargando solicitudes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de solicitudes
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isManager ? 'No hay solicitudes de vacaciones en tu departamento.' : "Aún no has enviado solicitudes de vacaciones."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enviada</TableHead>
                  <TableHead>Respuesta</TableHead>
                  <TableHead className="w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(request => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {request.technicians 
                        ? ((`${request.technicians.first_name ?? ''} ${request.technicians.last_name ?? ''}`.trim()) || request.technicians.email || request.technician_id)
                        : request.technician_id}
                    </TableCell>
                    <TableCell>{format(new Date(request.start_date), 'd MMM yyyy')}</TableCell>
                    <TableCell>{format(new Date(request.end_date), 'd MMM yyyy')}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{format(new Date(request.created_at), 'd MMM yyyy')}</TableCell>
                    <TableCell>
                      {request.approved_at
                        ? format(new Date(request.approved_at), 'd MMM yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportPDF(request)}
                        className="h-8 w-8 p-0"
                        title="Exportar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {isManager && request.status !== 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendEmail(request)}
                          className="h-8 w-8 p-0"
                          title="Reenviar correo de decisión"
                          disabled={sendingIds.includes(request.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
