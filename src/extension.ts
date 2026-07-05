import * as vscode from 'vscode'
import { initTelemetry, readLog, clearLog, logErrorMiss } from './telemetry'
import { startDetection, runHandlers } from './detection'
import { handlers, undoLastCommit, forcePush } from './handlers'
import { createStatusBar, getOutputChannel, showError, confirmDestructive } from './ui'
import { explainError } from './explainer'
import { planRoute } from './nlRouter'
import { entryForHandler } from './errorMap'
import { GitDocTreeProvider } from './treeView'

function currentWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
}

/** Render an explanation for a pasted/observed error and offer the live fix if any. */
async function runExplain(text: string, root: string | undefined): Promise<void> {
  const explanation = await explainError(text, { workspaceRoot: root ?? '' })
  if (explanation.unmatched) logErrorMiss(text)

  const ch = getOutputChannel()
  ch.clear()
  ch.appendLine(`GitDoc — ${explanation.title}`)
  ch.appendLine('')
  ch.appendLine(explanation.body)
  if (explanation.suggestedCommand) {
    ch.appendLine('')
    ch.appendLine('Suggested command (run it yourself):')
    ch.appendLine(`  ${explanation.suggestedCommand}`)
  }
  ch.show()

  if (explanation.liveFixHandlerId && root) {
    const handler = handlers.find(h => h.id === explanation.liveFixHandlerId)
    if (handler) {
      const doFix = await vscode.window.showInformationMessage(
        `GitDoc: ${explanation.title}. Your repo is in this state now — want the safe fix?`,
        'Do the safe fix',
        'Just explain'
      )
      if (doFix === 'Do the safe fix') await handler.handle({ workspaceRoot: root })
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  initTelemetry(context)
  context.subscriptions.push(createStatusBar())

  // Sidebar
  const tree = new GitDocTreeProvider(currentWorkspaceRoot)
  context.subscriptions.push(vscode.window.registerTreeDataProvider('gitdocView', tree))
  tree.refresh()

  // Detection only runs when there's a workspace to watch. Commands are always
  // registered so the extension is never dead on arrival.
  const workspaceRoot = currentWorkspaceRoot()
  if (workspaceRoot) {
    context.subscriptions.push(...startDetection(context, workspaceRoot))
  }

  const register = (id: string, fn: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn))

  const withWorkspace = (fn: (root: string) => unknown) => () => {
    const root = currentWorkspaceRoot()
    if (!root) {
      showError('Open a folder with a git repository first.')
      return
    }
    return fn(root)
  }

  register('gitdoc.viewFixes', async () => {
    const items = handlers
      .filter(h => !h.commandOnly)
      .map(h => ({
        label: h.id,
        description: h.destructive ? 'destructive' : h.advisory ? 'advisory' : 'safe',
      }))
    await vscode.window.showQuickPick(items, { placeHolder: 'GitDoc: active auto-detection handlers' })
  })

  register('gitdoc.undoLastCommit', withWorkspace(root => undoLastCommit.handle({ workspaceRoot: root })))
  register('gitdoc.forcePush', withWorkspace(root => forcePush.handle({ workspaceRoot: root })))
  register('gitdoc.checkNow', withWorkspace(async root => { await runHandlers({ workspaceRoot: root }); tree.refresh() }))

  // Unified NL entry point: describe an intent OR paste an error — one box.
  register('gitdoc.ask', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Tell GitDoc what you want, or paste a git error',
      placeHolder: 'e.g. "undo my last commit"  ·  "my branch is behind"  ·  paste an error',
      ignoreFocusOut: true,
    })
    if (!input) return
    const root = currentWorkspaceRoot()
    const plan = planRoute(input)

    if (plan.action === 'explain') {
      await runExplain(input, root)
      return
    }
    if (plan.action === 'unknown') {
      vscode.window.showInformationMessage(`GitDoc: ${plan.message}`)
      return
    }

    // run-handler: whitelist-check against the registry, then dispatch through gates.
    const handler = handlers.find(h => h.id === plan.handlerId)
    if (!handler) {
      showError("I matched an action I can't run safely. Aborting.")
      return
    }
    if (!root) {
      showError('Open a folder with a git repository first.')
      return
    }
    // Extra gate for NL-invoked destructive handlers: explicit 2-step confirm that
    // embeds the plain-English explanation (a beginner must understand it).
    if (plan.needsConfirm && handler.destructive) {
      const entry = entryForHandler(handler.id)
      const ok = await confirmDestructive(
        `${entry?.whatItMeans ?? ''}\n\nYou asked: "${input}". This maps to a destructive action (${handler.id}). Continue?`.trim(),
        `Run the ${handler.id} fix? It will ask you to confirm the exact command next.`
      )
      if (!ok) return
    } else if (plan.needsConfirm) {
      const ok = await vscode.window.showInformationMessage(
        `GitDoc: I think you mean "${handler.id}". Run it?`,
        'Yes',
        'Cancel'
      )
      if (ok !== 'Yes') return
    }
    await handler.handle({ workspaceRoot: root })
    tree.refresh()
  })

  register('gitdoc.explainError', async () => {
    const text = await vscode.window.showInputBox({
      prompt: 'Paste the git error you got',
      placeHolder: 'e.g. error: Your local changes would be overwritten by merge',
      ignoreFocusOut: true,
    })
    if (!text) return
    await runExplain(text, currentWorkspaceRoot())
  })

  register('gitdoc.viewLog', async () => {
    const entries = readLog()
    const ch = getOutputChannel()
    ch.clear()
    if (entries.length === 0) {
      ch.appendLine('GitDoc activity log is empty.')
    } else {
      ch.appendLine(`GitDoc activity log (${entries.length} entries):`)
      entries.forEach(e => ch.appendLine(`  ${e.ts}  ${e.handlerId ?? e.kind}  [${e.outcome ?? ''}]`))
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
