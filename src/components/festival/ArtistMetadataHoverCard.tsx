import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  useArtistExternalMetadata,
  useOverrideArtistExternalMetadata,
} from "@/hooks/useArtistExternalMetadata";

type ArtistMetadataHoverCardProps = {
  artistName: string;
  canManage: boolean;
  children: React.ReactNode;
};

export const ArtistMetadataHoverCard = ({ artistName, canManage, children }: ArtistMetadataHoverCardProps) => {
  const [open, setOpen] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [manualQid, setManualQid] = useState("");

  const metadataQuery = useArtistExternalMetadata(artistName, open);
  const overrideMutation = useOverrideArtistExternalMetadata();

  const metadata = metadataQuery.data;
  const isUncertain = metadata?.matchStatus === "needs_review" || metadata?.matchStatus === "no_match";

  const handleOverrideSubmit = () => {
    const qid = manualQid.trim();
    if (!qid) return;

    overrideMutation.mutate(
      { artistName, qid },
      {
        onSuccess: () => {
          setShowOverrideInput(false);
          setManualQid("");
        },
      },
    );
  };

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={350} closeDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        {metadataQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando información pública…
          </div>
        ) : metadataQuery.isError || !metadata || metadata.matchStatus === "no_match" ? (
          <p className="text-sm text-muted-foreground">No se encontró metadata pública para este artista.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              {metadata.thumbnailUrl && (
                <img
                  src={metadata.thumbnailUrl}
                  alt={metadata.displayArtistName}
                  className="h-14 w-14 flex-shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold">{metadata.displayArtistName}</p>
                {metadata.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{metadata.description}</p>
                )}
              </div>
            </div>

            {(metadata.country || metadata.foundedOrBirthYear || metadata.genres.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {metadata.country && <Badge variant="outline">{metadata.country}</Badge>}
                {metadata.foundedOrBirthYear && <Badge variant="outline">Desde {metadata.foundedOrBirthYear}</Badge>}
                {metadata.genres.slice(0, 2).map((genre) => (
                  <Badge key={genre} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {metadata.extract && <p className="line-clamp-3 text-xs text-muted-foreground">{metadata.extract}</p>}

            {metadata.wikipediaUrl && (
              <a
                href={metadata.wikipediaUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Wikipedia / Wikidata
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {isUncertain && canManage && (
              <div className="border-t pt-2">
                {showOverrideInput ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={manualQid}
                      onChange={(event) => setManualQid(event.target.value)}
                      placeholder="Q123456"
                      className="h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={handleOverrideSubmit}
                      disabled={overrideMutation.isPending || !manualQid.trim()}
                    >
                      {overrideMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Vincular"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setShowOverrideInput(true)}
                  >
                    Coincidencia dudosa · Vincular QID de Wikidata manualmente
                  </Button>
                )}
              </div>
            )}

            <p className="border-t pt-1.5 text-[10px] text-muted-foreground">
              Metadata pública de Wikimedia. Los datos del rider son internos.
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
