import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ArtistTableHeaderProps {
  artistCount: number;
  /** Form links carry a bearer token, so only roles that may create them see the list. */
  canManageFormLinks: boolean;
  onViewLinks: () => void;
}

export const ArtistTableHeader = ({ artistCount, canManageFormLinks, onViewLinks }: ArtistTableHeaderProps) => (
  <div className="flex items-center justify-between py-4 px-2">
    <h2 className="text-xl md:text-2xl font-semibold leading-none tracking-tight">
      Cronograma de artistas ({artistCount} artistas)
    </h2>
    {canManageFormLinks && (
      <>
        <Button variant="outline" size="sm" onClick={onViewLinks} className="hidden md:flex">
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver todos los enlaces
        </Button>
        <Button variant="outline" size="icon" onClick={onViewLinks} className="md:hidden" aria-label="Ver todos los enlaces">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </>
    )}
  </div>
);
