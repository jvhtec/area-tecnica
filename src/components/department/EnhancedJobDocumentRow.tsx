import { Download, Eye, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDocumentUploadDate } from "@/components/department/enhancedJobDetailsModel";
import type { JobDocument } from "@/types/job";

interface EnhancedJobDocumentRowProps {
  doc: JobDocument;
  isDark: boolean;
  isLoading: boolean;
  onDownload: () => void;
  onView: () => void;
  textMainClassName: string;
  textMutedClassName: string;
}

export const EnhancedJobDocumentRow = ({
  doc,
  isDark,
  isLoading,
  onDownload,
  onView,
  textMainClassName,
  textMutedClassName,
}: EnhancedJobDocumentRowProps) => (
  <div
    className={`${isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-slate-50 border-slate-200"} min-w-0 rounded-lg border p-4`}
  >
    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className={`mb-1 break-words text-sm font-bold ${textMainClassName}`}>{doc.file_name}</div>
        <div className={`break-words text-xs ${textMutedClassName}`}>
          {doc.uploaded_at && `Subido el ${formatDocumentUploadDate(doc.uploaded_at)}`}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {doc.template_type === "soundvision" && (
            <Badge variant="outline" className="text-xs">SoundVision</Badge>
          )}
          {doc.read_only && (
            <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-500">Solo lectura</Badge>
          )}
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
          disabled={isLoading}
          className="min-h-11 w-full md:min-h-9 md:w-auto"
          aria-label={`Ver ${doc.file_name}`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye size={14} className="mr-1" /> Ver</>}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={isLoading}
          className="min-h-11 w-full md:min-h-9 md:w-auto"
          aria-label={`Descargar ${doc.file_name}`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download size={14} className="mr-1" /> Descargar</>}
        </Button>
      </div>
    </div>
  </div>
);
