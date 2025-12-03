import { MessageContentBlock, ProjectPlan } from '../types';

export function parseProjectPlan(content: string): ProjectPlan | null {
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  const matches = Array.from(content.matchAll(jsonBlockRegex));

  for (const match of matches) {
    try {
      const jsonStr = match[1];
      const parsed = JSON.parse(jsonStr) as ProjectPlan;
      
      if (parsed && Array.isArray(parsed.workstreams)) {
        const isValid = parsed.workstreams.every(ws => 
          typeof ws.title === 'string' &&
          typeof ws.description === 'string' &&
          Array.isArray(ws.deliverables) &&
          ws.deliverables.every(d => 
            typeof d.title === 'string' &&
            typeof d.description === 'string' &&
            (d.outcome === undefined || d.outcome === null || typeof d.outcome === 'string') &&
            (d.timeline === undefined || d.timeline === null || typeof d.timeline === 'string') &&
            (d.dependencies === undefined || d.dependencies === null || typeof d.dependencies === 'string')
          )
        );
        
        if (isValid) {
          return parsed;
        }
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

export function extractProjectPlanBlocks(content: string): MessageContentBlock[] {
  const blocks: Array<{ type: 'text' | 'plan'; content: string | ProjectPlan; start: number; end: number }> = [];
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  
  let lastIndex = 0;
  let match;

  while ((match = jsonBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
        start: lastIndex,
        end: match.index,
      });
    }

    const plan = parseProjectPlan(match[0]);
    if (plan) {
      blocks.push({
        type: 'plan',
        content: plan,
        start: match.index,
        end: match.index + match[0].length,
      });
    } else {
      blocks.push({
        type: 'text',
        content: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: 'text',
      content: content.substring(lastIndex),
      start: lastIndex,
      end: content.length,
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      type: 'text',
      content: content,
      start: 0,
      end: content.length,
    });
  }

  return blocks;
}

