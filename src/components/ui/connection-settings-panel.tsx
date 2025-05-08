
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { connectionConfig, ConnectionConfig } from "@/lib/connection-config";
import { useResetSubscriptions } from "@/hooks/useResetSubscriptions";
import { RefreshCw, Bug, Clock, Volume2, VolumeX, Activity, Zap } from "lucide-react";

export function ConnectionSettingsPanel() {
  const { resetAllSubscriptions, isResetting } = useResetSubscriptions();
  const [settings, setSettings] = useState<Partial<ConnectionConfig>>({
    showConnectionIndicator: connectionConfig.get().showConnectionIndicator,
    showReconnectNotifications: connectionConfig.get().showReconnectNotifications,
    quietMode: connectionConfig.get().quietMode,
    debugMode: connectionConfig.get().debugMode,
    verboseLogging: connectionConfig.get().verboseLogging
  });
  
  const [advanced, setAdvanced] = useState(false);
  
  const handleToggleSetting = (key: keyof ConnectionConfig, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Apply settings immediately
    connectionConfig.update(newSettings);
    
    // Show confirmation for important settings
    if (key === "quietMode") {
      toast.success(`Quiet mode ${value ? 'enabled' : 'disabled'}`);
    } else if (key === "debugMode") {
      toast.success(`Debug mode ${value ? 'enabled' : 'disabled'}`);
      
      // Also update verbose logging if enabling debug mode
      if (value) {
        setSettings(prev => ({ ...prev, verboseLogging: true }));
        connectionConfig.update({ verboseLogging: true });
      }
    }
  };
  
  const handleHeartbeatIntervalChange = (value: number[]) => {
    const heartbeatIntervalMs = value[0] * 1000;
    setSettings(prev => ({ ...prev, heartbeatIntervalMs }));
    connectionConfig.update({ heartbeatIntervalMs });
  };
  
  const handleReconnectBackoffChange = (value: number[]) => {
    const reconnectBackoffBaseMs = value[0] * 1000;
    setSettings(prev => ({ ...prev, reconnectBackoffBaseMs }));
    connectionConfig.update({ reconnectBackoffBaseMs });
  };
  
  const handleReset = async () => {
    const result = await resetAllSubscriptions();
    if (result) {
      toast.success("Connection settings applied and connections refreshed");
    }
  };
  
  const handleResetConfig = () => {
    const defaultConfig = connectionConfig.reset();
    setSettings({
      showConnectionIndicator: defaultConfig.showConnectionIndicator,
      showReconnectNotifications: defaultConfig.showReconnectNotifications,
      quietMode: defaultConfig.quietMode,
      debugMode: defaultConfig.debugMode,
      verboseLogging: defaultConfig.verboseLogging
    });
    toast.success("Connection settings reset to defaults");
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Connection Settings
        </CardTitle>
        <CardDescription>
          Configure connection behavior and notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-indicator" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Show Connection Indicator
              </Label>
              <p className="text-xs text-muted-foreground">
                Display connection status in the user interface
              </p>
            </div>
            <Switch
              id="show-indicator"
              checked={settings.showConnectionIndicator}
              onCheckedChange={(value) => handleToggleSetting('showConnectionIndicator', value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-notifications" className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Connection Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Show notifications when connection status changes
              </p>
            </div>
            <Switch
              id="show-notifications"
              checked={settings.showReconnectNotifications}
              onCheckedChange={(value) => handleToggleSetting('showReconnectNotifications', value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-mode" className="flex items-center gap-2">
                <VolumeX className="h-4 w-4" />
                Quiet Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Reduce non-critical notifications and popups
              </p>
            </div>
            <Switch
              id="quiet-mode"
              checked={settings.quietMode}
              onCheckedChange={(value) => handleToggleSetting('quietMode', value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="debug-mode" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable detailed connection logging in console
              </p>
            </div>
            <Switch
              id="debug-mode"
              checked={settings.debugMode}
              onCheckedChange={(value) => handleToggleSetting('debugMode', value)}
            />
          </div>
        </div>
        
        {settings.debugMode && (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-xs">
              Debug mode is enabled. Check the browser console for detailed connection logs.
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => setAdvanced(!advanced)}
        >
          {advanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
        </Button>
        
        {advanced && (
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="heartbeat-interval" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Heartbeat Interval
                </Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(connectionConfig.get().heartbeatIntervalMs / 1000)}s
                </span>
              </div>
              <Slider
                id="heartbeat-interval"
                defaultValue={[connectionConfig.get().heartbeatIntervalMs / 1000]}
                max={120}
                min={10}
                step={5}
                onValueChange={handleHeartbeatIntervalChange}
              />
              <p className="text-xs text-muted-foreground">
                Time between connection checks (seconds)
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reconnect-backoff" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Reconnect Base Delay
                </Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(connectionConfig.get().reconnectBackoffBaseMs / 1000)}s
                </span>
              </div>
              <Slider
                id="reconnect-backoff"
                defaultValue={[connectionConfig.get().reconnectBackoffBaseMs / 1000]}
                max={10}
                min={1}
                step={1}
                onValueChange={handleReconnectBackoffChange}
              />
              <p className="text-xs text-muted-foreground">
                Base delay before reconnect attempts
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="verbose-logging" className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Verbose Logging
                </Label>
                <p className="text-xs text-muted-foreground">
                  Log all connection events (very detailed)
                </p>
              </div>
              <Switch
                id="verbose-logging"
                checked={settings.verboseLogging}
                onCheckedChange={(value) => handleToggleSetting('verboseLogging', value)}
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button 
          className="w-full" 
          onClick={handleReset}
          disabled={isResetting}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
          {isResetting ? "Resetting Connections..." : "Reset All Connections"}
        </Button>
        {advanced && (
          <Button 
            variant="outline" 
            size="sm"
            className="w-full" 
            onClick={handleResetConfig}
          >
            Reset to Default Settings
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
