# Pruebas de Logística — 5 de octubre de 2026

## Revisión sobre la versión actualizada del compañero

Se ha preparado `Entrega-GitHub` desde `origin/main`, commit `825e0c3a` (#992), y se han incorporado los cambios de Logística sin demos. No se han modificado las copias originales para actualizar su base ni se ha publicado código.

- Typecheck, lint, governance, pruebas críticas, compilación y presupuesto de tamaño: superados.
- Suite completa: 3634 pruebas superadas, 95 omitidas y 1 fallida; 535 archivos superados, 11 omitidos y 1 fallido.
- La única prueba fallida es `tests/assignments/ci-reference-fixture.test.ts`, procedente de la versión actualizada. Divide un archivo SQL mediante saltos LF literales y falla cuando Git lo convierte a CRLF en Windows (espera 29 filas y obtiene 1). Al repetir únicamente esa prueba con el SQL temporalmente normalizado a LF, pasa. Se han restaurado los bytes originales del archivo; no se ha cambiado código del compañero para ocultar el resultado.
- Flota en navegador sobre esta integración: 12 pruebas superadas, 6 en ordenador y 6 en móvil. Cubren calendarios por vehículo, permisos de consulta, creación, conflictos y cancelación con historial. Usan respuestas de servidor simuladas.
- La auditoría informa de 5 avisos altos conocidos en dependencias de desarrollo; el control del proyecto verifica el parche de seguridad instalado y registra 0 vulnerabilidades sin resolver. No se ha ejecutado una actualización automática forzada.

Las pruebas usan datos sintéticos. No se ha conectado con datos reales de la empresa. Sigue pendiente validar las migraciones y permisos en una base de datos de pruebas, así como seguimiento y notificaciones reales. El fallo de portabilidad de la prueba debe comunicarse al compañero antes de dar toda la suite por aprobada.

Se ha revisado la copia con demos (`Area-tecnica-taller`). Las correcciones de aplicación y la nueva migración están también en `Proyecto-sin-demos`. Los módulos de personal coinciden en ambas copias. Las pruebas de navegador usan contextos aislados, sin cambiar los registros del navegador del usuario.

## Errores corregidos

1. Cancelar o completar un traslado quedaba bloqueado si su vehículo se desactivaba, dejaba de tener suficientes plazas o el conductor no aparecía en la flota actual. La validación de recursos se aplica ahora a traslados pendientes y confirmados; cerrar el registro conserva sus datos y libera su reserva. Se ha preparado la misma corrección del servidor en `20261005190000_personnel_closed_plan_resources.sql`, sin aplicarla a producción.
2. Guardar un traslado invalidaba una clave inexistente del calendario diario (`logistics-events-day`). Ahora invalida `today-logistics`, además del calendario general, las fichas de personal y la matriz de conductores.

## Comprobaciones superadas

- 16 archivos y 99 pruebas de Logística y planificación: `vitest run src/features/logistics src/components/logistics/TransportRequestPlanningDialog.test.tsx`.
- Demo de material: planificación, creación de eventos y solicitudes, edición de asignaciones, alta de vehículos y persistencia tras recarga.
- Demo de personal: plazas insuficientes, habitaciones insuficientes, destino escrito y persistencia, conflictos con devolución al estado original, cancelación con vehículo desactivado y liberación de evento/asignación.
- Excel semanal y mensual: descarga, contenido de traslados, direcciones y habitaciones. Pruebas del formato 03 con múltiples fichas, notas largas, informe vacío y estancias que cruzan de mes; vista de la ficha revisada previamente.
- Calendarios general y específicos de ambos subdepartamentos, Conductores, Flota y Seguimiento en 1440 y 390 píxeles.
- TypeScript (`tsc --noEmit --pretty false -p tsconfig.app.json`) sin errores; ESLint de los módulos comprobados sin errores.
- Compilación Vite y preparación del service worker correctas. Vite avisa de módulos grandes y de una importación dinámica/estática compartida.
- Verificación estática de las 249 migraciones: marcas de tiempo únicas y ordenadas.

## Límites de esta revisión

No se ha publicado ni subido código a GitHub. Las pruebas de navegador simulan Supabase. No están disponibles Supabase CLI y Docker en este entorno, por lo que no se han ejecutado las migraciones ni las pruebas pgTAP contra PostgreSQL. Antes de producción deben verificarse permisos, reservas concurrentes, escrituras de ubicaciones y las migraciones en una base de pruebas. La compilación y las pruebas de la demo no demuestran esos comportamientos del servidor real.

Seguimiento sigue siendo simulado en la demo; no se han comprobado geolocalización real ni notificaciones externas.
