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

### Project Plan Preview
- **Inline Plan Rendering**: Project plans appear inline within chat messages
- **Expandable Workstreams**: Collapsible sections for workstreams and deliverables
- **Flexible Positioning**: Plans can appear anywhere in a message (beginning, middle, or end)
- **Smart Detection**: Automatically detects and converts plan-like responses to structured previews

### Model Selection
- **Visual Model Selector**: Dropdown to switch between different LLM models
- **Supported Models**:
  - Gemini: 2.5 Pro, 2.5 Flash
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

- **Per-Chat Loading States**: Each chat maintains independent loading indicators
- **Plan Generation CTA**: Assistant messages can include a "Generate project plan" button
- **Context-Aware Planning**: System extracts original user goals when generating plans
- **Memory Management**: Soft limits prevent unbounded memory growth during development

## License

This project was created as part of the Tekkr Full Stack Hiring Challenge.
