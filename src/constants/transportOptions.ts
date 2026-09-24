// Transport options used in Logistics event creation (full set)
export const LOGISTICS_TRANSPORT_OPTIONS = [
  'trailer',
  'rv',
  'van',
  'autobus',
  'sleeper_bus',
  '9m',
  '8m',
  '6m',
  '4m',
  'furgoneta',
  'train',
  'plane',
];

// Transport types for technical transport requests, logistics events, tour logistics
// and Hoja de Ruta transport rows: the cargo sizes plus the company's sleeper buses.
// Must match the DB checks (transport_request_items / hoja_de_ruta_transport /
// truck_planner_transport_mappings) and create-transport-request's VALID_TRANSPORT_TYPES.
export const REQUEST_TRANSPORT_OPTIONS = [
  'trailer',
  '9m',
  '8m',
  '6m',
  '4m',
  'furgoneta',
  'sleeper_bus',
];
