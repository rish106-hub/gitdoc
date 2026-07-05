import { describe, it, expect, vi, beforeEach } from 'vitest'

const { showWarning, cfgGet } = vi.hoisted(() => ({
  showWarning: vi.fn(),
  cfgGet: vi.fn(),
}))
vi.mock('vscode', () => ({
  window: {
    showWarningMessage: showWarning,
    showInformationMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
    createStatusBarItem: vi.fn(() => ({ show: vi.fn(), text: '', tooltip: '', command: '' })),
    StatusBarAlignment: { Left: 1 },
  },
  workspace: { getConfiguration: vi.fn(() => ({ get: cfgGet })) },
}))

import { previewCommand, confirmSafe } from '../../src/ui'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('previewCommand', () => {
  it('renders a plain argv', () => {
    expect(previewCommand(['reset', 'HEAD~1'])).toBe('git reset HEAD~1')
  })

  it('quotes args containing whitespace (injection-safe display)', () => {
    expect(previewCommand(['push', 'origin', 'feature branch'])).toBe(
      'git push origin "feature branch"'
    )
  })

  it('leaves flags and refs unquoted', () => {
    expect(previewCommand(['push', '--force-with-lease', 'origin', 'main'])).toBe(
      'git push --force-with-lease origin main'
    )
  })
})

describe('confirmSafe', () => {
  it('prompts when confirmSafeFixes is true and returns true on Yes', async () => {
    cfgGet.mockImplementation((key: string, dflt: unknown) =>
      key === 'confirmSafeFixes' ? true : dflt
    )
    showWarning.mockResolvedValueOnce('Yes')
    expect(await confirmSafe('do it?')).toBe(true)
    expect(showWarning).toHaveBeenCalledOnce()
  })

  it('returns false on Cancel', async () => {
    cfgGet.mockImplementation((key: string, dflt: unknown) =>
      key === 'confirmSafeFixes' ? true : dflt
    )
    showWarning.mockResolvedValueOnce('Cancel')
    expect(await confirmSafe('do it?')).toBe(false)
  })

  it('skips the prompt and auto-applies when confirmSafeFixes is false', async () => {
    cfgGet.mockImplementation((key: string, dflt: unknown) =>
      key === 'confirmSafeFixes' ? false : dflt
    )
    expect(await confirmSafe('do it?')).toBe(true)
    expect(showWarning).not.toHaveBeenCalled()
  })
})
