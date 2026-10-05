import { describe, it, expect, vi } from 'vitest'
import { pinMessageToTop } from '@/lib/scroll'

/** 造一个容器 + 里面一条消息，rect 用假的（jsdom 没有布局，全返回 0） */
const setupDom = (containerTop: number, messageTop: number, scrollTop = 40) => {
  const container = document.createElement('div')
  const message = document.createElement('div')
  message.dataset.messageId = 'm1'
  container.appendChild(message)
  container.scrollTop = scrollTop
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: containerTop } as DOMRect)
  vi.spyOn(message, 'getBoundingClientRect').mockReturnValue({ top: messageTop } as DOMRect)
  return { container, message }
}

describe('pinMessageToTop', () => {
  it('把消息顶边对齐容器顶边', () => {
    const { container } = setupDom(100, 300)
    expect(pinMessageToTop(container, 'm1')).toBe(true)
    expect(container.scrollTop).toBe(240)
  })

  it('消息已经在容器上方时（差值为负）往上回滚', () => {
    const { container } = setupDom(100, 60, 200)
    expect(pinMessageToTop(container, 'm1')).toBe(true)
    expect(container.scrollTop).toBe(160)
  })

  it('找不到这条消息就什么都不做', () => {
    const { container } = setupDom(100, 300)
    expect(pinMessageToTop(container, '不存在')).toBe(false)
    expect(container.scrollTop).toBe(40)
  })
})
