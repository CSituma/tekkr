import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { Chat, SendMessageMutationParams, SendMessageResponse, UpdateChatRequest } from "../../types";
import { handleApiResponse } from "../../helpers";

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
