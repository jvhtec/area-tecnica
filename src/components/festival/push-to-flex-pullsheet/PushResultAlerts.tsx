import { CheckCircle2, XCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

interface PushResultAlertsProps {
  result: { succeeded: number; failed: Array<{ name: string; error: string }> };
}

/** The outcome of a push: what went in, and what Flex refused. */
export function PushResultAlerts({ result }: PushResultAlertsProps) {
  return (
    <div className="space-y-2">
      {result.succeeded > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Se enviaron {result.succeeded} artículos al pullsheet de Flex</AlertDescription>
        </Alert>
      )}
      {result.failed.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {result.failed.length} artículos fallaron:
            <div className="mt-1 text-xs max-h-20 overflow-y-auto">
              {result.failed.map((failure, index) => (
                <div key={index}>
                  {failure.name}: {failure.error}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
