import { describe, it, expect } from 'vitest'
import { classifyProposedCommand, blockedReason } from '../../src/commandGuard'

describe('classifyProposedCommand — blocked (catastrophic)', () => {
  const blocked: [string, string[]][] = [
    ['reset --hard', ['reset', '--hard']],
    ['reset --hard HEAD~3', ['reset', '--hard', 'HEAD~3']],
    ['reset --soft (still rewrites)', ['reset', '--soft', 'HEAD~1']],
    ['push (any)', ['push']],
    ['push --force', ['push', '--force']],
    ['push -f', ['push', '-f']],
    ['push --force-with-lease', ['push', '--force-with-lease', 'origin', 'main']],
    ['clean -fdx', ['clean', '-fdx']],
    ['clean -f', ['clean', '-f']],
    ['clean -fd', ['clean', '-fd']],
    ['branch -D', ['branch', '-D', 'main']],
    ['branch -d', ['branch', '-d', 'feature']],
    ['tag -d', ['tag', '-d', 'v1']],
    ['stash drop', ['stash', 'drop']],
    ['stash clear', ['stash', 'clear']],
    ['filter-branch', ['filter-branch', '--tree-filter', 'rm x']],
    ['filter-repo', ['filter-repo', '--path', 'x']],
    ['rm', ['rm', '-r', 'src']],
    ['gc --prune', ['gc', '--prune=now']],
    ['reflog expire', ['reflog', 'expire', '--all']],
    ['update-ref', ['update-ref', '-d', 'refs/heads/x']],
    ['rebase', ['rebase', '-i', 'HEAD~3']],
    ['remote add', ['remote', 'add', 'evil', 'http://x']],
    ['remote set-url', ['remote', 'set-url', 'origin', 'http://x']],
    ['config write', ['config', 'user.email', 'x@y.z']],
    ['checkout --force', ['checkout', '--force', 'main']],
    ['switch --discard-changes', ['switch', '--discard-changes', 'main']],
    ['restore --force (discard)', ['restore', '-f', '.']],
  ]
  it.each(blocked)('blocks: %s', (_label, argv) => {
    expect(classifyProposedCommand(argv)).toBe('blocked')
  })

  it('blocks shell-injection metacharacters', () => {
    expect(classifyProposedCommand(['status', ';', 'rm -rf /'])).toBe('blocked')
    expect(classifyProposedCommand(['log', '&&', 'curl evil'])).toBe('blocked')
    expect(classifyProposedCommand(['commit', '-m', '`whoami`'])).toBe('blocked')
    expect(classifyProposedCommand(['log', '$(rm -rf ~)'])).toBe('blocked')
    expect(classifyProposedCommand(['status', 'a|b'])).toBe('blocked')
  })

  it('blocks the -c config-override smuggle and leading flags', () => {
    expect(classifyProposedCommand(['-c', 'core.pager=sh -c evil', 'log'])).toBe('blocked')
    expect(classifyProposedCommand(['--exec-path=/tmp/evil', 'status'])).toBe('blocked')
  })

  it('blocks empty, non-array, and unknown subcommands', () => {
    expect(classifyProposedCommand([])).toBe('blocked')
    expect(classifyProposedCommand(undefined as unknown as string[])).toBe('blocked')
    expect(classifyProposedCommand(['frobnicate'])).toBe('blocked')
    expect(classifyProposedCommand(['sudo', 'rm'])).toBe('blocked')
  })
})

describe('classifyProposedCommand — read (auto-run, cannot mutate)', () => {
  const reads: [string, string[]][] = [
    ['status', ['status']],
    ['status --porcelain', ['status', '--porcelain=v1']],
    ['log --oneline', ['log', '--oneline', '-10']],
    ['diff', ['diff']],
    ['diff --stat', ['diff', '--stat']],
    ['show', ['show', 'HEAD']],
    ['rev-parse', ['rev-parse', 'HEAD']],
    ['branch list (bare)', ['branch']],
    ['branch --list', ['branch', '--list']],
    ['branch -a', ['branch', '-a']],
    ['remote -v', ['remote', '-v']],
    ['stash list', ['stash', 'list']],
    ['config --get', ['config', '--get', 'user.email']],
  ]
  it.each(reads)('reads: %s', (_label, argv) => {
    expect(classifyProposedCommand(argv)).toBe('read')
  })
})

describe('classifyProposedCommand — mutating (two-step confirm)', () => {
  const mutating: [string, string[]][] = [
    ['add', ['add', '.']],
    ['commit -m', ['commit', '-m', 'msg']],
    ['checkout -b', ['checkout', '-b', 'feature']],
    ['switch -c', ['switch', '-c', 'feature']],
    ['merge', ['merge', 'feature']],
    ['fetch', ['fetch', 'origin']],
    ['pull (plain)', ['pull']],
    ['stash push', ['stash', 'push']],
    ['stash pop', ['stash', 'pop']],
    ['tag create', ['tag', 'v1.0.0']],
  ]
  it.each(mutating)('gates: %s', (_label, argv) => {
    expect(classifyProposedCommand(argv)).toBe('mutating')
  })
})

describe('blockedReason', () => {
  it('gives a specific reason for known dangerous ops', () => {
    expect(blockedReason(['push', '--force'])).toMatch(/push/i)
    expect(blockedReason(['reset', '--hard'])).toMatch(/reset/i)
    expect(blockedReason(['clean', '-fdx'])).toMatch(/delete/i)
    expect(blockedReason(['frobnicate'])).toMatch(/manually/i)
  })
})
