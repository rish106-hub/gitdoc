import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

let logPath: string | undefined

export function initTelemetry(context: vscode.ExtensionContext): void {
  logPath = path.join(context.globalStorageUri.fsPath, 'telemetry.jsonl')
  fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true })
}

export function logHandlerRun(handlerId: string, outcome: 'applied' | 'cancelled'): void {
  if (!logPath) return
  const entry = JSON.stringify({ handlerId, outcome, ts: new Date().toISOString() })
  try {
    fs.appendFileSync(logPath, entry + '\n')
  } catch {
    // non-critical — ignore write failures
  }
}
