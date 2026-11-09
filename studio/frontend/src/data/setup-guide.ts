import guide from "../../../data/knowledge/setup-guide.json";

export type SetupStep = {
  id: string;
  title: string;
  detail: string;
  commands: string[];
  verify?: string;
  action_label?: string;
  action_url?: string;
  subtasks?: string[];
};

export type SetupGuide = {
  title: string;
  subtitle: string;
  whats_needed: { label: string; note: string }[];
  steps: SetupStep[];
  troubleshooting: { q: string; a: string }[];
  next_steps: { label: string; note: string }[];
};

export const SETUP_GUIDE = guide as SetupGuide;
export const SETUP_STEP_IDS = SETUP_GUIDE.steps.map((s) => s.id);
