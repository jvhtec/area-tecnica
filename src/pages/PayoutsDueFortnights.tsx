import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, CalendarDays, FileDown, Loader2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { PayoutDueResponsiveList } from "@/components/payouts/PayoutDueMobileList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { createQueryKey } from "@/lib/optimized-react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { canManagePayouts } from "@/utils/permissions";


import {
  LOOKAHEAD_DAYS,
  MADRID_TIMEZONE,
  compareDueItems,
  fetchFortnightPayoutsDue,
  formatAutonomoCellValue,
  formatCurrency,
  formatDateInputValue,
  formatEstimateText,
  formatLongDate,
  formatPaymentWindowDate,
  getSuggestedPaymentWindow,
  isInvoiceApplicable,
  parseDateInputValue,
  type DueGroup,
  type DueItem,
  type SortColumn,
  type SortDirection,
} from "@/features/rates/payoutsDueData";
import { queryKeys } from "@/lib/react-query";

export default function PayoutsDueFortnights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, userRole, userDepartment } = useOptimizedAuth();
  const todayInput = formatDateInputValue(new Date());
  const defaultToInput = useMemo(
    () => formatDateInputValue(addDays(new Date(), LOOKAHEAD_DAYS)),
    []
  );
  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [fromDateFilter, setFromDateFilter] = useState(todayInput);
  const [toDateFilter, setToDateFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("jobDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [printingGroupKey, setPrintingGroupKey] = useState<string | null>(null);
  const [updatingInvoiceKeys, setUpdatingInvoiceKeys] = useState<Record<string, boolean>>({});

  const queryFromInput = fromDateFilter || todayInput;
  const queryToInput = toDateFilter || defaultToInput;
  const canManageInvoice = canManagePayouts(userRole, userDepartment);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.custom(...createQueryKey.payoutDueFortnights.all, queryFromInput, queryToInput),
    queryFn: () =>
      fetchFortnightPayoutsDue({
        payoutFromInput: queryFromInput,
        payoutToInput: queryToInput,
      }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const invoiceMutation = useMutation({
    mutationFn: async ({
      jobId,
      technicianId,
      received,
    }: {
      jobId: string;
      technicianId: string;
      received: boolean;
    }) => {
      const receivedAt = received ? new Date().toISOString() : null;
      const receivedBy = received ? user?.id ?? null : null;

      const { data: updatedRows, error: updateError } = await dataLayerClient.from("job_assignments")
        .update({
          invoice_received_at: receivedAt,
          invoice_received_by: receivedBy,
        })
        .eq("job_id", jobId)
        .eq("technician_id", technicianId)
        .select("id");

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("No se encontró la asignación para marcar la factura.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: createQueryKey.payoutDueFortnights.all });
    },
  });

  const nowTs = Date.now();
  const availableDepartments = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(
        data.groups
          .flatMap((group) => group.items.map((item) => item.department))
          .filter((department): department is string => Boolean(department))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return null;
    const text = searchText.trim().toLowerCase();
    const fromDate = parseDateInputValue(fromDateFilter, false);
    const toDate = parseDateInputValue(toDateFilter, true);

    const groups = data.groups
      .map((group) => {
        const items = group.items.filter((item) => {
          if (departmentFilter !== "all" && item.department !== departmentFilter) {
            return false;
          }

          if (text) {
            const haystack = `${item.technicianName} ${item.jobTitle}`.toLowerCase();
            if (!haystack.includes(text)) {
              return false;
            }
          }

          // Keep items whose estimated range overlaps the selected date window.
          if (fromDate && item.toDate.getTime() < fromDate.getTime()) {
            return false;
          }
          if (toDate && item.fromDate.getTime() > toDate.getTime()) {
            return false;
          }

          return true;
        });

        if (items.length === 0) return null;
        const sortedItems = [...items].sort((left, right) =>
          compareDueItems(left, right, sortColumn, sortDirection)
        );
        return {
          ...group,
          items: sortedItems,
          totalEur: sortedItems.reduce((sum, item) => sum + item.totalEur, 0),
        };
      })
      .filter((group): group is DueGroup => group !== null);

    return {
      groups,
      totalEur: groups.reduce((sum, group) => sum + group.totalEur, 0),
      totalItems: groups.reduce((sum, group) => sum + group.items.length, 0),
    };
  }, [data, searchText, departmentFilter, fromDateFilter, toDateFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  };

  const getSortIndicator = (column: SortColumn): string => {
    if (sortColumn !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handleToggleInvoice = async (item: DueItem, received: boolean) => {
    if (!isInvoiceApplicable(item.isHouseTech, item.isAutonomo)) return;
    if (!canManageInvoice) return;
    if (!user?.id && received) {
      toast({
        title: "No se pudo actualizar",
        description: "No se encontró el usuario autenticado para registrar la factura.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingInvoiceKeys((prev) => ({ ...prev, [item.key]: true }));
    try {
      await invoiceMutation.mutateAsync({
        jobId: item.jobId,
        technicianId: item.technicianId,
        received,
      });
      toast({
        title: received ? "Factura marcada" : "Factura desmarcada",
        description: `${item.technicianName} · ${item.jobTitle}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la factura.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingInvoiceKeys((prev) => {
        const { [item.key]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handlePrintGroup = async (group: DueGroup) => {
    const paymentWindow = getSuggestedPaymentWindow(group.startDate);
    setPrintingGroupKey(group.key);
    try {
      const { downloadPayoutDueGroupPdf } = await import("@/utils/payout-due-pdf");
      await downloadPayoutDueGroupPdf({
        paymentFrom: paymentWindow.fromDate,
        paymentTo: paymentWindow.toDate,
        totalEur: group.totalEur,
        rows: group.items.map((item) => ({
          jobId: item.jobId,
          technicianName: item.technicianName,
          department: item.department,
          isHouseTech: item.isHouseTech,
          isAutonomo: item.isAutonomo,
          invoiceReceivedAt: item.invoiceReceivedAt,
          jobDate: item.jobDate,
          jobTitle: item.jobTitle,
          estimateText: formatEstimateText(item.fromDate, item.toDate),
          totalEur: item.totalEur,
        })),
      });
      toast({ title: "PDF generado", description: "La tabla se descargó correctamente." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo generar el PDF.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPrintingGroupKey(null);
    }
  };

  const overdueItems = useMemo(() => {
    if (!filteredData) return 0;
    return filteredData.groups.reduce(
      (sum, group) => sum + group.items.filter((item) => item.toDate.getTime() < nowTs).length,
      0
    );
  }, [filteredData, nowTs]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-5 w-[520px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la previsión de pagos.";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Error cargando pagos previstos
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || !filteredData || filteredData.totalItems === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Pagos previstos por quincena</h1>
          <p className="text-sm text-muted-foreground">
            Estimación basada en partes aprobados y en la regla de pago quincenal (+30 días desde cierre de período).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>
              Por defecto se muestran pagos desde hoy; puedes buscar hacia atrás cambiando la fecha "Desde".
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payout-search">Buscar</Label>
              <Input
                id="payout-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Técnico o evento..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-from-date">Desde</Label>
              <Input
                id="payout-from-date"
                type="date"
                value={fromDateFilter}
                onChange={(event) => setFromDateFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-to-date">Hasta</Label>
              <Input
                id="payout-to-date"
                type="date"
                value={toDateFilter}
                onChange={(event) => setToDateFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => setFromDateFilter(todayInput)}
              >
                Desde hoy
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchText("");
                  setDepartmentFilter("all");
                  setFromDateFilter(todayInput);
                  setToDateFilter("");
                }}
              >
                Restablecer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sin resultados</CardTitle>
            <CardDescription>
              No hay pagos estimados para los filtros seleccionados.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Pagos previstos por quincena</h1>
        <p className="text-sm text-muted-foreground">
          Estimación basada en partes aprobados y en la regla de pago quincenal (+30 días desde cierre de período).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total filtrado
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(filteredData.totalEur)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {filteredData.totalItems} pagos agrupados en {filteredData.groups.length} quincenas.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Ventana analizada
            </CardDescription>
            <CardTitle className="text-base">
              {formatLongDate(data.windowFrom)} - {formatLongDate(data.windowTo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Generado el {formatLongDate(data.generatedAt)}.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Vencidos
            </CardDescription>
            <CardTitle className="text-2xl">{overdueItems}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pagos cuyo rango estimado terminó antes de hoy.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Por defecto se muestran pagos desde hoy; puedes buscar hacia atrás cambiando la fecha "Desde".
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="payout-search">Buscar</Label>
            <Input
              id="payout-search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Técnico o evento..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout-from-date">Desde</Label>
            <Input
              id="payout-from-date"
              type="date"
              value={fromDateFilter}
              onChange={(event) => setFromDateFilter(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout-to-date">Hasta</Label>
            <Input
              id="payout-to-date"
              type="date"
              value={toDateFilter}
              onChange={(event) => setToDateFilter(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableDepartments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFromDateFilter(todayInput)}
            >
              Desde hoy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchText("");
                setDepartmentFilter("all");
                setFromDateFilter(todayInput);
                setToDateFilter("");
              }}
            >
              Restablecer
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredData.groups.map((group) => {
          const isPastFortnight = group.endDate.getTime() < nowTs;
          const paymentWindow = getSuggestedPaymentWindow(group.startDate);
          return (
            <Card key={group.key}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      A pagar entre {formatPaymentWindowDate(paymentWindow.fromDate)} y{" "}
                      {formatPaymentWindowDate(paymentWindow.toDate)}
                    </CardTitle>
                    <CardDescription>
                      {group.items.length} pagos · {formatCurrency(group.totalEur)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintGroup(group)}
                      disabled={printingGroupKey === group.key}
                    >
                      {printingGroupKey === group.key ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      Imprimir PDF
                    </Button>
                    <Badge variant={isPastFortnight ? "destructive" : "secondary"}>
                      {isPastFortnight ? "Vencida" : "Activa/Futura"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PayoutDueResponsiveList
                  canManageInvoice={canManageInvoice}
                  getSortIndicator={getSortIndicator}
                  items={group.items.map((item) => ({
                    autonomoText: formatAutonomoCellValue(item.isHouseTech, item.isAutonomo),
                    department: item.department,
                    estimateText: formatEstimateText(item.fromDate, item.toDate),
                    invoiceApplicable: isInvoiceApplicable(item.isHouseTech, item.isAutonomo),
                    invoiceReceived: Boolean(item.invoiceReceivedAt),
                    invoiceUpdatedAtText: item.invoiceReceivedAt
                      ? formatInTimeZone(new Date(item.invoiceReceivedAt), MADRID_TIMEZONE, "dd/MM/yyyy")
                      : "",
                    isUpdatingInvoice: Boolean(updatingInvoiceKeys[item.key]),
                    jobDateText: item.jobDate ? formatLongDate(item.jobDate) : "Fecha desconocida",
                    jobTitle: item.jobTitle,
                    key: item.key,
                    technicianName: item.technicianName,
                    totalText: formatCurrency(item.totalEur),
                  }))}
                  onSort={handleSort}
                  onToggleInvoice={(itemKey, received) => {
                    const item = group.items.find((candidate) => candidate.key === itemKey);
                    if (item) void handleToggleInvoice(item, received);
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
