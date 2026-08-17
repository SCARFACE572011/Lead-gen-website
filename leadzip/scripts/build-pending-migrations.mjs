#!/usr/bin/env node
/**
 * Regenerates supabase/migrations/RUN_ALL_PENDING.sql from the individual
 * migration files.
 *
 * Why this exists: the combined file is what the operator actually pastes into
 * the Supabase SQL editor, and it is a verbatim copy of the parts. Maintaining
 * it by hand meant a fix to a source migration could silently fail to reach
 * production, because the copy still held the old text. That already happened
 * once. Generating it removes the possibility.
 *
 * Usage:  npm run build:migrations
 * Check:  npm run build:migrations -- --check   (exits 1 if the file is stale)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '..', 'supabase', 'migrations')
const outputPath = join(migrationsDir, 'RUN_ALL_PENDING.sql')

/**
 * Applied-but-listed migrations stay in the list on purpose: every file is
 * idempotent, so re-running is safe, and leaving one out would make the
 * combined file diverge from "all pending" the moment someone forgets.
 *
 * Order is dependency order, which happens to equal filename order. The two
 * constraints that matter:
 *   - admin_allowlist must precede product_allowances and feature_usage,
 *     which both read that table.
 *   - lock_usage_counters makes usage_limits read-only for end users. Every
 *     later writer is a SECURITY DEFINER function, which bypasses RLS, so the
 *     lockdown running before them is safe.
 */
const PENDING = [
  '20260812_admin_allowlist.sql',
  '20260812_audit_reports.sql',
  '20260812_daily_search_counter.sql',
  '20260812_gclid.sql',
  '20260812_lock_usage_counters.sql',
  '20260812_pipeline.sql',
  '20260812_saved_search_country.sql',
  '20260813_bulk_save_entitlements.sql',
  '20260815_product_allowances.sql',
  '20260816_saved_lead_count_sync.sql',
  '20260817_feature_usage.sql',
  '20260818_email_credits.sql',
]

const DESCRIPTIONS = {
  '20260812_admin_allowlist.sql': 'auto-admin moved out of the signup trigger',
  '20260812_audit_reports.sql': 'shareable audit reports, no anon access',
  '20260812_daily_search_counter.sql': 'tamper-proof daily counter for the fair-use cap',
  '20260812_gclid.sql': 'ad click id on the profile, for attribution',
  '20260812_lock_usage_counters.sql': 'users can no longer edit their own usage counters',
  '20260812_pipeline.sql': 'CRM pipeline stage on saved leads',
  '20260812_saved_search_country.sql': 'keeps country and km on saved searches',
  '20260813_bulk_save_entitlements.sql': 'saved-lead entitlement enforcement',
  '20260815_product_allowances.sql': 'metered live-search allowances and workspace guards',
  '20260816_saved_lead_count_sync.sql': 'keeps saved-lead counts honest',
  '20260817_feature_usage.sql': 'per-feature usage metering',
  '20260818_email_credits.sql': 'Email Finder credit ledger, accounts, purchases',
}

function build() {
  const parts = []
  parts.push('-- ' + '='.repeat(74))
  parts.push('-- LeadZipp: every pending migration, in one paste.')
  parts.push('--')
  parts.push('-- GENERATED FILE. Do not edit by hand.')
  parts.push('--   Regenerate with: npm run build:migrations')
  parts.push('--   Edit the individual files in supabase/migrations/ instead.')
  parts.push('--')
  parts.push('-- HOW TO RUN')
  parts.push('--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.')
  parts.push('--   Runs inside a single transaction, so a failure applies nothing and')
  parts.push('--   cannot leave the database half-built. Every statement is idempotent,')
  parts.push('--   so running it twice is safe.')
  parts.push('--')
  parts.push('-- CONTENTS, in dependency order')
  PENDING.forEach((file, i) => {
    const n = String(i + 1).padStart(2, ' ')
    parts.push(`--   ${n}. ${file.replace(/\.sql$/, '').padEnd(34)} ${DESCRIPTIONS[file] ?? ''}`)
  })
  parts.push('--')
  parts.push('-- AFTER RUNNING, deploy the application. The code is written to work in')
  parts.push('-- both states, so deploying before this runs degrades rather than breaks,')
  parts.push('-- but features stay inert until it is applied.')
  parts.push('-- ' + '='.repeat(74))
  parts.push('')
  parts.push('begin;')

  for (const file of PENDING) {
    const full = join(migrationsDir, file)
    if (!existsSync(full)) {
      throw new Error(`Missing migration listed in PENDING: ${file}`)
    }
    const sql = readFileSync(full, 'utf8')
    if (/create\s+index\s+concurrently/i.test(sql)) {
      throw new Error(
        `${file} uses CREATE INDEX CONCURRENTLY, which cannot run inside a transaction. ` +
          'Either drop CONCURRENTLY or this file must stop wrapping everything in one transaction.'
      )
    }
    parts.push('')
    parts.push(`-- ${'='.repeat(12)} ${file} ${'='.repeat(12)}`)
    parts.push('')
    parts.push(sql.replace(/\s+$/, ''))
  }

  parts.push('')
  parts.push('commit;')
  parts.push('')
  return parts.join('\n')
}

const generated = build()
const check = process.argv.includes('--check')

if (check) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : ''
  if (current !== generated) {
    console.error(
      'RUN_ALL_PENDING.sql is STALE. A migration changed but the combined file was not regenerated.\n' +
        'Run: npm run build:migrations'
    )
    process.exit(1)
  }
  console.log('RUN_ALL_PENDING.sql is up to date.')
} else {
  writeFileSync(outputPath, generated)
  const lines = generated.split('\n').length
  console.log(`Wrote ${outputPath} (${PENDING.length} migrations, ${lines} lines).`)
}
