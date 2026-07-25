
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { JobCardDocumentActions } from "@/components/jobs/cards/JobCardDocumentActions";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useJobDocumentActions } from "@/hooks/useJobDocumentActions";
import { formatDocumentUploadDate } from "@/utils/jobDocuments";
import { isManagementRole } from "@/utils/permissions";
import type { JobDocument } from "@/types/job";

export type { JobDocument } from "@/types/job";

interface JobCardDocumentsProps {
  documents: JobDocument[];
  userRole: string | null;
  onDeleteDocument: (doc: JobDocument) => void;
  showTitle?: boolean;
}

export const JobCardDocuments: React.FC<JobCardDocumentsProps> = ({
  documents,
  userRole,
  onDeleteDocument,
  showTitle = true,
}) => {
  const canManageDocuments = isManagementRole(userRole);
  const { handleDownload, handleViewDocument } = useJobDocumentActions();

  if (documents.length === 0) {
    return null;
  }

  const handleToggleVisibility = async (doc: JobDocument) => {
    if (doc.read_only) {
      return;
    }
    try {
      const next = !doc.visible_to_tech;
      const { error } = await dataLayerClient.from('job_documents')
        .update({ visible_to_tech: next })
        .eq('id', doc.id);
      if (error) throw error;
      // Realtime subscription in parent hook will refresh the list
      try {
        // Notify assigned technicians about document visibility updates
        void dataLayerClient.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: next ? 'document.tech_visible.enabled' : 'document.tech_visible.disabled',
            doc_id: doc.id,
            file_name: doc.file_name,
          }
        });
      } catch { /* best-effort push notification; ignore delivery failures */ }
    } catch (err: any) {
      console.error('Error toggling document visibility:', err);
      alert(`Error al actualizar la visibilidad: ${err.message}`);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {showTitle && <div className="text-sm font-medium">Documentos</div>}
      <div className="space-y-2">
        {documents.map((doc) => {
          const isTemplate = doc.template_type === 'soundvision';
          const isReadOnly = Boolean(doc.read_only);
          return (
            <div
              key={doc.id}
              className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-md bg-accent/20 p-2 transition-colors hover:bg-accent/30 md:flex-row md:items-center md:justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {doc.file_name}
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {isTemplate && (
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                      Plantilla SoundVision
                    </Badge>
                  )}
                  {canManageDocuments && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${doc.visible_to_tech ? 'bg-green-500/20 text-green-800 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>
                      {doc.visible_to_tech ? 'Visible para técnicos' : 'Oculto para técnicos'}
                    </span>
                  )}
                  <span>
                    Subido el {formatDocumentUploadDate(doc.uploaded_at)}
                  </span>
                  {isReadOnly && (
                    <span className="italic">Solo lectura</span>
                  )}
                </div>
              </div>
              <JobCardDocumentActions
                fileName={doc.file_name}
                onView={() => handleViewDocument(doc)}
                onDownload={() => handleDownload(doc)}
                onDelete={canManageDocuments && !isReadOnly ? () => onDeleteDocument(doc) : undefined}
                visibilityControl={canManageDocuments ? (
                  <div className="mr-auto flex min-w-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground select-none">Visible para técnicos</span>
                    <Switch
                      className="shrink-0"
                      checked={Boolean(doc.visible_to_tech)}
                      onCheckedChange={() => handleToggleVisibility(doc)}
                      disabled={isReadOnly}
                    />
                  </div>
                ) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
