import { ChevronDown, ChevronRight, Download, Eye } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { JobCardDocuments, type JobDocument } from "@/components/jobs/cards/JobCardDocuments";
import { Button } from "@/components/ui/button";
import { formatInJobTimezone, MADRID_TIMEZONE } from "@/utils/timezoneUtils";

interface StoredDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

interface RiderDocument extends StoredDocument {
  artist_id: string;
}

interface JobCardDocumentSectionsProps {
  jobType: string | null | undefined;
  userRole?: string | null;
  documents: JobDocument[];
  documentsCollapsed: boolean;
  setDocumentsCollapsed: Dispatch<SetStateAction<boolean>>;
  onDeleteDocument: (document: JobDocument) => void;
  tourDocuments: StoredDocument[];
  tourDocumentsCollapsed: boolean;
  setTourDocumentsCollapsed: Dispatch<SetStateAction<boolean>>;
  onViewTourDocument: (file: { file_path: string }) => void | Promise<void>;
  onDownloadTourDocument: (file: { file_path: string; file_name: string }) => void | Promise<void>;
  riderFiles: RiderDocument[];
  artistNameMap: Map<string, string>;
  ridersCollapsed: boolean;
  setRidersCollapsed: Dispatch<SetStateAction<boolean>>;
  onViewRider: (file: { file_path: string }) => void | Promise<void>;
  onDownloadRider: (file: { file_path: string; file_name: string }) => void | Promise<void>;
}

function SectionToggle({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full h-auto flex items-center justify-between text-left px-2 py-1"
      aria-expanded={!collapsed}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span className="text-sm font-medium">{label} ({count})</span>
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </Button>
  );
}

export function JobCardDocumentSections({
  jobType,
  userRole,
  documents,
  documentsCollapsed,
  setDocumentsCollapsed,
  onDeleteDocument,
  tourDocuments,
  tourDocumentsCollapsed,
  setTourDocumentsCollapsed,
  onViewTourDocument,
  onDownloadTourDocument,
  riderFiles,
  artistNameMap,
  ridersCollapsed,
  setRidersCollapsed,
  onViewRider,
  onDownloadRider,
}: JobCardDocumentSectionsProps) {
  if (jobType === "dryhire") return null;

  return (
    <>
      {documents.length > 0 && (
        <div className="mt-2">
          <SectionToggle
            label="Documentos"
            count={documents.length}
            collapsed={documentsCollapsed}
            onToggle={() => setDocumentsCollapsed((previous) => !previous)}
          />
          {!documentsCollapsed && (
            <div className="mt-1">
              <JobCardDocuments
                documents={documents}
                userRole={userRole || null}
                onDeleteDocument={onDeleteDocument}
                showTitle={false}
              />
            </div>
          )}
        </div>
      )}

      {tourDocuments.length > 0 && (
        <div className="mt-2">
          <SectionToggle
            label="Documentos de gira"
            count={tourDocuments.length}
            collapsed={tourDocumentsCollapsed}
            onToggle={() => setTourDocumentsCollapsed((previous) => !previous)}
          />
          {!tourDocumentsCollapsed && (
            <div className="mt-1 space-y-2">
              {tourDocuments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{file.file_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatInJobTimezone(file.uploaded_at, "MMM d, yyyy", MADRID_TIMEZONE)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="icon" title="Ver" onClick={() => onViewTourDocument(file)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" title="Descargar" onClick={() => onDownloadTourDocument(file)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {riderFiles.length > 0 && (
        <div className="mt-2">
          <SectionToggle
            label="Riders de artistas"
            count={riderFiles.length}
            collapsed={ridersCollapsed}
            onToggle={() => setRidersCollapsed((previous) => !previous)}
          />
          {!ridersCollapsed && (
            <div className="mt-1 space-y-2">
              {riderFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{file.file_name}</span>
                    <span className="text-xs text-muted-foreground">
                      Artista: {artistNameMap.get(file.artist_id) || "Desconocido"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="icon" title="Ver" onClick={() => onViewRider(file)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" title="Descargar" onClick={() => onDownloadRider(file)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
