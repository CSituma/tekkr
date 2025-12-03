import React from 'react';
import { ProjectPlan } from '../types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDownIcon, ChevronUpIcon, FileText, Binoculars, Megaphone } from 'lucide-react';

interface ProjectPlanPreviewProps {
  plan: ProjectPlan;
}

export function ProjectPlanPreview({ plan }: ProjectPlanPreviewProps) {
  return (
    <div className="my-4 rounded-lg border border-border/0.2 bg-white p-5 text-slate-900 dark:text-slate-900">
      <h3 className="text-lg font-semibold mb-4">Project Workstreams</h3>
      <div className='rounded-lg border border-border/0.3 bg-white shadow-sm'>
        {plan.workstreams.map((workstream, wsIndex) => (
          <WorkstreamItem 
            key={wsIndex} 
            workstream={workstream} 
            letter={String.fromCharCode(65 + wsIndex)} // A, B, C, D...
            isDefaultOpen={wsIndex === 0} // First workstream open by default
          />
        ))}
      </div>
    </div>
  );
}

function WorkstreamItem({ 
  workstream, 
  letter,
  isDefaultOpen = false
}: { 
  workstream: { 
    title: string; 
    description: string; 
    deliverables: Array<{ 
      title: string; 
      description: string;
      outcome?: string;
      timeline?: string;
      dependencies?: string;
    }> 
  };
  letter: string;
  isDefaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(isDefaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className=" border-b border-border/0.1 "
      >
        <CollapsibleTrigger className="w-full px-4 py-4 gap-4  flex items-center hover:bg-accent/50 transition-colors rounded-lg">
          {/* Letter label */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
            {letter}
          </div>

          {/* Title (starts to the right of the letter) */}
          <div className="flex-1 text-left">
          <h4 className="font-semibold text-base text-slate-900 dark:text-slate-900">
            {workstream.title}
          </h4>
            {!isOpen && (
            <p className="text-sm text-slate-600 dark:text-slate-600 mt-1 line-clamp-1">
                {workstream.description}
              </p>
            )}
          </div>

          {/* Chevron icon */}
          {isOpen ? (
            <ChevronUpIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
        </CollapsibleTrigger>

        {/* Everything inside the open state is indented to align under the title (after the letter) */}
        <CollapsibleContent className="px-4 pb-4">
          <div className="pl-12">
            {/* Description */}
            <p className="text-sm text-slate-600 dark:text-slate-600 mb-4 mt-3 leading-relaxed">
              {workstream.description}
            </p>
            
          {/* Deliverables section */}
          {workstream.deliverables.length > 0 && (
              <div className="mt-3 pt-1 border-t border-border/0.2">
                {/* Small gap between line and heading */}
                <div className="mt-3">
                  <h5 className="text-base font-semibold mb-3 text-slate-900 dark:text-slate-900">
                    Deliverables
                  </h5>
                  <div className="space-y-2">
                    {workstream.deliverables.map((deliverable, dIndex) => (
                      <DeliverableItem key={dIndex} deliverable={deliverable} index={dIndex} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DeliverableItem({ 
  deliverable, 
  index,
}: { 
  deliverable: { 
    title: string; 
    description: string;
    outcome?: string;
    timeline?: string;
    dependencies?: string;
  };
  index: number;
}) {
  const icons = [FileText, Binoculars, Megaphone];
  const Icon = icons[index % icons.length];

  return (
    <div className="py-1 grid grid-cols-[auto,1fr] gap-x-3">
      <div className="mt-0.5 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="col-start-2">
        <h6 className="font-semibold text-sm text-foreground">{deliverable.title}</h6>
      </div>
      {/* Description aligned with icon (starts under icon, spans across) */}
      <div className="col-span-2 mt-1">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {deliverable.description}
        </p>
      </div>
    </div>
  );
}

