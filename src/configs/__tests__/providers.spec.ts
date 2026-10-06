import { describe, it, expect } from 'vitest'
import { findProviderByUrl, providerList } from '@/configs/providers'

describe('服务商预设', () => {
  it('每个预设都有 logo、申请 Key 的地址和思考风格', () => {
    // 一次列出所有缺东西的预设（断言里带语言名，失败时一眼看出是哪个）
    const incomplete = providerList
      .map((provider) => ({
        name: provider.name,
        expect: {
          logo: !!provider.logo,
          keyUrl: /^https:\/\//.test(provider.keyUrl),
          thinkingStyle: !!provider.thinkingStyle,
        },
      }))
      .filter((provider) => Object.values(provider.expect).some((ok) => !ok))
    expect(incomplete).toEqual([])
  })

  it('认得出预设地址（忽略大小写和末尾斜杠），认不出来的返回 undefined', () => {
    expect(findProviderByUrl('https://api.openai.com/v1')?.name).toBe('OpenAI')
    expect(findProviderByUrl('  https://API.OpenAI.com/v1/  ')?.name).toBe('OpenAI')
    expect(findProviderByUrl('https://api.deepseek.com')?.name).toBe('DeepSeek')
    expect(findProviderByUrl('https://api.siliconflow.cn/v1')?.name).toContain('SiliconFlow')

    expect(findProviderByUrl('http://localhost:11456/model-01/v1')).toBeUndefined()
    expect(findProviderByUrl('https://api.example.com/v1')).toBeUndefined()
    expect(findProviderByUrl('')).toBeUndefined()
  })
})
