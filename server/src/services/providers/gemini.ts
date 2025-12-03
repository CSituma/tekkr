import { BaseMessage, GeminiAPIResponse, LLMAdapter } from '../../types';

export class GeminiAdapter implements LLMAdapter {
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.defaultModel = 'gemini-2.5-flash'; // Using stable model available on free tier
  }

  async sendMessage(messages: BaseMessage[], model?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const modelName = model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }
    const data = await response.json() as GeminiAPIResponse;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from LLM';
  }

  getAvailableModels(): string[] {
    return [
      'gemini-3-pro-preview', // Gemini 3 Pro Preview
      'gemini-2.5-pro', // Stable Gemini 2.5 Pro
      'gemini-2.5-flash', // Stable Gemini 2.5 Flash
      'gemini-2.0-flash-exp', // Previous Gemini model
    ];
  }
}

