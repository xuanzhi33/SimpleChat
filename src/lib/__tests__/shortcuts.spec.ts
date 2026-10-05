// @vitest-environment node（纯逻辑，不需要 jsdom，省掉环境启动开销）
import { describe, expect, it } from 'vitest'
import { isNewChatShortcut } from '@/lib/shortcuts'

/** 造一个 keydown 事件（只用到这几个字段） */
const keydown = (partial: Partial<KeyboardEvent>): KeyboardEvent =>
  ({
    key: 'j',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...partial,
  }) as KeyboardEvent

describe('isNewChatShortcut', () => {
  it('Ctrl+J 和 Cmd+J 都算，大小写不敏感', () => {
    expect(isNewChatShortcut(keydown({ ctrlKey: true }))).toBe(true)
    expect(isNewChatShortcut(keydown({ metaKey: true }))).toBe(true)
    expect(isNewChatShortcut(keydown({ ctrlKey: true, key: 'J' }))).toBe(true)
  })

  it('光按 j、或别的键都不算', () => {
    expect(isNewChatShortcut(keydown({}))).toBe(false)
    expect(isNewChatShortcut(keydown({ key: 'k', ctrlKey: true }))).toBe(false)
    expect(isNewChatShortcut(keydown({ key: 'Enter', ctrlKey: true }))).toBe(false)
  })

  it('让开 Ctrl+Shift+J（DevTools 控制台）和 Ctrl+Alt+J', () => {
    expect(isNewChatShortcut(keydown({ ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isNewChatShortcut(keydown({ ctrlKey: true, altKey: true }))).toBe(false)
  })
})
