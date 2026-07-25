import type { ReactNode } from "react";
import { Download, Eye, Loader2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDocumentUploadDate } from "@/utils/jobDocuments";
import type { JobDocument } from "@/types/job";

interface JobDocumentRowProps {
  doc: JobDocument;
  isLoading?: boolean;
  onView: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  /** Management-only visibility toggle (e.g. a Switch), rendered above the action buttons. */
  visibilityControl?: ReactNode;
  /** Management-only "Visible/Oculto para técnicos" indicator, rendered alongside the other badges. */
  statusBadge?: ReactNode;
  /** Only needed by callers using a manual light/dark toggle instead of the Tailwind `dark:` variant. */
  isDark?: boolean;
  textMainClassName?: string;
  textMutedClassName?: string;
}

export const JobDocumentRow = ({
  doc,
  isLoading = false,
  onView,
  onDownload,
  onDelete,
  visibilityControl,
  statusBadge,
  isDark,
  textMainClassName = "text-foreground",
  textMutedClassName = "text-muted-foreground",
}: JobDocumentRowProps) => {
  const isTemplate = doc.template_type === "soundvision";
  const isReadOnly = Boolean(doc.read_only);

  const rowClassName =
    isDark === undefined
      ? "bg-slate-50 dark:bg-[#0f1219] border-slate-200 dark:border-[#1f232e]"
      : isDark
        ? "bg-[#0f1219] border-[#1f232e]"
        : "bg-slate-50 border-slate-200";

  return (
    <div className={`min-w-0 rounded-lg border p-4 ${rowClassName}`}>
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className={`mb-1 break-words text-sm font-bold ${textMainClassName}`}>{doc.file_name}</div>
          <div className={`break-words text-xs ${textMutedClassName}`}>
            {`Subido el ${formatDocumentUploadDate(doc.uploaded_at)}`}
            {isReadOnly && <span className="ml-2 italic">Solo lectura</span>}
          </div>
          {(isTemplate || statusBadge) && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {isTemplate && (
                <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide">
                  Plantilla SoundVision
                </Badge>
              )}
              {statusBadge}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:w-auto md:shrink-0">
          {visibilityControl}
          <div className={`grid w-full gap-2 md:flex md:w-auto ${onDelete ? "grid-cols-3" : "grid-cols-2"}`}>
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              disabled={isLoading}
              className="min-h-11 w-full md:min-h-9 md:w-auto"
              aria-label={`Ver ${doc.file_name}`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Eye size={14} className="mr-1" /> Ver
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isLoading}
              className="min-h-11 w-full md:min-h-9 md:w-auto"
              aria-label={`Descargar ${doc.file_name}`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download size={14} className="mr-1" /> Descargar
                </>
              )}
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                disabled={isLoading}
                className="min-h-11 w-full md:min-h-9 md:w-auto"
                aria-label={`Eliminar ${doc.file_name}`}
              >
                <Trash2 size={14} className="mr-1" /> Eliminar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
