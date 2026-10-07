# SimpleChat - Agent 开发参考

纯前端 AI 对话应用（无后端）| Vue 3.5 · TS · Pinia · VueUse · Tailwind 4 · shadcn-vue · Dexie · markstream-vue

> 本文件只记「从代码和代码注释里读不出来」的约定、坑和已定的取舍（含原因）。
> 实现细节、数据模型、目录结构、步骤流程一律留在代码和注释里 —— 别往这里搬，会腐烂。

## 铁律

- **不要动 `src/components/ui/`**（shadcn 生成物，已从 eslint/prettier 排除）：改样式只能在调用处传 `class`，靠 `cn()` 的 tw-merge 顶掉 cva 默认值（只对「同变体 + 同属性」生效）；这类组件的基础类常带 `md:` 前缀，覆盖字号时要一起带
- **i18n 中英必须成对**：键不一致不报错，界面只会显示原始 key；日期时间一律走 `d(...)`，别自己拼 `toLocaleString`
- **不加依赖**：能自己写的（时间戳分档、快捷键、滚动）不引库；渲染只走 markstream-vue（它的可选 peer `stream-diffs` / `mermaid` / `katex` 是富代码块 / 图表 / 公式的必需品，别当冗余依赖删掉）
- **CORS 无法确诊**：fetch 被拦 / 断网 / DNS 失败都只是 `TypeError`，文案只能写“疑似”并建议改用 LLM Gate
- **思考内容的字段名不统一**：优先 `reasoning_content`，回退 `reasoning`（**不是** `thinking`）—— DeepSeek/SGLang 用前者，vLLM 新版 / OpenRouter / Ollama 用后者
- **主题是绿色的**：`src/assets/main.css` 末尾还有第二段 `:root`，它覆盖了前面的中性色，改配色要改那一段

## markstream-vue（只用它，但坑不少）

- 用户贴的 HTML 交给它净化（`htmlPolicy: 'safe'` 是默认值），不要再引 marked / DOMPurify
- **它的界面文案不跟语言走**：库只给“替换文案”的钩子 → 由 `src/i18n/markstream.ts` 灌进 i18n 的 `markstream` 段，改文案时 zh/en 都要动
- **软换行不吃 `breaks`**（实测怎么设都不出 `<br>`）：靠它自带的 `white-space: pre-wrap` 显示，行尾两个空格才是真换行 —— 所以思考里的单换行不用额外处理
- **富代码块必须有 `stream-diffs`**：没有它，流式期间有工具栏，块一落定就按设计降级成「只有复制按钮」的 `<pre>`（库拿不到 code-block runtime 就不切回来了）—— 这就是它为什么算硬需求
- **HTML 预览的脚本执行**：靠 `MessageItem` 给 `MarkdownRender` 传 `codeBlockProps: { htmlPreviewAllowScripts: true }`（→ `sandbox="allow-scripts"`；默认 `sandbox=""` 不跑脚本）；**绝不能加 `allow-same-origin`** —— srcdoc 继承同源，预览脚本就能读到 localStorage 里的 apiKey。预览 iframe + sandbox 实现都在 markstream 的 `CodeBlockNode`，`stream-diffs` 只决定“落定后的富块在不在”，所以它同时是预览入口的前提
- `mermaid` / `katex` 装了就默认启用（默认 loader 就是 `() => import('mermaid')`），不用调 `enableMermaid()` / `enableKatex()`；但 **katex 的样式库不自带**，得自己 `@import 'katex/dist/katex.min.css'`（已在 `main.css` 的 components 层）
- 流式观感：默认 `smoothStreaming: 'auto'`（首屏一次吐出，之后平滑推进，可用 `smoothStreamingOptions` 调）；光标只在 `typewriter` 下存在，我们选了 `fade` + 不要光标

## gate / api 双模式

Gate 未配 Model Name 时会把请求体原样透传：多发参数污染上游、少发会报错 —— 统一用 `modelRequestOptions(m)` 生成，别让两种模式各写一份。

## 本地检查

一轮验证跑 **`pnpm verify`**（并行，约 15s）；**只有要看产物 / CSS 体积 / 分包才 `pnpm build`**。
`lint` / `format` 会改文件，验证用只读的 `lint:check` / `format:check`。`vue-tsc --build` 每次全量（`noEmit` 让 tsbuildinfo 白写），别指望增量。
没有 `vitest.setup.ts`，每个 spec 自己 stub；纯逻辑的 spec 加 `// @vitest-environment node` 省掉 jsdom 启动开销。

## 测试环境的坑

- jsdom 里 locale 是 **en**（没有 zh ICU 数据）：文案断言一律对比 `i18n.global.t/d(...)`，别写死中英文
- jsdom 没有布局：`getBoundingClientRect` 全 0（要打桩）、没有 `ResizeObserver`（要 stub）、`wrapper.text()` 会 trim
- 别断言依赖时区的字面量；也别给流式节流写断言（没有 `requestIdleCallback`）

## 开发机环境

- 没有浏览器 → 只能靠 `pnpm verify`、构建产物 grep、jsdom 探针验证
- **Node 没有 zh 的 ICU 数据**：`supportedLocalesOf(['zh'])` 为空，`Intl` 的 zh 一律回退成英文，所以中文时间格式只能按 CLDR 推断，别说“本地验证过了”
