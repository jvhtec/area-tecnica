import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMemoriaUploadDate } from "@/features/technical-tools/memoria/dateFormat";
import type { DetectedMemoriaDocument } from "@/features/technical-tools/memoria/useMemoriaAutoFill";

interface MemoriaDetectedDocumentSelectProps {
  candidates: DetectedMemoriaDocument[];
  onSelect: (filePath: string) => void;
  sectionTitle: string;
  selected: DetectedMemoriaDocument;
}

const getDocumentLabel = (document: DetectedMemoriaDocument) => {
  const date = document.uploadedAt ? formatMemoriaUploadDate(document.uploadedAt) : "";
  return date ? `${document.fileName} (${date})` : document.fileName;
};

export const MemoriaDetectedDocumentSelect = ({
  candidates,
  onSelect,
  sectionTitle,
  selected,
}: MemoriaDetectedDocumentSelectProps) => {
  if (candidates.length <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        Detectado: {getDocumentLabel(selected)}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Documento detectado</Label>
      <Select value={selected.filePath} onValueChange={onSelect}>
        <SelectTrigger aria-label={`Documento para ${sectionTitle}`} className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((document) => (
            <SelectItem key={document.filePath} value={document.filePath}>
              {getDocumentLabel(document)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Se encontraron {candidates.length} documentos. Elige cuál incluir en la memoria.
      </p>
    </div>
  );
};
