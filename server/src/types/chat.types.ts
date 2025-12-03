/**
 * Chat-related types
 */

import { MessageRole } from './common.types';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface Chat {
  id: string;
  name: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  model?: string;
  provider?: string;
}

export interface CreateChatRequest {
  name?: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface UpdateChatRequest {
  name?: string;
  model?: string;
  provider?: string;
}

export interface ChatResponse {
  message?: string;
  chat?: Chat;
}

