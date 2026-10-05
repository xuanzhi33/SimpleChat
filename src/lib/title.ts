/** 送给模型的单条消息，只要 role + content */
export interface CompletionMessage {
  role: string
  content: string
}

const clip = (text: string, maxLength: number) => text.trim().slice(0, maxLength)

/**
 * 让模型给第一轮对话起标题的提示词。
 * 首条回复可能很长，截断后只作为起标题的素材。
 */
export function buildTitlePrompt(
  userMessage: string,
  assistantMessage: string,
): CompletionMessage[] {
  return [
    {
      role: 'system',
      content:
        'You write a short title for a chat conversation. Reply with the title only — no quotes, no trailing punctuation, no explanation — at most 20 characters, in the same language as the conversation.',
    },
    {
      role: 'user',
      content: `User: ${clip(userMessage, 500)}\n\nAssistant: ${clip(assistantMessage, 500)}`,
    },
  ]
}

/**
 * 清理模型返回的标题：只取第一行，去掉包裹的引号或 # 标题符，压缩空白并截断。
 * 模型经常不听话地加上引号或解释，这里兜住。
 */
export function cleanTitle(raw: string, maxLength = 30): string {
  const firstLine = raw.trim().split('\n')[0] ?? ''
  return firstLine
    .replace(/^[#\s"'“”‘’]+/, '')
    .replace(/[\s"'“”‘’]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
    .trim()
}
