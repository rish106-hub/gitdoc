import * as vscode from 'vscode'

export interface GitRescueConfig {
  autoDetect: boolean
  disabledHandlers: string[]
  telemetry: boolean
  confirmSafeFixes: boolean
}

const DEFAULTS: GitRescueConfig = {
  autoDetect: true,
  disabledHandlers: [],
  telemetry: true,
  confirmSafeFixes: true,
}

export function getConfig(): GitRescueConfig {
  const c = vscode.workspace.getConfiguration('gitrescue')
  return {
    autoDetect: c.get('autoDetect', DEFAULTS.autoDetect),
    disabledHandlers: c.get('disabledHandlers', DEFAULTS.disabledHandlers),
    telemetry: c.get('telemetry', DEFAULTS.telemetry),
    confirmSafeFixes: c.get('confirmSafeFixes', DEFAULTS.confirmSafeFixes),
  }
}

export function isHandlerEnabled(id: string): boolean {
  return !getConfig().disabledHandlers.includes(id)
}
