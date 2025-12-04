import { Chat, ChatMessage } from '../types';

export type { Chat, ChatMessage };

const MAX_CHATS_PER_USER = 50;
const MAX_MESSAGES_PER_CHAT = 200;

class ChatStorage {
  private chats: Map<string, Chat> = new Map();
  private userChats: Map<string, string[]> = new Map();

  createChat(userId: string, name?: string): Chat {
    const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chat: Chat = {
      id,
      name: name || 'New Chat',
      userId,
      messages: [],
      createdAt: new Date(),
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
    };

    this.chats.set(id, chat);
    const userChatList = this.userChats.get(userId) || [];
    userChatList.push(id);

    if (userChatList.length > MAX_CHATS_PER_USER) {
      const excess = userChatList.length - MAX_CHATS_PER_USER;
      const chatsToRemove = userChatList.splice(0, excess);
      for (const oldChatId of chatsToRemove) {
        this.chats.delete(oldChatId);
      }
    }

    this.userChats.set(userId, userChatList);

    return chat;
  }

  getChat(chatId: string): Chat | undefined {
    return this.chats.get(chatId);
  }

  getUserChats(userId: string): Chat[] {
    const chatIds = this.userChats.get(userId) || [];
    return chatIds
      .map(id => this.chats.get(id))
      .filter((chat): chat is Chat => chat !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateChat(chatId: string, updates: Partial<Chat>): Chat | undefined {
    const chat = this.chats.get(chatId);
    if (!chat) return undefined;

    const updated = { ...chat, ...updates };
    this.chats.set(chatId, updated);
    return updated;
  }

  addMessage(chatId: string, message: ChatMessage): void {
    const chat = this.chats.get(chatId);
    if (!chat) return;

    chat.messages.push(message);

    if (chat.messages.length > MAX_MESSAGES_PER_CHAT) {
      const excess = chat.messages.length - MAX_MESSAGES_PER_CHAT;
      chat.messages.splice(0, excess);
    }

    if (chat.messages.length === 1 && message.role === 'user') {
      chat.name = message.content.substring(0, 50) || 'New Chat';
    }

    this.chats.set(chatId, chat);
  }

  deleteChat(chatId: string): boolean {
    const chat = this.chats.get(chatId);
    if (!chat) return false;

    this.chats.delete(chatId);
    const userChatList = this.userChats.get(chat.userId) || [];
    const index = userChatList.indexOf(chatId);
    if (index > -1) {
      userChatList.splice(index, 1);
      this.userChats.set(chat.userId, userChatList);
    }
    return true;
  }

  clearAll(): void {
    this.chats.clear();
    this.userChats.clear();
  }

  clearUserChats(userId: string): void {
    const chatIds = this.userChats.get(userId) || [];
    for (const chatId of chatIds) {
      this.chats.delete(chatId);
    }
    this.userChats.delete(userId);
  }
}

export const chatStorage = new ChatStorage();

