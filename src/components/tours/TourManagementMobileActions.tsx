import { ExternalLink, MessageCircle, MoreHorizontal, Printer, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobileActionSheet } from "@/components/ui/mobile-action-sheet";

interface TourManagementMobileActionsProps {
  flexUuid: string | null;
  folderExists: boolean;
  isFlexLoading: boolean;
  isManagementUser: boolean;
  isPrintingSchedule: boolean;
  onFlexClick: () => void | Promise<void>;
  onOpenSettings: () => void;
  onOpenWhatsapp: () => void;
  onPrintSchedule: () => void | Promise<void>;
}

export const TourManagementMobileActions = ({
  flexUuid,
  folderExists,
  isFlexLoading,
  isManagementUser,
  isPrintingSchedule,
  onFlexClick,
  onOpenSettings,
  onOpenWhatsapp,
  onPrintSchedule,
}: TourManagementMobileActionsProps) => (
  <div className="flex w-full gap-2">
    <Button onClick={onOpenSettings} className="min-w-0 flex-1">
      <Settings className="mr-2 h-4 w-4" />
      Configuración
    </Button>
    <MobileActionSheet
      title="Acciones de la gira"
      description="Impresión, Flex y comunicación"
      groups={[{
        id: "tour-actions",
        actions: [
          {
            id: "print",
            label: isPrintingSchedule ? "Imprimiendo calendario…" : "Imprimir calendario",
            icon: Printer,
            disabled: isPrintingSchedule,
            onSelect: onPrintSchedule,
          },
          ...((folderExists || isFlexLoading) ? [{
            id: "flex",
            label: isFlexLoading ? "Cargando Flex…" : "Abrir en Flex",
            icon: ExternalLink,
            disabled: !flexUuid || isFlexLoading,
            onSelect: onFlexClick,
          }] : []),
          ...(isManagementUser ? [{
            id: "whatsapp",
            label: "Crear grupo de WhatsApp",
            icon: MessageCircle,
            onSelect: onOpenWhatsapp,
          }] : []),
        ],
      }]}
      trigger={(
        <Button variant="outline" className="gap-2">
          <MoreHorizontal className="h-4 w-4" />
          Más
        </Button>
      )}
    />
  </div>
);
