import { useMemo } from "react";
import { CalendarIcon, Clock, Loader2, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatFestivalDayKey } from "@/features/festival-management/dateFormatting";
import type { CopySearchResult } from "@/features/festival-artists/api";
import { COPY_SEARCH_LIMIT, COPY_SEARCH_MIN_LENGTH } from "@/features/festival-artists/hooks/useCopyArtistsData";

interface CopySearchTabProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  /** The trimmed, debounced term the results belong to. */
  debouncedSearch: string;
  results: CopySearchResult[];
  isSearching: boolean;
  selectedIds: string[];
  onToggle: (artistId: string) => void;
}

/**
 * When the same artist name shows up several times, the newest instance is flagged (results are
 * date-descending, so the first occurrence per name is the most recent) so the user can copy the
 * freshest rider at a glance.
 */
const useDuplicateNames = (results: CopySearchResult[]) =>
  useMemo(() => {
    const counts = new Map<string, number>();
    const recentId = new Map<string, string>();
    for (const artist of results) {
      const key = artist.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!recentId.has(key) && artist.date) recentId.set(key, artist.id);
    }
    const duplicated = new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
    return { duplicated, recentId };
  }, [results]);

/** Global name search across every other festival. */
export const CopySearchTab = ({
  searchTerm,
  onSearchTermChange,
  debouncedSearch,
  results,
  isSearching,
  selectedIds,
  onToggle,
}: CopySearchTabProps) => {
  const { duplicated, recentId } = useDuplicateNames(results);
  const tooShort = debouncedSearch.length > 0 && debouncedSearch.length < COPY_SEARCH_MIN_LENGTH;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          autoFocus
          placeholder="Buscar artista por nombre en todos los festivales..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="pl-10"
          aria-label="Buscar artista por nombre"
        />
        {isSearching && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {tooShort ? (
        <p className="text-sm text-muted-foreground px-1">
          Escribe al menos {COPY_SEARCH_MIN_LENGTH} caracteres para buscar.
        </p>
      ) : debouncedSearch.length >= COPY_SEARCH_MIN_LENGTH ? (
        results.length > 0 ? (
          <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
            {results.map((artist) => {
              const nameKey = artist.name.trim().toLowerCase();
              const isMostRecent = duplicated.has(nameKey) && recentId.get(nameKey) === artist.id;
              return (
                <label
                  key={artist.id}
                  htmlFor={`search-${artist.id}`}
                  className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                >
                  <Checkbox
                    id={`search-${artist.id}`}
                    checked={selectedIds.includes(artist.id)}
                    onCheckedChange={() => onToggle(artist.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{artist.name}</span>
                      <Badge variant="secondary" className="text-xs">Stage {artist.stage}</Badge>
                      {isMostRecent && (
                        <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">
                          Más reciente
                        </Badge>
                      )}
                      {artist.show_start && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {artist.show_start}
                          {artist.show_end ? ` - ${artist.show_end}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 font-medium shrink-0">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {artist.date ? formatFestivalDayKey(artist.date, "d MMM yyyy", artist.date) : "Sin fecha"}
                      </Badge>
                      <span className="truncate">{artist.jobTitle}</span>
                    </div>
                  </div>
                </label>
              );
            })}
            {results.length >= COPY_SEARCH_LIMIT && (
              <p className="text-xs text-muted-foreground px-2 pt-1">
                Mostrando los primeros {COPY_SEARCH_LIMIT} resultados. Refina la búsqueda para ver más.
              </p>
            )}
          </div>
        ) : (
          !isSearching && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron artistas que coincidan con "{debouncedSearch}".</p>
            </div>
          )
        )
      ) : (
        <p className="text-sm text-muted-foreground px-1">
          Busca cualquier artista por nombre; los resultados incluyen su festival, fecha y stage de origen.
        </p>
      )}
    </div>
  );
};
