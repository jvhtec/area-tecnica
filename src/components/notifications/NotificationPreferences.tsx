
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { notificationService } from "@/services/NotificationService";
import { useEffect } from "react";

export const NotificationPreferences = () => {
  const { preferences, loading, updatePreference } = useNotificationPreferences();

  useEffect(() => {
    // Initialize notification service
    notificationService.initialize();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Loading preferences...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which notifications you want to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="messages" className="flex flex-col space-y-1">
            <span>Messages</span>
            <span className="text-sm text-muted-foreground">
              Receive notifications for new messages
            </span>
          </Label>
          <Switch
            id="messages"
            checked={preferences?.messages}
            onCheckedChange={(checked) => updatePreference('messages', checked)}
          />
        </div>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="assignments" className="flex flex-col space-y-1">
            <span>Assignments</span>
            <span className="text-sm text-muted-foreground">
              Receive notifications for new job assignments
            </span>
          </Label>
          <Switch
            id="assignments"
            checked={preferences?.assignments}
            onCheckedChange={(checked) => updatePreference('assignments', checked)}
          />
        </div>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="form_submissions" className="flex flex-col space-y-1">
            <span>Form Submissions</span>
            <span className="text-sm text-muted-foreground">
              Receive notifications for artist form submissions
            </span>
          </Label>
          <Switch
            id="form_submissions"
            checked={preferences?.form_submissions}
            onCheckedChange={(checked) => updatePreference('form_submissions', checked)}
          />
        </div>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="gear_movements" className="flex flex-col space-y-1">
            <span>Gear Movements</span>
            <span className="text-sm text-muted-foreground">
              Receive notifications for equipment movements
            </span>
          </Label>
          <Switch
            id="gear_movements"
            checked={preferences?.gear_movements}
            onCheckedChange={(checked) => updatePreference('gear_movements', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
