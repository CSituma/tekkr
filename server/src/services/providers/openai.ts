import { BaseMessage, LLMAdapter, OpenAIAPIResponse } from '../../types';

export class OpenAIAdapter implements LLMAdapter {
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.defaultModel = 'gpt-5-nano';
  }

  async sendMessage(messages: BaseMessage[], model?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const modelName = model || this.defaultModel;
    const url = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as OpenAIAPIResponse;
    return data.choices?.[0]?.message?.content || 'No response from LLM';
  }

  getAvailableModels(): string[] {
    return [
      'gpt-5-mini',
      'gpt-4o-mini',
      'gpt-4o',
      // Latest OpenAI model (fast & efficient)
    ];
  }
}

