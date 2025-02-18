
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";

const Settings = () => {
  return (
    <Container>
      <div className="space-y-6">
        <ThemeToggle />
        <NotificationPreferences />
      </div>
    </Container>
  );
};

export default Settings;
