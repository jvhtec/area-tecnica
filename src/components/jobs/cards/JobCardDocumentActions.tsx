import type { ReactNode } from "react";
import { Download, Eye, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface JobCardDocumentActionsProps {
  fileName: string;
  onDelete?: () => void;
  onDownload: () => void;
  onView: () => void;
  visibilityControl?: ReactNode;
}

export function JobCardDocumentActions({
  fileName,
  onDelete,
  onDownload,
  onView,
  visibilityControl,
}: JobCardDocumentActionsProps) {
  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-2 md:w-auto md:shrink-0">
      {visibilityControl}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onView}
          title="Ver"
          aria-label={`Ver ${fileName}`}
          className="h-11 w-11 shrink-0 md:h-9 md:w-9"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDownload}
          title="Descargar"
          aria-label={`Descargar ${fileName}`}
          className="h-11 w-11 shrink-0 md:h-9 md:w-9"
        >
          <Download className="h-4 w-4" />
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Eliminar"
            aria-label={`Eliminar ${fileName}`}
            className="h-11 w-11 shrink-0 md:h-9 md:w-9"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
