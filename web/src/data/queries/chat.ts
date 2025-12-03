import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import { Chat, LLMModelsResponse } from "../../types";
import { handleApiResponse } from "../../helpers";


export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => handleApiResponse<Chat[]>(apiClient.get("/chat")),
  });
}

export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: ["chat", chatId],
    queryFn: () =>
      chatId ? handleApiResponse<Chat>(apiClient.get(`/chat/${chatId}`)) : null,
    enabled: !!chatId,
    retry: false, // Don't retry on 404 - chat doesn't exist
  });
}

export function useLLMModels() {
  return useQuery({
    queryKey: ["llm-models"],
    queryFn: () =>
      handleApiResponse<LLMModelsResponse>(
        apiClient.get("/chat/llm/models")
      ),
  });
}

