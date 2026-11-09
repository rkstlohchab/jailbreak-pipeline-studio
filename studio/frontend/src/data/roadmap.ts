import roadmap from "../../../data/knowledge/roadmap.json";

export type RoadmapLearnItem = { topic: string; detail: string };
export type RoadmapPractice = { task: string; how: string; validate: string };
export type RoadmapLink = { title?: string; name?: string; label?: string; channel?: string; author?: string; authors?: string; url?: string; href?: string; note?: string; duration?: string };

export type RoadmapResources = {
  videos: RoadmapLink[];
  papers: RoadmapLink[];
  repos: RoadmapLink[];
  courses: RoadmapLink[];
  app_links: RoadmapLink[];
};

export type RoadmapPrompt = { title: string; purpose: string; text: string };

export type RoadmapPhase = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  duration: string;
  status: "known" | "current" | "next" | "optional";
  overview: string;
  learn: RoadmapLearnItem[];
  practice: RoadmapPractice[];
  resources: RoadmapResources;
  prompts: RoadmapPrompt[];
};

export type FreeComputeTier = {
  id: string;
  provider: string;
  tier: string;
  gpu: string;
  vram: string;
  quota: string;
  best_for: string;
  url: string;
  caveat: string;
};

export type RoadmapData = {
  title: string;
  subtitle: string;
  overview: string;
  note: string;
  author_status: { known_through_phase: number; practice_gap: string; no_gpu: boolean };
  free_compute: FreeComputeTier[];
  phases: RoadmapPhase[];
  fastest_path: { title: string; subtitle: string; steps: { day: string; task: string; output: string }[]; note: string };
  cross_links: { title: string; entries: { label: string; href: string; note: string }[] };
};

export const ROADMAP = roadmap as RoadmapData;
export const PHASE_IDS = ROADMAP.phases.map((p) => p.id);
