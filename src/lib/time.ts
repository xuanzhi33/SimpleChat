/** 时间戳分档：今天 / 昨天 / 更早（更早的一律带年份） */
export type DayBucket = 'today' | 'yesterday' | 'older'

/**
 * 相差几个本地日历天。各自归零到当天 00:00 再相减，`Math.round` 兜住 DST 那天只有 23/25 小时。
 * 别用 `(now - ts) / 86400000` 取整：昨天 23:00 到今天 8:00 只差 9 小时会被算成「今天」。
 */
export function dayDiff(ts: number, now: number = Date.now()): number {
  const from = new Date(ts)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(0, 0, 0, 0)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/**
 * 按日历天分档。刻意只到「天」这一档，不做「几分钟前」那类相对时间——
 * 那需要挂定时器刷新，而且会把真实钟点藏起来。
 */
export function dayBucket(ts: number, now: number = Date.now()): DayBucket {
  const diff = dayDiff(ts, now)
  // diff <= 0（含时钟回拨 / 未来的时间戳）都当成今天
  if (diff <= 0) return 'today'
  return diff === 1 ? 'yesterday' : 'older'
}
