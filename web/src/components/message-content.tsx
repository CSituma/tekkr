import React from 'react';
import ReactMarkdown from 'react-markdown';
import { extractProjectPlanBlocks } from '../utils/project-plan-parser';
import { ProjectPlanPreview } from './project-plan-preview';
import { ProjectPlan } from '../types';

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  const blocks = extractProjectPlanBlocks(content);

  return (
    <div className="break-words">
      {blocks.map((block, index) => {
        if (block.type === 'plan') {
          return (
            <React.Fragment key={index}>
              <ProjectPlanPreview plan={block.content as ProjectPlan} />
            </React.Fragment>
          );
        }
        const textContent = (block.content as string).trim();
        if (!textContent) {
          return null;
        }
        return (
          <ReactMarkdown
            key={index}
            components={{
              p: ({ node, ...props }) => (
                <p className="mb-2 text-sm text-foreground" {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-semibold" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="mb-2 ml-5 list-decimal text-sm text-foreground" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="mb-2 ml-5 list-disc text-sm text-foreground" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="mb-1" {...props} />
              ),
            }}
          >
            {textContent}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

