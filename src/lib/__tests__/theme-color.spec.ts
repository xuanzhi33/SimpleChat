import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT, applyThemeColor } from '@/lib/theme-color'

const meta = () => document.querySelector('meta[name="theme-color"]')

describe('theme-color 跟随应用内主题', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000" />'
  })

  it('按主题改成对应的边栏背景色', () => {
    applyThemeColor(false)
    expect(meta()?.getAttribute('content')).toBe(THEME_COLOR_LIGHT)

    applyThemeColor(true)
    expect(meta()?.getAttribute('content')).toBe(THEME_COLOR_DARK)
  })

  it('页面里没有 theme-color 时静默跳过', () => {
    document.head.innerHTML = ''
    expect(() => applyThemeColor(true)).not.toThrow()
  })
})
