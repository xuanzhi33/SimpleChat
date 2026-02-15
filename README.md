<div align="center">

# SimpleChat

**English** | [中文](./README-CN.md)

### ✨ [Live Demo](https://gh.xuanzhi33.cn/SimpleChat/)

</div>

A lightweight, pure frontend LLM chat web application built with Vue 3.

## Overview

SimpleChat is a minimalist chat interface for interacting with Large Language Models (LLMs). As a pure frontend application, it runs entirely in your browser with no backend server required.

## Prerequisites

**Important:** This application requires [LLM Gate](https://github.com/xuanzhi33/LLM-Gate) to be installed and running on your local machine.

LLM Gate acts as a local API gateway that provides the chat completion endpoints needed by SimpleChat.

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

1. Ensure [LLM Gate](https://github.com/xuanzhi33/LLM-Gate) is installed and running
2. Open SimpleChat in your browser
3. Configure the LLM Gate endpoint in settings if needed
4. Start chatting!

## Development

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Lint and fix code
- `pnpm test:unit` - Run unit tests

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Pinia (State Management)
- Dexie (IndexedDB wrapper)
- Vue Router
