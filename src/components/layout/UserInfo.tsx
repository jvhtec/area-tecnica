
import { useAuth } from "@/hooks/useAuth";

export const UserInfo = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="px-2 py-2 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Signed in as:
      </p>
      <p className="text-sm text-muted-foreground truncate text-left">
        {user.email}
      </p>
    </div>
  );
};
