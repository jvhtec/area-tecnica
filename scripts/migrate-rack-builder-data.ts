#!/usr/bin/env tsx
/**
 * One-time data migration: copies rows and storage objects from the
 * standalone jvhtec/rack-builder Supabase project into area-tecnica's own
 * project, after the rack_builder_* schema/storage migrations have been
 * applied.
 *
 * The source project has no RLS, so its own public anon key (already
 * embedded in that repo's client code) is sufficient for reads. Writing
 * into area-tecnica requires a service-role key to bypass the new RLS.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... tsx scripts/migrate-rack-builder-data.ts
 *
 * Re-running is safe: rows are upserted by primary key, storage uploads use
 * upsert:true.
 */

import { createClient } from '@supabase/supabase-js'

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || 'https://hocnivfaamoazfqmvodb.supabase.co'
const OLD_SUPABASE_ANON_KEY = process.env.OLD_SUPABASE_ANON_KEY || 'sb_publishable_dXrksnqF0EqcuDyihRCsZg_091iL4sd'

const NEW_SUPABASE_URL = process.env.VITE_SUPABASE_URL
const NEW_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!NEW_SUPABASE_URL || !NEW_SERVICE_ROLE_KEY) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
  process.exit(1)
}

const oldClient = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const newClient = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface TableCopyStep {
  sourceTable: string
  targetTable: string
  conflictKey: string
  /** Handled separately by copyDeviceCategories() - kept here only so verifyRowCounts() covers it. */
  skipGenericCopy?: boolean
}

const TABLE_STEPS: TableCopyStep[] = [
  { sourceTable: 'device_categories', targetTable: 'rack_builder_device_categories', conflictKey: 'id', skipGenericCopy: true },
  { sourceTable: 'devices', targetTable: 'rack_builder_devices', conflictKey: 'id' },
  { sourceTable: 'racks', targetTable: 'rack_builder_racks', conflictKey: 'id' },
  { sourceTable: 'projects', targetTable: 'rack_builder_projects', conflictKey: 'id' },
  { sourceTable: 'layouts', targetTable: 'rack_builder_layouts', conflictKey: 'id' },
  { sourceTable: 'connectors', targetTable: 'rack_builder_connectors', conflictKey: 'id' },
  { sourceTable: 'panel_layouts', targetTable: 'rack_builder_panel_layouts', conflictKey: 'id' },
  { sourceTable: 'panel_layout_rows', targetTable: 'rack_builder_panel_layout_rows', conflictKey: 'id' },
  { sourceTable: 'panel_layout_ports', targetTable: 'rack_builder_panel_layout_ports', conflictKey: 'id' },
  { sourceTable: 'layout_items', targetTable: 'rack_builder_layout_items', conflictKey: 'id' },
]

const BUCKET_STEPS = [
  { sourceBucket: 'device-images', targetBucket: 'rack-builder-device-images' },
  { sourceBucket: 'connector-images', targetBucket: 'rack-builder-connector-images' },
]

async function copyTable(step: TableCopyStep, rowTransform?: (row: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const { data: rows, error: fetchError } = await oldClient.from(step.sourceTable).select('*')
  if (fetchError) {
    throw new Error(`Failed to read ${step.sourceTable}: ${fetchError.message}`)
  }
  if (!rows || rows.length === 0) {
    console.log(`  ${step.sourceTable}: no rows`)
    return
  }

  const payload = rowTransform ? rows.map(rowTransform) : rows
  const { error: upsertError } = await newClient
    .from(step.targetTable)
    .upsert(payload, { onConflict: step.conflictKey })
  if (upsertError) {
    throw new Error(`Failed to write ${step.targetTable}: ${upsertError.message}`)
  }
  console.log(`  ${step.sourceTable} -> ${step.targetTable}: ${rows.length} rows`)
}

/**
 * device_categories needs special handling: the target already seeds an
 * 'Uncategorized' row (with its own generated id) under a unique
 * lower(name) index. Copying source categories by id would collide on that
 * seed and abort the whole migration. Instead, merge by name - reuse the
 * target's id for any name that already exists there, and only insert
 * genuinely new categories under their original id. The returned map lets
 * the devices step rewrite category_id to match wherever a merge happened.
 */
async function copyDeviceCategories(): Promise<Map<string, string>> {
  const { data: rows, error: fetchError } = await oldClient.from('device_categories').select('*')
  if (fetchError) {
    throw new Error(`Failed to read device_categories: ${fetchError.message}`)
  }
  if (!rows || rows.length === 0) {
    console.log('  device_categories: no rows')
    return new Map()
  }

  const { data: existingRows, error: existingError } = await newClient
    .from('rack_builder_device_categories')
    .select('id, name')
  if (existingError) {
    throw new Error(`Failed to read rack_builder_device_categories: ${existingError.message}`)
  }

  const existingIdByLowerName = new Map<string, string>(
    (existingRows ?? []).map((row: { id: string; name: string }) => [row.name.toLowerCase(), row.id]),
  )
  const idRemap = new Map<string, string>()
  const rowsToInsert: typeof rows = []

  for (const row of rows) {
    const lowerName = String(row.name).toLowerCase()
    const existingId = existingIdByLowerName.get(lowerName)
    if (existingId) {
      idRemap.set(row.id, existingId)
    } else {
      // Track this row's own name too, so a later source row with the same
      // (case-insensitive) name remaps to it instead of both being inserted
      // and colliding on the target's unique lower(name) index.
      existingIdByLowerName.set(lowerName, row.id)
      rowsToInsert.push(row)
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: upsertError } = await newClient
      .from('rack_builder_device_categories')
      .upsert(rowsToInsert, { onConflict: 'id' })
    if (upsertError) {
      throw new Error(`Failed to write rack_builder_device_categories: ${upsertError.message}`)
    }
  }

  console.log(
    `  device_categories -> rack_builder_device_categories: ${rowsToInsert.length} inserted, ${idRemap.size} merged by name`,
  )
  return idRemap
}

async function copyBucket(sourceBucket: string, targetBucket: string): Promise<void> {
  const { data: objects, error: listError } = await oldClient.storage.from(sourceBucket).list(undefined, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (listError) {
    throw new Error(`Failed to list ${sourceBucket}: ${listError.message}`)
  }

  const paths = await listAllPaths(sourceBucket, '')
  console.log(`  ${sourceBucket}: ${paths.length} objects`)

  const failures: string[] = []
  for (const path of paths) {
    const { data: blob, error: downloadError } = await oldClient.storage.from(sourceBucket).download(path)
    if (downloadError || !blob) {
      failures.push(`${path}: ${downloadError?.message ?? 'no data'}`)
      continue
    }
    const { error: uploadError } = await newClient.storage.from(targetBucket).upload(path, blob, { upsert: true })
    if (uploadError) {
      failures.push(`${path}: ${uploadError.message}`)
    }
  }
  void objects

  if (failures.length > 0) {
    throw new Error(`Failed to copy ${failures.length}/${paths.length} object(s) from ${sourceBucket}:\n  ${failures.join('\n  ')}`)
  }
}

/** Recursively lists every object path under a folder prefix (list() is not recursive). */
async function listAllPaths(bucket: string, prefix: string): Promise<string[]> {
  const { data: entries, error } = await oldClient.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !entries) return []

  const paths: string[] = []
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id === null) {
      // Folder placeholder — recurse.
      paths.push(...(await listAllPaths(bucket, fullPath)))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

async function verifyRowCounts(): Promise<void> {
  console.log('\nRow count comparison:')
  let hasMismatch = false
  for (const step of TABLE_STEPS) {
    const { count: sourceCount } = await oldClient.from(step.sourceTable).select('*', { count: 'exact', head: true })
    const { count: targetCount } = await newClient.from(step.targetTable).select('*', { count: 'exact', head: true })
    const matches = sourceCount === targetCount
    if (!matches) hasMismatch = true
    console.log(`  ${step.targetTable}: source=${sourceCount ?? 0} target=${targetCount ?? 0} [${matches ? 'ok' : 'MISMATCH'}]`)
  }
  if (hasMismatch) {
    throw new Error('Row count verification failed - see MISMATCH rows above')
  }
}

async function main() {
  console.log('Copying tables (FK-safe order)...')
  const categoryIdRemap = await copyDeviceCategories()

  for (const step of TABLE_STEPS) {
    if (step.skipGenericCopy) continue
    const rowTransform =
      step.sourceTable === 'devices' && categoryIdRemap.size > 0
        ? (row: Record<string, unknown>) => ({
            ...row,
            category_id: categoryIdRemap.get(row.category_id as string) ?? row.category_id,
          })
        : undefined
    await copyTable(step, rowTransform)
  }

  console.log('\nCopying storage objects...')
  for (const { sourceBucket, targetBucket } of BUCKET_STEPS) {
    await copyBucket(sourceBucket, targetBucket)
  }

  await verifyRowCounts()
  console.log('\nDone.')
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
