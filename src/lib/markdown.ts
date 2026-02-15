import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 配置 marked
marked.setOptions({
  breaks: true, // 支持 GFM 换行
  gfm: true, // 启用 GitHub Flavored Markdown
})

/**
 * 将 Markdown 文本渲染为 HTML（已净化）
 */
export function renderMarkdown(content: string): string {
  if (!content) return ''

  try {
    const html = marked.parse(content) as string
    return DOMPurify.sanitize(html)
  } catch (error) {
    console.error('Markdown parse error:', error)
    return DOMPurify.sanitize(content)
  }
}
