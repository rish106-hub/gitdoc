import * as assert from 'assert'
import * as vscode from 'vscode'

suite('GitDoc Integration', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('rish106-hub.gitdoc')
    assert.ok(ext, 'Extension should be installed')
    await ext!.activate()
    assert.ok(ext!.isActive, 'Extension should be active')
  })

  test('gitdoc.viewFixes command registered', async () => {
    const cmds = await vscode.commands.getCommands(true)
    assert.ok(cmds.includes('gitdoc.viewFixes'), 'viewFixes command should be registered')
  })

  test('gitdoc.undoLastCommit command registered', async () => {
    const cmds = await vscode.commands.getCommands(true)
    assert.ok(cmds.includes('gitdoc.undoLastCommit'), 'undoLastCommit command should be registered')
  })

  test('gitdoc.forcePush command registered', async () => {
    const cmds = await vscode.commands.getCommands(true)
    assert.ok(cmds.includes('gitdoc.forcePush'), 'forcePush command should be registered')
  })
})
