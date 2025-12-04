import { FastifyPluginAsync } from 'fastify';
import { chatStorage } from '../../services/chat-storage';
import { LLMService } from '../../services/llm-service';
import { SendMessageRequest, UpdateChatRequest, LLMProvider, BaseMessage } from '../../types';
import { GeminiAdapter } from '../../services/providers/gemini';
import { OpenAIAdapter } from '../../services/providers/openai';
import { GroqAdapter } from '../../services/providers/groq';

const TEKKR_PROJECT_PLAN_PROMPT = `
You are an expert project planning engine.
You MUST respond with ONLY valid JSON.
NO markdown.
NO commentary.
NO backticks.
NO prose.

Follow exactly this schema:
{
  "overview": "string",
  "goals": ["string"],
  "workstreams": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "tasks": [
        {
          "id": "string",
          "name": "string",
          "description": "string",
          "duration": "string",
          "dependencies": ["string"]
        }
      ]
    }
  ],
  "timeline": [
    {
      "phase": "string",
      "start": "string",
      "end": "string"
    }
  ]
}

Rules:
- concise, tactical, Tekkr style
- tasks must be small, actionable
- generated IDs must be unique
- durations must be human readable
- timeline phases must be sequential, no overlap
`;

function postProcessProjectPlanResponse(response: string): string {
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
  const jsonMatch = response.match(jsonBlockRegex);
  if (jsonMatch) {
    return response;
  }

  const jsonObjectRegex = /\{[\s\S]*"workstreams"[\s\S]*\}/;
  const jsonObjectMatch = response.match(jsonObjectRegex);
  if (jsonObjectMatch && jsonObjectMatch.index !== undefined) {
    try {
      JSON.parse(jsonObjectMatch[0]);
      const beforeText = response.substring(0, jsonObjectMatch.index).trim();
      const afterText = response.substring(jsonObjectMatch.index + jsonObjectMatch[0].length).trim();
      const jsonBlock = `\`\`\`json\n${jsonObjectMatch[0]}\n\`\`\``;
      
      if (beforeText || afterText) {
        return [beforeText, jsonBlock, afterText].filter(Boolean).join('\n\n');
      }
      return jsonBlock;
    } catch (e) {
    }
  }

  const workstreams = extractWorkstreamsFromText(response);
  
  if (workstreams.length >= 2 && workstreams.some(ws => ws.deliverables.length > 0)) {
    const projectPlan = {
      workstreams: workstreams
    };
    const jsonBlock = `\`\`\`json\n${JSON.stringify(projectPlan, null, 2)}\n\`\`\``;
    
    const planStartPatterns = [
      /(?:^|\n)\d+\.\s+\*\*[^*]+\*\*/,
      /\*\*[^*]+\*\*[:\n]\s*\*\*Deliverables?:/i,
      /\*\*Phase\s+\d+|\*\*Week\s+\d+|\*\*Workstream\s+\d+/i,
      /(?:^|\n)(?:Workstreams?\s+&|Core\s+Pillars|Key\s+Areas)/i
    ];
    
    let planStartIndex = response.length;
    for (const pattern of planStartPatterns) {
      const match = response.match(pattern);
      if (match && match.index !== undefined && match.index < planStartIndex) {
        planStartIndex = match.index;
        break;
      }
    }
    
    if (planStartIndex === response.length) {
      const numberedListMatch = response.match(/(?:^|\n\n)\d+\.\s+\*\*/);
      if (numberedListMatch && numberedListMatch.index !== undefined) {
        const textBefore = response.substring(0, numberedListMatch.index).trim();
        if (textBefore.length > 20) {
          planStartIndex = numberedListMatch.index;
        }
      }
    }
    
    const beforeText = response.substring(0, planStartIndex).trim();
    const postPlanSectionPatterns = [
      /(?:^|\n)\*\*Timeline/i,
      /(?:^|\n)\*\*Key\s+Outcomes?/i,
      /(?:^|\n)\*\*Expected\s+Outcomes?/i,
      /(?:^|\n)\*\*Next\s+Steps?/i,
      /(?:^|\n)(?:Total|Overall)\s+Timeline/i,
      /(?:^|\n)Timeline\s*\(/i,
      /(?:^|\n)\*\*Phase\s+\d+/i,
      /(?:^|\n)###\s+Phase/i,
      /(?:^|\n)####\s+Phase/i,
      /(?:^|\n)\*\*Duration:/i,
      /(?:^|\n)\*\*Objective:/i
    ];
    
    let planContentEnd = response.length;
    
    for (const pattern of postPlanSectionPatterns) {
      const match = response.substring(planStartIndex).match(pattern);
      if (match && match.index !== undefined) {
        const textBeforeSection = response.substring(planStartIndex, planStartIndex + match.index);
        if (textBeforeSection.match(/\d+\.\s+\*\*/) || textBeforeSection.match(/\*\*[^*]+\*\*[:\n]\s*\*\*Deliverables?:/i) || textBeforeSection.match(/###\s+Phase/i)) {
          planContentEnd = planStartIndex + match.index;
          break;
        }
      }
    }
    
    if (planContentEnd === response.length) {
      const summaryPatterns = [
        /(?:^|\n)\*\*Expected\s+Outcomes?/i,
        /(?:^|\n)\*\*Next\s+Steps?/i,
        /(?:^|\n)###\s+Expected/i
      ];
      
      for (const pattern of summaryPatterns) {
        const match = response.substring(planStartIndex).match(pattern);
        if (match && match.index !== undefined) {
          const textBeforeSection = response.substring(planStartIndex, planStartIndex + match.index);
          if (textBeforeSection.match(/\d+\.\s+\*\*/) || textBeforeSection.length > 200) {
            planContentEnd = planStartIndex + match.index;
            break;
          }
        }
      }
    }
    
    const afterText = response.substring(planContentEnd).trim();
    
    let briefIntro = '';
    if (beforeText && beforeText.length > 0) {
      const sentences = beforeText.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        briefIntro = sentences.slice(0, 2).join(' ').trim().substring(0, 200);
      } else {
        briefIntro = beforeText.substring(0, 150).trim();
      }
    }
    
    let briefOutro = '';
    if (afterText && afterText.length > 0) {
      const isClosingRemark = /feel\s+free|adjust|review|let\s+me\s+know|questions?|feedback/i.test(afterText) && afterText.length < 150;
      if (isClosingRemark) {
        briefOutro = afterText.substring(0, 150).trim();
      }
    }
    
    const parts: string[] = [];
    if (briefIntro) {
      parts.push(briefIntro);
    }
    parts.push(jsonBlock);
    if (briefOutro) {
      parts.push(briefOutro);
    }
    
    return parts.join('\n\n');
  }

  return response;
}

function extractWorkstreamsFromText(text: string): Array<{title: string; description: string; deliverables: Array<{title: string; description: string}>}> {
  const workstreams: Array<{title: string; description: string; deliverables: Array<{title: string; description: string}>}> = [];
  const numberedBoldPattern = /(\d+)\.\s+\*\*([^*]+)\*\*([^\n]*)/g;
  let match;
  let currentWorkstream: {title: string; description: string; deliverables: Array<{title: string; description: string}>} | null = null;
  
  while ((match = numberedBoldPattern.exec(text)) !== null) {
    const title = match[2].trim();
    const desc = match[3].trim().substring(0, 200) || 'Project workstream';
    
    if (currentWorkstream) {
      workstreams.push(currentWorkstream);
    }
    
    currentWorkstream = {
      title: title,
      description: desc,
      deliverables: []
    };
    
    const sectionStart = match.index + match[0].length;
    numberedBoldPattern.lastIndex = 0;
    const nextMatch = text.substring(sectionStart).match(numberedBoldPattern);
    const sectionEnd = (nextMatch && nextMatch.index !== undefined) ? sectionStart + nextMatch.index : text.length;
    const section = text.substring(sectionStart, sectionEnd);
    const bulletMatches = section.match(/^\s*[\*\-\•]\s+([^\n]+)/gmi) || [];
    for (const bullet of bulletMatches.slice(0, 5)) {
      const clean = bullet.replace(/^\s*[\*\-\•]\s+/, '').trim();
      if (clean.length > 10) {
        const parts = clean.split(/[:–-]/);
        currentWorkstream.deliverables.push({
          title: parts[0].trim().substring(0, 80),
          description: parts.slice(1).join(':').trim().substring(0, 200) || clean.substring(0, 150)
        });
      }
    }
  }
  
  if (currentWorkstream && currentWorkstream.deliverables.length > 0) {
    workstreams.push(currentWorkstream);
  }
  
  if (workstreams.length === 0) {
    const boldHeaderPattern = /\*\*([^*]+)\*\*[:\n]\s*([^\*]*?)(?:\*\*Deliverables?:\*\*|\*\*[^*]+\*\*|$)/gi;
    let headerMatch;
    
    while ((headerMatch = boldHeaderPattern.exec(text)) !== null) {
      const title = headerMatch[1].trim();
      const desc = headerMatch[2].trim().substring(0, 200) || 'Project workstream';
      
      const afterHeader = text.substring(headerMatch.index + headerMatch[0].length);
      const deliverablesMatch = afterHeader.match(/\*\*Deliverables?:\*\*\s*([\s\S]*?)(?:\*\*[^*]+\*\*|$)/i);
      
      const deliverables: Array<{title: string; description: string}> = [];
      if (deliverablesMatch) {
        const bulletMatches = deliverablesMatch[1].match(/^\s*[\*\-\•]\s+([^\n]+)/gmi) || [];
        for (const bullet of bulletMatches.slice(0, 5)) {
          const clean = bullet.replace(/^\s*[\*\-\•]\s+/, '').trim();
          if (clean.length > 10) {
            const parts = clean.split(/[:–-]/);
            deliverables.push({
              title: parts[0].trim().substring(0, 80),
              description: parts.slice(1).join(':').trim().substring(0, 200) || clean.substring(0, 150)
            });
          }
        }
      }
      
      if (deliverables.length > 0) {
        workstreams.push({ title, description: desc, deliverables });
      }
    }
  }
  
  if (workstreams.length === 0) {
    const planHeaderMatch = text.match(/(?:Project\s+Plan|Plan)[:\s]+([^\n]+)/i);
    if (planHeaderMatch) {
      const numberedItems = text.match(/^\s*(\d+)\.\s+([^\n]+)/gmi) || [];
      
      for (const item of numberedItems.slice(0, 10)) {
        const itemMatch = item.match(/^\s*(\d+)\.\s+(.+)/);
        if (itemMatch) {
          const title = itemMatch[2].trim();
          const itemIndex = text.indexOf(item);
          const nextItemMatch = text.substring(itemIndex + item.length).match(/^\s*\d+\.\s+/m);
          const contentEnd = (nextItemMatch && nextItemMatch.index !== undefined) ? itemIndex + item.length + nextItemMatch.index : itemIndex + item.length + 500;
          const content = text.substring(itemIndex + item.length, contentEnd).trim();
          
          const bullets = content.match(/^\s*[\*\-\•]\s+([^\n]+)/gmi) || [];
          const deliverables: Array<{title: string; description: string}> = [];
          
          if (bullets.length > 0) {
            for (const bullet of bullets.slice(0, 5)) {
              const clean = bullet.replace(/^\s*[\*\-\•]\s+/, '').trim();
              if (clean.length > 10) {
                deliverables.push({
                  title: clean.split(':')[0].trim().substring(0, 80),
                  description: clean.split(':').slice(1).join(':').trim().substring(0, 200) || clean.substring(0, 150)
                });
              }
            }
          } else {
            const firstSentence = content.split(/[.!?]/)[0].trim();
            if (firstSentence.length > 10) {
              deliverables.push({
                title: firstSentence.substring(0, 80),
                description: content.substring(firstSentence.length).trim().substring(0, 200) || 'Project deliverable'
              });
            }
          }
          
          if (deliverables.length > 0 || content.length > 50) {
            workstreams.push({
              title: title.substring(0, 80),
              description: content.substring(0, 200) || 'Project workstream',
              deliverables: deliverables.length > 0 ? deliverables : [{
                title: 'Implementation',
                description: content.substring(0, 150)
              }]
            });
          }
        }
      }
    }
  }
  
  return workstreams;
}

function looksLikePlanResponse(response: string): boolean {
  const lower = response.toLowerCase();

  if (
    lower.includes('here is a project plan') ||
    lower.includes('here\'s a project plan') ||
    lower.includes('structured project plan') ||
    lower.includes('project workstreams') ||
    (lower.includes('project plan') && lower.includes('objective'))
  ) {
    return true;
  }

  const hasObjective = /(^|\n)\s*(objective|goal)[:]/i.test(response);
  const hasPhases = /(^|\n)\s*phase\s*\d+[:\-\s]/i.test(response);
  
  return hasObjective && hasPhases && response.length > 200;
}

function getProviderInstance(provider: LLMProvider) {
  switch (provider) {
    case 'gemini':
      return new GeminiAdapter();
    case 'openai':
      return new OpenAIAdapter();
    case 'groq':
      return new GroqAdapter();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

const chat: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const defaultProvider = 'gemini';
  const llmService = new LLMService(defaultProvider);
  
  function getProviderForModel(model: string): LLMProvider {
    if (model.includes("gemini")) return "gemini";
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('llama-') || model.startsWith('mixtral-') || model.startsWith('gemma')) return 'groq';
    return 'gemini';
  }

  fastify.post('/', async function (request, reply) {
    const userId = request.userId;
    const chat = chatStorage.createChat(userId);
    reply.send(chat);
  });

  fastify.get('/', async function (request, reply) {
    const userId = request.userId;
    const chats = chatStorage.getUserChats(userId);
    reply.send(chats);
  });

  fastify.get('/:chatId', async function (request, reply) {
    const { chatId } = request.params as { chatId: string };
    const userId = request.userId;
    const chat = chatStorage.getChat(chatId);

    if (!chat) {
      reply.status(404).send({ error: 'Chat not found' });
      return;
    }

    if (chat.userId !== userId) {
      reply.status(403).send({ error: 'Forbidden' });
      return;
    }

    reply.send(chat);
  });

  fastify.delete('/clear', async function (request, reply) {
    const userId = request.userId;
    chatStorage.clearUserChats(userId);
    reply.send({ message: 'All chats cleared' });
  });

  fastify.options('/:chatId/message/stream', async function (request, reply) {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.code(204).send();
  });

  fastify.post('/:chatId/message/stream', async function (request, reply) {
    const { chatId } = request.params as { chatId: string };
    const userId = request.userId;
    const { message } = request.body as SendMessageRequest;

    if (!message || typeof message !== 'string') {
      reply.status(400).send({ error: 'Message is required' });
      return;
    }

    const chat = chatStorage.getChat(chatId);
    if (!chat) {
      reply.status(404).send({ error: 'Chat not found' });
      return;
    }

    if (chat.userId !== userId) {
      reply.status(403).send({ error: 'Forbidden' });
      return;
    }

    chatStorage.addMessage(chatId, { role: 'user', content: message });

    const updatedChat = chatStorage.getChat(chatId);
    if (!updatedChat) {
      reply.status(500).send({ error: 'Failed to update chat' });
      return;
    }

    // Hijack the response before setting headers
    reply.hijack();
    
    // Set headers on the raw response
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });

    const sendSSE = (event: string, data: string) => {
      const message = `event: ${event}\ndata: ${data}\n\n`;
      reply.raw.write(message);
      // Force flush to ensure real-time streaming
      if (typeof (reply.raw as any).flush === 'function') {
        (reply.raw as any).flush();
      }
    };

    try {
      const conversation = updatedChat.messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const baseSystemPrompt = {
        role: 'system' as const,
        content: `You are a professional project planning assistant. Your job is to help users think in terms of structured, actionable plans.

APPROACH:
- Be direct and concise. Keep greetings brief (1-2 sentences max).
- First, respond conversationally in 1–3 sentences: clarify, summarise, and give 1–2 concrete suggestions.
- Always think in terms of deliverables, timelines, and outcomes, but do NOT always output a full project plan.
- If the user explicitly asks for a "project plan", "roadmap", "implementation plan" or similar, then a structured project plan is appropriate.
- If the user describes goals, challenges, or long-term outcomes (e.g. "be the best coffee shop in Kenya by 2026") but does NOT explicitly ask for a plan:
  - Give a short, insightful response (1-3 sentences).
  - Then explicitly OFFER: "If you'd like, I can turn this into a detailed project plan with workstreams and deliverables."
- IMPORTANT: Once you've offered to create a plan and the user provides information or says "ok"/"yes", STOP asking questions and generate the plan. Don't ask for more details - use what you have and make reasonable assumptions.`
      };

      const hasExplicitPlanKeyword = /project\s+plan|create\s+(?:a\s+)?plan|plan\s+for|write\s+(?:me\s+)?a\s+plan|roadmap|implementation\s+plan|transition.*business|business.*plan|show.*plan|present.*plan|need\s+a\s+plan(?:\s+(?:for|to))?|want\s+a\s+plan(?:\s+(?:for|to))?/i.test(
        message
      );
      
      const lastAssistantMessage = conversation
        .filter(m => m.role === 'assistant')
        .pop();
      const assistantOfferedPlan =
        lastAssistantMessage &&
        /turn this into a detailed project plan|generate a project plan|create a detailed project plan|turn this into a project plan/i.test(
          lastAssistantMessage.content
        );

      const userAffirmative = /\b(yes|yeah|yep|sure|sounds good|do it|go ahead|let'?s do it|okay|ok\b|alright|please|that would be great|absolutely|sounds good|go for it|create it|make it|generate it)\b/i.test(
        message.trim()
      );
      const userNegative = /\b(no|nope|nah|not now|maybe later|don'?t|do not|no thanks|no thank you)\b/i.test(
        message.trim()
      );

      const userAcceptedPlanOffer = assistantOfferedPlan && userAffirmative && !userNegative;
      
      let planGoal = message;
      if (userAcceptedPlanOffer || (hasExplicitPlanKeyword && message.toLowerCase().includes('create a project plan for:'))) {
        // First, try to extract from the message itself if it contains "Create a project plan for: ..."
        if (message.toLowerCase().includes('create a project plan for:')) {
          const match = message.match(/create a project plan for:\s*(.+)/i);
          if (match && match[1]) {
            planGoal = match[1].trim();
          } else {
            // If extraction failed, find the most recent user message (iterate backwards)
            const userMessages = conversation.filter(m => m.role === 'user');
            for (let i = userMessages.length - 1; i >= 0; i--) {
              const userMsg = userMessages[i];
              if (
                !userMsg.content.toLowerCase().includes('create a project plan') &&
                !userMsg.content.toLowerCase().includes('generate project plan') &&
                !userMsg.content.toLowerCase().startsWith('create a project plan for:')
              ) {
                planGoal = userMsg.content;
                break;
              }
            }
          }
        } else {
          // Find the most recent user message (not a plan request) - iterate backwards
          const userMessages = conversation.filter(m => m.role === 'user');
          for (let i = userMessages.length - 1; i >= 0; i--) {
            const userMsg = userMessages[i];
            if (
              !userMsg.content.toLowerCase().includes('create a project plan') &&
              !userMsg.content.toLowerCase().includes('generate project plan') &&
              !userMsg.content.toLowerCase().startsWith('create a project plan for:')
            ) {
              planGoal = userMsg.content;
              break;
            }
          }
        }
      }
      
      const isProjectPlanRequest =
        hasExplicitPlanKeyword || userAcceptedPlanOffer;
      
      if (isProjectPlanRequest) {
        conversation.unshift({
          role: 'system',
          content: `You are a professional project planning assistant. Your job is to create structured, actionable project plans quickly and directly.

🚨 CRITICAL: YOUR RESPONSE FORMAT 🚨
- You MUST provide the project plan as a JSON code block starting with \`\`\`json and ending with \`\`\`
- This is the ONLY acceptable format. NO exceptions.
- DO NOT use plain text, markdown lists, "Workstream A/B/C", or any other format.
- If you provide a plan in any format other than JSON, your response is WRONG and will not work.

APPROACH:
- Be direct and concise. Create the plan immediately based on what the user tells you.
- Infer missing details from context. Make reasonable assumptions - DO NOT ask for more information.
- If the user has already provided information (dates, budget, preferences, etc.), use it immediately to create the plan.
- DO NOT ask follow-up questions once you have enough context to create a plan.
- Keep intro text minimal (1-2 sentences max) before the plan.
- Keep outro text minimal (1-2 sentences max) after the plan.
- The user wants the plan NOW, not more questions.

FORMAT REQUIREMENT:
- Start your response with a brief intro (1-5 sentences max).
- Then immediately provide the plan in this EXACT format:
\`\`\`json
{
  "workstreams": [...]
}
\`\`\`
- That's it. The JSON block is mandatory. No plain text plans.
- End your response with a brief outro (1-5 sentences max) with a summary of the plan and a call to action for the user to review the plan and provide feedback.

Create the plan immediately. Break into workstreams (3-8 or more) with 2-5 deliverables each. Each deliverable description must be outcome-focused.`
        });
        
        const lastMessage = conversation[conversation.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.content = `Create a project plan for: "${planGoal}"

🚨 FORMAT REQUIREMENT: You MUST provide the plan as a JSON code block. Start with \`\`\`json, end with \`\`\`.

DO NOT:
- Provide plans as text lists, markdown, bullet points, numbered lists, or "Workstream A/B/C" format
- Show deliverables as bullet points or numbered lists outside JSON
- Use any format other than JSON

DO:
- Provide a brief intro (1-2 sentences max)
- Then immediately provide the plan in JSON format:
\`\`\`json
{
  "workstreams": [
    {
      "title": "Workstream Name",
      "description": "One well definied sentence describing this workstream.",
      "deliverables": [
        {
          "title": "Deliverable Name",
          "description": "One well definied sentence describing this deliverable."
        }
      ]
    }
  ]
}
\`\`\`

Keep it simple: Only title and description are required for deliverables. 

CRITICAL: Deliverable descriptions must describe WHAT will be created/delivered (the outcome/result), NOT what actions to take.
- ✅ CORRECT (outcome-focused): "A formal document outlining mission, vision, and strategic objectives"
- ✅ CORRECT: "A comprehensive market analysis report with competitor insights"
- ❌ WRONG (action-focused): "Draft an enablement charter" or "Create a document that..." or "Research and analyze the market"
- Focus on the RESULT (what exists after completion), not the PROCESS (what to do)

Create the plan immediately. Break into workstreams (3-8 or more) with 2-5 deliverables each. Each deliverable description must be outcome-focused.`;
        }
      } else {
        conversation.unshift(baseSystemPrompt);
      }

      const model = updatedChat.model || llmService.getAvailableModels()[0];
      const modelProvider = getProviderForModel(model);
      if (llmService.getProvider() !== modelProvider) {
        llmService.setProvider(modelProvider);
      }
      
      let tokenCount = 0;
      let fullResponse = '';
      
      try {
        fastify.log.info({ chatId, model, messageCount: conversation.length }, 'Starting stream');
        
        const modelProvider = getProviderForModel(model);
        
        // Gemini streaming is unreliable - use non-streaming and simulate streaming
        if (modelProvider === 'gemini') {
          fastify.log.info('Using non-streaming for Gemini (simulated streaming)');
          fullResponse = await llmService.sendMessage(conversation, model);
          
          // Simulate streaming by chunking the response
          const chunkSize = 10;
          for (let i = 0; i < fullResponse.length; i += chunkSize) {
            const chunk = fullResponse.substring(i, i + chunkSize);
            if (chunk.length > 0) {
              tokenCount++;
              sendSSE('token', JSON.stringify({ token: chunk }));
              // Small delay to simulate real streaming- gemini (NON-SSE)
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          }
        } else {
          // Use real streaming for OpenAI/Groq
          fullResponse = await llmService.streamMessage(conversation, model, (token: string) => {
            if (!token || token.length === 0) return;
            
            tokenCount++;
            
            try {
              sendSSE('token', JSON.stringify({ token }));
              if (tokenCount === 1) {
                fastify.log.info('First token received and sent');
              }
            } catch (err) {
              fastify.log.error({ err }, 'Error sending SSE token');
              // Don't throw - continue processing even if one token fails to send
            }
          });
        }
        
        fastify.log.info({ tokenCount, responseLength: fullResponse.length }, 'Stream completed');
        
        if (!fullResponse || fullResponse.length === 0) {
          fastify.log.warn('No response received from LLM');
          sendSSE('error', JSON.stringify({ 
            error: 'No response from LLM', 
            details: 'The LLM did not return any content'
          }));
          reply.raw.end();
          return;
        }
      } catch (streamError) {
        fastify.log.error({ error: streamError, stack: streamError instanceof Error ? streamError.stack : undefined }, 'Stream message error');
        sendSSE('error', JSON.stringify({ 
          error: 'Failed to get LLM response', 
          details: streamError instanceof Error ? streamError.message : 'Unknown error'
        }));
        reply.raw.end();
        return;
      }

      if (isProjectPlanRequest) {
        fullResponse = postProcessProjectPlanResponse(fullResponse);
      } else if (looksLikePlanResponse(fullResponse)) {
        fullResponse = postProcessProjectPlanResponse(fullResponse);
      }

      chatStorage.addMessage(chatId, { role: 'assistant', content: fullResponse });

      const finalChat = chatStorage.getChat(chatId);
      sendSSE('done', JSON.stringify({ chat: finalChat }));
      reply.raw.end();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      fastify.log.error({ error: errorMessage, stack: errorStack }, 'LLM stream failed');
      
      sendSSE('error', JSON.stringify({ 
        error: 'Failed to get LLM response', 
        details: errorMessage
      }));
      reply.raw.end();
    }
  });

  fastify.post('/:chatId/message', async function (request, reply) {
    const { chatId } = request.params as { chatId: string };
    const userId = request.userId;
    const { message } = request.body as SendMessageRequest;

    if (!message || typeof message !== 'string') {
      reply.status(400).send({ error: 'Message is required' });
      return;
    }

    const chat = chatStorage.getChat(chatId);
    if (!chat) {
      reply.status(404).send({ error: 'Chat not found' });
      return;
    }

    if (chat.userId !== userId) {
      reply.status(403).send({ error: 'Forbidden' });
      return;
    }

    chatStorage.addMessage(chatId, { role: 'user', content: message });

    const updatedChat = chatStorage.getChat(chatId);
    if (!updatedChat) {
      reply.status(500).send({ error: 'Failed to update chat' });
      return;
    }

    try {
      const conversation = updatedChat.messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const baseSystemPrompt = {
        role: 'system' as const,
        content: `You are a professional project planning assistant. Your job is to help users think in terms of structured, actionable plans.

APPROACH:
- Be direct and concise. Keep greetings brief (1-2 sentences max).
- First, respond conversationally in 1–3 sentences: clarify, summarise, and give 1–2 concrete suggestions.
- Always think in terms of deliverables, timelines, and outcomes, but do NOT always output a full project plan.
- If the user explicitly asks for a "project plan", "roadmap", "implementation plan" or similar, then a structured project plan is appropriate.
- If the user describes goals, challenges, or long-term outcomes (e.g. "be the best coffee shop in Kenya by 2026") but does NOT explicitly ask for a plan:
  - Give a short, insightful response (1-3 sentences).
  - Then explicitly OFFER: "If you'd like, I can turn this into a detailed project plan with workstreams and deliverables."
- IMPORTANT: Once you've offered to create a plan and the user provides information or says "ok"/"yes", STOP asking questions and generate the plan. Don't ask for more details - use what you have and make reasonable assumptions.`
      };

      const hasExplicitPlanKeyword = /project\s+plan|create\s+(?:a\s+)?plan|plan\s+for|write\s+(?:me\s+)?a\s+plan|roadmap|implementation\s+plan|transition.*business|business.*plan|show.*plan|present.*plan|need\s+a\s+plan(?:\s+(?:for|to))?|want\s+a\s+plan(?:\s+(?:for|to))?/i.test(
        message
      );
      
      const lastAssistantMessage = conversation
        .filter(m => m.role === 'assistant')
        .pop();
      const assistantOfferedPlan =
        lastAssistantMessage &&
        /turn this into a detailed project plan|generate a project plan|create a detailed project plan|turn this into a project plan/i.test(
          lastAssistantMessage.content
        );

      const userAffirmative = /\b(yes|yeah|yep|sure|sounds good|do it|go ahead|let'?s do it|okay|ok\b|alright|please|that would be great|absolutely|sounds good|go for it|create it|make it|generate it)\b/i.test(
        message.trim()
      );
      const userNegative = /\b(no|nope|nah|not now|maybe later|don'?t|do not|no thanks|no thank you)\b/i.test(
        message.trim()
      );

      const userAcceptedPlanOffer = assistantOfferedPlan && userAffirmative && !userNegative;
      
      let planGoal = message;
      if (userAcceptedPlanOffer || (hasExplicitPlanKeyword && message.toLowerCase().includes('create a project plan for:'))) {
        // First, try to extract from the message itself if it contains "Create a project plan for: ..."
        if (message.toLowerCase().includes('create a project plan for:')) {
          const match = message.match(/create a project plan for:\s*(.+)/i);
          if (match && match[1]) {
            planGoal = match[1].trim();
          } else {
            // If extraction failed, find the most recent user message (iterate backwards)
            const userMessages = conversation.filter(m => m.role === 'user');
            for (let i = userMessages.length - 1; i >= 0; i--) {
              const userMsg = userMessages[i];
              if (
                !userMsg.content.toLowerCase().includes('create a project plan') &&
                !userMsg.content.toLowerCase().includes('generate project plan') &&
                !userMsg.content.toLowerCase().startsWith('create a project plan for:')
              ) {
                planGoal = userMsg.content;
                break;
              }
            }
          }
        } else {
          // Find the most recent user message (not a plan request) - iterate backwards
          const userMessages = conversation.filter(m => m.role === 'user');
          for (let i = userMessages.length - 1; i >= 0; i--) {
            const userMsg = userMessages[i];
            if (
              !userMsg.content.toLowerCase().includes('create a project plan') &&
              !userMsg.content.toLowerCase().includes('generate project plan') &&
              !userMsg.content.toLowerCase().startsWith('create a project plan for:')
            ) {
              planGoal = userMsg.content;
              break;
            }
          }
        }
      }
      
      const isProjectPlanRequest =
        hasExplicitPlanKeyword || userAcceptedPlanOffer;
      
      if (isProjectPlanRequest) {
        conversation.unshift({
          role: 'system',
          content: `You are a professional project planning assistant. Your job is to create structured, actionable project plans quickly and directly.

🚨 CRITICAL: YOUR RESPONSE FORMAT 🚨
- You MUST provide the project plan as a JSON code block starting with \`\`\`json and ending with \`\`\`
- This is the ONLY acceptable format. NO exceptions.
- DO NOT use plain text, markdown lists, "Workstream A/B/C", or any other format.
- If you provide a plan in any format other than JSON, your response is WRONG and will not work.

APPROACH:
- Be direct and concise. Create the plan immediately based on what the user tells you.
- Infer missing details from context. Make reasonable assumptions - DO NOT ask for more information.
- If the user has already provided information (dates, budget, preferences, etc.), use it immediately to create the plan.
- DO NOT ask follow-up questions once you have enough context to create a plan.
- Keep intro text minimal (1-2 sentences max) before the plan.
- Keep outro text minimal (1-2 sentences max) after the plan.
- The user wants the plan NOW, not more questions.

FORMAT REQUIREMENT:
- Start your response with a brief intro (1-5 sentences max).
- Then immediately provide the plan in this EXACT format:
\`\`\`json
{
  "workstreams": [...]
}
\`\`\`
- That's it. The JSON block is mandatory. No plain text plans.
- End your response with a brief outro (1-5 sentences max) with a summary of the plan and a call to action for the user to review the plan and provide feedback.
INSTRUCTIONS:
1. Organize work into clear Workstreams (e.g., Market Research, Design, Operations, Development)
2. For each workstream, provide a concise description (exactly one sentence summarizing scope and objectives)
3. For each deliverable, include ONLY:
   - Title: Clear name of the deliverable (the thing that will be created/delivered)
   - Description: Describe WHAT will be delivered/created (the outcome/result), NOT what actions to take
   - CRITICAL: Deliverable descriptions must be OUTCOME-FOCUSED, not ACTION-FOCUSED
   - ✅ CORRECT examples:
     * "A formal document outlining mission, vision, and strategic objectives"
     * "A comprehensive market analysis report with competitor insights"
     * "A set of customer personas that capture key demographics and behaviors"
   - ❌ WRONG examples (these describe actions, not outcomes):
     * "Draft an enablement charter document"
     * "Research and analyze the market"
     * "Create customer personas"
   - Focus on the RESULT/OUTCOME (what exists after completion), not the process/action (what to do)
   - (Optional fields like outcome, timeline, dependencies can be added if needed, but are NOT required)

EXAMPLE OF CORRECT FORMAT (keep it simple):
\`\`\`json
{
  "workstreams": [
    {
      "title": "  Enablement Strategy & Foundation",
      "description": "Define the purpose, scope and initial structure of the enablement function, securing leadership buy-in and establishing clear success metrics",
      "deliverables": [
        {
          "title": "Enablement Chart of Responsibilities",
          "description": "A formal document outlining the mission, vision, scope, and responsibilities of the enablement function, including its mandate and key areas of focus."
        },
        {
          "title": "Success Metrics & Measurement Plan",
          "description":"Defined Key Perfomance Indicators (KPIs) for measuring team effectiveness,reduction in work overlap, and the traget 4-week new engineer productivity, along with a plan for how these will be tracked."
        },
        {
          "title": "Leadership Alignment & Sponsorship",
          "description": "Formal agreement and commitmnet from key stakeholders and leadership on the enablement initiative, 
          ensuring resources and support area llocated."        }
      ]
    },
    {
      "title": "Current State Analysis & Needs Assessment",
      "description": "A thorough analysis of the current state of the organization, including the team's structure, processes, and capabilities, along with a clear understanding of the needs and gaps in enablement support for new engineers.",
        {
          "title": "Team Structure & Organization",
          "description": "A clear documentation of the team's structure, including the number of engineers, their roles, and the overall organization of the team."
        }
      ]
    }
  ]
}
\`\`\`

NOTE: Keep the JSON structure simple. Only include title and description for deliverables. Optional fields (outcome, timeline, dependencies) can be added if you want, but they are NOT required.

DETECTION RULE:
If your response contains ANY of the following, you MUST format it as a structured project plan:
- Timelines, phases, or time-based milestones (e.g., "Week 1-2", "90-day sprint", "Q1-Q4")
- Structured frameworks, playbooks, or methodologies
- Multiple actionable steps or initiatives
- Deliverables, milestones, or outcomes
- Workstreams, tracks, or parallel work areas
- Scaling plans, growth strategies, or execution roadmaps

RULES:
1. Your response MUST include EXACTLY ONE \`\`\`json code block that contains the project plan. This is REQUIRED, not optional.
2. DO NOT provide plans as text lists, markdown, bullet points, numbered lists, or any format other than JSON.
3. DO NOT show workstreams as "Workstream A:", "Workstream B:", "1.", "2.", or any plain text format.
4. The JSON block is the PRIMARY format - ALL plan content (workstreams, deliverables) must be inside the JSON code block.
5. Outside that code block, you may add helpful explanation before and/or after (intro, summary, caveats, etc.) - but keep it minimal (1-2 sentences).
6. Break the project into workstreams (typically 3-8 workstreams, but use as many as needed to cover the scope - up to 8 or more if the project requires it).
7. Each workstream has 2-5 deliverables.
8. Use exactly one concise sentence for each workstream and deliverable description.
9. Deliverable descriptions must describe the OUTCOME (what will be created/delivered), NOT the action/process.
9. Keep deliverables simple: only title and description are required. Optional fields (outcome, timeline, dependencies) can be added if needed.
10. Use clear, professional, actionable language.
11. Do NOT include markdown formatting (like headings, lists, bold text) inside the JSON values themselves.
12. Convert any natural plan-like content (phases, playbooks, frameworks, timelines) into workstreams and deliverables in the JSON structure.

CRITICAL: Your response must ALWAYS include a valid JSON project plan inside a single \`\`\`json code block. Do not skip this or provide only text. Even if you're providing advice or frameworks, structure it as a project plan. NEVER provide plans as plain text lists, markdown, or any format other than JSON.`
        });
        
        const lastMessage = conversation[conversation.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.content = `Create a project plan for: "${planGoal}"

🚨 FORMAT REQUIREMENT: You MUST provide the plan as a JSON code block. Start with \`\`\`json, end with \`\`\`.

DO NOT:
- Provide plans as text lists, markdown, bullet points, numbered lists, or "Workstream A/B/C" format
- Show deliverables as bullet points or numbered lists outside JSON
- Use any format other than JSON

DO:
- Provide a brief intro (1-2 sentences max)
- Then immediately provide the plan in JSON format:
\`\`\`json
{
  "workstreams": [
    {
      "title": "Workstream Name",
      "description": "One well definied sentence describing this workstream.",
      "deliverables": [
        {
          "title": "Deliverable Name",
          "description": "One well definied sentence describing this deliverable."
        }
      ]
    }
  ]
}
\`\`\`

Keep it simple: Only title and description are required for deliverables. 

CRITICAL: Deliverable descriptions must describe WHAT will be created/delivered (the outcome/result), NOT what actions to take.
- ✅ CORRECT (outcome-focused): "A formal document outlining mission, vision, and strategic objectives"
- ✅ CORRECT: "A comprehensive market analysis report with competitor insights"
- ❌ WRONG (action-focused): "Draft an enablement charter" or "Create a document that..." or "Research and analyze the market"
- Focus on the RESULT (what exists after completion), not the PROCESS (what to do)

Create the plan immediately. Break into workstreams (3-8 or more) with 2-5 deliverables each. Each deliverable description must be outcome-focused.`;
        }
      } else {
        conversation.unshift(baseSystemPrompt);
      }

      const model = updatedChat.model || llmService.getAvailableModels()[0];
      const modelProvider = getProviderForModel(model);
      if (llmService.getProvider() !== modelProvider) {
        llmService.setProvider(modelProvider);
      }
      
      let response = await llmService.sendMessage(conversation, model);

      if (isProjectPlanRequest) {
        response = postProcessProjectPlanResponse(response);
      } else if (looksLikePlanResponse(response)) {
        response = postProcessProjectPlanResponse(response);
      }

      chatStorage.addMessage(chatId, { role: 'assistant', content: response });

      const finalChat = chatStorage.getChat(chatId);
      reply.send({ message: response, chat: finalChat });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      fastify.log.error({ error: errorMessage, stack: errorStack }, 'LLM request failed');
      
      reply.status(500).send({ 
        error: 'Failed to get LLM response', 
        details: errorMessage
      });
    }
  });

  fastify.patch('/:chatId', async function (request, reply) {
    const { chatId } = request.params as { chatId: string };
    const userId = request.userId;
    const updates = request.body as UpdateChatRequest;

    const chat = chatStorage.getChat(chatId);
    if (!chat) {
      reply.status(404).send({ error: 'Chat not found' });
      return;
    }

    if (chat.userId !== userId) {
      reply.status(403).send({ error: 'Forbidden' });
      return;
    }

    const updated = chatStorage.updateChat(chatId, updates);
    reply.send(updated);
  });

  fastify.get('/llm/models', async function (request, reply) {
    const geminiAdapter = new GeminiAdapter();
    const openaiAdapter = new OpenAIAdapter();
    const groqAdapter = new GroqAdapter();
    
    const allModels = [
      ...geminiAdapter.getAvailableModels().map(m => ({ name: m, provider: 'gemini' as const })),
      ...openaiAdapter.getAvailableModels().map(m => ({ name: m, provider: 'openai' as const })),
      ...groqAdapter.getAvailableModels().map(m => ({ name: m, provider: 'groq' as const })),
    ];
    
    reply.send({ 
      models: allModels.map(m => m.name),
      modelsWithProvider: allModels
    });
  });

  fastify.post('/generate/project-plan', async function (request, reply) {
    try {
      const body = request.body as {
        provider: LLMProvider;
        model?: string;
        userPrompt: string;
      };

      const { provider, model, userPrompt } = body;

      if (!provider || !userPrompt) {
        return reply.code(400).send({
          error: 'Missing provider or userPrompt',
        });
      }

      const adapter = getProviderInstance(provider);

      const messages: BaseMessage[] = [
        { role: 'system', content: TEKKR_PROJECT_PLAN_PROMPT },
        {
          role: 'user',
          content: `Create a project plan for the following request:\n${userPrompt}`,
        },
      ];

      const raw = await adapter.sendMessage(messages, model);

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        fastify.log.error({ raw }, 'LLM returned non-JSON for TEKKR project plan');
        throw new Error('LLM did not return valid JSON');
      }

      return reply.send({
        id: `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        provider,
        model,
        createdAt: new Date().toISOString(),
        plan: parsed,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Error generating TEKKR project plan');
      return reply.code(500).send({
        error: error.message || 'Internal Server Error',
      });
    }
  });
};

export default chat;
