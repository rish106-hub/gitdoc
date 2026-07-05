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
