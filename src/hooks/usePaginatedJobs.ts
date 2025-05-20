
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { useMultiTableSubscription } from "@/hooks/useSubscription";

const PAGE_SIZE = 10;

export const usePaginatedJobs = (initialPage = 1) => {
  const [page, setPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);
  const queryClient = useQueryClient();

  // Set up multi-table subscriptions using our enhanced hooks
  useMultiTableSubscription([
    { table: 'jobs', queryKey: ['jobs', 'paginated'] },
    { table: 'job_date_types', queryKey: ['jobs', 'paginated'] },
    { table: 'job_assignments', queryKey: ['jobs', 'paginated'] }
  ]);

  const fetchJobs = async ({ pageParam = page }) => {
    console.log(`Fetching jobs page ${pageParam}, size ${PAGE_SIZE}...`);
    
    // First, get the total count for pagination
    const { count, error: countError } = await supabase
      .from("jobs")
      .select("*", { count: 'exact', head: true });
      
    if (countError) {
      console.error("Error fetching job count:", countError);
      throw countError;
    }
    
    setTotalCount(count || 0);
    
    // Then fetch the paginated data
    const from = (pageParam - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(`
        *,
        location:locations(name),
        job_departments!inner(department),
        job_assignments(
          technician_id,
          sound_role,
          lights_role,
          video_role,
          profiles(
            first_name,
            last_name
          )
        ),
        job_documents(*),
        tour_date:tour_dates(*)
      `)
      .order("start_time", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Error fetching paginated jobs:", error);
      throw error;
    }

    console.log(`Successfully fetched ${jobs?.length} jobs for page ${pageParam}`);
    return { jobs, page: pageParam, totalCount: count };
  };

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["jobs", "paginated", page],
    queryFn: () => fetchJobs({ pageParam: page }),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });

  const goToNextPage = () => {
    const nextPage = page + 1;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    
    if (nextPage <= totalPages) {
      setPage(nextPage);
      
      // Prefetch next page if it exists
      if (nextPage + 1 <= totalPages) {
        queryClient.prefetchQuery({
          queryKey: ["jobs", "paginated", nextPage + 1],
          queryFn: () => fetchJobs({ pageParam: nextPage + 1 }),
        });
      }
    }
  };

  const goToPreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const goToPage = (newPage: number) => {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return {
    jobs: data?.jobs || [],
    isLoading,
    error,
    page,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    goToNextPage,
    goToPreviousPage,
    goToPage,
    refetch,
    isRefetching,
  };
};
