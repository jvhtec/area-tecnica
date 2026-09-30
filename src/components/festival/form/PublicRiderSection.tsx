import { Download, Eye, FileText, Loader2, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOCUMENT_UPLOAD_ACCEPT } from "@/utils/documentUploadValidation";
import type { RiderFileRecord } from "@/components/festival/artistRequirementsFormModel";

interface PublicRiderSectionProps {
  riderMissing: boolean;
  riderFiles: readonly RiderFileRecord[];
  deletingRiderId: string | null;
  isUploadingRider: boolean;
  tx: (es: string, en: string) => string;
  formatFileSize: (size: number | null) => string;
  formatUploadedAt: (value: string | null) => string;
  onOpen: (file: RiderFileRecord) => void;
  onDownload: (file: RiderFileRecord) => void;
  onDelete: (file: RiderFileRecord) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** The artist's technical-rider files on the public form: list, view/download/delete, and upload. */
export const PublicRiderSection = ({
  riderMissing,
  riderFiles,
  deletingRiderId,
  isUploadingRider,
  tx,
  formatFileSize,
  formatUploadedAt,
  onOpen,
  onDownload,
  onDelete,
  onUpload,
}: PublicRiderSectionProps) => (
  <div className="space-y-4 border rounded-lg p-4">
    <h3 className="text-lg font-semibold">{tx("Rider Técnico", "Technical Rider")}</h3>

    {riderMissing && (
      <p className="text-sm font-medium text-destructive">
        {tx(
          "Aún no hemos recibido el rider técnico de este artista. Por favor súbelo en esta sección.",
          "We have not received this artist's technical rider yet. Please upload it in this section.",
        )}
      </p>
    )}

    {riderFiles.length > 0 ? (
      <div className="rounded-md border p-3 space-y-3">
        {riderFiles.map((file) => (
          <div key={file.id} className="flex flex-col gap-3 border rounded-md p-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                <span>{file.file_name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tx("Subido", "Uploaded")}: {formatUploadedAt(file.uploaded_at)} · {formatFileSize(file.file_size)}
              </p>
              {file.uploaded_by_name && (
                <p className="text-xs text-muted-foreground">
                  {tx("Subido por", "Uploaded by")}: {file.uploaded_by_name}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpen(file)}>
                <Eye className="h-4 w-4 mr-2" />
                {tx("Ver", "View")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onDownload(file)}>
                <Download className="h-4 w-4 mr-2" />
                {tx("Descargar", "Download")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletingRiderId === file.id}
                onClick={() => onDelete(file)}
              >
                {deletingRiderId === file.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {tx("Eliminar", "Delete")}
              </Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {tx(
            "Estos son los riders actuales que tenemos registrados. Si existe una versión más nueva, súbela usando el campo inferior y elimina las versiones erróneas.",
            "These are the rider files we currently have on file. If there is a newer version, upload it below and delete any incorrect versions.",
          )}
        </p>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">
        {tx(
          "No hay ningún rider cargado actualmente para este artista.",
          "There is currently no rider file uploaded for this artist.",
        )}
      </p>
    )}

    <div className="space-y-2">
      <label htmlFor="public-rider-upload" className="text-sm font-medium">
        {tx(
          "Subir rider(s) (PDF, Word, imagen, SoundVision, NWM o CAD)",
          "Upload rider file(s) (PDF, Word, image, SoundVision, NWM, or CAD)",
        )}
      </label>
      <Input
        id="public-rider-upload"
        type="file"
        accept={DOCUMENT_UPLOAD_ACCEPT}
        multiple
        onChange={onUpload}
        disabled={isUploadingRider}
      />
      {isUploadingRider && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tx("Subiendo rider...", "Uploading rider...")}
        </div>
      )}
    </div>
  </div>
);
