/**
 * Chat-related types for frontend
 * These should mirror backend types where applicable
 */

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface Chat {
  id: string;
  name: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string; // ISO string from API
  model?: string;
  provider?: string;
}

export interface CreateChatRequest {
  name?: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface SendMessageMutationParams {
  chatId: string;
  message: string;
}

export interface SendMessageResponse {
  message: string;
  chat: Chat;
}

export interface UpdateChatRequest {
  name?: string;
  model?: string;
  provider?: string;
}

