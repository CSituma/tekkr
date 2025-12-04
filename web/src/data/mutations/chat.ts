import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, API_BASE_URL } from "../client";
import { Chat, SendMessageMutationParams, SendMessageResponse, UpdateChatRequest } from "../../types";
import { handleApiResponse } from "../../helpers";
import { useState, useCallback, useEffect, useRef } from "react";

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => handleApiResponse<Chat>(apiClient.post("/chat", {})),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, message }: SendMessageMutationParams) =>
      handleApiResponse<SendMessageResponse>(
        apiClient.post(`/chat/${chatId}/message`, { message })
      ),
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, updates }: { chatId: string; updates: UpdateChatRequest }) =>
      handleApiResponse<Chat>(apiClient.patch(`/chat/${chatId}`, updates)),
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useStreamMessage() {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const activeStreamRef = useRef<string | null>(null);
  const tokenTimestampsRef = useRef<number[]>([]);
  const batchedContentRef = useRef<string>('');
  const throttleTimerRef = useRef<number | null>(null);
  const isFastStreamRef = useRef<boolean>(false);
  
  useEffect(() => {
    return () => {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamError(null);
      setStreamingChatId(null);
      activeStreamRef.current = null;
      tokenTimestampsRef.current = [];
      batchedContentRef.current = '';
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      isFastStreamRef.current = false;
    };
  }, []);

  const streamMessage = useCallback(async (
    chatId: string,
    message: string,
    onToken?: (token: string, fullContent: string) => void
  ): Promise<void> => {
    if (streamingChatId && streamingChatId !== chatId) {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamError(null);
    }
    
    setIsStreaming(true);
    setStreamingContent('');
    setStreamError(null);
    setStreamingChatId(chatId);
    activeStreamRef.current = chatId;

    try {
      const response = await fetch(`${API_BASE_URL}/chat/${chatId}/message/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'richard',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let currentEventType: string | null = null;
      
      tokenTimestampsRef.current = [];
      batchedContentRef.current = '';
      isFastStreamRef.current = false;
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      
      const FAST_STREAM_THRESHOLD = 10;
      const BATCH_INTERVAL = 50;
      const RATE_WINDOW_SIZE = 10;

      const updateContent = (newContent: string, token: string) => {
        if (activeStreamRef.current !== chatId) return;
        
        if (isFastStreamRef.current) {
          batchedContentRef.current = newContent;
          
          if (!throttleTimerRef.current) {
            throttleTimerRef.current = window.setTimeout(() => {
              if (activeStreamRef.current === chatId) {
                setStreamingContent(batchedContentRef.current);
                onToken?.(token, batchedContentRef.current);
              }
              throttleTimerRef.current = null;
            }, BATCH_INTERVAL);
          }
        } else {
          setStreamingContent(newContent);
          onToken?.(token, newContent);
        }
      };

      const handleSSEEvent = (eventType: string, data: string) => {
        if (activeStreamRef.current !== chatId) return;
        
        try {
          const parsed = JSON.parse(data);
          
          switch (eventType) {
            case 'token':
              if (parsed.token) {
                content += parsed.token;
                
                const now = Date.now();
                tokenTimestampsRef.current.push(now);
                
                if (tokenTimestampsRef.current.length > RATE_WINDOW_SIZE) {
                  tokenTimestampsRef.current.shift();
                }
                
                if (tokenTimestampsRef.current.length >= 5 && !isFastStreamRef.current) {
                  const timeSpan = now - tokenTimestampsRef.current[0];
                  const tokenCount = tokenTimestampsRef.current.length;
                  const tokensPerSecond = (tokenCount / timeSpan) * 1000;
                  
                  if (tokensPerSecond > FAST_STREAM_THRESHOLD) {
                    isFastStreamRef.current = true;
                    if (batchedContentRef.current) {
                      setStreamingContent(batchedContentRef.current);
                    }
                  }
                }
                
                updateContent(content, parsed.token);
              }
              break;
              
            case 'done':
              if (parsed.chat) {
                if (throttleTimerRef.current) {
                  clearTimeout(throttleTimerRef.current);
                  throttleTimerRef.current = null;
                }
                if (batchedContentRef.current) {
                  setStreamingContent(batchedContentRef.current);
                }
                queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
                queryClient.invalidateQueries({ queryKey: ["chats"] });
              }
              break;
              
            case 'error':
              setStreamError(parsed.error || parsed.details || 'Stream error occurred');
              break;
          }
        } catch (e) {
          if (eventType === 'error' || data.includes('error')) {
            setStreamError('⚠️ Connection lost. Response may be incomplete.');
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data.trim() === '') continue;

              const eventType = currentEventType || 'token';
              handleSSEEvent(eventType, data);
              currentEventType = null;
            }
          }
        }
      } finally {
        reader.releaseLock();
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        if (batchedContentRef.current && activeStreamRef.current === chatId) {
          setStreamingContent(batchedContentRef.current);
        }
        if (activeStreamRef.current === chatId) {
          setIsStreaming(false);
          setStreamingChatId(null);
          activeStreamRef.current = null;
          tokenTimestampsRef.current = [];
          batchedContentRef.current = '';
          isFastStreamRef.current = false;
        }
      }
    } catch (err) {
      if (activeStreamRef.current === chatId) {
        setIsStreaming(false);
        setStreamingChatId(null);
        activeStreamRef.current = null;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      if (activeStreamRef.current === chatId) {
        setStreamError(errorMessage);
      }
      throw err;
    }
  }, [queryClient, streamingChatId]);

  return {
    streamMessage,
    isStreaming,
    streamingContent,
    streamError,
    streamingChatId,
  };
}
