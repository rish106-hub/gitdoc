import * as vscode from 'vscode'

export interface GitContext {
  workspaceRoot: string
  apiEvent?: { action: string; error?: string }
  gitHead?: string
}

export interface Handler {
  id: string
  detect: (ctx: GitContext) => boolean | Promise<boolean>
  destructive: boolean
  advisory: boolean
  handle: (ctx: GitContext) => Promise<void>
}

export type GitExtensionAPI = {
  getAPI: (version: number) => GitAPI
}

export type GitAPI = {
  onDidOpenRepository: vscode.Event<GitRepository>
  repositories: GitRepository[]
}

export type GitRepository = {
  rootUri: vscode.Uri
  state: {
    HEAD?: { name?: string; upstream?: { name: string } }
    remotes: Array<{ name: string; fetchUrl?: string }>
  }
}
