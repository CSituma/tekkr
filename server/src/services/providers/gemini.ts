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

  async streamMessage(
    messages: BaseMessage[],
    model: string | undefined,
    onToken: (token: string) => void
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const modelName = model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}`;

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
      console.error('Gemini API error response:', error);
      throw new Error(`Gemini API error: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from Gemini API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;
    let lastSentText = ''; // Track what we've already sent to avoid duplicates
    let longestText = ''; // Always track the longest text we've seen (for final return)

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Gemini streams JSON objects, potentially separated by newlines
        // Try to parse complete JSON objects from the buffer
        let braceDepth = 0;
        let inString = false;
        let escapeNext = false;
        let startIdx = -1;
        let processedUpTo = 0;
        
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (inString) {
            continue;
          }
          
          if (char === '{') {
            if (braceDepth === 0) {
              startIdx = i;
            }
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
            
            if (braceDepth === 0 && startIdx !== -1) {
              // We have a complete JSON object
              const jsonStr = buffer.substring(startIdx, i + 1);
              try {
                const json = JSON.parse(jsonStr);
                
                // Extract text from candidates[0].content.parts[0].text
                const fullText = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (fullText && typeof fullText === 'string' && fullText.length > 0) {
                  // Always track the longest text we've seen (for final return)
                  if (fullText.length > longestText.length) {
                    longestText = fullText;
                  }
                  
                  // Gemini sends full accumulated text, so we need to send only the delta
                  if (lastSentText === '') {
                    // First chunk - send it all
                    tokenCount++;
                    onToken(fullText);
                    lastSentText = fullText;
                  } else if (fullText.length > lastSentText.length && fullText.startsWith(lastSentText)) {
                    // Normal case: new text extends previous text
                    const delta = fullText.substring(lastSentText.length);
                    if (delta.length > 0) {
                      tokenCount++;
                      onToken(delta);
                      lastSentText = fullText;
                    }
                  } else if (fullText.length > lastSentText.length) {
                    // Text is longer but doesn't start with lastSentText - might be a continuation
                    // Try to find where it continues from
                    const overlap = lastSentText.length;
                    if (fullText.substring(0, Math.min(overlap, fullText.length)) === lastSentText.substring(0, Math.min(overlap, lastSentText.length))) {
                      // There's some overlap, send the new part
                      const delta = fullText.substring(lastSentText.length);
                      if (delta.length > 0) {
                        tokenCount++;
                        onToken(delta);
                        lastSentText = fullText;
                      }
                    } else {
                      // No overlap - this might be a complete new response, use it
                      const delta = fullText.substring(lastSentText.length);
                      if (delta.length > 0) {
                        tokenCount++;
                        onToken(delta);
                        lastSentText = fullText;
                      } else {
                        // Full text is actually shorter or same - update to use the longer one
                        if (fullText.length >= lastSentText.length) {
                          lastSentText = fullText;
                        }
                      }
                    }
                  } else if (fullText.length === lastSentText.length && fullText !== lastSentText) {
                    // Same length but different - might be the final complete version
                    // Update to use the new text (might have corrections)
                    lastSentText = fullText;
                  }
                }
              } catch (e) {
                // Skip invalid JSON - might be incomplete
              }
              
              processedUpTo = i + 1;
              startIdx = -1;
            }
          }
        }
        
        // Keep only unprocessed part in buffer (after the last complete JSON object)
        if (processedUpTo > 0) {
          buffer = buffer.substring(processedUpTo);
        }
      }
      
      // After stream ends, try to parse any remaining buffer as final JSON
      // This handles the case where the final JSON object might be incomplete
      if (buffer.trim()) {
        // Try to find and parse any complete JSON objects in the remaining buffer
        let braceDepth = 0;
        let inString = false;
        let escapeNext = false;
        let startIdx = -1;
        
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (inString) {
            continue;
          }
          
          if (char === '{') {
            if (braceDepth === 0) {
              startIdx = i;
            }
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
            
            if (braceDepth === 0 && startIdx !== -1) {
              const jsonStr = buffer.substring(startIdx, i + 1);
              try {
                const json = JSON.parse(jsonStr);
                const fullText = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (fullText && typeof fullText === 'string' && fullText.length > 0) {
                  // Always track the longest text we've seen (for final return)
                  if (fullText.length > longestText.length) {
                    longestText = fullText;
                  }
                  
                  // Send any remaining delta
                  if (lastSentText === '') {
                    tokenCount++;
                    onToken(fullText);
                    lastSentText = fullText;
                  } else if (fullText.length > lastSentText.length) {
                    const delta = fullText.substring(lastSentText.length);
                    if (delta.length > 0) {
                      tokenCount++;
                      onToken(delta);
                      lastSentText = fullText;
                    }
                  }
                }
              } catch (e) {
                // Final buffer might not be complete JSON - that's okay, we'll use lastSentText
              }
            }
          }
        }
      }
      
      if (tokenCount === 0) {
        console.warn('Gemini stream completed but no tokens were received');
        console.warn('Final buffer:', buffer.substring(0, 500));
        return '';
      } else {
        // Return the longest text we've seen (should be the complete final response)
        const finalText = longestText.length > lastSentText.length ? longestText : lastSentText;
        console.log(`Gemini stream completed: ${tokenCount} tokens received, final text length: ${finalText.length} (longest: ${longestText.length}, lastSent: ${lastSentText.length})`);
        return finalText;
      }
    } catch (error) {
      console.error('Error reading Gemini stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
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

