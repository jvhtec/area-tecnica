
import { PageHeader } from "@/components/ui/page-header";
import { ConnectionSettingsPanel } from "@/components/ui/connection-settings-panel";
import { SubscriptionStatus } from "@/components/ui/subscription-status";

export default function ConnectionSettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-8 max-w-3xl">
      <PageHeader 
        title="Connection Settings" 
        description="Manage real-time connection behavior and performance"
      />
      
      <div className="grid grid-cols-1 gap-8">
        <ConnectionSettingsPanel />
        <SubscriptionStatus />
      </div>
      
      <div className="rounded-lg border p-4 bg-muted/50">
        <h3 className="font-medium mb-2">About Real-Time Connections</h3>
        <p className="text-sm text-muted-foreground">
          This application uses real-time connections to keep your data synchronized
          across devices. If you're experiencing connection issues, you can adjust the
          settings above or manually reset connections.
        </p>
      </div>
    </div>
  );
}
