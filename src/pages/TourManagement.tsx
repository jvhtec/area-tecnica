import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin, 
  Settings, 
  Users, 
  FileText, 
  Truck,
  Calculator,
  Weight,
  Clock,
  BarChart3,
  UserCheck,
  Eye,
  ArrowLeft,
  Info,
  Printer,
  Loader2,
  Euro,
  MessageCircle,
  Box,
  ListChecks
} from "lucide-react";
import { TourRatesManagerDialog } from "@/components/tours/TourRatesManagerDialog";
import { useTourRatesApproval } from "@/hooks/useTourRatesApproval";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TourManagementDialog } from "@/components/tours/TourManagementDialog";
import { TourLogisticsDialog } from "@/components/tours/TourLogisticsDialog";
import { TourDateManagementDialog } from "@/components/tours/TourDateManagementDialog";
import { TourDefaultsManager } from "@/components/tours/TourDefaultsManager";
import { TourAssignmentDialog } from "@/components/tours/TourAssignmentDialog";
import { TourDocumentsDialog } from "@/components/tours/TourDocumentsDialog";
import { TourPresetManagerDialog } from "@/components/tours/TourPresetManagerDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTourAssignments } from "@/hooks/useTourAssignments";
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { fetchTourLogo } from "@/utils/pdf/logoUtils";
import { exportTourPDF } from "@/lib/tourPdfExport";
import { useToast } from "@/hooks/use-toast";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { isManagementRole, isTechnicianRole } from "@/utils/permissions";
import createFolderIcon from "@/assets/icons/icon.png";
import { TourManagementHeader } from "@/components/tours/TourManagementHeader";
import { TourManagementMobileActions } from "@/components/tours/TourManagementMobileActions";
import { openFlexElement } from "@/utils/flex-folders";
import { TaskManagerDialog } from "@/components/tasks/TaskManagerDialog";
import { TourSchedulingDialog } from "@/components/tours/TourSchedulingDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTourWhatsappGroup } from "@/hooks/tours/useTourWhatsappGroup";
import { TourWhatsappGroupDialog } from "@/pages/tour-management/TourWhatsappGroupDialog";
import { TourUpcomingDates } from "@/pages/tour-management/TourUpcomingDates";
import type { QuickAction, TourManagementProps } from "@/pages/tour-management/tourManagementTypes";

export const TourManagement = ({ tour }: TourManagementProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const isTechnicianView = mode === 'technician' || isTechnicianRole(userRole);
  const isMobile = useIsMobile();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatesOpen, setIsDatesOpen] = useState(false);
  const [isDefaultsManagerOpen, setIsDefaultsManagerOpen] = useState(false);
  const [isAssignmentsOpen, setIsAssignmentsOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isTourPresetsOpen, setIsTourPresetsOpen] = useState(false);
  const [isRatesManagerOpen, setIsRatesManagerOpen] = useState(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [isTourTasksOpen, setIsTourTasksOpen] = useState(false);
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [tourLogoUrl, setTourLogoUrl] = useState<string | undefined>();
  const [isPrintingSchedule, setIsPrintingSchedule] = useState(false);
  const {
    handleCreateWaGroup,
    isCreatingWaGroup,
    isWaDialogOpen,
    openWaDialog,
    retryWhatsappGroup,
    setIsWaDialogOpen,
    setWaDepartment,
    setWaSelectedDateId,
    waDepartment,
    waGroup,
    waRequest,
    waSelectedDateId,
  } = useTourWhatsappGroup({ isManagementUser, tourDates: tour?.tour_dates || [] });

  const { assignments } = useTourAssignments(tour?.id);
  const { data: approvalRow, refetch: refetchApproval } = useTourRatesApproval(tour?.id);
  const tourRatesApproved = !!approvalRow?.rates_approved;
  // Use tour.id directly - the service now handles tours properly
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists } = useFlexUuid(tour?.id || '');

  // Load tour logo
  useEffect(() => {
    if (tour?.id) {
      fetchTourLogo(tour.id).then(setTourLogoUrl);
    }
  }, [tour?.id]);


  if (!tour) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Gira No Encontrada</h1>
          <p className="text-muted-foreground">No se pudo encontrar la gira solicitada.</p>
        </div>
      </div>
    );
  }

  const upcomingDates = tour.tour_dates?.filter(
    (date: any) => new Date(date.date) >= new Date()
  ).slice(0, 5) || [];

  const totalDates = tour.tour_dates?.length || 0;
  const completedDates = tour.tour_dates?.filter(
    (date: any) => new Date(date.date) < new Date()
  ).length || 0;

  const getSortedTourDates = () => {
    if (!tour?.tour_dates) return [];

    return [...tour.tour_dates].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const sortedTourDates = getSortedTourDates();


  const handlePowerDefaults = () => {
    navigate(`/sound/consumos?tourId=${tour.id}&mode=tour-defaults`);
  };

  const handleWeightDefaults = () => {
    navigate(`/sound/pesos?tourId=${tour.id}&mode=tour-defaults`);
  };

  const handleLightsPowerDefaults = () => {
    navigate(`/lights-consumos-tool?tourId=${tour.id}&mode=tour-defaults`);
  };

  const handlePrintSchedule = async () => {
    setIsPrintingSchedule(true);
    try {
      await exportTourPDF(tour);
      toast({
        title: "Éxito",
        description: "Calendario de gira exportado exitosamente",
      });
    } catch (error: any) {
      console.error("Error exporting tour schedule:", error);
      toast({
        title: "Error",
        description: "Error al exportar el calendario de gira",
        variant: "destructive",
      });
    } finally {
      setIsPrintingSchedule(false);
    }
  };

  const totalAssignments = assignments.length;
  const assignedDepartments = new Set(assignments.map(a => a.department)).size;

  // Filter quick actions based on view mode
  const handleOpenTourTasks = () => {
    setIsTourTasksOpen(true);
  };

  const quickActions: QuickAction[] = [
    {
      title: "Fechas y Ubicaciones de la Gira",
      description: "Ver fechas, recintos y ubicaciones de la gira",
      icon: Calendar,
      onClick: () => setIsDatesOpen(true),
      badge: `${totalDates} fechas`,
      viewOnly: true
    },
    {
      title: "Asignaciones del Equipo",
      description: isTechnicianView
        ? "Ver miembros del equipo de gira (aplicados automáticamente a todos los trabajos)"
        : "Asignar miembros del equipo a toda la gira (sincroniza automáticamente con todos los trabajos)",
      icon: UserCheck,
      onClick: () => setIsAssignmentsOpen(true),
      badge: `${totalAssignments} asignados`,
      viewOnly: isTechnicianView,
      hasAutoSync: true
    },
    {
      title: "Gestión de Documentos",
      description: "Subir, organizar y compartir documentos de la gira",
      icon: FileText,
      onClick: () => setIsDocumentsOpen(true),
      badge: "Disponible",
      viewOnly: false
    },
    {
      id: "rates-manager",
      title: "Gestor de Tarifas y Extras",
      description: "Configurar extras y resolver problemas de tarifas",
      icon: Euro,
      onClick: () => setIsRatesManagerOpen(true),
      badge: tourRatesApproved ? "Tarifas Aprobadas" : "Requiere Aprobación",
      showForTechnician: false
    },
    {
      title: "Presets de Gira",
      description: "Crear y gestionar presets de equipos para esta gira",
      icon: Box,
      onClick: () => setIsTourPresetsOpen(true),
      badge: "Equipamiento",
      showForTechnician: false
    },
    {
      title: "Configuración de Gira",
      description: "Valores por defecto de potencia y peso, configuraciones técnicas",
      icon: Settings,
      onClick: () => setIsDefaultsManagerOpen(true),
      badge: "Configuración",
      showForTechnician: false
    },
    {
      title: "Requisitos de Potencia",
      description: "Establecer cálculos de potencia por defecto para todas las fechas",
      icon: Calculator,
      onClick: handlePowerDefaults,
      badge: "Por Defecto",
      showForTechnician: false
    },
    {
      title: "Cálculos de Peso",
      description: "Configurar valores por defecto y cálculos de peso",
      icon: Weight,
      onClick: handleWeightDefaults,
      badge: "Por Defecto",
      showForTechnician: false
    },
    {
      title: "Requisitos de Potencia Luces",
      description: "Establecer cálculos de potencia por defecto de luces para todas las fechas",
      icon: Calculator,
      onClick: handleLightsPowerDefaults,
      badge: "Por Defecto",
      showForTechnician: false
    },
    {
      title: "Programación y Línea de Tiempo",
      description: "Línea de tiempo y gestión de programación de la gira",
      icon: Clock,
      onClick: () => setIsSchedulingOpen(true),
      badge: "Disponible",
      viewOnly: false,
      showForTechnician: false
    },
    {
      title: "Logística",
      description: "Transporte para toda la gira con anulaciones por fecha",
      icon: Truck,
      onClick: () => setIsLogisticsOpen(true),
      badge: "Disponible",
      showForTechnician: false
    },
    {
      title: "Tareas de Gira",
      description: "Gestionar tareas y actualizaciones de toda la gira",
      icon: ListChecks,
      onClick: handleOpenTourTasks,
      badge: "Disponible",
      showForTechnician: false,
    }
  ].filter(action => {
    if (isTechnicianView && action.showForTechnician === false) {
      return false;
    }
    return true;
  });

  const handleBackToTechnicianDashboard = () => {
    navigate('/technician-dashboard');
  };

  const handleFlexClick = async () => {
    if (isFlexLoading) {
      toast({ title: "Cargando", description: "Por favor espera mientras cargamos la carpeta Flex..." });
      return;
    }

    if (flexUuid) {
      await openFlexElement({
        elementId: flexUuid,
        onError: (error) => {
          toast({ title: "Error", description: error.message || "Error al abrir Flex", variant: "destructive" });
        },
        onWarning: (message) => {
          toast({ title: "Advertencia", description: message });
        },
      });
    } else if (flexError) {
      toast({ title: "Error", description: flexError, variant: "destructive" });
    } else {
      toast({ title: "Info", description: "Carpeta Flex no disponible para esta gira" });
    }
  };

  if (isTechnicianView) {
    return (
      <div className="max-w-[1920px] mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="flex-shrink-0 mx-auto md:mx-0">
              {tourLogoUrl ? (
                <img
                  src={tourLogoUrl}
                  alt={`${tour.name} logo`}
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className="w-16 h-16 object-contain rounded-lg border border-border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center rounded-lg border border-border bg-muted">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <Button variant="ghost" onClick={handleBackToTechnicianDashboard} className="p-0 h-auto">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver al Panel
                </Button>
                <Badge variant="outline">
                  <Eye className="h-3 w-3 mr-1" />
                  Vista de Técnico
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">{tour.name}</h1>
              {tour.description && (
                <p className="text-muted-foreground mt-1 text-sm md:text-base">{tour.description}</p>
              )}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-sm text-muted-foreground">
                {tour.start_date && tour.end_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs md:text-sm">
                      {format(new Date(tour.start_date), "d MMM", { locale: es })} - {format(new Date(tour.end_date), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>
                )}
                <Badge variant="outline" style={{ borderColor: tour.color, color: tour.color }}>
                  {totalDates} fechas
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button variant="outline" onClick={() => setIsAssignmentsOpen(true)} className="w-full sm:w-auto">
              <Users className="h-4 w-4 mr-2" />
              Ver Asignaciones
            </Button>
            <Button onClick={() => setIsDocumentsOpen(true)} className="w-full sm:w-auto">
              <FileText className="h-4 w-4 mr-2" />
              Abrir Documentos
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Fechas de Gira Programadas</CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground">
              Revisa las fechas y ubicaciones confirmadas para esta gira.
            </p>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            {sortedTourDates.length > 0 ? (
              <div className="space-y-3">
                {sortedTourDates.map((date: any) => {
                  const eventDate = date?.date ? new Date(date.date) : null;

                  return (
                    <div
                      key={date.id}
                      className="p-3 md:p-4 border rounded-lg flex flex-col gap-2 bg-muted/30"
                    >
                      {eventDate ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm md:text-base">
                              {format(eventDate, 'EEEE, MMMM d, yyyy')}
                            </span>
                          </div>
                          <Badge variant="outline" className="self-start sm:self-auto">
                            {format(eventDate, 'HH:mm')}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Fecha no disponible</span>
                        </div>
                      )}
                      {date.location?.name && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{date.location.name}</span>
                        </div>
                      )}
                      {date.notes && (
                        <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap break-words">
                          {date.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Aún no hay fechas programadas disponibles para esta gira.
              </div>
            )}
          </CardContent>
        </Card>

        <TourDateManagementDialog
          open={isDatesOpen}
          onOpenChange={setIsDatesOpen}
          tourId={tour.id}
          tourDates={sortedTourDates}
          readOnly
        />

        <TourAssignmentDialog
          open={isAssignmentsOpen}
          onOpenChange={setIsAssignmentsOpen}
          tourId={tour.id}
          readOnly
        />

        <TourDocumentsDialog
          open={isDocumentsOpen}
          onOpenChange={setIsDocumentsOpen}
          tourId={tour.id}
          tourName={tour.name}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <TourManagementHeader
          isTechnicianView={isTechnicianView}
          onBackToTechnicianDashboard={handleBackToTechnicianDashboard}
          tour={tour}
          tourLogoUrl={tourLogoUrl}
          totalAssignments={totalAssignments}
          totalDates={totalDates}
        />
        
        {!isTechnicianView && (isMobile ? (
          <TourManagementMobileActions
            flexUuid={flexUuid}
            folderExists={folderExists}
            isFlexLoading={isFlexLoading}
            isManagementUser={isManagementUser}
            isPrintingSchedule={isPrintingSchedule}
            onFlexClick={handleFlexClick}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenWhatsapp={openWaDialog}
            onPrintSchedule={handlePrintSchedule}
          />
        ) : (
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Button
              onClick={handlePrintSchedule}
              variant="outline"
              disabled={isPrintingSchedule}
              className="w-full sm:w-auto"
            >
              <Printer className="h-4 w-4 mr-2" />
              {isPrintingSchedule ? 'Imprimiendo...' : 'Imprimir Calendario'}
            </Button>
            {/* Only show Flex button if folder exists or is loading */}
            {(folderExists || isFlexLoading) && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 w-full sm:w-auto"
                onClick={handleFlexClick}
                disabled={!flexUuid || isFlexLoading}
              >
                {isFlexLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <img
                    src={createFolderIcon}
                    alt="Flex"
                    width={16}
                    height={16}
                    loading="lazy"
                    decoding="async"
                    className="h-4 w-4"
                  />
                )}
                {isFlexLoading ? 'Cargando...' : 'Flex'}
              </Button>
            )}
            {isManagementUser && (
              <Button variant="outline" size="sm" className="flex items-center gap-2 w-full sm:w-auto" onClick={openWaDialog}>
                <MessageCircle className="h-4 w-4" />
                Grupo WhatsApp
              </Button>
            )}
            <Button onClick={() => setIsSettingsOpen(true)} className="w-full sm:w-auto">
              <Settings className="h-4 w-4 mr-2" />
              Configuración de Gira
            </Button>
          </div>
        ))}
      </div>

      {/* Auto-sync info for management users */}
      {!isTechnicianView && (
        <div className="bg-blue-50 dark:bg-blue-950 p-3 md:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Sincronización Automática de Trabajos</p>
              <p className="text-xs md:text-sm">Las asignaciones de gira se aplican automáticamente a todos los trabajos de esta gira. Los miembros del equipo asignados a la gira aparecerán instantáneamente en todas las asignaciones de trabajos individuales, y eliminarlos de la gira los elimina de todos los trabajos.</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium">Fechas Totales</CardTitle>
            <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <div className="text-xl md:text-2xl font-bold">{totalDates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium">Completadas</CardTitle>
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <div className="text-xl md:text-2xl font-bold">{completedDates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium">Próximas</CardTitle>
            <Clock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <div className="text-xl md:text-2xl font-bold">{totalDates - completedDates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium">Personal asignado</CardTitle>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <div className="text-xl md:text-2xl font-bold">{totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              {assignedDepartments} departamentos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 px-1">
          {isTechnicianView ? 'Información de Gira' : 'Áreas de Gestión'}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-4">
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className={`hover:shadow-md transition-shadow cursor-pointer ${action.disabled ? 'opacity-60' : ''}`}
              onClick={action.onClick}
            >
              <CardHeader className="px-3 pb-2 pt-3 md:px-6 md:pb-3 md:pt-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <action.icon className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" style={{ color: tour.color }} />
                      {action.hasAutoSync && !isTechnicianView && (
                        <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 hidden sm:inline-flex">
                          Auto-sincronización
                        </Badge>
                      )}
                    </div>
                    <Badge variant={action.badge === "Coming Soon" ? "secondary" : tourRatesApproved && action.id === 'rates-manager' ? 'default' : 'outline'} className="max-w-[7rem] truncate text-xs">
                      {action.badge}
                    </Badge>
                  </div>
                  {!isTechnicianView && action.id === 'rates-manager' && (
                    <div className="flex gap-2">
                      {tourRatesApproved ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await dataLayerClient.from('tours')
                              .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                              .eq('id', tour.id);
                            refetchApproval();
                          }}
                        >
                          Revocar
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full text-xs"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { data: u } = await dataLayerClient.auth.getUser();
                            await dataLayerClient.from('tours')
                              .update({ rates_approved: true, rates_approved_at: new Date().toISOString(), rates_approved_by: u?.user?.id || null } as any)
                              .eq('id', tour.id);
                            refetchApproval();
                          }}
                        >
                          Aprobar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <CardTitle className="mt-1 line-clamp-2 text-sm md:mt-2 md:text-base">{action.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
                <p className="hidden text-xs text-muted-foreground md:line-clamp-2">{action.description}</p>
                {action.viewOnly && isTechnicianView && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    Solo Lectura
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <TourUpcomingDates isTechnicianView={isTechnicianView} upcomingDates={upcomingDates} />

      {/* Management Dialogs - Modified for technician view */}
      {!isTechnicianView && (
        <TourManagementDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          tour={tour}
        />
      )}

      {/* Rates & Extras Manager */}
      {!isTechnicianView && (
        <TourRatesManagerDialog 
          open={isRatesManagerOpen}
          onOpenChange={setIsRatesManagerOpen}
          tourId={tour.id}
        />
      )}

      <TourDateManagementDialog
        open={isDatesOpen}
        onOpenChange={setIsDatesOpen}
        tourId={tour.id}
        tourDates={sortedTourDates}
        readOnly={isTechnicianView}
      />

      {!isTechnicianView && (
        <TourDefaultsManager
          open={isDefaultsManagerOpen}
          onOpenChange={setIsDefaultsManagerOpen}
          tour={tour}
        />
      )}

      <TourAssignmentDialog
        open={isAssignmentsOpen}
        onOpenChange={setIsAssignmentsOpen}
        tourId={tour.id}
        readOnly={isTechnicianView}
      />

      <TourDocumentsDialog
        open={isDocumentsOpen}
        onOpenChange={setIsDocumentsOpen}
        tourId={tour.id}
        tourName={tour.name}
      />

      {/* Tour Presets Manager */}
      {!isTechnicianView && (
        <TourPresetManagerDialog
          open={isTourPresetsOpen}
          onOpenChange={setIsTourPresetsOpen}
          tourId={tour.id}
        />
      )}

      {/* Logistics – tour‑wide with per‑date overrides */}
      {!isTechnicianView && (
      <TourLogisticsDialog
        open={isLogisticsOpen}
        onOpenChange={setIsLogisticsOpen}
        tourId={tour.id}
      />
      )}

      {!isTechnicianView && (
        <TaskManagerDialog
          open={isTourTasksOpen}
          onOpenChange={setIsTourTasksOpen}
          tourId={tour.id}
          userRole={userRole}
        />
      )}

      {/* Tour Scheduling Dialog */}
      {!isTechnicianView && (
        <TourSchedulingDialog
          open={isSchedulingOpen}
          onOpenChange={setIsSchedulingOpen}
          tourId={tour.id}
          tourDates={sortedTourDates}
          tourName={tour.name}
        />
      )}

      <TourWhatsappGroupDialog
        handleCreateWaGroup={handleCreateWaGroup}
        isCreatingWaGroup={isCreatingWaGroup}
        isWaDialogOpen={isWaDialogOpen}
        retryWhatsappGroup={retryWhatsappGroup}
        setIsWaDialogOpen={setIsWaDialogOpen}
        setWaDepartment={setWaDepartment}
        setWaSelectedDateId={setWaSelectedDateId}
        sortedTourDates={sortedTourDates}
        waDepartment={waDepartment}
        waGroup={waGroup}
        waRequest={waRequest}
        waSelectedDateId={waSelectedDateId}
      />
    </div>
  );
};

export default TourManagement;
