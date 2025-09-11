import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface EmergencyBannerProps {
  onRefresh?: () => void;
}

export const EmergencyBanner = ({ onRefresh }: EmergencyBannerProps) => {
  return (
    <Alert variant="destructive" className="mb-4 border-orange-600 bg-orange-50 dark:bg-orange-950">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800 dark:text-orange-200">Emergency Mode Active</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <div className="text-orange-700 dark:text-orange-300">
          <span>
            Real-time updates have been temporarily disabled to restore database performance. 
            Data will refresh automatically every 10-15 minutes or you can refresh manually.
          </span>
        </div>
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="ml-4 border-orange-400 text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};