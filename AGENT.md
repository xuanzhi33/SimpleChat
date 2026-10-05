# SimpleChat - Agent 开发参考

纯前端 AI 对话应用（无后端）| Vue 3.5 · TS · Pinia · VueUse · Tailwind 4 · shadcn-vue · Dexie · markstream-vue

## 铁律

- **不要动 `src/components/ui/`**：shadcn 生成物（已从 eslint/prettier 排除），要改样式就在调用处传 `class`（`cn()` 会做 tw-merge 覆盖）。tw-merge 只能顶掉「同变体 + 同属性」的类：比如 `data-[active=true]:bg-foreground/10` 能盖掉 cva 里的 `data-[active=true]:bg-sidebar-accent`；而构建产物里默认值是排在后面的，没被顶掉就改了等于没改（例：`ConversationList` 的选中态）
- **i18n 中英必须成对**：键集合不一致不会报错，界面只会显示原始 key；`src/i18n/config.ts` 里的 `datetimeFormats` 也一样（可见钟点走 `d(ts, 'time')`，完整日期时间走 `d(ts, 'dateTime')`，别自己拼 `toLocaleString`）
- **思考内容字段**：优先 `delta.reasoning_content`，回退 `delta.reasoning`（**不是** `thinking`），内部统一存 `reasoning_content`。DeepSeek/SGLang 用前者，vLLM 新版/OpenRouter/Ollama 用后者
- **“思考结束”= 收到首个正文增量**：SSE 没有 thinking 结束事件，唯一信号是 `delta.content` 到来，所以 `ChatPanel` 用单向 latch 写成 `message.thinkingDone`（模型偶尔思考/正文交替也不回头）。思考块的标题/脉动/自动收起/`:final` 全看 `isThinking = isStreaming && !thinkingDone`，而不是整条消息的 `isStreaming`（否则正文开始后还一直显示“思考中...”）
- **CORS 无法确诊**：`fetch` 被拦 / 断网 / DNS 失败都只抛 `TypeError`，文案只能写“疑似”并建议改用 LLM Gate（`isLikelyCorsError(err)`）
- **主题是绿色**：`src/assets/main.css` 末尾还有第二段 `:root`（绿色主题），它覆盖了前面的中性色，所以 `--primary` / `--ring` 都是绿的；想让某个控件不发光得在控件上调 `class` 覆盖
- **`Textarea` 字号**：基础类是 `text-base md:text-sm`，要改字号必须带 `md:` 前缀才压得住
- **Markdown 只走 `markstream-vue`**：`<MarkdownRender mode="chat" :content :final="!message.isStreaming" :is-dark>`（思考块传 `:final="!isThinking"`），用户在消息里贴的 HTML 绝不自己 `v-html`；不要再引 marked / DOMPurify（已删）
- **它的 CSS 落在 `components` 层**：`@import 'markstream-vue/index.css' layer(components)`（官配写法，能被我们的 utility 压住）。要改它内部样式只能改 `--ms-*` 令牌（思考块就靠 `.thinking-md.markstream-vue` 把 `--ms-text-body` 调小），Tailwind 类打不进去
- **模型输出里的 HTML 由它自己净化**：`htmlPolicy` 默认 `safe`（白名单标签、剥 `on*`/`style`、校验 URL、禁 script），这就是卸掉 DOMPurify 的原因；想要的更狠就改 `escape`（HTML 当纯文本显示）
- **它的界面文案不跟语言走**：库只提供“替换文案”钩子，`src/i18n/markstream.ts` 把 i18n 的 `markstream` 段灌进 reactive map，`i18n/config.ts` 里 watch locale 刷新
- **软换行靠 CSS，不靠 `breaks`**：它不吃 `breaks`（实测 `customMarkdownIt` 里怎么设都不出 `<br>`），但软换行会原样留在 `text-node` 里，由它自带的 `white-space: pre-wrap` 渲染成换行（行尾两空格才是真 `<br>`）——所以 `reasoning_content` 的单换行不用额外处理
- **流式观感/光标**：默认 `smoothStreaming: 'auto'`（首屏一次吐出，之后按 ~3000 字/秒平滑推进，调 `smoothStreamingOptions`）；光标只在 `typewriter` 打开时有（`'simple'` 用末个文本节点的 `::after`，`true`/`'precise'` 用绝对定位 span），`final` 后自动消失；`mode="chat"` 下 `fade` 默认关

## gate / api 双模式

多发参数会污染上游（Gate 未配 Model Name 时原样透传），少发会报错；统一用 `modelRequestOptions(m)`（`src/lib/model.ts`）生成请求参数。

| `Model.kind` | 请求体 `model` | `Authorization` | 说明 |
| --- | --- | --- | --- |
| `'gate'`（缺省 / 历史数据） | ❌ | ❌ | LLM Gate 把模型编码在 URL path 里（`/{model_id}/v1`） |
| `'api'` | ✅ | 有 `apiKey` 才发 | 直连兼容 OpenAI 的厂商接口 |

## 数据模型（`src/types/chat.ts`）

```ts
interface Model { id; name; baseUrl; kind?; model?; apiKey? }
// name 只是展示名（两种模式都不参与请求），model 才是真正发出去的模型 ID（仅 api 模式）
interface Message { role: 'user' | 'assistant' | 'system'; content; reasoning_content?; reasoningDurationMs?; thinkingDone?; error?; timestamp; isStreaming? }
interface Conversation { id; title; messages; modelId?; systemPrompt?; titleIsManual?; createdAt; updatedAt }
```

## 关键流程

- **发送**：`ChatPanel.sendMessage()` → `ChatService.sendMessage()`，`POST {baseUrl}/chat/completions`，body 为 `messages` + `stream: true`；用 Fetch（不是 EventSource）读 ReadableStream 逐行解析 `data:`；非 2xx 抛 `HttpError(status, detail)`
- **错误文案**：`describeError(err, t)`（多行：原因 + 服务端原文 + 解法）、`summarizeError(err, t)`（单行，给 toast）；状态码对照表在 `i18n.errors.http.*`，未收录走 `other`
- **错误展示**：不再有顶部错误条（`error` ref 已删）。发送失败时详情写进 AI 消息的 `Message.error`，由 `MessageItem` 用 `text-destructive` 红色就地显示（有半截正文时接在正文下面），toast 只留一行摘要；同时自动 `startEdit(用户消息)`进入编辑模式，用户全选后回车即重发。无可用模型这种“发之前”的校验只弹 toast，不占 AI 位置
- **`complete(messages)`**：非流式补全，返回文本；`testConnection()`（要求回复 "OK"）和自动标题都走它
- **快捷键**：Ctrl/Cmd+J 新建对话。判定与展示标签在 `src/lib/shortcuts.ts`，监听放在 `HomeView`（`useEventListener(window, 'keydown')`，`createConversation` 后 ChatPanel 的 watch 会自己聚焦输入框）。改键位只改那一个文件；注意 Ctrl+J 是 Chrome/Firefox 自带的「下载」快捷键，浏览器可能抢在前头
- **自动标题**：`addMessage` 先用首条用户消息前 30 字当标题；第一轮问答结束（`messages.length === 2`）后 `maybeGenerateTitle()` 再让模型起一个，提示词与清洗在 `src/lib/title.ts`。`titleIsManual` 一旦手动改过就不再覆盖，失败只 `console.error`
- **编辑重发**：`MessageItem` 只 `emit('edit', id)`；`ChatPanel.editingMessageId` 非空时在该消息上方插分割线，发送时先 `truncateFrom(id)`（删掉这条**及其之后**全部消息）再 `addMessage`，之后走普通发送流程（上下文裁剪、自动标题都会照常触发）
- **时间戳**：一律走 vue-i18n 的 `d(ts, 'time' | 'dateTime' | 'dateTimeWithYear' | 'date')`，别自己拼 `toLocaleString`；`datetimeFormats` 的 key 必须 zh/en 成对。消息 footer 只分三档（`src/lib/time.ts` 的 `dayBucket`）：今天给钟点、昨天加「昨天」、更早一律带年份；**不挂定时器**（跨午夜靠下一次重渲染），悬停 tooltip 始终给完整日期时间。判定天差用 `dayDiff`（按本地日历天，别拿时间差除 86400000，“昨天 23:00”会被算成今天）
- **持久化**：会话在 IndexedDB（Dexie），配置在 localStorage 且一律用 `useStorage()`（不要手写 localStorage）；启动时 `chatStore.initializeStore()`

## 本地检查

一轮验证就跑 **`pnpm verify`**（`run-p` 并行 type-check / lint:check / format:check / test:unit:run，约 12~14s）。
**只有要看产物、CSS 体积或分包才 `pnpm build`**（并行版约 20s；`vue-tsc --build && vite build` 串行要 26s；逐个直连 `node_modules/.bin/*` 最慢，约 37s）。

- `vue-tsc --build` 每次都是全量（`@vue/tsconfig` 的 `noEmit` 让 `--build` 永远认为“输出文件不存在”，`tsbuildinfo` 白写），约 11s，别指望增量
- `lint` / `format` **会改文件**（`--fix` / `--write`），验证用只读的 `lint:check` / `format:check`
- `src/lib/__tests__/*` 是纯逻辑，文件头 `// @vitest-environment node` 免掉 jsdom 启动开销；用到 pinia/localStorage 的 `src/stores/__tests__/*` 必须留 jsdom。没有 `vitest.setup.ts`，每个 spec 自己 stub（如 reka 要的 `ResizeObserver`）

## 目录

- `src/components/chat/` - ChatPanel（发送 / 编辑 / 流式）、MessageItem、ConversationList、TitleBar、SystemPromptBlock
- `src/components/settings/` - SetupDialog（欢迎弹窗：DeepSeek 官方 / API / Gate）、ModelManagement
- `src/stores/` - chat.ts、settings.ts
- `src/lib/` - chat-service.ts（SSE）、model.ts（kind 判定）、errors.ts、title.ts、db.ts、utils.ts
- `src/i18n/` - config.ts（创建实例 + 同步 markstream 文案）、markstream.ts、zh/en.json

## localStorage 键（前缀 `xuanzhi33-`）

`active-conversation-id` · `models` · `default-model-id` · `context-length`（默认 10）· `language` · `color-mode`
