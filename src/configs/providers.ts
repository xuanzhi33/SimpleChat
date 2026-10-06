import deepseekLogo from '@/assets/deepseek.svg'
import openaiLogo from '@/assets/openai.svg'
import openrouterLogo from '@/assets/openrouter.svg'
import siliconcloudLogo from '@/assets/siliconcloud.svg'

/**
 * 思考档位（关/低/中/高/强）在请求体里的表达风格（wire format）。
 *
 * 同一个档位，各家要发成完全不同的字段，所以给每个 provider 预设标一个风格，
 * 由它决定「档位 → 请求体字段」的映射：
 *
 * - `reasoning_effort`   平面枚举：`{ reasoning_effort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' }`
 *                         OpenAI / xAI / Groq / Kimi k3，以及绝大多数 OpenAI 兼容中转
 * - `thinking_effort`    开关 + 平面枚举：`{ thinking: { type: 'enabled' | 'disabled' }, reasoning_effort: ... }`
 *                         DeepSeek / 智谱 GLM / MiniMax（各家支持的档位是子集，如 DeepSeek 只有 none|low|high|max）
 * - `unified_reasoning`  统一对象：`{ reasoning: { effort?, max_tokens?, exclude?, enabled? } }`
 *                         OpenRouter / Perplexity Agent API（也能用 max_tokens 表达思考预算）
 * - `enable_thinking`    开关 + token 预算：`{ enable_thinking: true, thinking_budget: 1024 }`
 *                         阿里百炼 Qwen 系 / SiliconFlow
 * - `anthropic`          对象 + 输出配置：`{ thinking: { type: 'adaptive' }, output_config: { effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' } }`
 *                         Anthropic 原生；老模型是 `{ thinking: { type: 'enabled', budget_tokens: number } }`
 * - `google`             generationConfig 内：`{ generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' } } }`
 *                         Gemini 3+；Gemini 2.5 用 `thinkingBudget: number`（0 = 关）
 * - `none`               不发任何思考字段（模型不支持，或还没接）
 *
 * 注意：风格只决定字段形状，各家支持的档位集合并不一样（有的没有「中」，有的关不掉），
 * 这部分留给映射函数去就近取整，别写进这个字段。
 *
 * 来源级别（2026-02 核对）：OpenAI / DeepSeek / OpenRouter / SiliconFlow 四种风格都对过官方 API 文档；
 * `anthropic` 与 `google` 只是从 LiteLLM / AI SDK 这类二手文档推出来的，接入前先去官方页核一遍。
 * 另外 provider 级归类只是默认值：聚合平台（OpenRouter、SiliconFlow）实际上是「模型级」行为，
 * 同一个 base url 下不同模型的可用档位、能否关闭都可能不同，必要时得把风格下沉到模型上。
 */
export type ThinkingStyle =
  | 'reasoning_effort'
  | 'thinking_effort'
  | 'unified_reasoning'
  | 'enable_thinking'
  | 'anthropic'
  | 'google'
  | 'none'

export interface ProviderPreset {
  name: string
  /** OpenAI 兼容的 base url，请求会拼成 `${url}/chat/completions`（末尾斜杠会被去掉） */
  url: string
  /** 申请 API Key 的页面 */
  keyUrl: string
  /** 思考档位的请求风格，见 ThinkingStyle */
  thinkingStyle: ThinkingStyle
  /** 服务商 logo（`src/assets/*.svg`），列表和下拉里展示用 */
  logo: string
  /** 单色 logo（用 currentColor 画的）在深色模式下要反色才看得见 */
  logoInvert?: boolean
}

export const providerList: ProviderPreset[] = [
  {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    thinkingStyle: 'reasoning_effort',
    logo: openaiLogo,
    // OpenAI 的 mark 是单色的，SVG 里用 currentColor -> 深色底上要反色
    logoInvert: true,
  },
  {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    thinkingStyle: 'thinking_effort',
    logo: deepseekLogo,
  },
  {
    name: 'SiliconFlow CN (硅基流动)',
    url: 'https://api.siliconflow.cn/v1',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    // 平台只有开关 + thinking_budget 预算，没有「低/中/高」档，档位只能映射成 token 数
    thinkingStyle: 'enable_thinking',
    logo: siliconcloudLogo,
  },
  {
    name: 'SiliconFlow Global',
    url: 'https://api.siliconflow.com/v1',
    keyUrl: 'https://cloud.siliconflow.com/account/ak',
    thinkingStyle: 'enable_thinking',
    logo: siliconcloudLogo,
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    thinkingStyle: 'unified_reasoning',
    logo: openrouterLogo,
    // OpenRouter 的 mark 也是单色的
    logoInvert: true,
  },
]

/**
 * 按 base url 找预设服务商。
 *
 * 模型里没存服务商，只能靠地址反推：预设地址是选服务商时原样存进模型的，
 * 所以去掉末尾斜杠、忽略大小写就能对上；对不上就是用户自己填的地址。
 */
export function findProviderByUrl(baseUrl: string): ProviderPreset | undefined {
  const normalize = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase()
  const target = normalize(baseUrl)
  if (!target) return undefined
  return providerList.find((provider) => normalize(provider.url) === target)
}
