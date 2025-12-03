/**
 * Project Plan types
 */

export interface Deliverable {
  title: string;
  description: string;
  outcome?: string; // Measurable outcome/KPI
  timeline?: string; // Dates or duration
  dependencies?: string; // Other tasks/workstreams this depends on
}

export interface Workstream {
  title: string;
  description: string;
  deliverables: Deliverable[];
}

export interface ProjectPlan {
  workstreams: Workstream[];
}

export interface MessageContentBlock {
  type: 'text' | 'plan';
  content: string | ProjectPlan;
  start: number;
  end: number;
}

