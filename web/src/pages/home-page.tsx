import {ChatSidebar} from "../components/chat-sidebar";
import {ChatInputBox} from "../components/chat-input-box";
import {MessageDisplay, AssistantLoadingIndicator} from "../components/message";
import {useChats, useChat} from "../data/queries/chat";
import {useCreateChat, useSendMessage, useStreamMessage} from "../data/mutations/chat";
import {ChatMessage} from "../types";
import {useChatState} from "../hooks/use-chat-state";
import {useEffect, useRef, useState} from "react";
import {useToast} from "../components/ui/toast";
import Spinner from "../components/ui/spinner";
import {ModelSelector} from "../components/model-selector";

export function HomePage () {
    const { selectedChatId, setSelectedChatId } = useChatState();
    const chatsQuery = useChats();
    const chatQuery = useChat(selectedChatId);
    const createChatMutation = useCreateChat();
    const sendMessageMutation = useSendMessage();
    const { streamMessage, isStreaming, streamingContent, streamError } = useStreamMessage();
    const { showToast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

    useEffect(() => {
        if (chatQuery.data && chatQuery.data.messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatQuery.data?.messages.length, streamingContent]);

    useEffect(() => {
        if (!selectedChatId) return;
        if (!chatsQuery.data) return;
        if (chatsQuery.isLoading || chatsQuery.isFetching) return;

        const chatExists = chatsQuery.data.some(chat => chat.id === selectedChatId);
        if (!chatExists) {
            setSelectedChatId(null);
        }
    }, [selectedChatId, chatsQuery.data, chatsQuery.isLoading, chatsQuery.isFetching, setSelectedChatId]);

    const handleCreateChat = async () => {
        try {
            const newChat = await createChatMutation.mutateAsync();
            setSelectedChatId(newChat.id);
        } catch (error) {
            showToast('Failed to create chat', 'error');
        }
    };

    const handleSendMessage = async (message: string) => {
        if (!selectedChatId) {
            showToast('Please select or create a chat first', 'error');
            return;
        }
        
        const tempMessageId = `streaming-${Date.now()}`;
        setStreamingMessageId(tempMessageId);
        
        try {
            await streamMessage(selectedChatId, message, (token, fullContent) => {
                setStreamingMessageId(tempMessageId);
            });
            setStreamingMessageId(null);
        } catch (error) {
            setStreamingMessageId(null);
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            
            if (streamError) {
                showToast(streamError, 'error');
            } else {
                showToast('Streaming failed, falling back to regular message', 'error');
                try {
                    await sendMessageMutation.mutateAsync({ chatId: selectedChatId, message });
                } catch (fallbackError) {
                    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Failed to send message';
                    showToast(fallbackMessage, 'error');
                }
            }
        }
    };

    const messages: ChatMessage[] = chatQuery.data?.messages || [];
    const isSendingForThisChat =
        (sendMessageMutation.isPending && sendMessageMutation.variables?.chatId === selectedChatId) ||
        (isStreaming && streamingMessageId !== null);
    const isLoading = isSendingForThisChat || chatQuery.isFetching;

    if (chatsQuery.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <Spinner />
            </div>
        );
    }

    return <div className={"flex flex-col items-center"}>
        <ChatSidebar 
            chats={chatsQuery.data || []} 
            selectedChatId={selectedChatId} 
            onSelectChat={setSelectedChatId}
            onCreateChat={handleCreateChat}
        />
        <div className={"flex flex-col pt-8 max-w-4xl ms-64 w-full px-4"}>
            {selectedChatId ? (
                <ChatWindow 
                    messages={messages} 
                    onSend={handleSendMessage}
                    isLoading={isLoading}
                    chatName={chatQuery.data?.name || 'Chat'}
                    chatId={selectedChatId}
                    isChatLoading={chatQuery.isLoading}
                    streamingContent={isStreaming && streamingMessageId ? streamingContent : null}
                    streamError={streamError}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-96">
                    <h2 className="text-2xl font-semibold mb-4">No chat selected</h2>
                    <p className="text-muted-foreground mb-4">Create a new chat to get started</p>
                </div>
            )}
        </div>
    </div>
}

function ChatWindow ({ 
    messages, 
    onSend, 
    isLoading,
    chatName,
    chatId,
    isChatLoading,
    streamingContent,
    streamError
}: { 
    messages: ChatMessage[]; 
    onSend: (message: string) => void;
    isLoading: boolean;
    chatName: string;
    chatId: string;
    isChatLoading?: boolean;
    streamingContent?: string | null;
    streamError?: string | null;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isLoading, streamingContent]);

    return <div className={"flex flex-col gap-4 h-[calc(100vh-12rem)]"}>
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{chatName}</h2>
            <ModelSelector chatId={chatId} />
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4">
            {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Start a conversation by sending a message</p>
                </div>
            )}
            {messages.map((message, index) => {
                const originalUserMessage = messages.find(
                    (m, i) => 
                        m.role === 'user' && 
                        i < index &&
                        !m.content.toLowerCase().includes('create a project plan') &&
                        !m.content.toLowerCase().includes('generate project plan')
                );
                
                const generatePlanMessage = originalUserMessage
                    ? `Create a project plan for: ${originalUserMessage.content}`
                    : "Create a project plan for this conversation, with workstreams and deliverables.";
                
                return (
                    <MessageDisplay 
                        key={index} 
                        message={message}
                        onGeneratePlan={
                            message.role === 'assistant' && 
                            message.content.toLowerCase().includes("turn this into a detailed project plan")
                                ? () => onSend(generatePlanMessage)
                                : undefined
                        }
                    />
                );
            })}
            {streamingContent && (
                <MessageDisplay 
                    message={{ role: 'assistant', content: streamingContent }}
                />
            )}
            {streamError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {streamError}
                </div>
            )}
            {isLoading && !streamingContent && <AssistantLoadingIndicator />}
            <div ref={messagesEndRef} />
        </div>
        <ChatInputBox onSend={onSend} disabled={isLoading} />
    </div>
}