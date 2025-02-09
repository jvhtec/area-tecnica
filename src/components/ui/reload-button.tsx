import React from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReloadButtonProps {
  onReload: () => Promise<void>;
  className?: string;
}

export const ReloadButton = ({ onReload, className }: ReloadButtonProps) => {
  const { toast } = useToast();
  const [isReloading, setIsReloading] = React.useState(false);

  const handleReload = async () => {
    try {
      setIsReloading(true);
      await onReload();
      toast({
        title: "Reloaded",
        description: "Data has been refreshed successfully",
      });
    } catch (error) {
      console.error("Error reloading data:", error);
      toast({
        title: "Error",
        description: "Failed to reload data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleReload}
      disabled={isReloading}
      className={cn("shrink-0", className)}
      title="Reload data"
    >
      <RefreshCw className={cn("h-4 w-4", isReloading && "animate-spin")} />
    </Button>
  );
};