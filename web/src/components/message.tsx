import React from "react";
import {cn} from "../lib/utils";
import Spinner from "./ui/spinner";
import {BotIcon, UserIcon} from "lucide-react";
import { MessageContent } from "./message-content";
import { ChatMessage } from "../types";
import { Button } from "./ui/button";

export function MessageContainer({ role, children }: React.PropsWithChildren<{ role: ChatMessage["role"] }>) {
    return (
        <div className={cn("flex flex-col gap-2", role === "user" ? "items-end" : "items-start")}>
            <div
                className={
                    "flex flex-row items-center gap-1 rounded-full bg-accent py-1.5 pe-3 ps-1.5 text-xs font-semibold"
                }
            >
                {role === "assistant" && <BotIcon className={"me-1 inline-block h-4 w-4"} />}
                {role === "user" && <UserIcon className={"me-1 inline-block h-4 w-4"} />}
                {role === "user" ? "You" : "Assistant"}
            </div>
            <div className={cn(role === "user" ? "pe-2 ps-16" : "flex w-full flex-col items-start pe-16 ps-2")}>
                {children}
            </div>
        </div>
    );
}

export function MessageDisplay({ 
    message, 
    onGeneratePlan 
}: { 
    message: ChatMessage;
    onGeneratePlan?: () => void;
}) {
    const offersPlan = message.role === 'assistant' && 
        message.content.toLowerCase().includes("turn this into a detailed project plan");

    return (
        <MessageContainer role={message.role}>
            <div className="rounded-lg bg-accent px-4 py-2 text-sm">
                <MessageContent content={message.content} />
            </div>
            {offersPlan && onGeneratePlan && (
                <div className="mt-2">
                    <Button
                        size="sm"
                        onClick={onGeneratePlan}
                        className="text-xs"
                    >
                        Generate project plan
                    </Button>
                </div>
            )}
        </MessageContainer>
    );
}

export function AssistantLoadingIndicator() {
    return (
        <MessageContainer role={"assistant"}>
            <div
                className={
                    "flex flex-row items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-muted-foreground"
                }
            >
                <Spinner />
                Working on it...
            </div>
        </MessageContainer>
    );
}
