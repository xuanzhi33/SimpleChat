# SimpleChat - Agent 开发参考

纯前端 AI 对话应用 | Vue 3 + TypeScript + SSE 流式对话

## 技术栈

Vue 3.5 · TypeScript · Pinia · VueUse · Tailwind CSS 4 · Shadcn-vue · Dexie (IndexedDB) · marked · DOMPurify

## 核心架构

### SSE 流式处理

位置：`src/lib/chat-service.ts`

- 使用 Fetch API 而非 EventSource（需要发送 POST 请求体）
- 通过 ReadableStream 读取响应流，逐行解析 `data:` 开头的 SSE 事件
- 从 `delta.content` 和 `delta.reasoning_content`（回退 `delta.reasoning`）提取内容
- `ChatService(baseUrl, { model?, apiKey? })`：**仅 api 模式**才在请求体带 `model`、在请求头带 `Authorization: Bearer`
- 导出 `isLikelyCorsError(err)`：`fetch` 被浏览器拦截 / 断网 / DNS 失败都只会抛 `TypeError`，**无法互相区分**，所以文案必须写“疑似”并建议改用 LLM Gate

### 多模型管理

- 每个对话可独立选择模型（`Conversation.modelId`）
- 模型配置包含 `id`、`name`、`baseUrl`、`kind`、`model`、`apiKey`
- 通过 `settings.ts` 管理模型列表和默认模型
- 兼容两种后端，由 `kind` 区分：

| `kind` | 请求体 `model` | `Authorization` | 说明 |
| --- | --- | --- | --- |
| `'gate'`（含缺省/历史数据） | ❌ 不发 | ❌ 不发 | LLM Gate 将模型编码在 URL path 里（`/{model_id}/v1`） |
| `'api'` | ✅ 发 `model` | 有 `apiKey` 才发 | 直连兼容 OpenAI 的厂商接口 |

`name` 在两种模式下都只是展示名；发往厂商的模型 ID 是独立的 `model` 字段。
辅助函数在 `src/lib/model.ts`：`modelKind(m)`（`m.kind ?? 'gate'`）、`isApiModel(m)`、`modelRequestOptions(m)`。

### 数据持久化

- **会话数据**：IndexedDB (Dexie) 存储 conversations
- **配置项**：localStorage (VueUse) 存储模型列表、上下文长度等
- 使用 `useStorage()` 自动同步 localStorage

### 关键字段

**⚠️ Thinking 字段优先读 `reasoning_content`，回退到 `reasoning`（不是 `thinking`）**

不同网关字段名不一致：DeepSeek/SGLang/多数国内网关用 `reasoning_content`，vLLM 新版、OpenRouter、Ollama 的 OpenAI 兼容端点用 `reasoning`。解析时两者都读，内部统一存为 `reasoning_content`。

```typescript
interface Model {
  id: string
  name: string // 展示名，不参与请求
  baseUrl: string
  kind?: 'api' | 'gate' // 缺省视为 'gate'
  model?: string // 仅 api 模式：请求体中的 model
  apiKey?: string // 仅 api 模式：Bearer token，可为空
}
```

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string // 推理内容
  isStreaming?: boolean
}
```

## 核心目录

- `src/components/chat/` - ChatPanel、MessageItem、ConversationList
- `src/stores/` - chat.ts (IndexedDB)、settings.ts (模型管理)
- `src/lib/` - db.ts、chat-service.ts、model.ts、markdown.ts
- `src/types/chat.ts` - 类型定义

## API 接口

**请求**: `POST {baseUrl}/chat/completions`，发送 `messages` 数组和 `stream: true`；api 模式额外带 `model` 与 `Authorization: Bearer <key>`

**响应**: SSE 流返回 `delta.content` 和思考内容（`delta.reasoning_content` 或 `delta.reasoning`）

**测试连接**: `ChatService.testConnection()` 发一个非流式请求，要求模型只回复 "OK"（原来的 `GET /models` 已废弃，并非所有厂商都提供该端点）

## 核心流程

### 初始化

App 启动时调用 `chatStore.initializeStore()` 从 IndexedDB 加载会话

### 流式对话

1. 添加用户消息
2. 创建助手占位消息（`isStreaming: true`）
3. 根据对话的 `modelId` 获取模型配置
4. ChatService 流式接收并累加 `content` 和思考内容（`reasoning_content` / `reasoning`）
5. 完成后设置 `isStreaming: false`

## localStorage 键

- `xuanzhi33-active-conversation-id` - 当前会话ID
- `xuanzhi33-models` - 模型列表（含 `kind` / `model` / `apiKey`，同一份数组，无单独存储键）
- `xuanzhi33-default-model-id` - 默认模型
- `xuanzhi33-context-length` - 上下文长度（默认10）

## 常见错误

1. **字段名错误**：思考内容读 `reasoning_content`，并回退 `reasoning`；不要用 `thinking`
2. **未初始化**：使用 chatStore 前必须调用 `initializeStore()`
3. **手动存储**：用 `useStorage()` 而非手动操作 localStorage
4. **gate/api 混淆**：gate 模式发 `model` 会污染上游（Gate 未配 Model Name 时原样透传），api 模式漏发 `model` 会直接报错；统一用 `modelRequestOptions()` 生成参数
5. **CORS 误判**：`TypeError` 只能说明“请求没发出去”，不是 CORS 的确诊；文案不要写死
