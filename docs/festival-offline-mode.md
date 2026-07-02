# Modo Offline de Festivales

Permite descargar el dataset completo de un festival para consultarlo (cualquier rol) y editarlo (roles con permiso de edición) sin conexión, sincronizando los cambios manualmente al recuperar la red.

## Cómo funciona

### Descarga (cualquier rol)

Desde la cabecera de **Gestión de Festival** o de **Gestión de Artistas**, el botón **Offline** abre un menú con "Descargar para uso offline". Se guarda en IndexedDB (`sector-pro-offline`) una instantánea completa del festival:

- Trabajo (`jobs`), ajustes (`festival_settings`), tipos de fecha (`job_date_types`)
- Escenarios (`festival_stages`), setups de equipo (`festival_gear_setups`, `festival_stage_gear_setups`)
- Artistas (`festival_artists`), envíos de formularios (`festival_artist_form_submissions`), metadatos de riders (`festival_artist_files`)
- Turnos (`festival_shifts`, `festival_shift_assignments`)
- Logos y documentos del trabajo (metadatos), venue (`hoja_de_ruta` + `locations`)

Las consultas se paginan (1000 filas por página), por lo que festivales grandes se capturan completos.

Tras los metadatos se descargan también los **archivos binarios**: riders (PDF), stage plots y documentos del trabajo. Se guardan como blobs en IndexedDB (`festival-files`) y los fallos individuales no abortan la descarga (se reportan en el toast).

> El app shell y los chunks JS ya se cachean vía service worker (`public/sw.js`); la instantánea cubre la capa de datos.

### Lectura offline

Las páginas de gestión de festival, la de artistas y el modal de artistas del tech app sirven la instantánea local cuando:

- el navegador reporta sin conexión (`navigator.onLine === false`),
- la petición de red falla, o
- la red tarda más de ~4 s en responder (`fetchWithOfflineFallback` — `navigator.onLine` suele reportar `true` en recintos con cobertura inutilizable, así que las lecturas nunca esperan a la red indefinidamente).

Un banner ámbar indica que se está viendo la copia offline. Las queries afectadas usan `networkMode: "always"` para que React Query ejecute el `queryFn` sin conexión. Los riders, stage plots y documentos se sirven desde los blobs cacheados (también con conexión, para abrirlos al instante).

### Edición offline (roles con `canEditJobs`)

Crear, editar y eliminar artistas funciona sin conexión:

- Los cambios se aplican inmediatamente a la instantánea local (lectura consistente).
- Cada cambio se encola en IndexedDB con el `updated_at` base del registro (detección de conflictos).
- Los cambios sobre un mismo registro se fusionan (insert+update → insert; insert+delete → nada; update+delete → delete).
- Las altas offline generan un UUID de cliente que se conserva al sincronizar.

### Sincronización manual

Con conexión, el menú Offline muestra **Sincronizar cambios** (solo roles de edición). El motor (`src/lib/offline/festival-sync.ts`):

1. Aplica los cambios encolados en orden cronológico.
2. Cada update/delete se escribe de forma condicional (filtrado por el `updated_at` observado al descargar), por lo que la detección de conflictos es atómica:
   - Si la escritura afecta a la fila → aplicado.
   - Si no afecta a ninguna fila (modificada o borrada en el servidor) → se reporta como **conflicto** y queda encolado.
3. Los conflictos pueden resolverse con **Forzar sincronización** (sobrescribe el servidor) o **Descartar cambios pendientes** (requiere conexión: primero restaura la instantánea desde el servidor y solo entonces vacía la cola).
4. Tras una sincronización limpia se re-descarga la instantánea para alinear la copia local.
5. Mientras haya cambios pendientes no se permite **Actualizar copia offline**, para no sobrescribir las ediciones locales con datos del servidor.

## Arquitectura

| Pieza | Ruta |
|---|---|
| Almacén IndexedDB (fallback en memoria para tests) | `src/lib/offline/offline-db.ts` |
| Descarga/lectura de instantáneas | `src/lib/offline/festival-snapshot.ts` |
| Cola de cambios + coalescing | `src/lib/offline/festival-offline-queue.ts` |
| Motor de sincronización + conflictos | `src/lib/offline/festival-sync.ts` |
| Hook de estado/acciones | `src/hooks/festival/useOfflineFestival.ts` |
| UI (menú Offline) | `src/components/festival/FestivalOfflineControls.tsx` |
| Tests | `src/lib/offline/__tests__/` |

### Puntos de integración

- `src/hooks/useArtistsQuery.ts` — lectura de artistas con fallback offline + borrado encolado.
- `src/hooks/useArtistMutations.ts` — creación/edición encoladas offline.
- `src/features/festival-management/queries.ts` — detalles del festival y documentos desde la instantánea.
- `src/pages/FestivalArtistManagement.tsx` — contexto (ajustes, tipos de fecha, escenarios) desde la instantánea + banner offline.

## Limitaciones actuales

- La edición offline cubre **artistas** (la superficie principal de trabajo en campo). Turnos y setups de equipo se descargan para consulta; su edición offline puede añadirse extendiendo `OfflineSyncableTable` y encolando en sus mutaciones.
- Los logos del festival no se cachean como blob (solo riders, stage plots y documentos del trabajo).
- La resolución de conflictos es por registro (último en escribir gana al forzar), no por campo.
