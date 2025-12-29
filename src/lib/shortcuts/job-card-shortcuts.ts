/**
 * Job Card Action Shortcuts
 *
 * Registers shortcuts for performing actions on the selected job card.
 * Requires a job card to be selected first.
 */

import { useShortcutStore } from '@/stores/useShortcutStore';
import { useSelectedJobStore } from '@/stores/useSelectedJobStore';
import { toast } from 'sonner';

export interface JobCardActionShortcut {
  id: string;
  label: string;
  description: string;
  keybind?: string;
  icon?: string;
  requiresSelection: boolean;
  action: (jobId: string) => void | Promise<void>;
}

/**
 * Job card action shortcuts
 * Based on the actions found in JobCardActions.tsx
 */
export const JOB_CARD_ACTION_SHORTCUTS: Omit<JobCardActionShortcut, 'action'>[] = [
  {
    id: 'job-view-details',
    label: 'Ver Detalles',
    description: 'Abrir detalles del trabajo seleccionado',
    keybind: 'Ctrl+D',
    icon: 'Eye',
    requiresSelection: true,
  },
  {
    id: 'job-edit',
    label: 'Editar Trabajo',
    description: 'Editar el trabajo seleccionado',
    keybind: 'Ctrl+E',
    icon: 'Edit',
    requiresSelection: true,
  },
  {
    id: 'job-assign',
    label: 'Asignar Técnicos',
    description: 'Abrir diálogo de asignación de técnicos',
    keybind: 'Ctrl+A',
    icon: 'UserPlus',
    requiresSelection: true,
  },
  {
    id: 'job-refresh',
    label: 'Refrescar Datos',
    description: 'Refrescar los datos del trabajo',
    keybind: 'Ctrl+R',
    icon: 'RefreshCw',
    requiresSelection: true,
  },
  {
    id: 'job-sync-flex',
    label: 'Sincronizar con Flex',
    description: 'Sincronizar estado con Flex',
    keybind: 'Ctrl+Shift+S',
    icon: 'RefreshCcw',
    requiresSelection: true,
  },
  {
    id: 'job-timesheets',
    label: 'Gestionar Hojas de Tiempo',
    description: 'Abrir gestión de hojas de tiempo',
    keybind: 'Ctrl+T',
    icon: 'Clock',
    requiresSelection: true,
  },
  {
    id: 'job-pesos-calculator',
    label: 'Calculadora de Pesos',
    description: 'Abrir calculadora de pesos/equipamiento',
    keybind: 'Ctrl+P',
    icon: 'Weight',
    requiresSelection: true,
  },
  {
    id: 'job-consumos-calculator',
    label: 'Calculadora de Consumos',
    description: 'Abrir calculadora de consumo eléctrico',
    keybind: 'Ctrl+Shift+C',
    icon: 'Zap',
    requiresSelection: true,
  },
  {
    id: 'job-tasks',
    label: 'Abrir Tareas',
    description: 'Abrir gestor de tareas del trabajo',
    keybind: 'Ctrl+Shift+K',
    icon: 'CheckSquare',
    requiresSelection: true,
  },
  {
    id: 'job-transport',
    label: 'Solicitar Transporte',
    description: 'Abrir diálogo de solicitud de transporte',
    keybind: 'Ctrl+Shift+L',
    icon: 'Truck',
    requiresSelection: true,
  },
  {
    id: 'job-whatsapp-group',
    label: 'Crear Grupo WhatsApp',
    description: 'Crear grupo de WhatsApp para el trabajo',
    keybind: 'Ctrl+W',
    icon: 'MessageCircle',
    requiresSelection: true,
  },
  {
    id: 'job-create-flex-folders',
    label: 'Crear Carpetas Flex',
    description: 'Crear estructura de carpetas en Flex',
    keybind: 'Ctrl+Shift+F',
    icon: 'FolderPlus',
    requiresSelection: true,
  },
  {
    id: 'job-add-flex-folders',
    label: 'Añadir Carpetas Flex',
    description: 'Añadir carpetas adicionales en Flex',
    keybind: 'Ctrl+Alt+F',
    icon: 'FolderPlus',
    requiresSelection: true,
  },
  {
    id: 'job-create-local-folders',
    label: 'Crear Carpetas Locales',
    description: 'Crear estructura de carpetas locales',
    keybind: 'Ctrl+Shift+L',
    icon: 'Folder',
    requiresSelection: true,
  },
  {
    id: 'job-open-in-flex',
    label: 'Abrir en Flex',
    description: 'Navegar al navegador de archivos Flex',
    keybind: 'Ctrl+Shift+O',
    icon: 'ExternalLink',
    requiresSelection: true,
  },
  {
    id: 'job-upload-document',
    label: 'Subir Documento',
    description: 'Subir documento al trabajo',
    keybind: 'Ctrl+U',
    icon: 'Upload',
    requiresSelection: true,
  },
  {
    id: 'job-archive-to-flex',
    label: 'Archivar a Flex',
    description: 'Archivar documentos en Flex',
    keybind: 'Ctrl+Shift+A',
    icon: 'Archive',
    requiresSelection: true,
  },
  {
    id: 'job-backfill-docs',
    label: 'Backfill Documentación',
    description: 'Rellenar documentación técnica',
    icon: 'FileText',
    requiresSelection: true,
  },
  {
    id: 'job-view-sync-logs',
    label: 'Ver Logs de Sincronización',
    description: 'Ver logs de sincronización con Flex',
    icon: 'ListChecks',
    requiresSelection: true,
  },
  {
    id: 'job-delete',
    label: 'Eliminar Trabajo',
    description: 'Eliminar el trabajo seleccionado',
    keybind: 'Ctrl+Shift+Delete',
    icon: 'Trash2',
    requiresSelection: true,
  },
  {
    id: 'job-manage-festival',
    label: 'Gestionar Festival',
    description: 'Abrir gestión de festival',
    keybind: 'Ctrl+Shift+M',
    icon: 'Calendar',
    requiresSelection: true,
  },
];

/**
 * Register job card action shortcuts.
 * These shortcuts emit events that the JobCard components listen to.
 */
export function registerJobCardShortcuts() {
  const shortcutStore = useShortcutStore.getState();

  JOB_CARD_ACTION_SHORTCUTS.forEach((shortcut) => {
    shortcutStore.registerShortcut({
      id: shortcut.id,
      category: 'job-card',
      label: shortcut.label,
      description: shortcut.description,
      defaultKeybind: shortcut.keybind,
      requiresSelection: shortcut.requiresSelection,
      action: () => {
        const selectedJobStore = useSelectedJobStore.getState();
        const selectedJob = selectedJobStore.getSelectedJob();

        if (!selectedJob) {
          toast.error('No hay trabajo seleccionado', {
            description: 'Selecciona un trabajo primero',
          });
          return;
        }

        // Emit custom event for the job card to handle
        window.dispatchEvent(
          new CustomEvent('job-card-action', {
            detail: {
              action: shortcut.id,
              jobId: selectedJob.id,
            },
          })
        );
      },
    });
  });

  console.log(`✅ Registered ${JOB_CARD_ACTION_SHORTCUTS.length} job card action shortcuts`);
}

/**
 * Get the action ID from the shortcut ID
 */
export function getActionFromShortcutId(shortcutId: string): string {
  return shortcutId.replace('job-', '');
}
