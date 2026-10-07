<div align="center">

# SimpleChat

**English** | [中文](./README-CN.md)

### ✨ [Live Demo](https://chat.xuanzhi33.cn)

</div>

A lightweight, pure frontend LLM chat web application built with Vue 3.

## Overview

SimpleChat is a minimalist chat interface for interacting with Large Language Models (LLMs). As a pure frontend application, it runs entirely in your browser with no backend server required.

## Prerequisites

SimpleChat talks to an OpenAI-compatible `/chat/completions` endpoint. Two modes are supported:

- **API Mode (default)** — connect directly to any provider that allows browser cross-origin (CORS) requests, such as DeepSeek, Moonshot, or a local Ollama / LM Studio instance. You provide the Base URL, the Model ID and (optionally) an API Key.
- **LLM Gate Mode** — run [LLM Gate](https://github.com/xuanzhi33/LLM-Gate) locally as a gateway. Recommended when the provider blocks browser requests (CORS), or when you do not want to paste your API key into a web page.

> ⚠️ **Security note:** in API Mode your API key is stored in the browser's `localStorage` in plaintext and is sent directly from the browser to the endpoint you configure. Avoid API Mode on shared or untrusted machines.

## Features

- 💬 Clean and intuitive chat interface
- 🌐 Pure frontend - runs entirely in the browser
- 💾 Local conversation storage using IndexedDB
- 🌍 Multi-language support (English/Chinese)
- 🎨 Modern UI with Tailwind CSS
- ⚡ Real-time streaming responses
- 🔄 Conversation management

## Installation

1. Clone the repository:

```bash
git clone https://github.com/xuanzhi33/SimpleChat.git
cd SimpleChat
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

## Usage

1. Open SimpleChat in your browser
2. Choose a mode in the welcome dialog:
   - **API Mode**: enter the Base URL (e.g. `https://api.deepseek.com/v1`), the Model ID (e.g. `deepseek-chat`) and your API Key
   - **LLM Gate Mode**: install and start [LLM Gate](https://github.com/xuanzhi33/LLM-Gate), add a model, then paste the generated URL (e.g. `http://localhost:11456/model-01/v1`)
3. Use **Test** in the model editor to verify the connection (it asks the model to reply "OK")
4. Start chatting!

The two modes can be mixed: every model keeps its own mode, Base URL, Model ID and API Key.

If a request fails with a network error, the endpoint is probably blocking browser requests (CORS). Use LLM Gate Mode to route around it.

## Development

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Lint and fix code
- `pnpm test:unit` - Run unit tests (watch mode)
- `pnpm test:unit:run` - Run unit tests once

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Pinia (State Management)
- Dexie (IndexedDB wrapper)
- Vue Router
