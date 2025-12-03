import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { Chat, SendMessageMutationParams, SendMessageResponse, UpdateChatRequest } from "../../types";
import { handleApiResponse } from "../../helpers";
import { useState, useCallback } from "react";

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

  const streamMessage = useCallback(async (
    chatId: string,
    message: string,
    onToken?: (token: string, fullContent: string) => void
  ): Promise<void> => {
    setIsStreaming(true);
    setStreamingContent('');
    setStreamError(null);

    try {
      const response = await fetch(`http://localhost:8000/chat/${chatId}/message/stream`, {
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

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data.trim() === '') continue;

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.token) {
                  content += parsed.token;
                  setStreamingContent(content);
                  onToken?.(parsed.token, content);
                  // Force a re-render by updating state
                } else if (parsed.chat) {
                  queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
                  queryClient.invalidateQueries({ queryKey: ["chats"] });
                } else if (parsed.error) {
                  setStreamError(parsed.error || 'Stream error occurred');
                }
              } catch (e) {
                if (data.includes('error')) {
                  setStreamError('⚠️ Connection lost. Response may be incomplete.');
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        setIsStreaming(false);
      }
    } catch (err) {
      setIsStreaming(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      setStreamError(errorMessage);
      throw err;
    }
  }, [queryClient]);

  return {
    streamMessage,
    isStreaming,
    streamingContent,
    streamError,
  };
}
