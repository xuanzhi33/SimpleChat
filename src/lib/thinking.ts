import { findProviderByUrl, type ThinkingStyle } from '@/configs/providers'
import { HttpError } from '@/lib/errors'
import { isApiModel, modelRequestOptions } from '@/lib/model'
import { ChatService } from '@/lib/chat-service'
import type { CompletionMessage } from '@/lib/title'
import type { Model, ThinkingLevel } from '@/types/chat'

/**
 * 思考档位（统一词汇）→ 各家请求字段的映射。
 *
 * 统一档位固定这五个：`none / low / medium / high / max`，界面上从左到右是
 * 关 / 低 / 中 / 高 / 最高。每个服务商支持的子集不一样（DeepSeek 没有「中」、
 * 硅基流动只有开关），所以滑块档位按风格收窄；「最高」在发送时落到各家的顶档。
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

/** 滑块上的一个档位；最左边永远是「默认」（不发送任何思考字段） */
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

/** 滑块档位；返回空数组表示这个服务商不支持（界面直接不显示思考强度） */
export function thinkingStops(style: ThinkingStyle): ThinkingStop[] {
  const levels = THINKING_LEVELS[style]
  if (!levels) return []

  return [
    { labelKey: 'chat.thinkingEffort.default' },
    ...levels.map((level) => ({
      level,
      // 硅基流动那种「开」不叫「中」
      labelKey:
        style === 'enable_thinking' && level !== 'none'
          ? 'chat.thinkingEffort.on'
          : `chat.thinkingEffort.${level}`,
    })),
  ]
}

/**
 * 当前档位在滑块上的位置（0 = 默认档）。
 * 存下来的档位在新模型上不存在时（换模型、换服务商），按高低次序就近吸附；
 * 一样近时取更高的那档 —— 用户既然选了档位，就是想要思考。
 */
export function thinkingStopIndex(style: ThinkingStyle, level?: ThinkingLevel): number {
  if (!level) return 0

  const stops = thinkingStops(style)
  const exact = stops.findIndex((stop) => stop.level === level)
  if (exact >= 0) return exact

  let nearest = 0
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
