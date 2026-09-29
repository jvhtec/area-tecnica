import type { ComponentProps } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { combineWavesDisplay } from "@/constants/wavesModels";
import { FOH_DRIVE_LABELS, CONSOLE_POSITION_LABELS, type FohDrive, type ConsolePosition } from "@/constants/consoleDrive";
import { formatFestivalDayKey } from "@/features/festival-management/dateFormatting";
import { getArtistRiderStatus } from "@/features/festival-management/selectors";
import { formatDifferentScheduleDate, getEffectiveSoundcheckDate } from "@/utils/artistScheduleDates";
import type { ArtistGearComparison } from "@/utils/gearComparisonService";
import type { Artist } from "@/components/festival/artistTableTypes";
import { formatInfrastructure, formatNotes, formatTime, formatTimeRange, formatWiredMics, formatWirelessSystems, renderProviderBadge } from "@/components/festival/artistTableFormatters";
import { ArtistActionButtons } from "../ArtistActionButtons";
import { GearMismatchIndicator } from "../GearMismatchIndicator";
import { OutdatedRiderBadge } from "../OutdatedRiderBadge";

/** Everything `ArtistActionButtons` needs except the artist itself and its gear comparison. */
export type ArtistRowActionProps = Omit<
  ComponentProps<typeof ArtistActionButtons<Artist>>,
  "artist" | "gearComparison"
>;

interface ArtistTableRowProps {
  artist: Artist;
  stageName: string;
  crossDateSearch: boolean;
  stagePlotUrl: string | undefined;
  gearComparison: ArtistGearComparison | undefined;
  actionProps: ArtistRowActionProps;
  /** Called after something on the row changed the artist (e.g. an outdated-rider warning was dismissed). */
  onArtistChanged?: () => void;
}

/** One desktop row of the artist table. The mobile layout renders `MobileArtistCard` instead. */
export const ArtistTableRow = ({
  artist,
  stageName,
  crossDateSearch,
  stagePlotUrl,
  gearComparison,
  actionProps,
  onArtistChanged,
}: ArtistTableRowProps) => (
  <TableRow>
    {/* Artista: name, badges, stage, plot thumbnail */}
    <TableCell className="px-2 py-2 align-top">
      <div className="space-y-1">
        <div className="font-medium text-sm break-words">{artist.name}</div>
        <div className="flex flex-wrap gap-1">
          {crossDateSearch && artist.date && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              {formatFestivalDayKey(artist.date, "d MMM", artist.date)}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1 py-0">{stageName}</Badge>
          {artist.artist_submitted && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-900 border-amber-300" title="Enviado por artista mediante formulario público">
              Enviado
            </Badge>
          )}
          {artist.isaftermidnight && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-700 text-white" title="Show después de medianoche">
              +24h
            </Badge>
          )}
        </div>
        {stagePlotUrl && (
          <button
            type="button"
            className="group relative h-10 w-16 overflow-hidden rounded border"
            onClick={() => window.open(stagePlotUrl, "_blank", "noopener,noreferrer")}
            title="Ver stage plot"
          >
            <img
              src={stagePlotUrl}
              alt={`Stage plot de ${artist.name}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        )}
      </div>
    </TableCell>

    {/* Horarios: load in, show, soundcheck, line check */}
    <TableCell className="px-2 py-2 align-top">
      <div className="text-xs space-y-0.5">
        {artist.load_in_time && (
          <div className="text-muted-foreground">Load in: {formatTime(artist.load_in_time)}</div>
        )}
        <div className="font-medium">Show: {formatTimeRange(artist.show_start, artist.show_end)}</div>
        {artist.soundcheck && (
          <div className="text-muted-foreground">SC: {[formatDifferentScheduleDate(getEffectiveSoundcheckDate(artist), artist.date),
            formatTimeRange(artist.soundcheck_start, artist.soundcheck_end)].filter(Boolean).join(" · ")}</div>
        )}
        {artist.line_check && (
          <div className="text-muted-foreground">LC: {formatTimeRange(artist.line_check_start, artist.line_check_end)}</div>
        )}
      </div>
    </TableCell>

    {/* Consolas: FOH/MON with provider, tech, drive and position */}
    <TableCell className="px-2 py-2 align-top">
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="break-words">FOH: {artist.foh_console || "Sin especificar"}</span>
          {renderProviderBadge(artist.foh_console_provided_by)}
          {artist.foh_tech && <Badge variant="outline" className="text-[10px] px-1 py-0">Téc</Badge>}
        </div>
        {(artist.foh_drive || artist.foh_drive_position) && (
          <div className="text-muted-foreground">
            Drive: {artist.foh_drive ? FOH_DRIVE_LABELS[artist.foh_drive as FohDrive] || artist.foh_drive : "-"}
            {artist.foh_drive_position && ` (${CONSOLE_POSITION_LABELS[artist.foh_drive_position as ConsolePosition] || artist.foh_drive_position})`}
          </div>
        )}
        {artist.monitors_from_foh ? (
          <div className="text-muted-foreground">MON desde FOH</div>
        ) : (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="break-words">MON: {artist.mon_console || "Sin especificar"}</span>
              {renderProviderBadge(artist.mon_console_provided_by)}
              {artist.mon_tech && <Badge variant="outline" className="text-[10px] px-1 py-0">Téc</Badge>}
            </div>
            {artist.mon_position && (
              <div className="text-muted-foreground">
                Pos: {CONSOLE_POSITION_LABELS[artist.mon_position as ConsolePosition] || artist.mon_position}
              </div>
            )}
          </>
        )}
      </div>
    </TableCell>

    {/* Waves/Outboard: FOH + MON */}
    <TableCell className="px-2 py-2 align-top">
      {(artist.foh_waves_models?.length || artist.foh_outboard ||
        (!artist.monitors_from_foh && (artist.mon_waves_models?.length || artist.mon_outboard))) ? (
        <div className="text-xs space-y-1 text-muted-foreground">
          {(artist.foh_waves_models?.length || artist.foh_outboard) && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="break-words">FOH: {combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard)}</span>
              {renderProviderBadge(artist.foh_waves_provided_by)}
            </div>
          )}
          {!artist.monitors_from_foh && (artist.mon_waves_models?.length || artist.mon_outboard) && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="break-words">MON: {combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard)}</span>
              {renderProviderBadge(artist.mon_waves_provided_by)}
            </div>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </TableCell>

    {/* RF/IEM */}
    <TableCell className="px-2 py-2 align-top">
      <div className="text-xs space-y-1">
        {(artist.wireless_provided_by || (artist.wireless_systems && artist.wireless_systems.length > 0)) && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="break-words" title={formatWirelessSystems(artist.wireless_systems)}>
              RF: {formatWirelessSystems(artist.wireless_systems)}
            </span>
            {renderProviderBadge(artist.wireless_provided_by)}
          </div>
        )}
        {(artist.iem_provided_by || (artist.iem_systems && artist.iem_systems.length > 0)) && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="break-words" title={formatWirelessSystems(artist.iem_systems, true)}>
              IEM: {formatWirelessSystems(artist.iem_systems, true)}
            </span>
            {renderProviderBadge(artist.iem_provided_by)}
          </div>
        )}
        {!artist.wireless_provided_by && !artist.iem_provided_by &&
          !(artist.wireless_systems?.length) && !(artist.iem_systems?.length) && (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    </TableCell>

    {/* Micrófonos */}
    <TableCell className="px-2 py-2 align-top">
      <div className="text-xs space-y-1">
        <Badge variant={
          artist.mic_kit === 'festival' ? 'default' :
          artist.mic_kit === 'mixed' ? 'secondary' :
          'outline'
        } className={`text-[10px] px-1 py-0 ${artist.mic_kit === 'mixed' ? 'bg-purple-100 text-purple-800' : ''}`}>
          {artist.mic_kit === 'festival' ? 'Festival' :
           artist.mic_kit === 'mixed' ? 'Mixto' :
           'Banda'}
        </Badge>
        {(artist.mic_kit === 'festival' || artist.mic_kit === 'mixed') && artist.wired_mics && artist.wired_mics.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-muted-foreground line-clamp-3 cursor-help break-words">
                {formatWiredMics(artist.wired_mics)}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-sm">{formatWiredMics(artist.wired_mics)}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TableCell>

    {/* Monitores y extras */}
    <TableCell className="px-2 py-2 align-top">
      <div className="flex flex-wrap gap-1">
        {artist.monitors_enabled ? (
          <Badge variant="secondary" className="text-[10px] px-1 py-0" title="Cuñas de monitor">
            {artist.monitors_quantity}x
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1 py-0">0x</Badge>
        )}
        {artist.extras_sf && <Badge variant="outline" className="text-[10px] px-1 py-0" title="Side fill">SF</Badge>}
        {artist.extras_df && <Badge variant="outline" className="text-[10px] px-1 py-0" title="Drum fill">DF</Badge>}
        {artist.extras_djbooth && <Badge variant="outline" className="text-[10px] px-1 py-0" title="DJ booth">DJ</Badge>}
      </div>
    </TableCell>

    {/* Infraestructura */}
    <TableCell className="px-2 py-2 align-top">
      <div className="text-xs space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-muted-foreground line-clamp-3 cursor-help break-words">
              {formatInfrastructure(artist)}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-sm">
              <p className="font-medium">Requisitos de infraestructura:</p>
              <p>{formatInfrastructure(artist)}</p>
              {artist.infrastructure_provided_by && (
                <p className="text-xs mt-1">Provisto por: {artist.infrastructure_provided_by}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        {renderProviderBadge(artist.infrastructure_provided_by)}
      </div>
    </TableCell>

    {/* Notas */}
    <TableCell className="px-2 py-2 align-top">
      {artist.notes && artist.notes.trim() !== '' ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-xs text-muted-foreground line-clamp-3 cursor-help break-words">
              {formatNotes(artist.notes)}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-sm">
              <p className="font-medium">Notas:</p>
              <p className="whitespace-pre-wrap">{artist.notes}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </TableCell>

    {/* Estado: rider + material */}
    <TableCell className="px-2 py-2 align-top">
      <div className="flex flex-col items-start gap-1">
        {getArtistRiderStatus(artist) === "outdated" ? (
          <OutdatedRiderBadge
            artistId={artist.id}
            copiedFromDate={artist.rider_copied_from_date}
            onDismissed={() => onArtistChanged?.()}
            compact
          />
        ) : (
          <Badge variant={artist.rider_missing ? "destructive" : "default"} className="text-[10px] px-1 py-0">
            {artist.rider_missing ? "Faltante" : "Completo"}
          </Badge>
        )}
        {gearComparison ? (
          <GearMismatchIndicator mismatches={gearComparison.mismatches} compact />
        ) : (
          <Badge variant="outline" className="text-[10px] px-1 py-0" title="Sin configuración de material del festival">
            Sin conf.
          </Badge>
        )}
      </div>
    </TableCell>

    {/* Acciones */}
    <TableCell className="px-2 py-2 align-top">
      <ArtistActionButtons artist={artist} gearComparison={gearComparison} {...actionProps} />
    </TableCell>
  </TableRow>
);
