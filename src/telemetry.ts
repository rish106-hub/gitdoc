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

export function getLogPath(): string | undefined {
  return logPath
}

export function readLog(): Array<{ handlerId: string; outcome: string; ts: string }> {
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
