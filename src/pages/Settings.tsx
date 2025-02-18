
import { Container } from "@/components/ui/container";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";

const Settings = () => {
  const { session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <Container>
      <div className="space-y-6">
        {/* User Management Section */}
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage users, roles, and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Add UsersList and CreateUserDialog components when implemented */}
          </CardContent>
        </Card>

        {/* Company Logo Section */}
        <Card>
          <CardHeader>
            <CardTitle>Company Logo</CardTitle>
            <CardDescription>
              Upload and manage your company logo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FestivalLogoManager jobId={session.user.id} />
          </CardContent>
        </Card>

        {/* Notification Preferences Section */}
        <NotificationPreferences />
      </div>
    </Container>
  );
};

export default Settings;
