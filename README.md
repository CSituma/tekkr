# Tekkr Full Stack Hiring Solution

A full-stack chat application with LLM integration and inline project plan previews.

## Overview

This solution implements a multi-chat LLM-based application with support for Gemini, OpenAI, and Groq providers. Users can create multiple chats, switch between them, and receive structured project plans with interactive previews.

## Features

### Core Functionality
- **LLM-based Chat**: Integrated with Gemini, OpenAI, and Groq providers
- **Multi-Chat Support**: Create and switch between multiple conversations
- **Persistent Chat History**: Chats and selected chat state persist across page reloads
- **Loading Indicators**: Per-chat loading states for better UX
- **Error Handling**: Graceful error handling with user-friendly toast notifications
- **Real-time Streaming**: Server-Sent Events (SSE) for live token streaming with adaptive throttling

### Streaming Features
- **Real-time Response Streaming**: Messages appear token-by-token as the LLM generates them
- **Adaptive Rate Detection**: Automatically detects fast streams (>10 tokens/sec) and applies throttling
- **Smooth UX**: Fast streams (Groq/Llama) are batched to prevent UI flickering, slow streams remain responsive
- **Per-Chat Independence**: Each chat maintains its own streaming state, preventing cross-chat interference
- **Error Recovery**: Automatic fallback to non-streaming mode if SSE fails
- **Scroll Optimization**: Throttled scroll updates prevent janky scrolling during fast streams

### Project Plan Preview
- **Inline Plan Rendering**: Project plans appear inline within chat messages
- **Expandable Workstreams**: Collapsible sections for workstreams and deliverables
- **Flexible Positioning**: Plans can appear anywhere in a message (beginning, middle, or end)
- **Smart Detection**: Automatically detects and converts plan-like responses to structured previews
- **Generate Plan CTA Button**: Assistant messages offering to create plans include a "Generate project plan" button
- **Context-Aware Generation**: Button extracts the original user goal from conversation history for accurate plan generation

### Model Selection
- **Visual Model Selector**: Dropdown to switch between different LLM models
- **Supported Models**:
  - Gemini: 2.5 Pro, 2.5 Flash (default: 2.5 Flash)
  - OpenAI: GPT-4o-mini
  - Groq: Llama models (llama-3.3-70b-versatile, etc.)

## Tech Stack

### Frontend
- **React** with TypeScript
- **React Query** for data fetching and state management
- **shadcn/ui** components for UI
- **React Router** for navigation
- **Tailwind CSS** for styling

### Backend
- **Fastify** with TypeScript
- **In-memory storage** for chats (with soft limits to prevent memory issues)
- **LLM Adapter Pattern** for easy provider swapping
- **Server-Sent Events (SSE)** for real-time streaming
- **CORS** enabled for frontend communication

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- API keys for at least one LLM provider:
  - `GEMINI_API_KEY` for Gemini
  - `OPENAI_API_KEY` for OpenAI
  - `GROQ_API_KEY` for Groq

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   cd server && npm install
   cd ../web && npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the `server` directory:
   ```env
   GEMINI_API_KEY=your_gemini_key
   OPENAI_API_KEY=your_openai_key
   GROQ_API_KEY=your_groq_key
   ```

4. Start the backend:
   ```bash
   cd server && npm start
   ```
   Backend runs on `http://localhost:8000`

5. Start the frontend:
   ```bash
   cd web && npm start
   ```
   Frontend runs on `http://localhost:3000`

## Architecture

### LLM Provider Abstraction
The solution uses an adapter pattern that makes it easy to swap LLM providers:
- Each provider implements the `LLMAdapter` interface
- Providers are located in `server/src/services/providers/`
- To add a new provider, implement the interface and register it in `LLMService`

### Project Plan Detection
- **User Intent Detection**: Identifies explicit plan requests and conversational offers
- **Response Parsing**: Converts LLM responses to structured JSON when plan-like content is detected
- **Inline Rendering**: Uses React components to render plans within message content

### State Management
- **Frontend**: React Query for server state, localStorage for selected chat persistence
- **Backend**: In-memory Map-based storage with soft limits (50 chats/user, 200 messages/chat)

## Project Structure

```
├── server/
│   ├── src/
│   │   ├── routes/chat/        # Chat API endpoints
│   │   ├── services/
│   │   │   ├── providers/      # LLM provider adapters
│   │   │   ├── chat-storage.ts # In-memory chat storage
│   │   │   └── llm-service.ts  # LLM service abstraction
│   │   └── types/              # TypeScript type definitions
│   └── package.json
├── web/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── data/               # React Query hooks
│   │   └── types/              # TypeScript type definitions
│   └── package.json
└── README.md
```

## Key Implementation Details

### Streaming Architecture
- **SSE Endpoint**: `POST /chat/:chatId/message/stream` for real-time token delivery
- **Adaptive Throttling**: Measures token arrival rate and switches to batched updates for fast streams (>10 tokens/sec)
- **Provider-Specific Handling**: Gemini uses simulated streaming (chunked non-streaming response), OpenAI and Groq use native streaming
- **State Management**: `useStreamMessage` hook manages streaming state with per-chat isolation

### Plan Generation
- **Intent Detection**: Detects explicit plan requests and conversational offers from assistant
- **Generate Plan Button**: Appears on assistant messages that offer to create plans, with pattern matching for various phrasings
- **Context Extraction**: Finds the immediately preceding user message (excluding plan requests) to use as plan context
- **Two-Tier System**: Explicit requests auto-generate plans, implicit goals show a CTA button

### Performance Optimizations
- **Per-Chat Loading States**: Each chat maintains independent loading indicators
- **Memory Management**: Soft limits (50 chats/user, 200 messages/chat) prevent unbounded memory growth
- **Scroll Throttling**: Scroll updates throttled to 100ms intervals during streaming
- **Chat Independence**: Streaming state is isolated per chat to prevent cross-chat interference

## License

This project was created as part of the Tekkr Full Stack Hiring Challenge.
