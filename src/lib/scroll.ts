/**
 * 把某条消息钉在列表容器的顶部（流式输出时用）。
 *
 * 用两个 rect 的差值而不是 offsetTop：容器的 offsetParent 不一定是它自己，rect 不用管这层。
 * scrollTop 超出可滚动范围时由浏览器夹住 —— 正文不足一屏时只能停在底部，超过一屏后这条
 * 消息正好停在顶部，之后再怎么调都不会动（所以可以每个增量都无脑调一次）。
 */
export function pinMessageToTop(container: HTMLElement, messageId: string): boolean {
  const el = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
  if (!el) return false
  container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top
  return true
}
