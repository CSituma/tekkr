import { useState, useEffect } from 'react';

const SELECTED_CHAT_KEY = 'selectedChatId';

export function useChatState() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SELECTED_CHAT_KEY) || null;
    }
    return null;
  });

  useEffect(() => {
    if (selectedChatId) {
      localStorage.setItem(SELECTED_CHAT_KEY, selectedChatId);
    } else {
      localStorage.removeItem(SELECTED_CHAT_KEY);
    }
  }, [selectedChatId]);

  return { selectedChatId, setSelectedChatId };
}

