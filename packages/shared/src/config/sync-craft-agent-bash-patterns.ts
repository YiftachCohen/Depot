#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDepotReadOnlyBashPatterns } from './cli-domains.ts'

interface AllowedBashEntry {
  pattern: string
  comment?: string
}

interface PermissionsConfig {
  version?: string
  allowedBashPatterns?: AllowedBashEntry[]
  [key: string]: unknown
}

function isDepotPattern(entry: AllowedBashEntry): boolean {
  return typeof entry.pattern === 'string' && entry.pattern.startsWith('^depot\\s')
}

function syncDepotPatterns(config: PermissionsConfig): PermissionsConfig {
  const patterns = config.allowedBashPatterns ?? []
  const firstDepotIndex = patterns.findIndex(isDepotPattern)

  const withoutDepot = patterns.filter(entry => !isDepotPattern(entry))
  const generated = getDepotReadOnlyBashPatterns()

  const insertAt = firstDepotIndex >= 0 ? firstDepotIndex : withoutDepot.length
  const nextAllowedBashPatterns = [
    ...withoutDepot.slice(0, insertAt),
    ...generated,
    ...withoutDepot.slice(insertAt),
  ]

  return {
    ...config,
    allowedBashPatterns: nextAllowedBashPatterns,
  }
}

function main() {
  const targetPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'apps/electron/resources/permissions/default.json')

  const config = JSON.parse(readFileSync(targetPath, 'utf-8')) as PermissionsConfig
  const nextConfig = syncDepotPatterns(config)

  writeFileSync(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf-8')
  process.stdout.write(`Synced depot bash patterns in ${targetPath}\n`)
}

if (import.meta.main) {
  main()
}
