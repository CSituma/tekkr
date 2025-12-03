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

  getAvailableModels(): string[] {
    return [
      'llama-3.3-70b-versatile', // Latest and most capable
      'llama-3.1-8b-instant',    // Fast and efficient
      'mixtral-8x7b-32768',     // High context window
      'gemma2-9b-it',           // Google's Gemma model
    ];
  }
}

