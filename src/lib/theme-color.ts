/**
 * 浏览器/系统界面（地址栏、已安装应用的标题栏、启动闪屏）的着色。
 *
 * 取 main.css 里 --sidebar 的值——边栏是贴住窗口边缘的那层，比聊天区更像"边框"：
 * 浅色 oklch(0.985 0 0) = #fafafa，深色 oklch(0.205 0 0) = #171717。
 *
 * manifest 里的 theme_color / background_color 是静态的、运行时改不了，所以只放浅色那份（启动闪屏按浅色走），
 * 地址栏/标题栏的真机颜色由这里接管。改颜色记得同步 public/manifest.webmanifest 和 index.html
 * （src/__tests__/pwa.spec.ts 里有断言守着三处一致）。
 */
export const THEME_COLOR_LIGHT = '#fafafa'
export const THEME_COLOR_DARK = '#171717'

/** 把 index.html 里的 <meta name="theme-color"> 改成当前主题对应的边栏色 */
export const applyThemeColor = (isDark: boolean) => {
  const color = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', color)
  }
}
