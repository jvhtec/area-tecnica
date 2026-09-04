import { ArrowLeft, CheckSquare2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getSetupReturnPath } from '@/features/setup-workflows/returnNavigation';

export function SetupWorkflowReturnBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = getSetupReturnPath(searchParams);

  if (!returnPath) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm">
        <CheckSquare2 className="h-4 w-4 text-primary" />
        <span>Herramienta abierta desde la preparación guiada.</span>
      </div>
      <Button size="sm" className="gap-2" onClick={() => navigate(returnPath)}>
        <ArrowLeft className="h-4 w-4" />Volver a preparación guiada
      </Button>
    </div>
  );
}
