import * as vscode from 'vscode'
import { initTelemetry, readLog, clearLog } from './telemetry'
import { startDetection, runHandlers } from './detection'
import { handlers, undoLastCommit, forcePush } from './handlers'
import { createStatusBar, getOutputChannel } from './ui'

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) return

  const workspaceRoot = workspaceFolders[0].uri.fsPath

  initTelemetry(context)
  context.subscriptions.push(createStatusBar())

  const disposables = startDetection(context, workspaceRoot)
  context.subscriptions.push(...disposables)

  const register = (id: string, fn: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn))

  // List auto-detection handlers
  register('gitdoc.viewFixes', async () => {
    const items = handlers
      .filter(h => !h.commandOnly)
      .map(h => ({
        label: h.id,
        description: h.destructive ? 'destructive' : h.advisory ? 'advisory' : 'safe',
      }))
    await vscode.window.showQuickPick(items, {
      placeHolder: 'GitDoc: active auto-detection handlers',
    })
  })

  // Manual destructive commands (never auto-fire)
  register('gitdoc.undoLastCommit', () => undoLastCommit.handle({ workspaceRoot }))
  register('gitdoc.forcePush', () => forcePush.handle({ workspaceRoot }))

  // Force a detection sweep on demand
  register('gitdoc.checkNow', () => runHandlers({ workspaceRoot }))

  // Activity log
  register('gitdoc.viewLog', async () => {
    const entries = readLog()
    const ch = getOutputChannel()
    ch.clear()
    if (entries.length === 0) {
      ch.appendLine('GitDoc activity log is empty.')
    } else {
      ch.appendLine(`GitDoc activity log (${entries.length} entries):`)
      entries.forEach(e => ch.appendLine(`  ${e.ts}  ${e.handlerId}  [${e.outcome}]`))
    }
    ch.show()
  })

  register('gitdoc.clearLog', async () => {
    const answer = await vscode.window.showWarningMessage(
      'Clear the GitDoc activity log?',
      { modal: true },
      'Clear',
      'Cancel'
    )
    if (answer === 'Clear') {
      clearLog()
      vscode.window.showInformationMessage('GitDoc: activity log cleared.')
    }
  })
}

export function deactivate(): void {
  // disposables cleaned up via context.subscriptions
}
