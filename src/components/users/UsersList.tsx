
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Profile } from "./types";
import { UsersListContent } from "./UsersListContent";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface UsersListProps {
  searchQuery?: string;
  roleFilter?: string;
  departmentFilter?: string;
  isManagementUser?: boolean;
}

interface QueryResult {
  data: Profile[];
  count: number;
}

const PAGE_SIZE = 10;

export const UsersList = ({ 
  searchQuery = "", 
  roleFilter = "", 
  departmentFilter = "",
  isManagementUser = false,
}: UsersListProps) => {
  useTabVisibility(['profiles']);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState<'department' | 'role' | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'department'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  const { data: users, isLoading, error, isFetching, refetch } = useQuery<QueryResult>({
    queryKey: ['profiles', searchQuery, roleFilter, departmentFilter, currentPage, sortBy, sortOrder],
    queryFn: async () => {
      if (!isAuthenticated) {
        console.log("Not authenticated, skipping profiles fetch");
        return { data: [], count: 0 };
      }

      console.log("Starting profiles fetch with filters:", { 
        searchQuery, roleFilter, departmentFilter, currentPage, sortBy, sortOrder 
      });
      
      try {
        let query = supabase
          .from('profiles')
          .select('id, first_name, nickname, last_name, email, role, phone, department, dni, residencia, assignable_as_tech, flex_resource_id, soundvision_access_enabled, autonomo', { count: 'exact' });

        // Apply filters
        if (roleFilter) {
          query = query.eq('role', roleFilter);
        }

        if (departmentFilter) {
          query = query.eq('department', departmentFilter);
        }

        if (searchQuery) {
          query = query.or(`first_name.ilike.%${searchQuery}%,nickname.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
        }

        // Apply sorting
        if (sortBy === 'name') {
          query = query.order('first_name', { ascending: sortOrder === 'asc' });
        } else {
          query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }

        // Apply pagination
        const start = (currentPage - 1) * PAGE_SIZE;
        query = query.range(start, start + PAGE_SIZE - 1);

        const { data: profileData, error: profileError, count } = await query;

        if (profileError) {
          console.error("Error in profiles fetch:", profileError);
          throw profileError;
        }

        if (!profileData) {
          console.log("No profiles found");
          return { data: [], count: 0 };
        }

        const validProfiles = profileData.filter(profile => profile && profile.id);
        console.log("Profiles fetch successful:", validProfiles);
        return { data: validProfiles, count: count || 0 };
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

  const totalPages = users?.count ? Math.ceil(users.count / PAGE_SIZE) : 0;

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

  if (!users?.data?.length) {
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

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={groupBy || 'none'} onValueChange={(value: string) => setGroupBy(value === 'none' ? null : value as 'department' | 'role')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Group by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="department">By Department</SelectItem>
              <SelectItem value="role">By Role</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: 'name' | 'email' | 'role' | 'department') => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="email">Sort by Email</SelectItem>
              <SelectItem value="role">Sort by Role</SelectItem>
              <SelectItem value="department">Sort by Department</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Total: {users.count} users
        </div>
      </div>

      <UsersListContent users={users.data} groupBy={groupBy} isManagementUser={isManagementUser} />

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
            </PaginationItem>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
