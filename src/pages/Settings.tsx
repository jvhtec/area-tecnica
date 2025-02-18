
import { Container } from "@/components/ui/container";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { Loader2 } from "lucide-react";
import { UsersList } from "@/components/users/UsersList";

const Settings = () => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Container>
    );
  }

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
            <UsersList />
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
