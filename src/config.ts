import * as vscode from 'vscode'

export interface GitDocConfig {
  autoDetect: boolean
  disabledHandlers: string[]
  telemetry: boolean
  confirmSafeFixes: boolean
}

const DEFAULTS: GitDocConfig = {
  autoDetect: true,
  disabledHandlers: [],
  telemetry: true,
  confirmSafeFixes: true,
}

export function getConfig(): GitDocConfig {
  const c = vscode.workspace.getConfiguration('gitdoc')
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
