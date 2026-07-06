import * as assert from 'assert'
import * as vscode from 'vscode'

suite('GitRescue Integration', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('rish106-hub.git-rescue')
    assert.ok(ext, 'Extension should be installed')
    await ext!.activate()
    assert.ok(ext!.isActive, 'Extension should be active')
  })

  test('gitrescue.viewFixes command registered', async () => {
    const cmds = await vscode.commands.getCommands(true)
    assert.ok(cmds.includes('gitrescue.viewFixes'), 'viewFixes command should be registered')
  })

  test('gitrescue.undoLastCommit command registered', async () => {
    const cmds = await vscode.commands.getCommands(true)
    assert.ok(cmds.includes('gitrescue.undoLastCommit'), 'undoLastCommit command should be registered')
  })

  test('all GitRescue commands are registered', async () => {
    const cmds = await vscode.commands.getCommands(true)
    for (const id of [
      'gitrescue.forcePush',
      'gitrescue.undoLastCommit',
      'gitrescue.checkNow',
      'gitrescue.viewLog',
      'gitrescue.clearLog',
      'gitrescue.explainError',
      'gitrescue.ask',
    ]) {
      assert.ok(cmds.includes(id), `${id} should be registered`)
    }
  })
})
