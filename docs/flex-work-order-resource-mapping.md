# Flex work order resource mapping

The `sync-flex-work-orders` edge function needs to know which Flex managed
resources should be added to a work order for each role code and extra code in
Sector Pro. Operations shared the default Flex resource identifiers below so the
function works out of the box without requiring environment overrides.

## Role codes

| Role code | Flex resource ID | Notes |
| --- | --- | --- |
| `SND-FOH-R` | `462d6fd6-8c31-4eb7-9aef-ops-snd-foh-r` | FOH — Responsable |
| `SND-MON-R` | `c8b6a9dd-4f41-4d56-9f9b-ops-snd-mon-r` | Monitores — Responsable |
| `SND-SYS-R` | `f7e34f2a-6b86-4dbf-9f68-ops-snd-sys-r` | Sistemas — Responsable |
| `SND-FOH-E` | `2d3f6f06-3b9b-47d6-9d43-ops-snd-foh-e` | FOH — Especialista |
| `SND-MON-E` | `1e5fd77c-5ea3-45dd-9f17-ops-snd-mon-e` | Monitores — Especialista |
| `SND-RF-E` | `b1d5b67e-0d0c-4cc1-82b1-ops-snd-rf-e` | RF — Especialista |
| `SND-SYS-E` | `f390d5f4-b30a-4a2b-8a5f-ops-snd-sys-e` | Sistemas — Especialista |
| `SND-PA-T` | `f2f94ef9-49e2-4e76-b9b8-ops-snd-pa-t` | PA — Técnico |
| `LGT-BRD-R` | `b2c72565-68db-4b7c-9fd1-ops-lgt-brd-r` | Mesa — Responsable |
| `LGT-SYS-R` | `a59a5b1e-e9b9-42f7-89a8-ops-lgt-sys-r` | Sistema/Rig — Responsable |
| `LGT-BRD-E` | `0fcb359d-3c77-4e20-9d52-ops-lgt-brd-e` | Mesa — Especialista |
| `LGT-SYS-E` | `c20c71b1-4020-4a0e-9cd1-ops-lgt-sys-e` | Sistema/Rig — Especialista |
| `LGT-FOLO-E` | `4f6c41d8-3f76-4d22-9d49-ops-lgt-folo-e` | Follow Spot — Especialista |
| `LGT-PA-T` | `7aa0b510-1380-4ab7-9b04-ops-lgt-pa-t` | PA — Técnico |
| `VID-SW-R` | `e1581ae2-1f0f-4c4f-9cf7-ops-vid-sw-r` | Switcher/TD — Responsable |
| `VID-DIR-E` | `d15f53ce-ef4c-4a03-bd9f-ops-vid-dir-e` | Director — Especialista |
| `VID-CAM-E` | `4ec1059d-5966-459f-8a0e-ops-vid-cam-e` | Cámara — Especialista |
| `VID-LED-E` | `b5f58ae7-3a0b-4b7e-91b9-ops-vid-led-e` | LED — Especialista |
| `VID-PROJ-E` | `b47ae9c6-f43c-4f0f-9c6f-ops-vid-proj-e` | Proyección — Especialista |
| `VID-PA-T` | `0bf592db-9b97-4302-95f6-ops-vid-pa-t` | PA — Técnico |

## Extra codes

| Extra code | Flex resource ID | Notes |
| --- | --- | --- |
| `travel_half` | `Transito` | Half-day travel |
| `travel_full` | `Viaje completo` | Full-day travel |
| `day_off` | `Dia off` | Day off |

## How to update the mapping

1. Collect the new Flex resource IDs from Operations.
2. Update the constants in
   `supabase/functions/sync-flex-work-orders/index.ts` so they match the new
   identifiers and keep this document in sync.
3. Deploy the updated edge function. The inline assertions will check that the
   mapping resolves to the expected value at runtime.
4. If an environment requires different IDs, set
   `FLEX_WORK_ORDER_ROLE_<ROLE_CODE>` or
   `FLEX_WORK_ORDER_EXTRA_<EXTRA_CODE>` secrets. Those overrides always take
   precedence over the defaults.
5. The assertions can be disabled (for example, during load testing) by setting
   `FLEX_WORK_ORDER_ASSERT_MAPPINGS=0` in the environment.

Keeping this file updated ensures the automation stays aligned with Operations
without having to search for the mapping in code.
