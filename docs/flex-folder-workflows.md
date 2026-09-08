# Flex folder provisioning

Flex provisioning creates remote elements and records their identities locally. These writes are not transactional, so every workflow must persist each returned Flex UUID before creating children and must stop when the outcome of a remote request is ambiguous.

See the [Flex folder structures and variants](flex-folder-structures.md) catalog for the exact hierarchy, names, document numbers, picker branches, tracking types, and compatibility variants for every operation.

## Supported hierarchies

- Standard jobs and festivals use the `job` server operation through `createAllFoldersForJob`: event root, selected technical departments, administrative departments, and Estructura. Picker options control typed children and custom entries.
- Tour roots use the authenticated `create-flex-folders` operation `tour-root`. Manual, card, bulk, repair, and automatic-tour aliases all call this operation. Technical roots use the union of the tour jobs' persisted department selections; the operation refuses an empty selection before acquiring a lease. Production, Personnel, and Commercial remain administrative roots.
- Tour dates use the `tour-date` server operation for single and bulk runs: `Tour → department → date → typed children`. The former Edge hierarchy `Tour → date → department` is rejected for new requests so stale clients cannot create a competing tree.
- Dry-hire jobs use the `job` server operation and keep their monthly parent → dry hire → Presupuesto structure. Year setup uses the `dryhire-year` server operation, Spanish month names, and the `666.YY.MM`/`555.YY.MM` numbering contracts.
- Artist extras use the `festival-artist-extras` server operation. It loads the artist and job authoritatively and keeps its artist-specific identity, atomically allocated per-job ordinal, wall-clock schedule, and overnight rules because those differ from job commercial defaults.

Estructura is independent of picker selection. Standard jobs have Sound and Lights source Pull Sheets below Estructura. Tour dates use the tracked tour Estructura root and adopt pre-job rows by `tour_date_id` when a job later becomes available. `source_department` is the stable identity for source sheets.

## Deprecated Hoja de Información

Provisioning never creates SIP, LIP, or VIP Hoja de Información elements. Their definition IDs are absent from the active catalog. Stale options containing `hojaInfo` are normalized by dropping that key. An explicit empty selection remains empty, and malformed or unknown input never becomes default-all.

Historical `flex_folders` rows and remote elements are retained. Date-change readers may still recognize historical Hoja rows; that compatibility code is read-only. Hoja de Gastos, Gastos de Personal, Hoja de Ruta, and accommodation fields with similar names are unrelated and remain supported.

## Durable execution and recovery

`flex_provisioning_operations` owns one scope through an atomic database lease. `flex_provisioning_nodes` records stable semantic keys, parent keys, state, payload metadata, returned Flex UUIDs, and safe error details. The executor follows this sequence:

1. Acquire the scope lease after authoritative context and authorization checks.
2. Record a node as `creating`, then issue one typed `POST /element` request. Timeouts and ambiguous gateway failures are not replayed.
3. Retry recording a returned `elementId` before writing consumer rows. Children use the parent's remote `element_id`; new `flex_folders.parent_id` values use the local parent row ID.
4. Mark the node `persisted` only after its consumer record is durable.
5. Mark the operation complete only after every node in the requested plan is persisted. Activity is emitted only when the run created remote nodes.

An interrupted node with no returned UUID becomes `needs_reconciliation`; automatic replay is refused. A definite non-timeout 4xx rejection becomes `failed` and can be retried because Flex confirmed that it did not accept the request. A node with a known UUID is adopted and its local persistence can resume without another Flex POST. An explicit repair sends `reconcile: true`; it reacquires an expired lease in the same request. Completed scopes can reopen when the requested plan gains nodes, while already-persisted semantic keys are skipped.

Legacy tour roots with known UUID columns are adopted and retain an explicit legacy provenance marker. Canonical children remain suppressed per existing legacy department root whose child identities are unknown; missing departments and departments created by the durable planner keep their complete child plan. Legacy job and tour-date `flex_folders` rows are matched incrementally to semantic keys by folder type, department, source department, parent, and crew-call identity on every expansion, excluding rows already claimed by durable nodes. A partially populated legacy dry-hire year whose root UUID is unknown requires manual parent reconciliation; new year operations are resumable node by node.

## Authorization and rollout

The server validates roles before using its service client. Job, tour-date, and tour-root operations allow admin, management, and logistics users, matching the existing folder controls. Dry-hire year setup and artist extras remain restricted to admin and management. The server loads tours, jobs, dates, and department selections authoritatively and accepts entity IDs plus the few allowed operation options. Callers cannot supply arbitrary Flex parents, definition IDs, department IDs, or responsible-person IDs.

Deploy `20260908113000_add_flex_provisioning_state.sql` before the Edge function, then deploy clients that use the typed operation names. A production `supabase db push --linked --dry-run` and migration apply are human release steps. If provisioning must be paused, keep the Hoja removal and durable state records, disable new operations, and forward-fix adoption; do not delete remote elements or return to the deprecated date builder.

The live Flex typed payload contract and representative staging fixtures must be checked before production rollout because local tests do not issue remote Flex writes.
