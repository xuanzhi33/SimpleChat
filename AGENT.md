# SimpleChat - Agent 开发参考

纯前端 AI 对话应用 | Vue 3 + TypeScript + SSE 流式对话

## 技术栈

Vue 3.5 · TypeScript · Pinia · VueUse · Tailwind CSS 4 · Shadcn-vue · Dexie (IndexedDB) · marked · DOMPurify

## 核心架构

### SSE 流式处理

位置：`src/lib/chat-service.ts`

- 使用 Fetch API 而非 EventSource（需要发送 POST 请求体）
- 通过 ReadableStream 读取响应流，逐行解析 `data:` 开头的 SSE 事件
- 从 `delta.content` 和 `delta.reasoning_content` 提取内容

### 多模型管理

- 每个对话可独立选择模型（`Conversation.modelId`）
- 模型配置包含 `id`、`name`、`baseUrl`
- 通过 `settings.ts` 管理模型列表和默认模型

### 数据持久化

- **会话数据**：IndexedDB (Dexie) 存储 conversations
- **配置项**：localStorage (VueUse) 存储模型列表、上下文长度等
- 使用 `useStorage()` 自动同步 localStorage

### 关键字段

**⚠️ Thinking 字段名为 `reasoning_content`（不是 `thinking`）**

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
- `src/lib/` - db.ts、chat-service.ts、markdown.ts
- `src/types/chat.ts` - 类型定义

## API 接口

**请求**: `POST {baseUrl}/chat/completions` 发送 `messages` 数组和 `stream: true`

**响应**: SSE 流返回 `delta.content` 和 `delta.reasoning_content`

## 核心流程

### 初始化

App 启动时调用 `chatStore.initializeStore()` 从 IndexedDB 加载会话

### 流式对话

1. 添加用户消息
2. 创建助手占位消息（`isStreaming: true`）
3. 根据对话的 `modelId` 获取模型配置
4. ChatService 流式接收并累加 `content` 和 `reasoning_content`
5. 完成后设置 `isStreaming: false`

## localStorage 键

- `xuanzhi33-active-conversation-id` - 当前会话ID
- `xuanzhi33-models` - 模型列表
- `xuanzhi33-default-model-id` - 默认模型
- `xuanzhi33-context-length` - 上下文长度（默认10）

## 常见错误

1. **字段名错误**：使用 `reasoning_content` 而非 `thinking`
2. **未初始化**：使用 chatStore 前必须调用 `initializeStore()`
3. **手动存储**：用 `useStorage()` 而非手动操作 localStorage
