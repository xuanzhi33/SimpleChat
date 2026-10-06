/**
 * 这个键盘事件是不是「输入法正在组字」。
 *
 * 组字中的 Enter（拼音里「把拼音原样上屏成英文」）对 DOM 来说仍是一个 Enter 的 keydown，
 * 不挡就会当成「发送 / 保存」，而且我们的 `preventDefault` 还会把上屏本身掐掉。
 *
 * 两个条件必须都判：
 * - `isComposing`：Chrome / Edge 在「按 Enter 上屏」那一帧会给 `true`
 * - `keyCode === 229`：Safari / WebKit 先发 `compositionend` 再派发这个 keydown，
 *   那一帧它已经把 `isComposing` 清成 `false`，只剩 229（输入法按键的代号）可靠 ——
 *   `keyCode` 虽已废弃，却是 Safari 上唯一的信号，不能省
 */
export function isImeComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}
