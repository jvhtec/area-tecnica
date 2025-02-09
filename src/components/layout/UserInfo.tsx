import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const UserInfo = () => {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session?.user) return null;

  return (
    <div className="px-2 py-2 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Signed in as:
      </p>
      <p className="text-sm text-muted-foreground truncate text-left">
        {session.user.email}
      </p>
    </div>
  );
};