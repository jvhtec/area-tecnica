
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Profile } from "./types";
import { UsersListContent } from "./UsersListContent";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface UsersListProps {
  searchQuery?: string;
  roleFilter?: string;
  departmentFilter?: string;
}

export const UsersList = ({ 
  searchQuery = "", 
  roleFilter = "", 
  departmentFilter = "" 
}: UsersListProps) => {
  useTabVisibility(['profiles']);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
      });

      return () => subscription.unsubscribe();
    };

    checkAuth();
  }, []);

  const { data: users, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['profiles', searchQuery, roleFilter, departmentFilter],
    queryFn: async () => {
      if (!isAuthenticated) {
        console.log("Not authenticated, skipping profiles fetch");
        return [];
      }

      console.log("Starting profiles fetch with filters:", { searchQuery, roleFilter, departmentFilter });
      
      try {
        let query = supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, phone, department, dni, residencia');

        if (roleFilter) {
          query = query.eq('role', roleFilter);
        }

        if (departmentFilter) {
          query = query.eq('department', departmentFilter);
        }

        if (searchQuery) {
          query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
        }

        const { data: profileData, error: profileError } = await query;

        if (profileError) {
          console.error("Error in profiles fetch:", profileError);
          throw profileError;
        }

        if (!profileData) {
          console.log("No profiles found");
          return [];
        }

        const validProfiles = profileData.filter(profile => profile && profile.id);
        console.log("Profiles fetch successful:", validProfiles);
        return validProfiles;
      } catch (error) {
        console.error("Unexpected error in profiles fetch:", error);
        throw error;
      }
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (!isAuthenticated) {
    return (
      <Alert>
        <AlertDescription>Please sign in to view users.</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription className="flex items-center justify-between">
          <span>
            Error loading users: {error instanceof Error ? error.message : 'Network error occurred'}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="ml-2"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!users?.length) {
    return (
      <Alert>
        <AlertDescription>No users found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {isFetching && !isLoading && (
        <div className="text-xs text-muted-foreground">Refreshing...</div>
      )}
      <UsersListContent users={users} />
    </div>
  );
};
