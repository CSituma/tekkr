import { BaseMessage, LLMAdapter, OpenAIAPIResponse } from '../../types';

export class GroqAdapter implements LLMAdapter {
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.defaultModel = 'llama-3.3-70b-versatile';
  }

  async sendMessage(messages: BaseMessage[], model?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }

    const modelName = model || this.defaultModel;
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    let formattedMessages = conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    if (systemMessages.length > 0 && formattedMessages.length > 0 && formattedMessages[0].role === 'user') {
      const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
      formattedMessages[0].content = `${systemPrompt}\n\n${formattedMessages[0].content}`;
    }

    const isProjectPlanRequest = systemMessages.length > 0 && 
      systemMessages.some(m => m.content.includes('JSON') || m.content.includes('json'));
    
    const requestBody: any = {
      model: modelName,
      messages: formattedMessages,
      temperature: isProjectPlanRequest ? 0.1 : 0.7,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${error}`);
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
      throw new Error('GROQ_API_KEY is not set');
    }

    const modelName = model || this.defaultModel;
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    let formattedMessages = conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    if (systemMessages.length > 0 && formattedMessages.length > 0 && formattedMessages[0].role === 'user') {
      const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
      formattedMessages[0].content = `${systemPrompt}\n\n${formattedMessages[0].content}`;
    }

    const isProjectPlanRequest = systemMessages.length > 0 && 
      systemMessages.some(m => m.content.includes('JSON') || m.content.includes('json'));
    
    const requestBody: any = {
      model: modelName,
      messages: formattedMessages,
      temperature: isProjectPlanRequest ? 0.1 : 0.7,
      stream: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from Groq API');
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
      'llama-3.3-70b-versatile', // Latest and most capable
      'llama-3.1-8b-instant',    // Fast and efficient
      'mixtral-8x7b-32768',     // High context window
      'gemma2-9b-it',           // Google's Gemma model
    ];
  }
}

