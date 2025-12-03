/**
 * API response and request types
 */

export interface LLMModel {
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq';
}

export interface LLMModelsResponse {
  models: string[];
  modelsWithProvider?: LLMModel[];
}

export interface ApiErrorResponse {
  error: string;
  details?: string | unknown;
}

