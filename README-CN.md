<div align="center">

# SimpleChat

[English](./README.md) | **中文**

### ✨ [在线体验](https://gh.xuanzhi33.cn/SimpleChat/)

</div>

一个轻量级、纯前端的大语言模型（LLM）聊天网页应用，基于 Vue 3 构建。

## 概述

SimpleChat 是一个简洁的聊天界面，用于与大语言模型进行交互。作为一个纯前端应用，它完全在浏览器中运行，不需要后端服务器。

## 前置要求

**重要提示：** 本应用需要在本地计算机上安装并运行 [LLM Gate](https://github.com/xuanzhi33/LLM-Gate)。

LLM Gate 作为本地 API 网关，为 SimpleChat 提供聊天完成接口。

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

1. 确保 [LLM Gate](https://github.com/xuanzhi33/LLM-Gate) 已安装并运行
2. 在浏览器中打开 SimpleChat
3. 如需要，在设置中配置 LLM Gate 端点
4. 开始聊天！

## 开发

- `pnpm dev` - 启动开发服务器
- `pnpm build` - 构建生产版本
- `pnpm preview` - 预览生产版本
- `pnpm lint` - 代码检查和修复
- `pnpm test:unit` - 运行单元测试

## 技术栈

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Pinia（状态管理）
- Dexie（IndexedDB 封装）
- Vue Router
