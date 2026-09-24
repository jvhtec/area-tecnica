-- Montoya is one of the companies sleeper buses (autobús cama) are hired from,
-- alongside The Wild Tour. 20260924201000 makes it selectable in Hoja de Ruta and
-- uses it in the berth-planning helpers, in a separate transaction as Postgres
-- requires for a new enum value.
alter type public.transport_provider_enum add value if not exists 'montoya';
