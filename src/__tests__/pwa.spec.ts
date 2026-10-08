import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/theme-color'

// 安装成应用（添加到主屏幕 / 桌面）靠的是 public/manifest.webmanifest 里的图标，
// 跟 favicon 无关；这里守着「字段齐全 + 图标文件真存在」，写错了浏览器只会静默不给装。
// 测试里的 import.meta.url 被 Vite 换成非 file: 的地址，所以只能靠 cwd（vitest 的 root = 仓库根）。
const root = `${process.cwd()}/`
const publicDir = `${root}public/`

interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

interface Manifest {
  name?: string
  short_name?: string
  start_url?: string
  display?: string
  theme_color?: string
  background_color?: string
  prefer_related_applications?: boolean
  icons: ManifestIcon[]
}

const manifest = JSON.parse(readFileSync(`${publicDir}manifest.webmanifest`, 'utf8')) as Manifest
const html = readFileSync(`${root}index.html`, 'utf8')

describe('PWA 安装信息', () => {
  it('index.html 引了 manifest、apple-touch-icon', () => {
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('rel="apple-touch-icon"')
  })

  it('满足 Chromium 的安装门槛：name / start_url / display / 192+512 图标', () => {
    expect(manifest.name ?? manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBeTruthy()
    // 必须为 false 或干脆不写
    expect(manifest.prefer_related_applications ?? false).toBe(false)

    const sizes = manifest.icons.flatMap((icon) => icon.sizes.split(' '))
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('图标文件都在 public/ 下，且有一条 maskable（Android 自适应图标）', () => {
    const missing = manifest.icons.filter((icon) => !existsSync(publicDir + icon.src))
    expect(missing).toEqual([])
    expect(manifest.icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true)
    expect(existsSync(`${publicDir}apple-touch-icon.png`)).toBe(true)
  })

  it('主题色三处一致：深浅都取边栏背景色（HTML 里给没跑 JS 时用，manifest 固定浅色）', () => {
    expect(manifest.theme_color).toBe(THEME_COLOR_LIGHT)
    expect(manifest.background_color).toBe(THEME_COLOR_LIGHT)
    expect(html).toContain(
      `<meta name="theme-color" content="${THEME_COLOR_LIGHT}" media="(prefers-color-scheme: light)" />`,
    )
    expect(html).toContain(
      `<meta name="theme-color" content="${THEME_COLOR_DARK}" media="(prefers-color-scheme: dark)" />`,
    )
  })
})
