# Comprobaciones finales · 13 de octubre de 2026

## Entrega integrada de la PR

La rama de entrega se ha actualizado sobre `origin/main` (83d102d1), preservando sus cambios de dependencias, mapas y otros departamentos. La entrega incluye V05 y excluye la consolidación experimental basada en V06.

- Batería completa sobre la copia integrada: 3.724 aprobadas, 95 omitidas, cero fallos.
- Ajuste posterior: llamada de descansos extraída al módulo de datos para respetar los límites de arquitectura, con dos pruebas de guardado y rechazo del servidor.
- Pruebas dirigidas posteriores de Logística y correo: 190 aprobadas, cero omitidas y cero fallos.
- TypeScript, lint del ajuste y compilación repetidos después de la extracción: aprobados.
- Lint global de la integración: cero errores y 965 avisos preexistentes.
- Los controles estáticos de código, tamaños, logging, CSP, Actions, funciones y permisos/orden de migraciones pasan. No se presenta como una ejecución del comando completo governance: npm audit y Deno no están disponibles localmente.
- Añadida prueba pgTAP de permisos del punto de entrada de Personal y descansos. No ejecutada localmente.

Los resultados locales usan las dependencias existentes. CI debe comprobar instalación limpia, SQL y RLS. La PR debe permanecer en borrador hasta completar validación de base de datos y revisión. No se han aplicado migraciones a producción.

## V05 y demo

- Compilación de producción: `vite build`, aprobada; versión del service worker y precarga de 145 recursos generadas con `scripts/inject-sw-version.mjs --minify-service-worker`.
- Tamaños de aplicación: `scripts/performance/check-bundle-budget.mjs`, todos los límites aprobados.
- Pruebas de Logística y correo después del último cambio de roles: 188 aprobadas, cero fallos y cero omitidas. Resultado: `outputs/pruebas-final-v05.json`.
- Lint de los últimos cambios: cero errores y 40 avisos en el ámbito revisado. Resultado: `outputs/lint-final-v05.log`.
- Roles del correo y prueba correspondiente sincronizados por contenido entre V05 y demo. También se sincronizó la última corrección de la prueba del Excel.
- Navegador: los ocho apartados de la demo y la entrada móvil cargan sin errores de ejecución ni mensajes de fallo de carga.
- La batería global anterior al último cambio del catálogo de roles pasó 3.650 pruebas y omitió 95; no se presenta como una ejecución global posterior al cambio de roles.

## Copia aislada de consolidación

Carpeta: `Revision-consolidacion-logistica`. Está basada en V06; no se ha integrado automáticamente en V05 ni en la PR.

- TypeScript: `tsc --noEmit --pretty false -p tsconfig.app.json`, aprobado.
- Pruebas locales de Logística, alojamiento compartido y catálogo de referencia: 130 aprobadas, cero fallos y cero omitidas.
- Lint de Logística y formularios de Personal: cero errores.
- Orden de migraciones: 267 marcas temporales únicas y ordenadas.
- Revisión estática de permisos SECURITY DEFINER: cero exposiciones anónimas nuevas sin revisar.
- Corregido un mensaje esperado de la prueba pgTAP de bloqueos: «bloqueo actualizado», coincidente con el mensaje de la función. La prueba SQL no se ha ejecutado.

## Prueba que requiere una base de datos

No se ha encontrado un entorno local Docker/Supabase/PostgreSQL disponible. No se han instalado herramientas ni activado servicios de pago. No se han ejecutado migraciones en producción ni modificado la PR.

Las pruebas locales del cliente y la revisión estática no demuestran que las migraciones se apliquen, que se conserven las reservas e históricos ni que RLS funcione al ejecutarse.

Javier debe facilitar una base desechable de pruebas o ejecutar en su entorno local:

```sh
supabase db reset --local --no-seed
supabase db lint --local --fail-on error --schema public,auth
supabase test db supabase/tests/database
```

Solo en un entorno local de pruebas: `db reset` borra la base local. No utilizar producción. Para reservas existentes, revisar el mapa explícito de conciliación de hoteles que requiere la migración; no asociar hoteles únicamente por nombre.

Antes de integrar en V05, comprobar además compatibilidad con su cadena de migraciones, ya que la copia de consolidación procede de V06. La consolidación no se declara validada para datos reales hasta completar estas comprobaciones.
