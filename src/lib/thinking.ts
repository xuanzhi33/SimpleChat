import { findProviderByUrl, type ThinkingStyle } from '@/configs/providers'
import { HttpError } from '@/lib/errors'
import { isApiModel, modelRequestOptions } from '@/lib/model'
import { ChatService } from '@/lib/chat-service'
import type { CompletionMessage } from '@/lib/title'
import type { Model, ThinkingLevel } from '@/types/chat'

/**
 * 思考档位（统一词汇）→ 各家请求字段的映射。
 *
 * 统一档位固定这五个：`none / low / medium / high / max`。界面上从左到右是
 * 关 / 默认 / 低 / 中 / 高 / 最高：「关」是最左边那格（显式关掉思考），第二格「默认」
 * 代表什么都不设置（由模型自己决定，请求里一个字段都不加）。每个服务商支持的子集不一样
 * （DeepSeek 没有「中」、硅基流动只有开关），所以滑块档位按风格收窄；「最高」在发送时落到
 * 各家的顶档。
 *
 * 来源（2026-02 核对官方文档）：
 * - OpenAI `reasoning_effort`：Chat Completions 支持 `none|minimal|low|medium|high|xhigh|max`，
 *   用 `xhigh` 当顶档（不管老模型认不认）
 * - DeepSeek `{thinking:{type}}` + `reasoning_effort`：活跃模型只有 `low|high|max`（没有「中」，
 *   `medium` 会被官方映射回 `high`，所以干脆不提供）；关 = `thinking.type: 'disabled'`
 * - OpenRouter `reasoning.effort`：`none|minimal|low|medium|high|xhigh|max`（`none` 即关闭）；
 *   这里关用 `reasoning.enabled: false`（官方推荐的关闭写法，`mandatory` 的模型不收 `effort: none`）
 * - 硅基流动 `enable_thinking`：只有开关（`thinking_budget` 是可选预算，档位不落成 token 数）
 */

/** 档位高低次序，用于换模型后按最近档位吸附 */
const LEVEL_RANK: Record<ThinkingLevel, number> = { none: 0, low: 1, medium: 2, high: 3, max: 4 }

/** 每个风格在滑块上提供哪些档位（从左到右）。没列的风格 = 不支持配置，界面不显示这一项 */
export const THINKING_LEVELS: Partial<Record<ThinkingStyle, ThinkingLevel[]>> = {
  reasoning_effort: ['none', 'low', 'medium', 'high', 'max'],
  thinking_effort: ['none', 'low', 'high', 'max'],
  unified_reasoning: ['none', 'low', 'medium', 'high', 'max'],
  // 只支持开关：滑块就两档，「开」显示成「开」而不是「中」（内部仍按 medium 参与吸附）
  enable_thinking: ['none', 'medium'],
}

/** 统一档位 → 各家真实取值；「最高」在这里落到各家的顶档 */
const EFFORT_VALUES: Partial<Record<ThinkingStyle, Partial<Record<ThinkingLevel, string>>>> = {
  reasoning_effort: { none: 'none', low: 'low', medium: 'medium', high: 'high', max: 'xhigh' },
  thinking_effort: { low: 'low', high: 'high', max: 'max' },
  unified_reasoning: { low: 'low', medium: 'medium', high: 'high', max: 'xhigh' },
}

/** 滑块上的一个档位 */
export interface ThinkingStop {
  /** 缺省 = 默认档：不发送，由模型自己决定 */
  level?: ThinkingLevel
  /** i18n 键，档位名字由界面翻译 */
  labelKey: string
}

/** 这个模型的思考参数风格；LLM Gate 和自定义地址判断不出来 → none（不支持配置） */
export function thinkingStyleOf(model?: Model): ThinkingStyle {
  if (!model || !isApiModel(model)) return 'none'
  return findProviderByUrl(model.baseUrl)?.thinkingStyle ?? 'none'
}

/** 档位对应的界面文案键；不传 level = 默认档 */
export function thinkingLevelLabelKey(style: ThinkingStyle, level?: ThinkingLevel): string {
  if (!level) return 'chat.thinkingEffort.default'
  // 硅基流动那种「开」不叫「中」
  if (style === 'enable_thinking' && level !== 'none') return 'chat.thinkingEffort.on'
  return `chat.thinkingEffort.${level}`
}

/** 档位名字和滑块轨道的配色 */
export interface ThinkingLevelColors {
  /** 档位名字（弹窗里的当前档位、刻度、输入框外显） */
  text: string
  /** 滑块已填充的那段；写成任意变体是因为要打到 Slider 内部元素上（不改 ui/slider） */
  range: string
}

/**
 * 档位配色：关是灰的（明确不想），默认是蓝的（交给模型决定）—— 这两格必须一眼分清；
 * 其余按「想得越多越烫」排：绿 → 黄 → 橙 → 红。
 */
const LEVEL_COLORS: Record<ThinkingLevel, ThinkingLevelColors> = {
  none: {
    text: 'text-muted-foreground',
    range: '[&_[data-slot=slider-range]]:bg-muted-foreground',
  },
  low: {
    text: 'text-emerald-600 dark:text-emerald-400',
    range: '[&_[data-slot=slider-range]]:bg-emerald-500',
  },
  medium: {
    text: 'text-amber-600 dark:text-amber-400',
    range: '[&_[data-slot=slider-range]]:bg-amber-500',
  },
  high: {
    text: 'text-orange-600 dark:text-orange-400',
    range: '[&_[data-slot=slider-range]]:bg-orange-500',
  },
  max: {
    text: 'text-red-600 dark:text-red-400',
    range: '[&_[data-slot=slider-range]]:bg-red-500',
  },
}

/** 「默认」档不发任何字段，给个冷静的蓝 */
const DEFAULT_COLORS: ThinkingLevelColors = {
  text: 'text-sky-600 dark:text-sky-400',
  range: '[&_[data-slot=slider-range]]:bg-sky-500',
}

/** 档位配色；不传 level = 默认档 */
export function thinkingLevelColors(level?: ThinkingLevel): ThinkingLevelColors {
  return level ? LEVEL_COLORS[level] : DEFAULT_COLORS
}

/**
 * 滑块档位；返回空数组表示这个服务商不支持（界面直接不显示思考强度）。
 * 顺序固定：关 / 默认 / 其余档位（「关」必须在最左边，好让「默认」和真正的档位挤在一起）。
 */
export function thinkingStops(style: ThinkingStyle): ThinkingStop[] {
  const levels = THINKING_LEVELS[style]
  if (!levels) return []

  return [
    { level: 'none', labelKey: thinkingLevelLabelKey(style, 'none') },
    { labelKey: thinkingLevelLabelKey(style) },
    ...levels
      .filter((level) => level !== 'none')
      .map((level) => ({ level, labelKey: thinkingLevelLabelKey(style, level) })),
  ]
}

/**
 * 当前档位在滑块上的位置（「默认」那一格）。
 * 存下来的档位在新模型上不存在时（换模型、换服务商），按高低次序就近吸附；
 * 一样近时取更高的那档 —— 用户既然选了档位，就是想要思考。
 */
export function thinkingStopIndex(style: ThinkingStyle, level?: ThinkingLevel): number {
  const stops = thinkingStops(style)
  const defaultIndex = stops.findIndex((stop) => !stop.level)

  if (level) {
    const exact = stops.findIndex((stop) => stop.level === level)
    if (exact >= 0) return exact

    let nearest = defaultIndex
    let nearestDistance = Number.POSITIVE_INFINITY
    stops.forEach((stop, index) => {
      if (!stop.level) return
      const distance = Math.abs(LEVEL_RANK[stop.level] - LEVEL_RANK[level])
      if (distance <= nearestDistance) {
        nearest = index
        nearestDistance = distance
      }
    })
    return nearest
  }

  return defaultIndex
}

/**
 * 档位 → 请求体里的思考字段；不支持 / 没选档位都返回空对象（一个字段都不加）。
 * 注意「关」不能用 `effort: none` 代替：DeepSeek 要 thinking.type，OpenRouter 要走 enabled。
 */
export function thinkingPayload(
  style: ThinkingStyle,
  level?: ThinkingLevel,
): Record<string, unknown> {
  const levels = THINKING_LEVELS[style]
  if (!levels || !level || !levels.includes(level)) return {}

  if (style === 'enable_thinking') return { enable_thinking: level !== 'none' }

  if (level === 'none') {
    if (style === 'thinking_effort') return { thinking: { type: 'disabled' } }
    if (style === 'unified_reasoning') return { reasoning: { enabled: false } }
    return { reasoning_effort: 'none' }
  }

  const effort = EFFORT_VALUES[style]?.[level]
  if (!effort) return {}
  if (style === 'thinking_effort')
    return { thinking: { type: 'enabled' }, reasoning_effort: effort }
  if (style === 'unified_reasoning') return { reasoning: { effort } }
  return { reasoning_effort: effort }
}

/**
 * 内部请求（标题生成）用：能关思考就显式关掉 —— 省时间省钱，
 * 也避免模型把预算全花在思考上导致正文为空。
 *
 * 有些老模型 / 网关不认这些字段会回 400（个别 422），这时退回不带参数的版本再试一次：
 * 内部请求用户看不见，宁可多一次请求也别丢结果。
 */
export async function completeWithoutThinking(
  model: Model,
  messages: CompletionMessage[],
): Promise<string> {
  const options = modelRequestOptions(model)
  const thinking = thinkingPayload(thinkingStyleOf(model), 'none')
  if (!Object.keys(thinking).length) {
    return new ChatService(model.baseUrl, options).complete(messages)
  }

  try {
    return await new ChatService(model.baseUrl, { ...options, thinking }).complete(messages)
  } catch (error) {
    if (!(error instanceof HttpError) || (error.status !== 400 && error.status !== 422)) throw error
    console.warn('Thinking parameter rejected, retrying without it:', error)
    return new ChatService(model.baseUrl, options).complete(messages)
  }
}
