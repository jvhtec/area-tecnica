-- Crew transfers (traslados de personal): the fleet's vans, RVs and sleeper buses
-- also move people, often for several days, and until now the only logistics event
-- types were load/unload. 20260925131000 adds the columns and RPC changes that use
-- it, in a separate transaction as Postgres requires for a new enum value.
alter type public.logistics_event_type add value if not exists 'crew_transfer';
