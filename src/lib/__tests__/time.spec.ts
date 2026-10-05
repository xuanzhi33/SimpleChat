// @vitest-environment node（纯逻辑，不需要 jsdom，省掉环境启动开销）
import { describe, expect, it } from 'vitest'
import { dayBucket, dayDiff } from '@/lib/time'

/** 本地时间构造时间戳（月份按人类习惯从 1 开始） */
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

describe('dayDiff', () => {
  it('同一天都是 0、前一天都是 1，与几点无关', () => {
    const now = at(2026, 3, 5, 0, 1)
    expect(dayDiff(at(2026, 3, 5, 23, 59), now)).toBe(0)
    expect(dayDiff(at(2026, 3, 4, 23, 59), now)).toBe(1)
  })

  it('只差 2 分钟但跨了天，算 1 天（不能拿时间差除 86400000）', () => {
    expect(dayDiff(at(2026, 3, 4, 23, 59), at(2026, 3, 5, 0, 1))).toBe(1)
  })

  it('夏令时切换那天只有 23 小时，仍算 1 天', () => {
    // 用一组会跨越 3 月第二个周日（美国 DST 开始）的本地时间；本地无 DST 时结果同样是 1
    expect(dayDiff(at(2026, 3, 8, 12, 0), at(2026, 3, 9, 12, 0))).toBe(1)
  })
})

describe('dayBucket', () => {
  it('只分三档：今天 / 昨天 / 更早（更早不看是不是今年）', () => {
    const now = at(2026, 3, 5, 12, 0)
    expect(dayBucket(at(2026, 3, 5, 0, 1), now)).toBe('today')
    expect(dayBucket(at(2026, 3, 5, 23, 59), now)).toBe('today')
    expect(dayBucket(at(2026, 3, 4, 23, 59), now)).toBe('yesterday')
    expect(dayBucket(at(2026, 3, 3, 12, 0), now)).toBe('older')
    expect(dayBucket(at(2026, 1, 1, 12, 0), now)).toBe('older')
  })

  it('跨年时昨天仍是昨天', () => {
    expect(dayBucket(at(2025, 12, 31, 23, 0), at(2026, 1, 1, 0, 30))).toBe('yesterday')
    expect(dayBucket(at(2025, 12, 30, 23, 0), at(2026, 1, 1, 0, 30))).toBe('older')
  })

  it('未来时间（时钟回拨）当今天，不返回负数档', () => {
    expect(dayBucket(at(2026, 3, 6, 0, 0), at(2026, 3, 5, 12, 0))).toBe('today')
  })
})
