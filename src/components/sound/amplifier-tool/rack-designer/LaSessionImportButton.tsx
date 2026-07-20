import type { RefObject } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface LaSessionImportButtonProps {
  inputRef: RefObject<HTMLInputElement | null>;
  isImporting: boolean;
  onImport: (file: File) => void;
}

export function LaSessionImportButton({
  inputRef,
  isImporting,
  onImport,
}: LaSessionImportButtonProps) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".nwm,.xmlp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onImport(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
        title="Importar sesión de L-Acoustics: Network Manager (.nwm) o Soundvision (.xmlp)"
      >
        <Upload className="h-3.5 w-3.5" />
        {isImporting ? 'Importando…' : 'Importar NM/SV'}
      </Button>
    </>
  );
}
