/**
 * LLM-related types
 */

import { BaseMessage } from './common.types';

export interface LLMAdapter {
  sendMessage(messages: BaseMessage[], model?: string): Promise<string>;
  streamMessage(
    messages: BaseMessage[], 
    model: string | undefined,
    onToken: (token: string) => void
  ): Promise<string>; // Returns the final complete text
  getAvailableModels(): string[];
}

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'groq';

export interface LLMModelsResponse {
  models: string[];
  provider: LLMProvider;
}

// API Response Types
export interface GeminiAPIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export interface OpenAIAPIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface AnthropicAPIResponse {
  content?: Array<{
    text?: string;
  }>;
}

