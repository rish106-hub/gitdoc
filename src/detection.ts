import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { GitContext, GitExtensionAPI } from './types'
import { handlers } from './handlers'
import { getOutputChannel } from './ui'

const DEBOUNCE_MS = 200

export function startDetection(
  _context: vscode.ExtensionContext,
  workspaceRoot: string
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = []

  // On-activate: check for in-progress git states
  checkOnActivate(workspaceRoot)

  // vscode.git API event listener
  const gitExt = vscode.extensions.getExtension<GitExtensionAPI>('vscode.git')
  if (gitExt?.isActive) {
    const gitApi = gitExt.exports.getAPI(1)
    disposables.push(
      gitApi.onDidOpenRepository(repo => {
        // Future: wire up repo-level events when VS Code exposes them
        void repo
      })
    )
  }

  // FSWatcher on .git/ directory with debounce
  const gitDir = path.join(workspaceRoot, '.git')
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(gitDir, '**')
  )

  const runDetection = (apiEvent?: GitContext['apiEvent']) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void runHandlers({ workspaceRoot, apiEvent })
    }, DEBOUNCE_MS)
  }

  disposables.push(watcher.onDidCreate(() => runDetection()))
  disposables.push(watcher.onDidDelete(() => runDetection()))
  disposables.push(watcher.onDidChange(() => runDetection()))
  disposables.push(watcher)

  return disposables
}

async function checkOnActivate(workspaceRoot: string): Promise<void> {
  const markers = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', path.join('rebase-merge', 'head-name')]
  for (const marker of markers) {
    try {
      fs.readFileSync(path.join(workspaceRoot, '.git', marker), 'utf8')
      // Marker present — run full detection
      await runHandlers({ workspaceRoot })
      return
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
  }
}

async function runHandlers(ctx: GitContext): Promise<void> {
  for (const handler of handlers) {
    try {
      const detected = await handler.detect(ctx)
      if (detected) {
        await handler.handle(ctx)
        return // one handler per event cycle
      }
    } catch (err) {
      // non-fatal — log but don't surface raw errors
      getOutputChannel().appendLine(`Handler ${handler.id} error: ${String(err)}`)
    }
  }
}
