import { useQuery } from "@tanstack/react-query";
import { useLogisticsMatrix } from "./fleet/useLogisticsFleet";
import { useOperations } from "./operations/operationsApi";
import { operationKey, type Operation } from "./operations/operationsModel";
import { listTransportRequests, type TransportRequestRecord } from "./transportRequests";
import type { LogisticsMatrixData } from "./fleet/fleetModel";
import { transportProviderLabel } from "@/constants/transportProviders";
import { usePersonnelPlans, listPersonnelPlans } from "./personnel/personnelApi";
import { fetchLogisticsMatrix } from "./fleet/fleetApi";
import { listOperations } from "./operations/operationsApi";
import { logisticsCalendarExportBounds } from "@/utils/logisticsCalendarExport";

export type CalendarTransportEvent={id:string;event_type:string;transport_request_id?:string|null;license_plate?:string|null;transport_provider?:string|null};
export function resolveCalendarTransport(event:CalendarTransportEvent,matrix:Pick<LogisticsMatrixData,"assignments"|"vehicles">,operations:Operation[],requests:Pick<TransportRequestRecord,"id"|"events">[],plans:{id:string;event_id?:string|null}[]=[]) {
 const assigned=matrix.assignments.filter(row=>row.logistics_event_id===event.id&&row.status!=="declined");
 const plates=[...new Set(assigned.flatMap(row=>{const vehicle=matrix.vehicles.find(vehicle=>vehicle.id===row.vehicle_id);return vehicle?.license_plate.trim()?[vehicle.license_plate.trim()]:[];}))];
 const manual=event.license_plate?.trim()||null;
 const requestId=event.transport_request_id??requests.find(request=>request.events.some(row=>row.id===event.id))?.id;
 const entityId=event.event_type==="crew_transfer"?plans.find(plan=>plan.event_id===event.id)?.id:requestId;
 const kind=event.event_type==="crew_transfer"?"personnel":"material";
 const operation=entityId?operations.find(row=>operationKey(row.entity_kind,row.entity_id)===operationKey(kind,entityId)):undefined;
 return {license_plate:plates.length?plates.join(", "):manual,transport_company:operation?.transport_company?.trim()||transportProviderLabel(event.transport_provider)||null,
  transport_data_warning:plates.length&&manual&&!plates.includes(manual)?"La matrícula manual difiere de la asignación de Flota. Se muestra la asignada.":null};
}
export function useCalendarTransportDetails(first:string,last:string){
 const matrix=useLogisticsMatrix(first,last);
 const operations=useOperations();
 const plans=usePersonnelPlans(first,last);
 const requests=useQuery({queryKey:["logistics-work-requests"],queryFn:()=>listTransportRequests({includeClosed:true}),staleTime:30000});
 return {isLoading:matrix.isLoading||operations.isLoading||requests.isLoading||plans.isLoading,error:matrix.error??operations.error??requests.error??plans.error,
  resolve:(event:CalendarTransportEvent)=>resolveCalendarTransport(event,matrix.data??{assignments:[],vehicles:[]},operations.data??[],requests.data??[],plans.data??[])};
}

/** Export sources must match the report period, even when the visible month differs. */
export async function calendarTransportForExport<T extends CalendarTransportEvent>(events:T[],range:"current_week"|"next_week"|"month",date:Date) {
 const {first,last}=logisticsCalendarExportBounds(range,date);
 const [matrix,operations,requests,plans]=await Promise.all([fetchLogisticsMatrix(first,last),listOperations(),listTransportRequests({includeClosed:true}),listPersonnelPlans(first,last)]);
 return events.map(event=>({...event,...resolveCalendarTransport(event,matrix,operations,requests,plans)}));
}
