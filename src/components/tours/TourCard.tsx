import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, MoreVertical, Settings, FileText, Printer, FolderPlus, Image, HardDrive, XCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createSafeFolderName, sanitizeFolderName } from "@/utils/folderNameSanitizer";
import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TourManagementDialog } from "./TourManagementDialog";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useToast } from "@/hooks/use-toast";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { useIsMobile } from "@/hooks/use-mobile";
import { createTourRootFolders, createTourDateFolders, createTourRootFoldersManual } from "@/utils/tourFolders";
import { useQueryClient } from "@tanstack/react-query";
import { canUseCustomFolderStructure } from "@/utils/permissions";


import { queryKeys } from "@/lib/react-query";

type TourFolderConfig = string | {
  name: string;
  subfolders?: string[];
};

const normalizeTourFolderStructure = (value: unknown): TourFolderConfig[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const folders = value.flatMap((folder): TourFolderConfig[] => {
    if (typeof folder === 'string') {
      return [folder];
    }

    if (!folder || typeof folder !== 'object' || Array.isArray(folder) || !('name' in folder)) {
      return [];
    }

    const name = (folder as { name?: unknown }).name;
    if (typeof name !== 'string') {
      return [];
    }

    const subfolders = (folder as { subfolders?: unknown }).subfolders;
    return [{
      name,
      subfolders: Array.isArray(subfolders)
        ? subfolders.filter((subfolder): subfolder is string => typeof subfolder === 'string')
        : [],
    }];
  });

  return folders.length > 0 ? folders : null;
};

// File System Access API types
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

interface TourCardProps {
  tour: any;
  onTourClick?: (tourId: string) => void;
  onManageDates: () => void;
  onPrint: () => void;
  readOnly?: boolean;
}

export const TourCard = memo(function TourCard({ tour, onTourClick, onManageDates, onPrint, readOnly = false }: TourCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  const isMobile = useIsMobile();

  // Fetch tour logo
  useEffect(() => {
    const fetchTourLogo = async () => {
      if (!tour.id) return;

      const { data, error } = await dataLayerClient.from('tour_logos')
        .select('file_path')
        .eq('tour_id', tour.id)
        .maybeSingle();

      if (!error && data?.file_path) {
        try {
          // Try signed URL first
          const { data: signedUrlData } = await dataLayerClient.storage
            .from('tour-logos')
            .createSignedUrl(data.file_path, 60 * 60); // 1 hour expiry

          if (signedUrlData?.signedUrl) {
            setLogoUrl(signedUrlData.signedUrl);
          } else {
            // Fallback to public URL
            const { data: publicUrlData } = dataLayerClient.storage
              .from('tour-logos')
              .getPublicUrl(data.file_path);

            if (publicUrlData?.publicUrl) {
              setLogoUrl(publicUrlData.publicUrl);
            }
          }
        } catch (e) {
          // Fallback to public URL on error
          const { data: publicUrlData } = dataLayerClient.storage
            .from('tour-logos')
            .getPublicUrl(data.file_path);

          if (publicUrlData?.publicUrl) {
            setLogoUrl(publicUrlData.publicUrl);
          }
        }
      }
    };

    fetchTourLogo();
  }, [tour.id]);

  const getUpcomingDates = () => {
    if (!tour.tour_dates) return [];
    return tour.tour_dates
      .filter((date: any) => new Date(date.start_date || date.date) >= new Date())
      .slice(0, 3);
  };

  const upcomingDates = getUpcomingDates();

  const handleCardClick = () => {
    if (readOnly) {
      return;
    }

    if (onTourClick) {
      onTourClick(tour.id);
    } else {
      navigate(`/tour-management/${tour.id}`);
    }
  };

  const handleCreateTourRootFolders = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileMenuOpen(false);

    if (tour.flex_folders_created) {
      toast({
        title: "Las carpetas raíz ya existen",
        description: "Las carpetas raíz de esta gira ya están creadas.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Creating tour root folders manually for tour:", tour.id);

      const result = await createTourRootFoldersManual(tour.id);

      if (!result.success) {
        throw new Error(result.error || "No se pudieron crear las carpetas raíz de la gira");
      }

      toast({
        title: "Carpetas creadas",
        description: "Las carpetas raíz de la gira se han creado correctamente."
      });
    } catch (error: any) {
      console.error("Error creating tour root folders manually:", error);
      toast({
        title: "Error al crear las carpetas raíz de la gira",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCreateFlexFolders = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileMenuOpen(false);

    // Check if root folders exist first
    if (!tour.flex_folders_created) {
      toast({
        title: "Se necesitan las carpetas raíz",
        description: "Crea primero las carpetas raíz de la gira antes de crear las carpetas de fechas.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Creating tour date folders for tour:", tour.id);

      const result = await createTourDateFolders(tour.id);

      if (!result.success) {
        throw new Error(result.error || "No se pudieron crear las carpetas de fechas de la gira");
      }

      toast({
        title: "Carpetas creadas",
        description: "Las carpetas de fechas de la gira se han creado correctamente."
      });
    } catch (error: any) {
      console.error("Error creating tour date folders:", error);
      toast({
        title: "Error al crear las carpetas de fechas",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createLocalFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileMenuOpen(false);

    if (isCreatingLocalFolders) {
      console.log("TourCard: Local folder creation already in progress");
      return;
    }

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "Navegador no compatible",
        description: "Tu navegador no permite crear carpetas locales. Usa Chrome, Edge u otro navegador basado en Chromium.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingLocalFolders(true);

      // Ask user to pick a base folder
      const baseDirHandle = await window.showDirectoryPicker();

      // Format tour date range
      const startDate = tour.start_date ? new Date(tour.start_date) : null;
      const endDate = tour.end_date ? new Date(tour.end_date) : null;

      let dateRange = "";
      if (startDate && endDate) {
        dateRange = `${format(startDate, "yyMMdd")} to ${format(endDate, "yyMMdd")}`;
      } else if (startDate) {
        dateRange = format(startDate, "yyMMdd");
      } else {
        dateRange = "TBD";
      }

      // Create safe folder name
      const { name: rootFolderName, wasSanitized } = createSafeFolderName(tour.name, dateRange);

      if (wasSanitized) {
        console.log('TourCard: Folder name was sanitized for safety:', { original: `${tour.name} - ${dateRange}`, sanitized: rootFolderName });
      }

      // Create root folder
      const rootDirHandle = await baseDirHandle.getDirectoryHandle(rootFolderName, { create: true });

      // Get current user's custom folder structure or use default
      const { data: { user } } = await dataLayerClient.auth.getUser();
      let folderStructure: TourFolderConfig[] | null = null;

      if (user) {
        const { data: profile } = await dataLayerClient.from('profiles')
          .select('custom_tour_folder_structure, role')
          .eq('id', user.id)
          .single();

        // Only use custom tour structure for management users
        if (profile && canUseCustomFolderStructure(profile.role) && profile.custom_tour_folder_structure) {
          folderStructure = normalizeTourFolderStructure(profile.custom_tour_folder_structure);
        }
      }

      // Default tour structure if no custom one exists
      if (!folderStructure) {
        folderStructure = [
          { name: "00 - Tour Documents", subfolders: ["Contracts", "Insurance", "Permits", "Logistics"] },
          { name: "01 - Technical", subfolders: ["Sound", "Lights", "Video", "Stage"] },
          { name: "02 - Marketing", subfolders: ["Logos", "Press", "Social Media"] },
          { name: "03 - Dates", subfolders: [] },
          { name: "04 - Archive", subfolders: ["OLD"] }
        ];
      }

      // Create main tour folders
      if (Array.isArray(folderStructure)) {
        for (const folder of folderStructure) {
          if (typeof folder === 'string') {
            // Simple string structure
            const subDirHandle = await rootDirHandle.getDirectoryHandle(folder, { create: true });
            await subDirHandle.getDirectoryHandle("OLD", { create: true });
          } else if (folder && typeof folder === 'object' && folder.name) {
            // Special handling for "tourdates" element
            if (folder.name === 'tourdates' && tour.tour_dates && tour.tour_dates.length > 0) {
              const sortedDates = [...tour.tour_dates].sort((a, b) =>
                new Date(a.start_date || a.date).getTime() - new Date(b.start_date || b.date).getTime()
              );

              for (const tourDate of sortedDates) {
                let dateFolderName = "";
                const dateStart = new Date(tourDate.start_date || tourDate.date);

                if (tourDate.date_type === 'rehearsal' && tourDate.end_date) {
                  const dateEnd = new Date(tourDate.end_date);
                  dateFolderName = `${format(dateStart, "yyMMdd")}-${format(dateEnd, "yyMMdd")} - ${tourDate.location?.name || 'TBD'}, Rehearsal`;
                } else if (tourDate.date_type === 'travel') {
                  dateFolderName = `${format(dateStart, "yyMMdd")} - ${tourDate.location?.name || 'TBD'}, Travel`;
                } else {
                  dateFolderName = `${format(dateStart, "yyMMdd")} - ${tourDate.location?.name || 'TBD'}, Show`;
                }

                const cleanDateFolderName = sanitizeFolderName(dateFolderName);
                const dateDirHandle = await rootDirHandle.getDirectoryHandle(cleanDateFolderName, { create: true });

                // Create subfolders specified in the tourdates element
                if (folder.subfolders && Array.isArray(folder.subfolders) && folder.subfolders.length > 0) {
                  for (const subfolder of folder.subfolders) {
                    const safeSubfolderName = sanitizeFolderName(subfolder);
                    await dateDirHandle.getDirectoryHandle(safeSubfolderName, { create: true });
                  }
                } else {
                  // Default subfolders if none specified
                  await dateDirHandle.getDirectoryHandle("Technical", { create: true });
                  await dateDirHandle.getDirectoryHandle("Logistics", { create: true });
                  await dateDirHandle.getDirectoryHandle("Documentation", { create: true });
                }
              }
            } else {
              // Regular folder handling
              const safeFolderName = sanitizeFolderName(folder.name);
              const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });

              // Create subfolders if they exist
              if (folder.subfolders && Array.isArray(folder.subfolders) && folder.subfolders.length > 0) {
                for (const subfolder of folder.subfolders) {
                  const safeSubfolderName = sanitizeFolderName(subfolder);
                  await subDirHandle.getDirectoryHandle(safeSubfolderName, { create: true });
                }
              } else {
                // Default to OLD subfolder if no subfolders specified
                await subDirHandle.getDirectoryHandle("OLD", { create: true });
              }

              // Legacy special handling for Dates folder for backward compatibility
              if (folder.name === "03 - Dates" && tour.tour_dates && tour.tour_dates.length > 0) {
                const sortedDates = [...tour.tour_dates].sort((a, b) =>
                  new Date(a.start_date || a.date).getTime() - new Date(b.start_date || b.date).getTime()
                );

                for (const tourDate of sortedDates) {
                  let dateFolderName = "";
                  const dateStart = new Date(tourDate.start_date || tourDate.date);

                  if (tourDate.date_type === 'rehearsal' && tourDate.end_date) {
                    const dateEnd = new Date(tourDate.end_date);
                    dateFolderName = `${format(dateStart, "yyMMdd")}-${format(dateEnd, "yyMMdd")} - ${tourDate.location?.name || 'TBD'} - Rehearsal`;
                  } else if (tourDate.date_type === 'travel') {
                    dateFolderName = `${format(dateStart, "yyMMdd")} - ${tourDate.location?.name || 'TBD'} - Travel`;
                  } else {
                    dateFolderName = `${format(dateStart, "yyMMdd")} - ${tourDate.location?.name || 'TBD'} - Show`;
                  }

                  const cleanDateFolderName = sanitizeFolderName(dateFolderName);
                  const dateDirHandle = await subDirHandle.getDirectoryHandle(cleanDateFolderName, { create: true });

                  // Create standard subfolders for each date
                  await dateDirHandle.getDirectoryHandle("Technical", { create: true });
                  await dateDirHandle.getDirectoryHandle("Logistics", { create: true });
                  await dateDirHandle.getDirectoryHandle("Documentation", { create: true });

                  if (tourDate.date_type === 'rehearsal') {
                    await dateDirHandle.getDirectoryHandle("Schedule", { create: true });
                    await dateDirHandle.getDirectoryHandle("Notes", { create: true });
                  }
                }
              }
            }
          }
        }
      }

      const isCustom = user && folderStructure !== null;
      toast({
        title: "Carpetas locales creadas",
        description: `Se creó la estructura ${isCustom ? 'personalizada' : 'predeterminada'} de la gira en "${rootFolderName}"`
      });

    } catch (error: any) {
      console.error("TourCard: Error creating local folders:", error);
      if (error.name === 'AbortError') {
        // User cancelled, don't show error
        return;
      }

      let errorMessage = "No se pudieron crear las carpetas";
      if (error.message?.includes("Name is not allowed")) {
        errorMessage = "Se detectó un nombre de carpeta no válido. Inténtalo de nuevo o contacta con soporte.";
      } else if (error.message?.includes("getDirectoryHandle")) {
        errorMessage = "No se pudo crear la estructura. Comprueba los caracteres especiales de los nombres.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  };

  const handleManageTour = () => {
    setIsManagementOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleManageDatesClick = () => {
    onManageDates();
    setIsMobileMenuOpen(false);
  };

  const handlePrintClick = () => {
    onPrint();
    setIsMobileMenuOpen(false);
  };

  const handleToggleTourStatus = async () => {
    const newStatus = tour.status === 'active' ? 'cancelled' : 'active';
    const actionWord = newStatus === 'cancelled' ? 'cancel' : 'reactivate';

    try {
      const { error } = await dataLayerClient.from('tours')
        .update({ status: newStatus })
        .eq('id', tour.id);

      if (error) throw error;

      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope('tours') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour', tour.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope('jobs') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope('optimized-jobs') });

      toast({
        title: newStatus === "cancelled" ? "Gira cancelada" : "Gira reactivada",
        description: newStatus === "cancelled" ? "La gira se ha marcado como cancelada." : "La gira se ha reactivado.",
      });
    } catch (error: any) {
      console.error(`Error ${actionWord}ing tour:`, error);
      toast({
        title: "Error",
        description: `No se pudo actualizar la gira: ${error.message}`,
        variant: "destructive",
      });
    }

    setIsMobileMenuOpen(false);
  };

  const MenuItems = () => (
    <>
      <div
        className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
        onClick={handleManageTour}
      >
        <Settings className="h-4 w-4 mr-3" />
        <span>Gestionar gira</span>
      </div>
      <div
        className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
        onClick={handleManageDatesClick}
      >
        <Calendar className="h-4 w-4 mr-3" />
        <span>Gestionar fechas</span>
      </div>
      {tour.status === 'active' ? (
        <div
          className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors text-red-600"
          onClick={handleToggleTourStatus}
        >
          <XCircle className="h-4 w-4 mr-3" />
          <span>Marcar como cancelada</span>
        </div>
      ) : (
        <div
          className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors text-green-600"
          onClick={handleToggleTourStatus}
        >
          <CheckCircle className="h-4 w-4 mr-3" />
          <span>Reactivar gira</span>
        </div>
      )}
      {!tour.flex_folders_created && (
        <div
          className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
          onClick={handleCreateTourRootFolders}
        >
          <FolderPlus className="h-4 w-4 mr-3" />
          <span>Crear carpetas raíz de gira</span>
        </div>
      )}
      <div
        className={`flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors ${!tour.flex_folders_created ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        onClick={tour.flex_folders_created ? handleCreateFlexFolders : undefined}
      >
        <FolderPlus className="h-4 w-4 mr-3" />
        <span>
          {!tour.flex_folders_created
            ? "Crear primero las carpetas raíz"
            : "Crear carpetas de fechas"
          }
        </span>
      </div>
      <div
        className={`flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors ${isCreatingLocalFolders ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        onClick={isCreatingLocalFolders ? undefined : createLocalFoldersHandler}
      >
        <HardDrive className="h-4 w-4 mr-3" />
        <span>
          {isCreatingLocalFolders ? "Creando carpetas locales..." : "Crear carpetas locales"}
        </span>
      </div>
      <div
        className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
        onClick={handlePrintClick}
      >
        <Printer className="h-4 w-4 mr-3" />
        <span>Imprimir calendario</span>
      </div>
    </>
  );

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col" onClick={handleCardClick}>
        <CardHeader
          className="pb-3 relative px-3 py-3 md:px-6 md:py-4"
          style={{ backgroundColor: `${tour.color}20` }}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 md:gap-3 mb-2">
                {logoUrl && (
                  <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
                    <img
                      src={logoUrl}
                      alt="Logo de la gira"
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base md:text-lg truncate md:whitespace-normal">{tour.name}</CardTitle>
                  {tour.description && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mt-1">
                      {tour.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Sheet Menu */}
            {isMobile ? (
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 touch-manipulation"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-auto max-h-[50vh]">
                  <SheetHeader>
                    <SheetTitle>{tour.name} · Opciones</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-2 pt-4">
                    <MenuItems />
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              /* Desktop Dropdown Menu */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 z-[9999]"
                  sideOffset={5}
                >
                  <DropdownMenuItem onClick={handleManageTour}>
                    <Settings className="h-4 w-4 mr-2" />
                    Gestionar gira
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleManageDatesClick}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Gestionar fechas
                  </DropdownMenuItem>
                  {tour.status === 'active' ? (
                    <DropdownMenuItem
                      onClick={handleToggleTourStatus}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Marcar como cancelada
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleToggleTourStatus}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Reactivar gira
                    </DropdownMenuItem>
                  )}
                  {!tour.flex_folders_created && (
                    <DropdownMenuItem onClick={handleCreateTourRootFolders}>
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Crear carpetas raíz de gira
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleCreateFlexFolders}
                    disabled={!tour.flex_folders_created}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    {!tour.flex_folders_created
                      ? "Crear primero las carpetas raíz"
                      : "Crear carpetas de fechas"
                    }
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={createLocalFoldersHandler}
                    disabled={isCreatingLocalFolders}
                  >
                    <HardDrive className="h-4 w-4 mr-2" />
                    {isCreatingLocalFolders ? "Creando carpetas locales..." : "Crear carpetas locales"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintClick}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir calendario
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-3 px-3 pb-4 md:px-6 md:pb-6 flex-1">
          <div className="space-y-3 md:space-y-4">
            {/* Tour dates info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  {tour.tour_dates?.length || 0} fechas
                </span>
              </div>
              {tour.start_date && tour.end_date && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(tour.start_date), "d MMM", { locale: es })} - {format(new Date(tour.end_date), "d MMM yyyy", { locale: es })}
                </span>
              )}
            </div>

            {/* Upcoming dates preview */}
            {upcomingDates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs md:text-sm font-medium">Próximas:</h4>
                {upcomingDates.map((date: any) => (
                  <div key={date.id} className="flex flex-wrap items-center gap-1 md:gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="whitespace-nowrap">{format(new Date(date.start_date || date.date), "d MMM yyyy", { locale: es })}</span>
                    {date.location?.name && (
                      <>
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-1" />
                        <span className="text-muted-foreground truncate">{date.location.name}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status badges */}
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {tour.status === 'cancelled' && (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancelada
                </Badge>
              )}
              {tour.flex_folders_created ? (
                <Badge variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Flex preparado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                  <FolderPlus className="h-3 w-3 mr-1" />
                  Faltan carpetas raíz
                </Badge>
              )}
              {logoUrl && (
                <Badge variant="secondary" className="text-xs">
                  <Image className="h-3 w-3 mr-1" />
                  Logo
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: tour.color,
                  color: tour.color
                }}
              >
                  {tour.tour_dates?.length || 0} fechas
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management dialog */}
      <TourManagementDialog
        open={isManagementOpen}
        onOpenChange={setIsManagementOpen}
        tour={tour}
      />
    </>
  );
});
