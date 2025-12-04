import React from 'react';
import { useLLMModels, useChat } from '../data/queries/chat';
import { useUpdateChat } from '../data/mutations/chat';
import { Button } from './ui/button';
import { ChevronDownIcon } from 'lucide-react';
import { useToast } from './ui/toast';

interface ModelSelectorProps {
  chatId: string;
}

const ALLOWED_MODELS: Record<'gemini' | 'openai' | 'groq', string[]> = {
  groq: ['llama-'],
  openai: ['gpt-4o-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

const getProviderForModel = (
  model: string
): 'gemini' | 'openai' | 'anthropic' | 'groq' => {
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (
    model.startsWith('llama-') ||
    model.startsWith('mixtral-') ||
    model.startsWith('gemma')
  )
    return 'groq';
  return 'gemini';
};

export function ModelSelector({ chatId }: ModelSelectorProps) {
  const { data: modelsData } = useLLMModels();
  const { data: chat } = useChat(chatId);
  const updateChatMutation = useUpdateChat();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);

  const models = modelsData?.models || [];

  const filteredModels = models.filter((model) => {
    const provider = getProviderForModel(model);

    if (provider === 'gemini') {
      return ALLOWED_MODELS.gemini.indexOf(model) !== -1;
    }

    if (provider === 'openai') {
      return ALLOWED_MODELS.openai.indexOf(model) !== -1;
    }

    if (provider === 'groq') {
      return ALLOWED_MODELS.groq.some((prefix) => model.startsWith(prefix));
    }

    return false;
  });

  const currentModel =
    (chat?.model && filteredModels.includes(chat.model) && chat.model) ||
    filteredModels[0] ||
    '';

  if (!chatId) return null;

  if (filteredModels.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <span className="text-xs">Loading models...</span>
      </Button>
    );
  }

  const groupedModels = filteredModels.reduce((acc, model) => {
    const provider = getProviderForModel(model);
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<'gemini' | 'openai' | 'anthropic' | 'groq', string[]>);

  // Order providers: Groq first so LLaMA 70B is the default, then OpenAI, then Gemini
  const providerOrder: Array<'groq' | 'openai' | 'gemini' | 'anthropic'> = [
    'groq',
    'openai',
    'gemini',
    'anthropic',
  ];

  const providerLabels: Record<string, string> = {
    groq: '🚀 Groq',
    gemini: '✨ Gemini',
    openai: '🤖 OpenAI',
    anthropic: '🧠 Anthropic',
  };

  const handleSelectModel = async (model: string) => {
    try {
      const provider = getProviderForModel(model);
      
      await updateChatMutation.mutateAsync({ 
        chatId, 
        updates: { model, provider } 
      });
      setIsOpen(false);
      showToast('Model updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update model', 'error');
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <span className="text-xs">{currentModel || 'Select Model'}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </Button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 right-0 z-20 bg-background border border-border rounded-md shadow-lg min-w-[280px] max-h-[400px] overflow-y-auto">
            {providerOrder
              .filter((provider) => groupedModels[provider]?.length)
              .length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                No models available
              </div>
            ) : (
              providerOrder
                .filter((provider) => groupedModels[provider]?.length)
                .map((provider) => {
                  const providerModels = groupedModels[provider] || [];
                  return (
                <div key={provider} className="border-b border-border last:border-b-0">
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                    {providerLabels[provider] || provider.toUpperCase()}
                  </div>
                  {providerModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectModel(model);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors cursor-pointer ${
                        model === currentModel ? 'bg-accent font-semibold' : ''
                      }`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
                  );
                })
            )}
          </div>
        </>
      )}
    </div>
  );
}

