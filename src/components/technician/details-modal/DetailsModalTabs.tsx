import { parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Car,
  Download,
  Eye,
  FileText,
  Loader2,
  Map as MapIcon,
  MapPin,
  User,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TourDocumentUploader } from "@/components/tours/TourDocumentUploader";
import {
  formatCompanyLabel,
  formatDateTimeLabel,
  formatRoomTypeLabel,
  formatShiftTime,
  formatTransportCategory,
  getDateTypeBadgeClass,
  getDateTypeLabel,
  getJobTypeLabel,
  getLogisticsTransportTypeLabel,
  getTravelTransportTypeLabel,
} from "@/components/technician/details-modal/formatters";
import type { DetailsModalViewModel } from "@/components/technician/details-modal/useDetailsModalData";
import type { JobDocument, StaffAssignment } from "@/types/job";
import { labelForCode } from "@/utils/roles";

type TabProps = {
  vm: DetailsModalViewModel;
};

const madridTimeZone = "Europe/Madrid";

export { RestaurantsTab, WeatherTab } from "@/components/technician/details-modal/DetailsModalEnvironmentTabs";

export const InfoTab = ({ vm }: TabProps) => {
  const {
    allAssignedDates,
    dateTypeMap,
    festivalStageNameMap,
    getRoomOccupantsLabel,
    handleOpenAddressInMaps,
    hasHojaAccommodationData,
    hojaAccommodations,
    hojaAccommodationsLoading,
    hojaDeRutaLoading,
    isDark,
    job,
    jobDateTypesLoading,
    jobEndDate,
    jobStartDate,
    roomOccupantsLoading,
    roomStaffIds,
    techShiftAssignmentsByDate,
    techShiftAssignmentsLoading,
    theme,
    user,
  } = vm;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div>
        <h1 className={`text-2xl font-bold ${theme.textMain} mb-4`}>{job?.title}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Hora de inicio</label>
            <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>{jobStartDate}</div>
          </div>
          <div>
            <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Hora de finalización</label>
            <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>{jobEndDate}</div>
          </div>
        </div>

        <div className="mb-4">
          <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Tipo de trabajo</label>
          <div className="mt-2">
            <span className={`px-3 py-1 rounded-full ${isDark ? "bg-[#1a1d26] border-[#2a2e3b]" : "bg-slate-100 border-slate-200"} border text-xs ${theme.textMain} font-medium`}>
              {getJobTypeLabel(job?.job_type)}
            </span>
          </div>
        </div>
      </div>

      {user?.id && (
        <div>
          <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>Mis fechas asignadas</label>
          {vm.assignedDatesLoading || jobDateTypesLoading || techShiftAssignmentsLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className={theme.textMuted}>Cargando fechas...</span>
            </div>
          ) : allAssignedDates.length > 0 ? (
            <div className="space-y-2">
              {allAssignedDates.map((date) => {
                const dateTypeValue = dateTypeMap.get(date);
                const dateShiftAssignments = techShiftAssignmentsByDate.get(date) || [];
                return (
                  <div
                    key={date}
                    className={`p-3 rounded-lg ${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarIcon size={14} className={theme.textMuted} />
                        <span className={`text-sm font-medium ${theme.textMain}`}>
                          {formatInTimeZone(parseISO(date), "Europe/Madrid", "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                        </span>
                      </div>
                      {dateTypeValue && (
                        <Badge
                          variant="outline"
                          className={`text-xs font-bold border ${getDateTypeBadgeClass(dateTypeValue, isDark)}`}
                        >
                          {getDateTypeLabel(dateTypeValue)}
                        </Badge>
                      )}
                    </div>

                    {dateShiftAssignments.length > 0 && (
                      <div className="mt-2 pl-6 space-y-1">
                        {dateShiftAssignments.map((assignment) => {
                          const stageLabel = assignment.shift.stage != null
                            ? (festivalStageNameMap.get(assignment.shift.stage) || `Escenario ${assignment.shift.stage}`)
                            : "Escenario sin definir";
                          const roleLabel = labelForCode(assignment.role) || assignment.role;
                          const timeRange = `${formatShiftTime(assignment.shift.start_time)} - ${formatShiftTime(assignment.shift.end_time)}`;

                          return (
                            <div key={assignment.assignment_id} className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-xs font-semibold ${theme.textMain}`}>{assignment.shift.name}</span>
                              <span className={`text-[11px] ${theme.textMuted}`}>{timeRange}</span>
                              <Badge variant="outline" className="text-[10px]">{stageLabel}</Badge>
                              <Badge variant="outline" className="text-[10px]">{roleLabel}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`text-sm ${theme.textMuted} italic`}>No hay fechas asignadas para este trabajo</div>
          )}
        </div>
      )}

      {(hojaDeRutaLoading || hojaAccommodationsLoading || hasHojaAccommodationData) && (
        <div>
          <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>Alojamiento y rooming</label>

          {hojaDeRutaLoading || hojaAccommodationsLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className={theme.textMuted}>Cargando alojamiento...</span>
            </div>
          ) : hasHojaAccommodationData ? (
            <div className="space-y-3">
              {hojaAccommodations.map((accommodation) => {
                const rooms = accommodation.hoja_de_ruta_room_assignments || [];
                return (
                  <div
                    key={accommodation.id}
                    className={`p-3 rounded-lg ${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${theme.textMain}`}>{accommodation.hotel_name}</div>
                        {accommodation.address && (
                          <div className={`text-xs ${theme.textMuted} mt-1`}>{accommodation.address}</div>
                        )}
                      </div>
                      {accommodation.address && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenAddressInMaps(accommodation.address || "")}>
                          <MapPin size={12} className="mr-1" /> Mapa
                        </Button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Check-in</div>
                        <div className={`text-xs ${theme.textMain}`}>{formatDateTimeLabel(accommodation.check_in)}</div>
                      </div>
                      <div>
                        <div className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Check-out</div>
                        <div className={`text-xs ${theme.textMain}`}>{formatDateTimeLabel(accommodation.check_out)}</div>
                      </div>
                    </div>

                    {rooms.length > 0 ? (
                      <div className={`mt-3 pt-3 border-t ${theme.divider} space-y-1.5`}>
                        {rooms.map((room) => (
                          <div key={room.id} className="text-xs">
                            <div className={`font-medium ${theme.textMain}`}>
                              {formatRoomTypeLabel(room.room_type)}{room.room_number ? ` · ${room.room_number}` : ""}
                            </div>
                            <div className={theme.textMuted}>{getRoomOccupantsLabel(room)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`mt-3 text-xs ${theme.textMuted} italic`}>Sin habitaciones asignadas todavía</div>
                    )}
                  </div>
                );
              })}

              {roomStaffIds.length > 0 && roomOccupantsLoading && (
                <div className="flex items-center gap-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  <span className={theme.textMuted}>Resolviendo nombres de rooming...</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {job?.description && (
        <div>
          <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Descripción</label>
          <p className={`text-sm ${theme.textMain} mt-2 leading-relaxed`}>{job.description}</p>
        </div>
      )}

      <div>
        <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Recinto</label>
        <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>{job?.location?.name || "Sin ubicación"}</div>
      </div>
    </div>
  );
};

export const LocationTab = ({ vm }: TabProps) => {
  const { handleOpenMaps, isDark, isMapLoading, jobDetailsLoading, locationData, mapPreviewUrl, theme } = vm;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      {jobDetailsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : locationData ? (
        <>
          <div className="flex justify-between items-start">
            <div>
              <h2 className={`text-lg font-bold ${theme.textMain}`}>{locationData?.name || "Sin ubicación"}</h2>
              <p className={`text-sm ${theme.textMuted} mt-1 max-w-xs leading-relaxed`}>
                {locationData?.formatted_address || ("address" in locationData ? locationData.address : undefined) || "Dirección no disponible"}
              </p>
            </div>
            <Button onClick={handleOpenMaps} size="sm" className="whitespace-nowrap">
              <MapIcon size={14} className="mr-2" /> Abrir mapas
            </Button>
          </div>

          {isMapLoading && (
            <div className={`rounded-xl overflow-hidden border ${theme.divider} h-48 ${isDark ? "bg-[#0a0c10]" : "bg-slate-100"} flex items-center justify-center`}>
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className={`text-sm ${theme.textMuted}`}>Cargando vista previa del mapa...</p>
              </div>
            </div>
          )}
          {!isMapLoading && mapPreviewUrl && (
            <div className={`rounded-xl overflow-hidden border ${theme.divider}`}>
              <img
                src={mapPreviewUrl}
                alt="Mapa del recinto"
                width={600}
                height={300}
                loading="lazy"
                decoding="async"
                className="w-full h-auto"
              />
              <div className="p-3 flex justify-end">
                <Button size="sm" onClick={handleOpenMaps}>Ver indicaciones</Button>
              </div>
            </div>
          )}
          {!isMapLoading && !mapPreviewUrl && (
            <div className={`rounded-xl overflow-hidden border ${theme.divider} relative h-48 ${isDark ? "bg-[#0a0c10]" : "bg-slate-100"}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin size={32} className={theme.textMuted} />
                  <p className={`text-xs ${theme.textMuted} mt-2`}>Vista previa del mapa no disponible</p>
                  <Button size="sm" onClick={handleOpenMaps} className="mt-3">Abrir Google Maps</Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={`h-48 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
          <MapPin size={32} className="mb-2 opacity-50" />
          <span className="text-sm">No hay información de ubicación disponible</span>
        </div>
      )}
    </div>
  );
};

export const TransportTab = ({ vm }: TabProps) => {
  const {
    handleOpenAddressInMaps,
    hasHojaTransportData,
    hojaDeRutaId,
    hojaTransportEntries,
    hojaTravelArrangements,
    isDark,
    isTransportDataLoading,
    theme,
  } = vm;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <Car size={18} className={theme.textMuted} />
        <h3 className={`text-lg font-bold ${theme.textMain}`}>Transporte</h3>
      </div>

      {isTransportDataLoading ? (
        <div className="flex items-center gap-2 text-sm py-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className={theme.textMuted}>Cargando detalles de transporte...</span>
        </div>
      ) : !hojaDeRutaId ? (
        <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
          <span className="text-xs text-center px-4">Este trabajo no tiene hoja de ruta vinculada.</span>
        </div>
      ) : !hasHojaTransportData ? (
        <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
          <span className="text-xs text-center px-4">No hay detalles de transporte disponibles en la hoja de ruta.</span>
        </div>
      ) : (
        <>
          {hojaTravelArrangements.length > 0 && (
            <div>
              <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>
                Traslados de viaje ({hojaTravelArrangements.length})
              </label>
              <div className="space-y-2">
                {hojaTravelArrangements.map((travel) => {
                  const missingCoreDetails = [
                    travel.pickup_time,
                    travel.departure_time,
                    travel.arrival_time,
                    travel.pickup_address,
                  ].filter((value) => !value).length;

                  return (
                    <div key={travel.id} className={`${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border rounded-lg p-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className={`text-sm font-semibold ${theme.textMain}`}>{getTravelTransportTypeLabel(travel.transportation_type)}</div>
                        <div className="flex items-center gap-1">
                          {travel.pickup_time && <Badge variant="outline" className="text-[10px]">{formatDateTimeLabel(travel.pickup_time)}</Badge>}
                          {missingCoreDetails >= 3 && (
                            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                              Pendiente de confirmar
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <TransportField label="Punto de recogida" value={travel.pickup_address || "Pendiente"} theme={theme} />
                        <TransportField label="Referencia" value={travel.flight_train_number || "Pendiente"} theme={theme} />
                        <TransportField label="Hora salida" value={formatDateTimeLabel(travel.departure_time)} theme={theme} />
                        <TransportField label="Hora llegada" value={formatDateTimeLabel(travel.arrival_time)} theme={theme} />
                        <TransportField label="Conductor" value={travel.driver_name || "Pendiente"} theme={theme} />
                        <TransportField label="Contacto" value={travel.driver_phone || "Pendiente"} theme={theme} />
                        <TransportField label="Matrícula" value={travel.plate_number || "Pendiente"} theme={theme} />
                      </div>

                      {(travel.pickup_address || travel.notes) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {travel.pickup_address && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenAddressInMaps(travel.pickup_address || "")}>
                              <MapPin size={12} className="mr-1" /> Ver recogida
                            </Button>
                          )}
                          {travel.notes && (
                            <span className={`text-xs ${theme.textMuted}`}>
                              Nota: <span className={theme.textMain}>{travel.notes}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hojaTransportEntries.length > 0 && (
            <div>
              <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>
                Transporte logístico ({hojaTransportEntries.length})
              </label>
              <div className="space-y-2">
                {hojaTransportEntries.map((transport) => (
                  <div key={transport.id} className={`${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border rounded-lg p-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className={`text-sm font-semibold ${theme.textMain}`}>{getLogisticsTransportTypeLabel(transport.transport_type)}</div>
                      <Badge variant="outline" className="text-[10px]">{formatDateTimeLabel(transport.date_time)}</Badge>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <TransportField label="Empresa" value={formatCompanyLabel(transport.company)} theme={theme} />
                      <TransportField label="Conductor" value={transport.driver_name || "Pendiente"} theme={theme} />
                      <TransportField label="Contacto" value={transport.driver_phone || "Pendiente"} theme={theme} />
                      <TransportField label="Matrícula" value={transport.license_plate || "Pendiente"} theme={theme} />
                      <TransportField label="Vuelta" value={transport.has_return ? formatDateTimeLabel(transport.return_date_time) : "No"} theme={theme} />
                    </div>

                    {transport.logistics_categories && transport.logistics_categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {transport.logistics_categories.map((category) => (
                          <Badge key={`${transport.id}-${category}`} variant="outline" className="text-[10px]">
                            {formatTransportCategory(category)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const TransportField = ({ label, value, theme }: { label: string; value: string; theme: DetailsModalViewModel["theme"] }) => (
  <div>
    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>{label}</div>
    <div className={theme.textMain}>{value}</div>
  </div>
);

export const PersonnelTab = ({ vm }: TabProps) => {
  const { getDepartmentFromAssignment, getRoleFromAssignment, isDark, roomieNamesByTechId, staffAssignments, staffLoading, theme } = vm;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <User size={18} className={theme.textMuted} />
        <h3 className={`text-lg font-bold ${theme.textMain}`}>Personal asignado</h3>
      </div>

      {staffLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : staffAssignments.length === 0 ? (
        <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
          <User size={24} className="mb-2 opacity-50" />
          <span className="text-xs">No hay personal asignado</span>
        </div>
      ) : (
        <div className="space-y-2">
          {staffAssignments.map((assignment: StaffAssignment, idx) => {
            const tech = assignment.technician;
            const dept = getDepartmentFromAssignment(assignment);
            const role = getRoleFromAssignment(assignment);
            const roomieNames = tech?.id ? (roomieNamesByTechId.get(tech.id) || []) : [];
            const deptColors: Record<string, string> = {
              sound: "text-blue-400 bg-blue-900/30 border-blue-900/50",
              lights: "text-amber-400 bg-amber-900/30 border-amber-900/50",
              video: "text-purple-400 bg-purple-900/30 border-purple-900/50",
            };
            return (
              <div key={idx} className={`${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border rounded-lg p-4 flex items-start gap-3`}>
                <Avatar className="h-12 w-12 shrink-0">
                  {tech?.profile_picture_url && (
                    <AvatarImage src={tech.profile_picture_url} alt={`${tech.first_name} ${tech.last_name}`} />
                  )}
                  <AvatarFallback className="text-sm">
                    {`${tech?.first_name?.[0] || ""}${tech?.last_name?.[0] || ""}`.toUpperCase() || "T"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className={`font-bold text-sm ${theme.textMain} mb-1`}>
                    {tech?.first_name} {tech?.last_name}
                  </div>
                  <div className={`text-xs ${theme.textMuted}`}>{role}</div>
                  <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${deptColors[dept] || theme.textMuted}`}>
                    {dept}
                  </div>
                  {roomieNames.length > 0 && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[10px]">Compañeros: {roomieNames.join(" · ")}</Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DocumentsTab = ({ vm }: TabProps) => {
  const {
    artistNameMap,
    artistStageMap,
    canUploadTourDocuments,
    documentLoading,
    festivalStageNameMap,
    handleDownload,
    handleDownloadRider,
    handleDownloadTourDocument,
    handleTourDocumentUploadSuccess,
    handleViewDocument,
    handleViewRider,
    handleViewTourDocument,
    isArtistsLoading,
    isDark,
    isRidersLoading,
    isUploadingTourDocument,
    job,
    jobArtists,
    jobArtistsError,
    riderFiles,
    riderFilesError,
    setIsUploadingTourDocument,
    theme,
    tourDocuments,
    tourDocumentsLoading,
    tourId,
  } = vm;

  const visibleJobDocuments = (job?.job_documents ?? []).filter((doc: JobDocument) => doc.visible_to_tech);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} className={theme.textMuted} />
          <h3 className={`text-lg font-bold ${theme.textMain}`}>Documentos del trabajo</h3>
        </div>

        {visibleJobDocuments.length > 0 ? (
          <div className="space-y-2">
            {visibleJobDocuments.map((doc) => (
              <DocumentRow
                key={doc.id}
                fileName={doc.file_name}
                uploadedAt={doc.uploaded_at}
                isDark={isDark}
                theme={theme}
                isLoading={documentLoading.has(doc.id)}
                onView={() => handleViewDocument(doc)}
                onDownload={() => handleDownload(doc)}
                badges={
                  <>
                    {doc.template_type === "soundvision" && <Badge variant="outline" className="text-[10px]">SoundVision</Badge>}
                    {doc.read_only && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/50">Solo lectura</Badge>}
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyDocumentState theme={theme} message="No hay documentos disponibles" />
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className={theme.textMuted} />
          <h3 className={`text-lg font-bold ${theme.textMain}`}>Riders de artistas</h3>
        </div>

        {(jobArtistsError || riderFilesError) && (
          <div className={`mb-3 rounded-lg border p-3 ${theme.danger}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle size={14} />
              No se pudieron cargar todos los riders
            </div>
          </div>
        )}

        {isArtistsLoading || isRidersLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : jobArtists.length === 0 ? (
          <div className={`h-24 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
            <span className="text-xs">No hay artistas asociados a este trabajo</span>
          </div>
        ) : riderFiles.length > 0 ? (
          <div className="space-y-2">
            {riderFiles.map((file) => {
              const key = `rider:${file.id}`;
              const artistStageNumber = artistStageMap.get(file.artist_id);
              const artistStageLabel = artistStageNumber != null
                ? (festivalStageNameMap.get(artistStageNumber) || `Escenario ${artistStageNumber}`)
                : "Escenario sin definir";
              return (
                <DocumentRow
                  key={file.id}
                  fileName={file.file_name}
                  uploadedAt={file.uploaded_at}
                  isDark={isDark}
                  theme={theme}
                  isLoading={documentLoading.has(key)}
                  onView={() => handleViewRider(file)}
                  onDownload={() => handleDownloadRider(file)}
                  metadata={
                    <>
                      <div className={`text-xs ${theme.textMuted}`}>Artista: {artistNameMap.get(file.artist_id) || "Desconocido"}</div>
                      <div className="mt-1"><Badge variant="outline" className="text-[10px]">{artistStageLabel}</Badge></div>
                    </>
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className={`h-24 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
            <span className="text-xs">
              No hay riders subidos para los {jobArtists.length} {jobArtists.length === 1 ? "artista" : "artistas"} asociados
            </span>
          </div>
        )}
      </div>

      {tourId ? (
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className={theme.textMuted} />
              <h3 className={`text-lg font-bold ${theme.textMain}`}>Documentos de la gira</h3>
            </div>

            {canUploadTourDocuments ? (
              <Button variant="outline" size="sm" onClick={() => setIsUploadingTourDocument((value) => !value)}>
                {isUploadingTourDocument ? "Cancelar" : "Añadir"}
              </Button>
            ) : null}
          </div>

          {isUploadingTourDocument && canUploadTourDocuments ? (
            <div className={`${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border rounded-lg p-3 mb-3`}>
              <TourDocumentUploader
                tourId={tourId}
                onSuccess={handleTourDocumentUploadSuccess}
                onCancel={() => setIsUploadingTourDocument(false)}
              />
            </div>
          ) : null}

          {tourDocumentsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : tourDocuments.length > 0 ? (
            <div className="space-y-2">
              {tourDocuments.map((doc) => {
                const key = `tour:${doc.id}`;
                return (
                  <DocumentRow
                    key={doc.id}
                    fileName={doc.file_name}
                    uploadedAt={doc.uploaded_at}
                    isDark={isDark}
                    theme={theme}
                    isLoading={documentLoading.has(key)}
                    onView={() => handleViewTourDocument(doc)}
                    onDownload={() => handleDownloadTourDocument(doc)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyDocumentState theme={theme} message="No hay documentos de gira visibles" />
          )}
        </div>
      ) : null}
    </div>
  );
};

const DocumentRow = ({
  badges,
  fileName,
  isDark,
  isLoading,
  metadata,
  onDownload,
  onView,
  theme,
  uploadedAt,
}: {
  badges?: ReactNode;
  fileName: string;
  isDark: boolean;
  isLoading: boolean;
  metadata?: ReactNode;
  onDownload: () => void;
  onView: () => void;
  theme: DetailsModalViewModel["theme"];
  uploadedAt?: string;
}) => (
  <div className={`${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"} border rounded-lg p-3`}>
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-bold ${theme.textMain} leading-snug break-words line-clamp-2 mb-1`} title={fileName}>
          {fileName}
        </div>
        {metadata}
        <div className={`text-xs ${theme.textMuted}`}>
          {uploadedAt && `Subido el ${formatInTimeZone(uploadedAt, madridTimeZone, "d 'de' MMMM 'de' yyyy", { locale: es })}`}
        </div>
        {badges && <div className="flex gap-1 mt-1 flex-wrap">{badges}</div>}
      </div>
      <div className="flex gap-3 shrink-0">
        <Button
          variant="outline"
          size="icon"
          onClick={onView}
          disabled={isLoading}
          className="h-10 w-10 p-0"
          title={`Ver ${fileName}`}
          aria-label={`Ver ${fileName}`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye size={18} />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onDownload}
          disabled={isLoading}
          className="h-10 w-10 p-0"
          title={`Descargar ${fileName}`}
          aria-label={`Descargar ${fileName}`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={18} />}
        </Button>
      </div>
    </div>
  </div>
);

const EmptyDocumentState = ({ message, theme }: { message: string; theme: DetailsModalViewModel["theme"] }) => (
  <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
    <FileText size={24} className="mb-2 opacity-50" />
    <span className="text-xs">{message}</span>
  </div>
);
