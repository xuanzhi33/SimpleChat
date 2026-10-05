/**
 * 「新建对话」快捷键：Ctrl/Cmd + J。
 *
 * 但这是浏览器自带的加速键，页面未必抢得到（`preventDefault` 不一定赢）：
 * - Chrome（Windows/Linux）Ctrl+J = 打开下载页（官方帮助页，以及 Chromium `accelerator_table.cc` 里的
 *   `{VKEY_J, EF_CONTROL_DOWN, IDC_SHOW_DOWNLOADS}`）
 * - Firefox（macOS）⌘J = 下载（`browserSets.ftl` 的 `downloads-shortcut`）
 * 真要用得顺就换个组合：只改本文件的两处导出，tooltip 里的标签会自动跟着变。
 */
export function isNewChatShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 'j') return false
  if (!event.ctrlKey && !event.metaKey) return false
  // 让开 Ctrl+Shift+J（Chrome 的 DevTools 控制台）和 Ctrl+Alt+J 之类
  return !event.altKey && !event.shiftKey
}

/** 展示用的快捷键标签，按平台习惯显示 ⌘J / Ctrl+J */
export const newChatShortcutLabel =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
    ? '⌘J'
    : 'Ctrl+J'
