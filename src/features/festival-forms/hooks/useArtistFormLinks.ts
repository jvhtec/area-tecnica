import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { fetchArtistFormLinks } from "../api";
import { festivalFormKeys } from "../keys";
import type { ArtistLinkRow } from "../links";

const NO_LINKS: ArtistLinkRow[] = [];

/** Every artist of the festival with the form link they were sent, for the links overview dialog. */
export function useArtistFormLinks(jobId: string, open: boolean) {
  const { toast } = useToast();
  const query = useQuery({
    queryKey: festivalFormKeys.links(jobId),
    queryFn: () => fetchArtistFormLinks(jobId),
    enabled: open && !!jobId,
    // Links are issued from another dialog; always show what exists right now.
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!query.error) return;
    void trackError(query.error, { system: "festivals", operation: "load-artist-form-links", jobId });
    toast({
      title: "Error",
      description: "No se pudieron obtener los enlaces de artistas",
      variant: "destructive",
    });
  }, [query.error, jobId, toast]);

  return { links: query.data ?? NO_LINKS, isLoading: query.isLoading };
}
