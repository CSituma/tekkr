/**
 * Common types used across the backend application
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface BaseMessage {
  role: MessageRole;
  content: string;
}

