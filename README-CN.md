<div align="center">

# SimpleChat

[English](./README.md) | **中文**

### ✨ [在线体验](https://gh.xuanzhi33.cn/SimpleChat/)

</div>

一个轻量级、纯前端的大语言模型（LLM）聊天网页应用，基于 Vue 3 构建。

## 概述

SimpleChat 是一个简洁的聊天界面，用于与大语言模型进行交互。作为一个纯前端应用，它完全在浏览器中运行，不需要后端服务器。

## 前置要求

SimpleChat 对接的是兼容 OpenAI 的 `/chat/completions` 接口，支持两种模式：

- **API 模式（默认）**——直连任何允许浏览器跨域(CORS)访问的厂商接口，例如 DeepSeek、Moonshot，或本地的 Ollama / LM Studio。需要填写 Base URL、模型 ID，以及可选的 API Key。
- **LLM Gate 模式**——在本地运行 [LLM Gate](https://github.com/xuanzhi33/LLM-Gate) 作为网关。当厂商屏蔽浏览器请求（CORS）时，或不想把 API Key 粘贴到网页里时，推荐使用这种模式。

> ⚠️ **安全提示：** API 模式下您的 API Key 会以明文保存在浏览器的 `localStorage` 中，并由浏览器直接发送到您填写的接口。请勿在共享或不可信的设备上使用 API 模式。

## 特性

- 💬 简洁直观的聊天界面
- 🌐 纯前端 - 完全在浏览器中运行
- 💾 使用 IndexedDB 本地存储对话
- 🌍 多语言支持（英文/中文）
- 🎨 基于 Tailwind CSS 的现代化 UI
- ⚡ 实时流式响应
- 🔄 对话管理

## 安装

1. 克隆仓库：

```bash
git clone https://github.com/xuanzhi33/SimpleChat.git
cd SimpleChat
```

2. 安装依赖：

```bash
pnpm install
```

3. 启动开发服务器：

```bash
pnpm dev
```

## 使用方法

1. 在浏览器中打开 SimpleChat
2. 在欢迎弹窗中选择一种模式：
   - **API 模式**：填写 Base URL（如 `https://api.deepseek.com/v1`）、模型 ID（如 `deepseek-chat`）和 API Key
   - **LLM Gate 模式**：安装并启动 [LLM Gate](https://github.com/xuanzhi33/LLM-Gate)，添加模型，然后粘贴生成的 URL（如 `http://localhost:11456/model-01/v1`）
3. 在模型编辑里点「测试」验证连通性（会让模型只回复 "OK"）
4. 开始聊天！

两种模式可以混用：每个模型各自保存自己的模式、Base URL、模型 ID 和 API Key。

如果请求因网络错误失败，通常是接口不允许浏览器跨域(CORS)访问，改用 LLM Gate 模式即可绕过。

## 开发

- `pnpm dev` - 启动开发服务器
- `pnpm build` - 构建生产版本
- `pnpm preview` - 预览生产版本
- `pnpm lint` - 代码检查和修复
- `pnpm test:unit` - 运行单元测试（watch 模式）
- `pnpm test:unit:run` - 运行单元测试（执行一次）

## 技术栈

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Pinia（状态管理）
- Dexie（IndexedDB 封装）
- Vue Router
