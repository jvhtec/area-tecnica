import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SystemError {
  id: string;
  created_at: string;
  user_id: string | null;
  system: string;
  error_type: string;
  error_message: string | null;
  context: any;
}

export default function SystemErrors() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: errors, isLoading, error, refetch } = useQuery({
    queryKey: ['system-errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as SystemError[];
    },
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getSeverityColor = (severity?: string): string => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      case 'LOW':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Errors</h1>
            <p className="text-muted-foreground">View and manage error reports from users</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading system errors</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'An unknown error occurred'}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent Error Reports</CardTitle>
            <CardDescription>
              Showing the last 100 error reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !errors || errors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No error reports found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Sistema</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((errorItem) => {
                      const isExpanded = expandedRows.has(errorItem.id);
                      const severity = errorItem.context?.severity;
                      
                      return (
                        <>
                          <TableRow key={errorItem.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(errorItem.id)}>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(errorItem.created_at), 'PPp', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{errorItem.system}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {errorItem.error_type}
                            </TableCell>
                            <TableCell>
                              {severity && (
                                <Badge variant={getSeverityColor(severity)}>
                                  {severity}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {errorItem.user_id ? errorItem.user_id.slice(0, 8) : 'Anon'}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30">
                                <div className="space-y-3 py-3">
                                  {errorItem.error_message && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1">Mensaje:</h4>
                                      <p className="text-sm">{errorItem.error_message}</p>
                                    </div>
                                  )}
                                  
                                  {errorItem.context && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1">Contexto:</h4>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {errorItem.context.appVersion && (
                                          <div>
                                            <span className="font-medium">Versión:</span>{' '}
                                            {errorItem.context.appVersion}
                                          </div>
                                        )}
                                        {errorItem.context.browser && (
                                          <div>
                                            <span className="font-medium">Navegador:</span>{' '}
                                            {errorItem.context.browser}
                                          </div>
                                        )}
                                        {errorItem.context.os && (
                                          <div>
                                            <span className="font-medium">SO:</span>{' '}
                                            {errorItem.context.os}
                                          </div>
                                        )}
                                        {errorItem.context.screenWidth && (
                                          <div>
                                            <span className="font-medium">Ancho:</span>{' '}
                                            {errorItem.context.screenWidth}px
                                          </div>
                                        )}
                                        {errorItem.context.url && (
                                          <div className="col-span-2">
                                            <span className="font-medium">URL:</span>{' '}
                                            <span className="break-all">{errorItem.context.url}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {errorItem.context.stack && (
                                        <div className="mt-2">
                                          <h5 className="font-medium text-xs mb-1">Stack trace:</h5>
                                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                            {errorItem.context.stack}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
