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

  async streamMessage(
    messages: BaseMessage[],
    model: string | undefined,
    onToken: (token: string) => void
  ): Promise<string> {
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
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenAI API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onToken(delta);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    return fullText;
  }

  getAvailableModels(): string[] {
    return [
      'gpt-5-mini',
      'gpt-4o-mini',
      'gpt-4o',
    ];
  }
}

