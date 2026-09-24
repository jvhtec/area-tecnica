import { IdCard, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOwnDriverDetails } from "@/features/logistics/fleet/useLogisticsFleet";
import { formatMadridDateKey, formatMadridDayKey } from "@/utils/timezoneUtils";

const formatDay = (dateKey: string | null) => (dateKey ? formatMadridDayKey(dateKey, "dd/MM/yyyy") : "Sin registrar");

/**
 * Read-only licence data for a driver's own profile. Logistics maintains it;
 * the driver only needs to see what is on record and when it expires.
 */
export function ConductorProfileCard({ profileId, className }: { profileId: string; className?: string }) {
  const { data, isLoading, error } = useOwnDriverDetails(profileId);
  const todayKey = formatMadridDateKey(new Date());

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IdCard className="h-5 w-5" />
          Datos de conductor
        </CardTitle>
        <CardDescription>Los mantiene logística. Si algo no es correcto, avísales.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : error ? (
          // Don't fall through to "Sin registrar": a failed read is not missing data.
          <p className="text-sm text-destructive">No se pudieron cargar tus datos de conductor. Inténtalo de nuevo más tarde.</p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Permisos</dt>
              <dd>{data?.license_categories.length ? data.license_categories.join(", ") : "Sin registrar"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Certificado ADR</dt>
              <dd>{data?.adr_certified ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Caducidad del permiso</dt>
              <dd className="flex items-center gap-2">
                {formatDay(data?.license_expiry ?? null)}
                {data?.license_expiry && data.license_expiry < todayKey && <Badge variant="destructive">Caducado</Badge>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Caducidad del CAP</dt>
              <dd className="flex items-center gap-2">
                {formatDay(data?.cap_expiry ?? null)}
                {data?.cap_expiry && data.cap_expiry < todayKey && <Badge variant="destructive">Caducado</Badge>}
              </dd>
            </div>
            {data?.notes && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Notas</dt>
                <dd className="break-words">{data.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
