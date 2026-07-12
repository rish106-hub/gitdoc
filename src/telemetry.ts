import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { getConfig } from './config'

let logPath: string | undefined

export function initTelemetry(context: vscode.ExtensionContext): void {
  logPath = path.join(context.globalStorageUri.fsPath, 'telemetry.jsonl')
  fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true })
}

export function logHandlerRun(handlerId: string, outcome: 'applied' | 'cancelled'): void {
  if (!logPath) return
  if (!getConfig().telemetry) return // user opted out of local logging
  const entry = JSON.stringify({ handlerId, outcome, ts: new Date().toISOString() })
  try {
    fs.appendFileSync(logPath, entry + '\n')
  } catch {
    // non-critical — ignore write failures
  }
}

/**
 * Record that a pasted error matched no map entry. Stores a short stable hash of
 * the text, never the text itself — this is the dataset that grows the error map,
 * kept privacy-safe and local-only.
 */
export function logErrorMiss(errorText: string): void {
  if (!logPath) return
  if (!getConfig().telemetry) return
  let hash = 0
  for (let i = 0; i < errorText.length; i++) {
    hash = (hash * 31 + errorText.charCodeAt(i)) | 0
  }
  const entry = JSON.stringify({
    kind: 'error-miss',
    hash: (hash >>> 0).toString(16),
    len: errorText.length,
    ts: new Date().toISOString(),
  })
  try {
    fs.appendFileSync(logPath, entry + '\n')
  } catch {
    // non-critical
  }
}

export function getLogPath(): string | undefined {
  return logPath
}

export interface LogEntry {
  ts: string
  handlerId?: string
  outcome?: string
  kind?: string
  [k: string]: unknown
}

export function readLog(): LogEntry[] {
  if (!logPath) return []
  try {
    const raw = fs.readFileSync(logPath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))
  } catch {
    return []
  }
}

export function clearLog(): void {
  if (!logPath) return
  try {
    fs.writeFileSync(logPath, '')
  } catch {
    // non-critical
  }
}

export interface ErrorMissSummary {
  /** Stable hash of the unmatched error text (same hash logErrorMiss wrote). */
  hash: string
  /** Length of the original error text. */
  len: number
  /** How many times this same unmatched error was seen. */
  count: number
  /** ISO timestamp of the most recent sighting. */
  lastSeen: string
}

/**
 * Aggregate 'error-miss' entries into a ranked list of the most frequent
 * unmatched errors, so a maintainer can see which errors to add to the error
 * map next. Privacy-safe by construction: it only groups data that was already
 * hashed at write-time (never raw text) and reads nothing new. Pure — takes the
 * log entries as an argument (default readLog()) so it is testable in isolation.
 */
export function summarizeErrorMisses(
  entries: LogEntry[] = readLog(),
  limit = 10
): ErrorMissSummary[] {
  const byHash = new Map<string, ErrorMissSummary>()
  for (const e of entries) {
    if (e.kind !== 'error-miss' || typeof e.hash !== 'string') continue
    const existing = byHash.get(e.hash)
    if (existing) {
      existing.count += 1
      if (typeof e.ts === 'string' && e.ts > existing.lastSeen) existing.lastSeen = e.ts
    } else {
      byHash.set(e.hash, {
        hash: e.hash,
        len: typeof e.len === 'number' ? e.len : 0,
        count: 1,
        lastSeen: typeof e.ts === 'string' ? e.ts : '',
      })
    }
  }
  return [...byHash.values()]
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, limit)
}
