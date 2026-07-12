import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { GitContext, GitExtensionAPI, Handler } from './types'
import { handlers } from './handlers'
import { getOutputChannel } from './ui'
import { getConfig, isHandlerEnabled } from './config'

const DEBOUNCE_MS = 200

// Guards against overlapping detection cycles. A single git operation touches
// .git/ in a burst, and detect()/handle() are async — without this, two cycles
// could both pass the same detect() and show duplicate dialogs.
let detectionInFlight = false

// Shared, generation-tagged detection cache. The sidebar (treeView) and the
// auto-fix detector both sweep handler.detect(), and some detect()s spawn git
// subprocesses — running both back-to-back (checkNow/ask do exactly that) would
// double the work. runHandlers bumps the generation on entry to every cycle it
// actually runs, then caches each detect() result it computes; treeView reads
// that same-generation cache and only computes the handlers runHandlers didn't
// reach (i.e. those after the first match, which it short-circuits past). A new
// generation invalidates everything, so a stale detect() result is never read.
let detectionGeneration = 0
const detectionCache = new Map<string, boolean>() // key: `${root}::${handlerId}`

/** Current detection generation. Exposed for tests. */
export function detectionGen(): number {
  return detectionGeneration
}

/**
 * Run handler.detect(ctx), reusing a cached result from the current generation
 * if present. Both runHandlers and treeView go through this so a cycle followed
 * by a sidebar refresh shares detect() work instead of repeating it.
 */
export async function detectCached(handler: Handler, ctx: GitContext): Promise<boolean> {
  const key = `${ctx.workspaceRoot}::${handler.id}`
  const cached = detectionCache.get(key)
  if (cached !== undefined) return cached
  const result = await Promise.resolve(handler.detect(ctx))
  detectionCache.set(key, result)
  return result
}

export function startDetection(
  _context: vscode.ExtensionContext,
  workspaceRoot: string
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = []

  // On-activate: resume detection for any in-progress git state
  void checkOnActivate(workspaceRoot)

  // vscode.git API listener. The extension may not be active yet at our
  // activation, so activate it first, then wire the listener if the API exists.
  void wireGitApi(disposables)

  // FSWatcher on .git/ with debounce — the primary detection path. Works
  // regardless of whether the vscode.git API is available.
  const gitDir = path.join(workspaceRoot, '.git')
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(gitDir, '**')
  )

  const runDetection = (apiEvent?: GitContext['apiEvent']) => {
    if (!getConfig().autoDetect) return // user turned auto-detection off
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

async function wireGitApi(disposables: vscode.Disposable[]): Promise<void> {
  try {
    const gitExt = vscode.extensions.getExtension<GitExtensionAPI>('vscode.git')
    if (!gitExt) return
    if (!gitExt.isActive) await gitExt.activate()

    const gitApi = gitExt.exports.getAPI(1)
    disposables.push(
      gitApi.onDidOpenRepository(repo => {
        // Repo-level error events aren't exposed by the stable API yet
        // (validated in the Week 1 spike). The FSWatcher path covers detection;
        // this hook is where API-driven events attach once confirmed.
        void repo
      })
    )
  } catch (err) {
    getOutputChannel().appendLine(`vscode.git API wiring failed: ${String(err)}`)
  }
}

async function checkOnActivate(workspaceRoot: string): Promise<void> {
  const markers = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', path.join('rebase-merge', 'head-name')]
  for (const marker of markers) {
    try {
      fs.readFileSync(path.join(workspaceRoot, '.git', marker), 'utf8')
      // Marker present — run detection to resume the interrupted state
      await runHandlers({ workspaceRoot })
      return
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        getOutputChannel().appendLine(`on-activate check failed: ${String(e)}`)
      }
    }
  }
}

export async function runHandlers(
  ctx: GitContext,
  registry: Handler[] = handlers,
  enabled: (id: string) => boolean = isHandlerEnabled
): Promise<void> {
  if (detectionInFlight) return
  detectionInFlight = true
  // New cycle → new generation. Clear the cache so treeView can never read a
  // detect() result from a previous git state; only this generation is live.
  detectionGeneration++
  detectionCache.clear()
  try {
    for (const handler of registry) {
      if (handler.commandOnly) continue // command-only handlers never auto-fire
      if (!enabled(handler.id)) continue // user disabled this handler
      try {
        const detected = await detectCached(handler, ctx)
        if (detected) {
          await handler.handle(ctx)
          return // one handler per event cycle
        }
      } catch (err) {
        // non-fatal — log but don't surface raw errors to the user
        getOutputChannel().appendLine(`Handler ${handler.id} error: ${String(err)}`)
      }
    }
  } finally {
    detectionInFlight = false
  }
}
