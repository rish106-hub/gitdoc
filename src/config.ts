import * as vscode from 'vscode'

export interface GitRescueConfig {
  autoDetect: boolean
  disabledHandlers: string[]
  telemetry: boolean
  confirmSafeFixes: boolean
  groqModel: string
  aiChatEnabled: boolean
}

const DEFAULTS: GitRescueConfig = {
  autoDetect: true,
  disabledHandlers: [],
  telemetry: true,
  confirmSafeFixes: true,
  groqModel: 'llama-3.3-70b-versatile',
  aiChatEnabled: true,
}

export function getConfig(): GitRescueConfig {
  const c = vscode.workspace.getConfiguration('gitrescue')
  return {
    autoDetect: c.get('autoDetect', DEFAULTS.autoDetect),
    disabledHandlers: c.get('disabledHandlers', DEFAULTS.disabledHandlers),
    telemetry: c.get('telemetry', DEFAULTS.telemetry),
    confirmSafeFixes: c.get('confirmSafeFixes', DEFAULTS.confirmSafeFixes),
    groqModel: c.get('groqModel', DEFAULTS.groqModel),
    aiChatEnabled: c.get('aiChat.enabled', DEFAULTS.aiChatEnabled),
  }
}

// Handlers that were renamed. A user who disabled the old id in settings should
// keep the handler disabled after the rename — otherwise the advisory silently
// re-enables itself on upgrade. Maps current id -> legacy id(s).
const LEGACY_HANDLER_IDS: Record<string, string[]> = {
  'h10-far-behind-remote': ['h10-merge-wizard'],
}

export function isHandlerEnabled(id: string): boolean {
  const disabled = getConfig().disabledHandlers
  if (disabled.includes(id)) return false
  const legacy = LEGACY_HANDLER_IDS[id]
  return !legacy?.some(oldId => disabled.includes(oldId))
}
