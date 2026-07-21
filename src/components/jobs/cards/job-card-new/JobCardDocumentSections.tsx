import { format } from "date-fns";
import { ChevronDown, ChevronRight, Download, Eye } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { JobCardDocuments, type JobDocument } from "../JobCardDocuments";

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
    <button
      type="button"
      className="w-full flex items-center justify-between text-left px-2 py-1 rounded hover:bg-accent/40"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span className="text-sm font-medium">{label} ({count})</span>
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
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
            label="Documents"
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
            label="Tour Documents"
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
                      {format(new Date(file.uploaded_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="p-1 hover:bg-accent rounded" title="View" onClick={() => onViewTourDocument(file)}>
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded" title="Download" onClick={() => onDownloadTourDocument(file)}>
                      <Download className="h-4 w-4" />
                    </button>
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
            label="Artist Riders"
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
                      Artist: {artistNameMap.get(file.artist_id) || "Unknown"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="p-1 hover:bg-accent rounded" title="View" onClick={() => onViewRider(file)}>
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded" title="Download" onClick={() => onDownloadRider(file)}>
                      <Download className="h-4 w-4" />
                    </button>
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
