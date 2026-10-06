// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isImeComposing } from '@/lib/ime'

/** 纯对象即可：这里只读两个属性，不需要真的 KeyboardEvent */
const keydown = (parts: Partial<KeyboardEvent>) => parts as KeyboardEvent

describe('isImeComposing', () => {
  it('Chrome：上屏那一帧 isComposing 为 true', () => {
    expect(isImeComposing(keydown({ isComposing: true }))).toBe(true)
  })

  it('Safari：compositionend 先发生，isComposing 已是 false，只剩 keyCode 229', () => {
    expect(isImeComposing(keydown({ isComposing: false, keyCode: 229 }))).toBe(true)
  })

  it('普通回车不算组字（isComposing 缺失 / keyCode 13）', () => {
    expect(isImeComposing(keydown({}))).toBe(false)
    expect(isImeComposing(keydown({ isComposing: false, keyCode: 13 }))).toBe(false)
  })
})
