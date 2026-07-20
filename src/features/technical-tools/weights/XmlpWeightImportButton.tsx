import { useRef } from 'react';
import { FileInput } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface XmlpWeightImportButtonProps {
  isImporting: boolean;
  onImport: (file: File) => void;
  title?: string;
}

export function XmlpWeightImportButton({
  isImporting,
  onImport,
  title = 'Crear requisitos de peso desde un proyecto Soundvision (.xmlp)',
}: XmlpWeightImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xmlp"
        className="hidden"
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onImport(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
        title={title}
      >
        <FileInput className="h-4 w-4" />
        {isImporting ? 'Extrayendo XMLP…' : 'Extraer de XMLP'}
      </Button>
    </>
  );
}
