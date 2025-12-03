import { BaseMessage, LLMAdapter, LLMProvider } from '../types';
import { GeminiAdapter } from './providers/gemini';
import { OpenAIAdapter } from './providers/openai';
import { GroqAdapter } from './providers/groq';

export type { LLMProvider };

export class LLMService {
  private adapter: LLMAdapter;
  private provider: LLMProvider;

  constructor(provider: LLMProvider = 'gemini') {
    this.provider = provider;
    this.adapter = this.createAdapter(this.provider);
  }

  private createAdapter(provider: LLMProvider): LLMAdapter {
    switch (provider) {
      case 'gemini':
        return new GeminiAdapter();
      case 'openai':
        return new OpenAIAdapter();
      case 'groq':
        return new GroqAdapter();
      default:
        return new GeminiAdapter();
    }
  }

  async sendMessage(messages: BaseMessage[], model?: string): Promise<string> {
    return this.adapter.sendMessage(messages, model);
  }

  async streamMessage(
    messages: BaseMessage[],
    model: string | undefined,
    onToken: (token: string) => void
  ): Promise<string> {
    return this.adapter.streamMessage(messages, model, onToken);
  }

  getAvailableModels(): string[] {
    return this.adapter.getAvailableModels();
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  setProvider(provider: LLMProvider): void {
    this.provider = provider;
    this.adapter = this.createAdapter(provider);
  }
}

